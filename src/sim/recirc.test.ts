// Tank recirculation: a fixed bleed from the discharge back into the tank, as
// the Cat 7's 3-way valve set to TANK RECIRC (Resources/Photos/Cat7_Hydraulic_Diagram.jpg). It
// always flows while the pump has water, so a pump with no relief can churn without cooking.
import { describe, expect, it } from 'vitest';
import { controlIds } from './appliances/controls';
import { PUMP_TEMP_CAUTION_C, TICK_S } from './constants';
import { createInitialState } from './engine';
import { draughtSite, inputsWith, layLine, run, truckOf, TEST_STARTING } from './testUtils';
import type { ApplianceSpec, SimState } from './types';

/** 30 L/min at 700 kPa. */
const RECIRC_K = 700 / 30 ** 2;

// Inline spec so these tests don't move when an appliance's placeholders are re-tuned.
const SPEC: ApplianceSpec = {
  id: 'recirc-test',
  name: 'Recirculation test',
  pump: {
    shutoffKpa: 1300,
    droopKpaPerLpm2: 3.75e-3,
    cavitationInletKpa: -84,
    casingVolumeL: 4,
    churnKw: 5,
  },
  engine: { idleRpm: 1200, maxRpm: 3600, rpmLagS: 0.4, cylinders: 1, ...TEST_STARTING },
  tank: { capacityL: 1500, headM: 0 },
  inlets: [
    { id: 'tank', label: 'Tank', kind: 'tank', lossKpaPerLpm2: 4e-5 },
    { id: 'suction', label: 'Suction', kind: 'suction', sizeMm: 65, lossKpaPerLpm2: 5e-5 },
  ],
  deliveries: [{ id: 'a', label: 'A', sizeMm: 38 }],
  recirc: { sizeMm: 15, lossKpaPerLpm2: RECIRC_K },
  primer: { kind: 'diaphragm', id: 'primer', maxVacuumKpa: 75, displacementLps: 0.6 },
  instruments: [],
};

const bare = (): ApplianceSpec => {
  const spec = { ...SPEC };
  delete spec.recirc;
  return spec;
};

const withTank = (state: SimState, tankL: number): SimState => ({
  ...state,
  trucks: state.trucks.map((t) => ({ ...t, tankL })),
});

describe('tank recirculation', () => {
  it('is not a control: it always flows', () => {
    expect(controlIds(SPEC)).toEqual(controlIds(bare()));
  });

  it('flows Q = √(P_d / k) with every delivery shut, drawn through the inlets', () => {
    for (const throttle of [0.3, 1]) {
      const t = truckOf(run(createInitialState(SPEC), inputsWith(throttle, ['tank']), 30));
      const q = t.readings.recircLpm;
      expect(q).toBeGreaterThan(10);
      expect(q).toBeCloseTo(Math.sqrt(t.readings.dischargeKpa / RECIRC_K), 6);
      expect(t.readings.inletFlowLpm.tank).toBeCloseTo(q, 6);
      expect(t.readings.pumpFlowLpm).toBeCloseTo(q, 6);
    }
  });

  it('adds to the deliveries rather than replacing them', () => {
    const lines = [layLine('a', '38L', 3, 15)];
    const t = truckOf(run(createInitialState(SPEC, lines), inputsWith(0.7, ['tank', 'a']), 30));
    const q = t.readings.recircLpm;
    expect(q).toBeGreaterThan(10);
    expect(t.readings.pumpFlowLpm).toBeCloseTo((t.readings.deliveryFlowLpm.a ?? 0) + q, 6);
  });

  it('goes round through the tank on tank supply: the level holds', () => {
    const t = truckOf(run(createInitialState(SPEC), inputsWith(1, ['tank']), 600));
    expect(t.readings.recircLpm).toBeGreaterThan(10);
    expect(t.tankL).toBeCloseTo(1500, 6);
  });

  it('fills the tank while draughting, at the recirculation flow', () => {
    const start = withTank(createInitialState(SPEC, [], draughtSite(SPEC, 2)), 500);
    let s = start;
    for (let i = 0; i < 1200 && !truckOf(s).pump.primed; i++) {
      s = run(s, inputsWith(0, ['suction'], ['primer']), 1);
    }
    expect(truckOf(s).pump.primed).toBe(true);
    s = run(s, inputsWith(0.8, ['suction']), 50);
    const before = truckOf(s);
    const after = truckOf(run(s, inputsWith(0.8, ['suction']), 600));
    expect(before.readings.recircLpm).toBeGreaterThan(10);
    expect(after.tankL - before.tankL).toBeCloseTo(before.readings.recircLpm, 0); // 60 s
  });

  it('keeps a pump with no relief cool while it churns; without it the pump overheats', () => {
    const tenMin = Math.round(600 / TICK_S);
    const churn = (spec: ApplianceSpec) =>
      truckOf(run(createInitialState(spec), inputsWith(1, ['tank']), tenMin)).pump.tempC;
    expect(churn(SPEC)).toBeLessThan(PUMP_TEMP_CAUTION_C);
    expect(churn(bare())).toBeGreaterThan(PUMP_TEMP_CAUTION_C);
  });

  it('lets no air in: behind its check valve, the primer still catches', () => {
    const t = truckOf(
      run(
        createInitialState(SPEC, [], draughtSite(SPEC, 3)),
        inputsWith(0, ['suction'], ['primer']),
        900,
      ),
    );
    expect(t.pump.primed).toBe(true);
  });

  it('flows nothing from a dry pump', () => {
    const t = truckOf(run(createInitialState(SPEC), inputsWith(1, []), 30));
    expect(t.readings.recircLpm).toBe(0);
    expect(t.readings.pumpFlowLpm).toBe(0);
  });

  it('is absent from a spec without one', () => {
    const t = truckOf(run(createInitialState(bare()), inputsWith(1, ['tank']), 30));
    expect(t.readings.recircLpm).toBe(0);
    expect(t.readings.pumpFlowLpm).toBe(0);
  });
});
