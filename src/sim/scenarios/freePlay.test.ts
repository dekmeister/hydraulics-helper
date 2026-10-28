// Free play's sandbox fireground: two cold trucks, a dam, a hydrant, a closed relay, crews and a
// monitor, laid to fit any appliance, and heavy enough to break things.
import { describe, expect, it } from 'vitest';
import { TEST_APPLIANCE } from '../appliances/testAppliance';
import { inletOfKind } from '../appliances/controls';
import { warmStart } from '../engine';
import { hoseType } from '../hose';
import { run, truck } from '../testUtils';
import type { ApplianceSpec, PlayerInputs, SimState } from '../types';
import { FREE_PLAY } from './freePlay';
import { eligibleAppliances } from './index';
import { ATTACK_ID, BASE_ID } from './relayTrucks';

const SPECS = eligibleAppliances(FREE_PLAY, [...eligibleAppliances(FREE_PLAY), TEST_APPLIANCE]);

/** Every one of `ids` fully open, at `throttle`. */
function open(throttle: number, ids: readonly string[]): PlayerInputs {
  return { throttle, valves: Object.fromEntries(ids.map((id) => [id, 1])), switches: {} };
}

/**
 * `state` with both engines running and the base pump primed at the dam, pumping into the relay at
 * full throttle: the base crew's work done, so a test can lean on the attack pump.
 */
function relayRunning(state: SimState, spec: ApplianceSpec): SimState {
  const warm = warmStart(state);
  const relay = warm.links[0];
  if (relay === undefined) throw new Error('free play has no relay');
  return {
    ...warm,
    trucks: warm.trucks.map((t) =>
      t.id !== BASE_ID
        ? t
        : {
            ...t,
            pump: { ...t.pump, primed: true },
            inputs: open(1, [inletOfKind(spec, 'suction', 'test'), relay.deliveryId]),
          },
    ),
  };
}

describe.each(SPECS.map((s) => [s.id, s] as const))('free play on %s', (_id, spec) => {
  const { state } = FREE_PLAY.build(spec);

  it('has no lesson: two cold trucks, the attack pump active, the base pump unprimed', () => {
    expect(FREE_PLAY.lesson).toBeUndefined();
    expect(state.activeTruckId).toBe(ATTACK_ID);
    expect(state.trucks.map((t) => t.id)).toEqual([ATTACK_ID, BASE_ID]);
    for (const t of state.trucks) expect(t.engine.running).toBe(false);
    expect(truck(state, BASE_ID).pump.primed).toBe(false);
  });

  it('gives the base pump a dam, a hydrant on hydrant to tank, and a relay up to the attack pump', () => {
    expect(state.sources.map((s) => s.kind).sort()).toEqual(['hydrant', 'static']);
    expect(state.supplies.every((s) => s.truckId === BASE_ID)).toBe(true);
    const relay = state.links[0];
    expect(relay?.truckId).toBe(BASE_ID);
    expect(relay?.to).toEqual({
      kind: 'inlet',
      truckId: ATTACK_ID,
      inletId: inletOfKind(spec, 'suction', 'test'),
    });
  });

  it('puts a line on every delivery the trucks have free, up to three on the attack pump', () => {
    const on = (id: string) => state.lines.filter((l) => l.truckId === id).length;
    expect(on(ATTACK_ID)).toBe(Math.min(3, spec.deliveries.length));
    expect(on(BASE_ID)).toBe(1);
  });

  it('lays a monitor only where a delivery is as big as its hose', () => {
    const monitor = state.lines.find((l) => l.branch.kind === 'monitor');
    const big = spec.deliveries.some((d) => d.sizeMm >= 65);
    expect(monitor !== undefined).toBe(big);
    if (monitor !== undefined) {
      const delivery = spec.deliveries.find((d) => d.id === monitor.deliveryId);
      expect(delivery?.sizeMm).toBeGreaterThanOrEqual(hoseType('65L').sizeMm);
    }
  });

  // The point of the monitor: everything opened up at full throttle over-runs the relay or
  // cavitates a pump, which a lesson's bush lines never can. (No monitor, no over-run: see BACKLOG.)
  const hasMonitor = state.lines.some((l) => l.branch.kind === 'monitor');
  it.skipIf(!hasMonitor)(
    'can be broken: the monitor open at full throttle over-runs the relay',
    () => {
      const s0 = relayRunning(state, spec);
      const lines = s0.lines.filter((l) => l.truckId === ATTACK_ID).map((l) => l.deliveryId);
      const s = run(s0, open(1, [inletOfKind(spec, 'suction', 'test'), ...lines]), 900);
      const over =
        Object.values(s.linkReadings).some((r) => r.collapsed) ||
        s.trucks.some((t) => t.readings.cavitation > 0) ||
        s.links.some((l) => l.burst !== undefined);
      expect(over).toBe(true);
    },
  );
});
