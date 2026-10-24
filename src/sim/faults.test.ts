// Churn overheat, water hammer and gauge flutter (ARCHITECTURE §4.6).
import { describe, expect, it } from 'vitest';
import {
  AMBIENT_C,
  PUMP_TEMP_ALARM_C,
  PUMP_TEMP_CAUTION_C,
  WATER_HAMMER_SURGE_KPA,
} from './constants';
import { createInitialState } from './engine';
import { surgeKpa } from './hammer';
import { draughtSite, inputsWith, layLine, primedState, run, truckOf } from './testUtils';
import { stepTempC } from './thermal';
import type { ApplianceSpec, PlayerInputs, SimState } from './types';

const SPEC: ApplianceSpec = {
  id: 'fault-test',
  name: 'Fault test',
  pump: {
    shutoffKpa: 1400,
    droopKpaPerLpm2: 4e-4,
    cavitationInletKpa: -84,
    casingVolumeL: 10,
    churnKw: 10,
  },
  engine: { idleRpm: 800, maxRpm: 3000, rpmLagS: 0.5 },
  tank: { capacityL: 3000 },
  inlets: [
    { id: 'tank', label: 'Tank', kind: 'tank', lossKpaPerLpm2: 15e-6 },
    { id: 'suction', label: 'Suction', kind: 'suction', sizeMm: 64, lossKpaPerLpm2: 10e-6 },
  ],
  deliveries: [
    { id: 'a', label: 'A', sizeMm: 38 },
    { id: 'b', label: 'B', sizeMm: 64 },
  ],
  instruments: [],
};
const LINES = [layLine('a', '38L', 3, 15), layLine('b', '65L', 3, 25)];
const fresh = () => createInitialState(SPEC, LINES);

describe('overheat on churn', () => {
  it('heats with water in the pump and every delivery shut, past caution and alarm', () => {
    let s = run(fresh(), inputsWith(0.9, ['tank']), 3000);
    expect(truckOf(s).pump.tempC).toBeGreaterThan(PUMP_TEMP_CAUTION_C);
    s = run(s, inputsWith(0.9, ['tank']), 3000);
    expect(truckOf(s).pump.tempC).toBeGreaterThan(PUMP_TEMP_ALARM_C);
    expect(truckOf(s).tally.overheatS).toBeGreaterThan(0);
  });

  it('cools once a delivery is cracked: flow carries the heat away (L2077)', () => {
    const hot = run(fresh(), inputsWith(0.9, ['tank']), 6000);
    const cooled = run(hot, { ...inputsWith(0.9, ['tank']), valves: { tank: 1, a: 0.2 } }, 100);
    expect(truckOf(cooled).pump.tempC).toBeLessThan(AMBIENT_C + 5);
  });

  it('barely warms while delivering water', () => {
    const s = run(fresh(), inputsWith(0.9, ['tank', 'a']), 3000);
    expect(truckOf(s).pump.tempC).toBeLessThan(AMBIENT_C + 2);
  });

  it('a dry pump (no supply open) churns nothing', () => {
    const s = run(fresh(), inputsWith(0.9, []), 3000);
    expect(truckOf(s).pump.tempC).toBeCloseTo(AMBIENT_C, 6);
  });

  it('heat rises with the cube of rpm', () => {
    const at = (rpm: number) =>
      stepTempC(AMBIENT_C, { spec: SPEC, rpm, wet: true, throughLpm: 0 }, 1) - AMBIENT_C;
    expect(at(3000) / at(1500)).toBeCloseTo(8, 1);
  });
});

describe('water hammer', () => {
  const flowing = () => run(fresh(), inputsWith(0.6, ['tank', 'a']), 50);

  it('surge is ρ·a·Δv: 270 L/min stopped dead in 38 mm hose ≈ 1 MPa', () => {
    expect(surgeKpa(270, 38)).toBeCloseTo(992, -1);
  });

  it('slamming a delivery shut in one tick is hammer: tallied and recorded', () => {
    const s = run(flowing(), inputsWith(0.6, ['tank']), 1);
    const t = truckOf(s);
    expect(t.tally.waterHammer).toBe(1);
    expect(t.lastHammer?.deliveryId).toBe('a');
    expect(t.lastHammer?.surgeKpa).toBeGreaterThan(WATER_HAMMER_SURGE_KPA);
    expect(t.lastHammer?.atS).toBeCloseTo(s.timeS, 9);
  });

  it('one closure spread over two hard ticks is one hammer, not two', () => {
    // Full throttle, then the valve to 5 % and shut: each tick's surge passes the threshold.
    let s = run(fresh(), inputsWith(1, ['tank', 'a']), 50);
    s = run(s, { ...inputsWith(1, ['tank']), valves: { tank: 1, a: 0.05 } }, 1);
    const first = truckOf(s).lastHammer;
    s = run(s, inputsWith(1, ['tank']), 1);
    const t = truckOf(s);
    expect(first?.surgeKpa).toBeGreaterThan(WATER_HAMMER_SURGE_KPA);
    expect(t.lastHammer?.surgeKpa).toBeGreaterThan(WATER_HAMMER_SURGE_KPA);
    expect(t.lastHammer?.atS).toBeCloseTo(s.timeS, 9);
    expect(t.tally.waterHammer).toBe(1);
  });

  it('two closures with a pause between are two hammers', () => {
    let s = flowing();
    s = run(s, inputsWith(0.6, ['tank']), 1);
    s = run(s, inputsWith(0.6, ['tank', 'a']), 50);
    s = run(s, inputsWith(0.6, ['tank']), 1);
    expect(truckOf(s).tally.waterHammer).toBe(2);
  });

  it('closing it smoothly over three seconds is not', () => {
    let s = flowing();
    for (let i = 29; i >= 0; i--) {
      s = run(s, { ...inputsWith(0.6, ['tank']), valves: { tank: 1, a: i / 30 } }, 1);
    }
    expect(truckOf(s).readings.deliveryFlowLpm.a).toBe(0);
    expect(truckOf(s).tally.waterHammer).toBe(0);
  });

  it('flow collapsing with the valve unmoved (tank runs dry) is not hammer', () => {
    const low = flowing();
    const s0: SimState = { ...low, trucks: low.trucks.map((t) => ({ ...t, tankL: 1 })) };
    const s = run(s0, inputsWith(0.6, ['tank', 'a']), 50);
    expect(truckOf(s).tankL).toBe(0);
    expect(truckOf(s).tally.waterHammer).toBe(0);
  });
});

describe('cavitation flutter and tally', () => {
  const cavitating = (seed: number) => {
    const s = primedState(createInitialState(SPEC, LINES, { ...draughtSite(SPEC, 6), seed }));
    const inputs: PlayerInputs = inputsWith(1, ['suction', 'a', 'b']);
    return run(s, inputs, 100);
  };

  it('tallies cavitating seconds', () => {
    const t = truckOf(cavitating(1));
    expect(t.readings.cavitation).toBeGreaterThan(0);
    expect(t.tally.cavitationS).toBeGreaterThan(5);
  });

  it('flutter replays exactly from a seed and differs between seeds', () => {
    expect(cavitating(7)).toStrictEqual(cavitating(7));
    expect(truckOf(cavitating(7)).pump.flutter).not.toBe(truckOf(cavitating(8)).pump.flutter);
  });

  it('flutter stays within −1…1', () => {
    let s = cavitating(3);
    for (let i = 0; i < 200; i++) {
      s = run(s, inputsWith(1, ['suction', 'a', 'b']), 1);
      expect(Math.abs(truckOf(s).pump.flutter)).toBeLessThanOrEqual(1);
    }
  });
});
