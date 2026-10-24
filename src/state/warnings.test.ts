import { describe, expect, it } from 'vitest';
import {
  CAVITATION_FLUTTER_DISCHARGE_KPA,
  PUMP_TEMP_ALARM_C,
  PUMP_TEMP_CAUTION_C,
} from '../sim/constants';
import { APPLIANCES } from '../sim/appliances/catalogue';
import { primerControlId } from '../sim/appliances/controls';
import { TEST_APPLIANCE } from '../sim/appliances/testAppliance';
import { getScenario } from '../sim/scenarios';
import { inputsWith, primedState, run, suctionInletOf } from '../sim/testUtils';
import type { ApplianceSpec, PlayerInputs, SimState, TruckState } from '../sim/types';
import { activeTruck, instrumentValue } from './selectors';
import { CHECK_SUCTION_S, primerStatus, supplyLays } from './supply';
import { HAMMER_LAMP_S, selectWarnings } from './warnings';

const ALL: readonly ApplianceSpec[] = [...APPLIANCES, TEST_APPLIANCE];

const lamp = (sim: SimState, inputs: PlayerInputs, id: string) =>
  selectWarnings(sim, inputs).find((w) => w.id === id);

const patchTruck = (sim: SimState, patch: (t: TruckState) => TruckState): SimState => ({
  ...sim,
  trucks: sim.trucks.map(patch),
});

describe.each(ALL.map((spec) => [spec.id, spec] as const))('M4 warnings: %s', (_id, spec) => {
  const draught = getScenario('draughting').build(spec).state;
  const hydrant = getScenario('hydrant-supply').build(spec).state;
  const suction = suctionInletOf(spec);
  const deliveries = draught.lines.map((l) => l.deliveryId);
  const allOpen = inputsWith(1, [suction, ...deliveries]);

  it('says the suction isn’t primed when a delivery is open on an unprimed draught', () => {
    const w = lamp(draught, allOpen, 'supply');
    expect(w?.level).toBe('caution');
    expect(w?.message).toMatch(/primed/i);
  });

  it('lights the cavitation lamp with a lift message when a draught is pushed too hard', () => {
    const s = run(primedState(draught), allOpen, 100);
    const w = lamp(s, allOpen, 'cavitation');
    expect(w?.level).not.toBe('off');
    expect(w?.message).toMatch(/lift/);
    expect(w?.message).toMatch(/throttle/);
  });

  it('calls a hydrant over-run by name', () => {
    const s = run(hydrant, allOpen, 100);
    expect(lamp(s, allOpen, 'cavitation')?.message).toMatch(/hydrant/i);
  });

  it('raises a lost-prime alarm when the dam is empty', () => {
    const empty: SimState = {
      ...draught,
      sources: draught.sources.map((x) => (x.kind === 'static' ? { ...x, volumeL: 0 } : x)),
    };
    expect(lamp(empty, allOpen, 'supply')).toMatchObject({ level: 'alarm' });
  });

  it('says layflat can’t draught when the dam is on soft hose', () => {
    const soft: SimState = {
      ...draught,
      supplies: draught.supplies.map((x) => ({ ...x, segments: [{ hose: '65L', lengthM: 6 }] })),
    };
    const w = lamp(soft, allOpen, 'supply');
    expect(w?.level).toBe('caution');
    expect(w?.message).toMatch(/hard suction/i);
  });

  it('lights the temperature lamp amber then red as the casing heats', () => {
    const at = (tempC: number) =>
      lamp(
        patchTruck(draught, (t) => ({ ...t, pump: { ...t.pump, tempC } })),
        allOpen,
        'overheat',
      )?.level;
    expect(at(PUMP_TEMP_CAUTION_C - 1)).toBe('off');
    expect(at(PUMP_TEMP_CAUTION_C)).toBe('caution');
    expect(at(PUMP_TEMP_ALARM_C)).toBe('alarm');
  });

  it('latches the hammer lamp for a few seconds after a water hammer', () => {
    const delivery = spec.deliveries[0]?.id ?? '';
    const hit = patchTruck(draught, (t) => ({
      ...t,
      lastHammer: { atS: draught.timeS, deliveryId: delivery, surgeKpa: 800 },
    }));
    expect(lamp(hit, allOpen, 'hammer')?.level).toBe('caution');
    expect(lamp(hit, allOpen, 'hammer')?.message).toContain(spec.deliveries[0]?.label ?? '');
    const later = { ...hit, timeS: hit.timeS + HAMMER_LAMP_S };
    expect(lamp(later, allOpen, 'hammer')?.level).toBe('off');
  });

  it('draws the hard suction dry until primed, then primed; the hydrant layflat soft when over-run', () => {
    const shut = inputsWith(0, []);
    expect(supplyLays(draught, shut).map((s) => s.state)).toEqual(['dry']);
    expect(supplyLays(primedState(draught), shut).map((s) => s.state)).toEqual(['primed']);
    const some = inputsWith(0.3, [suction]);
    expect(supplyLays(run(hydrant, some, 20), some)[0]?.state).toBe('charged');
    expect(supplyLays(run(hydrant, allOpen, 50), allOpen)[0]?.state).toBe('soft');
  });

  it('reads the inlet valve from the inputs the player holds, like the lamps do', () => {
    // The truck's own copy is last tick's; the player has just opened the inlet.
    const opened = inputsWith(0, [suction]);
    expect(supplyLays(hydrant, opened)[0]?.open).toBe(true);
    expect(supplyLays(hydrant, inputsWith(0, []))[0]?.open).toBe(false);
  });

  it('adds flutter to the pressure gauges only while cavitating', () => {
    const calm = activeTruck(
      run(primedState(draught), inputsWith(0.3, [suction, ...deliveries]), 50),
    );
    expect(instrumentValue(calm, 'discharge')).toBe(calm.readings.dischargeKpa);
    const rough = activeTruck(run(primedState(draught), allOpen, 50));
    const shake = Math.abs(instrumentValue(rough, 'discharge') - rough.readings.dischargeKpa);
    expect(shake).toBeLessThanOrEqual(CAVITATION_FLUTTER_DISCHARGE_KPA);
  });
});

describe('primer status', () => {
  const spec = APPLIANCES[0] ?? TEST_APPLIANCE;
  const id = primerControlId(spec) ?? 'primer';
  const draught = getScenario('draughting').build(spec).state;
  const held = inputsWith(0, [suctionInletOf(spec)], [id]);

  it('runs with the ring filling, warns to check the suction after 30 s, then shows primed', () => {
    expect(primerStatus(draught, inputsWith(0, []), id).state).toBe('idle');
    const s = run(draught, held, 30);
    expect(primerStatus(s, held, id).state).toBe('running');
    expect(primerStatus(s, held, id).progress).toBeGreaterThan(0);
    const stuck = patchTruck(s, (t) => ({
      ...t,
      pump: { ...t.pump, primerRunS: CHECK_SUCTION_S },
    }));
    expect(primerStatus(stuck, held, id).state).toBe('check-suction');
    expect(primerStatus(primedState(s), held, id)).toEqual({ state: 'primed', progress: 1 });
  });

  it('shows the cut-out', () => {
    const cut = patchTruck(draught, (t) => ({ ...t, pump: { ...t.pump, primerCutOut: true } }));
    expect(primerStatus(cut, held, id).state).toBe('cut-out');
  });
});
