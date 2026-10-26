import { describe, expect, it } from 'vitest';
import { CAT1 } from '../appliances/cat1';
import { TEST_APPLIANCE } from '../appliances/testAppliance';
import { isRigid } from '../hose';
import { eligibleAppliances, getScenario, scenarioTraceCsv, SCENARIOS } from './index';
import { APPLIANCES } from '../appliances/catalogue';
import { loadScenario } from './load';
import { missingRequirements, supports, supportsLesson } from './types';
import type { ApplianceSpec } from '../types';

// Golden traces (docs/TESTING.md §2, layer 3). If one changes, explain the numeric diff before
// updating it; never update a trace to make a calibration test pass.
describe.each(SCENARIOS.map((s) => [s.id, s] as const))('scenario %s', (_id, scenario) => {
  const specs = eligibleAppliances(scenario, [...eligibleAppliances(scenario), TEST_APPLIANCE]);

  it('is playable on at least one registered appliance', () => {
    expect(eligibleAppliances(scenario).length).toBeGreaterThan(0);
  });

  // The UI draws one lay per delivery (selectors `lineOnDelivery`, scene and panel rows), so a
  // scenario may not put two lines on one delivery, nor a line on a delivery the truck lacks.
  it.each(specs.map((spec) => [spec.id, spec] as const))(
    'lays at most one line per delivery, each on a spec delivery, on %s',
    (_specId, spec) => {
      const { lines } = scenario.build(spec).state;
      const used = lines.map((l) => `${l.truckId}/${l.deliveryId}`);
      expect(new Set(used).size).toBe(used.length);
      const deliveryIds = spec.deliveries.map((d) => d.id);
      for (const l of lines) expect(deliveryIds).toContain(l.deliveryId);
    },
  );

  // Issue #19: the player starts every job from cold; support trucks are already running.
  it.each(specs.map((spec) => [spec.id, spec] as const))(
    'starts the player’s engine cold and its script starts it, on %s',
    (_specId, spec) => {
      const { state, script } = scenario.build(spec);
      for (const truck of state.trucks) {
        const player = truck.id === state.activeTruckId;
        expect(truck.engine.running).toBe(!player);
        expect(truck.rpm).toBe(player ? 0 : truck.spec.engine.idleRpm);
      }
      // A script that works the pump (anything but the tank-fill inlet) starts it first.
      const { ignition, start } = spec.engine.controls;
      const pumps = script.some(
        (step) =>
          step.throttle !== undefined ||
          Object.keys(step.valves ?? {}).some(
            (id) => spec.inlets.find((i) => i.id === id)?.kind !== 'tankFill',
          ),
      );
      if (pumps) {
        expect(script).toContainEqual(
          expect.objectContaining({ switches: { [ignition]: true, [start]: true } }),
        );
      }
    },
  );

  // Supplies join a real source to an external inlet; draughting needs hose that holds a vacuum.
  it.each(specs.map((spec) => [spec.id, spec] as const))(
    'connects supplies to external inlets, over hard suction for static water, on %s',
    (_specId, spec) => {
      const { sources, supplies, trucks } = scenario.build(spec).state;
      for (const supply of supplies) {
        const truck = trucks.find((t) => t.id === supply.truckId);
        const suction = truck?.spec.inlets.filter((i) => i.kind !== 'tank').map((i) => i.id);
        expect(suction).toContain(supply.inletId);
        const source = sources.find((x) => x.id === supply.sourceId);
        expect(source).toBeDefined();
        if (source?.kind === 'static') expect(isRigid(supply.segments)).toBe(true);
      }
    },
  );

  it.each(specs.map((spec) => [spec.id, spec] as const))('golden trace on %s', async (id, spec) => {
    await expect(scenarioTraceCsv(scenario, spec)).toMatchFileSnapshot(
      `__traces__/${scenario.id}.${id}.csv`,
    );
  });
});

// Relay scenarios mix appliances: each support role on another spec than the player's.
describe.each(SCENARIOS.filter((s) => (s.support ?? []).length > 0).map((s) => [s.id, s] as const))(
  'scenario %s with mixed appliances',
  (_id, scenario) => {
    const pairs = [
      [CAT1, TEST_APPLIANCE],
      [TEST_APPLIANCE, CAT1],
    ] as const;
    it.each(pairs.map(([p, o]) => [`${p.id}+${o.id}`, p, o] as const))(
      'golden trace on %s',
      async (name, player, other) => {
        const support = Object.fromEntries((scenario.support ?? []).map((r) => [r.id, other]));
        expect(supports(scenario, player, support)).toBe(true);
        const { trucks } = scenario.build(player, support).state;
        expect(trucks.map((t) => t.spec.id).sort()).toEqual([player.id, other.id].sort());
        await expect(scenarioTraceCsv(scenario, player, support)).toMatchFileSnapshot(
          `__traces__/${scenario.id}.${name}.csv`,
        );
      },
    );
  },
);

describe('scenario capabilities', () => {
  const noSuction = {
    ...TEST_APPLIANCE,
    inlets: TEST_APPLIANCE.inlets.filter((i) => i.kind === 'tank'),
  };
  const noPrimer: ApplianceSpec = { ...TEST_APPLIANCE };
  delete noPrimer.primer;

  it('a supply scenario needs a suction inlet', () => {
    expect(supports(getScenario('hydrant-supply'), noSuction)).toBe(false);
    expect(supports(getScenario('hydrant-supply'), TEST_APPLIANCE)).toBe(true);
  });

  it('a relay scenario checks its support trucks too', () => {
    const relay = getScenario('closed-relay');
    expect(supports(relay, TEST_APPLIANCE)).toBe(true);
    expect(supports(relay, TEST_APPLIANCE, { base: noSuction })).toBe(false);
    expect(supports(relay, noSuction, { base: TEST_APPLIANCE })).toBe(false);
  });

  it('draughting also needs a way to prime', () => {
    expect(supports(getScenario('draughting'), noPrimer)).toBe(false);
    expect(supports(getScenario('draughting'), TEST_APPLIANCE)).toBe(true);
  });

  it('names what is missing, in words', () => {
    const bare: ApplianceSpec = { ...noSuction, deliveries: noSuction.deliveries.slice(0, 1) };
    expect(missingRequirements(getScenario('draughting'), bare)).toEqual([
      'a suction inlet',
      '2 deliveries',
    ]);
    for (const s of SCENARIOS)
      expect(missingRequirements(s, TEST_APPLIANCE).length === 0).toBe(supports(s, TEST_APPLIANCE));
  });

  it('a lesson also needs the gauges it asks the player to read; free play doesn’t', () => {
    // The test appliance has no compound gauge: its hydrant fireground plays, the lesson doesn't.
    const hydrant = getScenario('hydrant-supply');
    expect(supports(hydrant, TEST_APPLIANCE)).toBe(true);
    expect(supportsLesson(hydrant, TEST_APPLIANCE)).toBe(false);
    expect(missingRequirements(hydrant, TEST_APPLIANCE, {}, true)).toEqual(['a compound gauge']);
    expect(() => loadScenario(hydrant, TEST_APPLIANCE)).toThrow(/a compound gauge/);
    for (const spec of APPLIANCES) expect(supportsLesson(hydrant, spec)).toBe(true);
  });
});
