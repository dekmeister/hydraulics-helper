// Delivery lines fill and empty (issue #6): water in a line is conserved, the front loads the pump
// with the wet length only, and a shut line empties only through its branch, under its own head.
import { describe, expect, it } from 'vitest';
import { CAT1 } from './appliances/cat1';
import { branchFlowLpm } from './branch';
import { HEAD_KPA_PER_M, TICK_S } from './constants';
import { chargeLines, createInitialState } from './engine';
import { hoseVolumeL } from './hose';
import { drainOut, fillingLoad, lineFill, stepLineWater, wetSegments } from './lineFill';
import { layLine, run, tankAttackInputs, truckOf } from './testUtils';
import type { HoseLine, SimState } from './types';

const D1 = CAT1.deliveries[0]?.id ?? '';
const mixed: HoseLine = {
  ...layLine(D1, '65L', 1, 15),
  segments: [
    { hose: '65L', lengthM: 30 },
    { hose: '38L', lengthM: 30 },
  ],
};
const water = (s: SimState, line: HoseLine) => s.lineWaterL[line.id] ?? 0;

describe('lineFill: geometry of the water in a line', () => {
  it('wets mixed hose in order from the pump end', () => {
    const v65 = hoseVolumeL([{ hose: '65L', lengthM: 30 }]);
    const half = wetSegments(mixed.segments, v65 / 2);
    expect(half).toHaveLength(1);
    expect(half[0]?.hose).toBe('65L');
    expect(half[0]?.lengthM).toBeCloseTo(15, 9);
    const wet = wetSegments(mixed.segments, v65 + 1);
    expect(wet).toHaveLength(2);
    expect(wet[0]).toEqual({ hose: '65L', lengthM: 30 });
    expect(hoseVolumeL(wet)).toBeCloseTo(v65 + 1, 9);
    expect(wetSegments(mixed.segments, 0)).toEqual([]);
  });

  it('clamps water to the volume and calls a line full only at its volume', () => {
    const v = hoseVolumeL(mixed.segments);
    expect(lineFill(mixed, 2 * v)).toMatchObject({
      volumeL: v,
      waterL: v,
      fraction: 1,
      full: true,
    });
    expect(lineFill(mixed, -3)).toMatchObject({ waterL: 0, fraction: 0, full: false });
    expect(lineFill(mixed, v / 2).full).toBe(false);
  });

  it('loads the pump with the wet length and the head up to the front (uniform grade)', () => {
    const uphill = { ...layLine(D1, '38L', 4, 15), elevationM: 20 };
    const v = hoseVolumeL(uphill.segments);
    const quarter = fillingLoad(uphill, v / 4);
    expect(quarter.headKpa).toBeCloseTo(HEAD_KPA_PER_M * 5, 9);
    expect(quarter.hoseR).toBeCloseTo(fillingLoad(layLine(D1, '38L', 1, 15), 1e9).hoseR, 12);
    expect(fillingLoad(uphill, 0)).toEqual({ hoseR: 0, headKpa: 0 });
  });
});

describe('lineFill: emptying', () => {
  it('a downhill line runs out of its branch under the head of the water left in it', () => {
    const downhill = { ...layLine(D1, '38L', 2, 15), elevationM: -10 };
    const v = hoseVolumeL(downhill.segments);
    const full = drainOut(downhill, v);
    expect(full.branchKpa).toBeCloseTo(100, 9);
    expect(full.flowLpm).toBeCloseTo(branchFlowLpm(downhill.branch, 100), 9);
    const half = drainOut(downhill, v / 2);
    expect(half.branchKpa).toBeCloseTo(50, 9);
    expect(half.flowLpm).toBeLessThan(full.flowLpm);
  });

  it('a flat or uphill line keeps its water: nothing is below the branch to drain', () => {
    for (const elevationM of [0, 15]) {
      const line = { ...layLine(D1, '38L', 2, 15), elevationM };
      expect(drainOut(line, hoseVolumeL(line.segments))).toEqual({ flowLpm: 0, branchKpa: 0 });
    }
  });

  it('conserves water: in less out, clamped to the hose', () => {
    const v = hoseVolumeL(mixed.segments);
    expect(stepLineWater(mixed, 10, 600, 0, 1)).toBeCloseTo(20, 9);
    expect(stepLineWater(mixed, v - 1, 600, 0, 1)).toBe(v);
    expect(stepLineWater(mixed, 1, 0, 600, 1)).toBe(0);
  });
});

describe('a line charging on tank supply (Cat 1)', () => {
  const line = layLine(D1, '38L', 1, 15);
  const volumeL = hoseVolumeL(line.segments);
  const inputs = tankAttackInputs(CAT1, 0.5, [D1]);

  it('starts dry, flows nothing at the branch until it is full, then reaches the steady value', () => {
    const steady = run(chargeLines(createInitialState(CAT1, [line])), inputs, 300);
    let s = createInitialState(CAT1, [line]);
    expect(water(s, line)).toBe(0);
    // F1: fills when ∫Q dt = V, to ±1 tick.
    let filledL = 0;
    let ticks = 0;
    while (water(s, line) < volumeL) {
      s = run(s, inputs, 1);
      const r = truckOf(s).readings;
      if (water(s, line) < volumeL) {
        expect(r.branchFlowLpm[line.id]).toBe(0);
        expect(r.branchKpa[line.id]).toBe(0);
        expect(r.dischargeKpa).toBeLessThan(truckOf(steady).readings.dischargeKpa);
      }
      filledL += ((r.deliveryFlowLpm[D1] ?? 0) * TICK_S) / 60;
      expect(++ticks).toBeLessThan(600);
    }
    expect(filledL).toBeGreaterThanOrEqual(volumeL);
    expect(filledL - volumeL).toBeLessThanOrEqual(
      ((truckOf(s).readings.deliveryFlowLpm[D1] ?? 0) * TICK_S) / 60 + 1e-9,
    );
    s = run(s, inputs, 300 - ticks);
    const r = truckOf(s).readings;
    const want = truckOf(steady).readings;
    expect(r.branchFlowLpm[line.id]).toBeCloseTo(want.branchFlowLpm[line.id] ?? 0, 3);
    expect(r.dischargeKpa).toBeCloseTo(want.dischargeKpa, 3);
  });

  it('draws the water it fills with from the tank', () => {
    const s = run(createInitialState(CAT1, [line]), inputs, 5);
    const drawnL = (CAT1.tank?.capacityL ?? 0) - truckOf(s).tankL;
    expect(drawnL).toBeCloseTo(water(s, line), 6);
  });

  it('holds its water when shut on the flat, and refills only what a downhill line lost', () => {
    const shut = tankAttackInputs(CAT1, 0.5, []);
    const flat = run(run(createInitialState(CAT1, [line]), inputs, 100), shut, 100);
    expect(water(flat, line)).toBe(volumeL);

    const downhill = { ...line, elevationM: -5 };
    let s = run(run(createInitialState(CAT1, [downhill]), inputs, 100), shut, 10);
    const left = water(s, downhill);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(volumeL);
    expect(truckOf(s).readings.branchFlowLpm[downhill.id]).toBeGreaterThan(0);
    const tankBefore = truckOf(s).tankL;
    while (water(s, downhill) < volumeL) s = run(s, inputs, 1);
    expect(tankBefore - truckOf(s).tankL).toBeLessThan(volumeL - left + 3);
  });
});
