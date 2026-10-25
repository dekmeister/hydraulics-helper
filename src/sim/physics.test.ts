import { describe, expect, it } from 'vitest';
import { branchFlowLpm, branchPressureKpa } from './branch';
import { HOSES } from './constants';
import { hoseFrictionKpa, hoseType } from './hose';
import { lagRpm, pumpRiseKpa, targetRpm } from './pump';
import { drainTankL } from './tank';

const PUMP = {
  shutoffKpa: 1400,
  droopKpaPerLpm2: 4e-4,
  cavitationInletKpa: -84,
  casingVolumeL: 10,
  churnKw: 10,
};
const ENGINE = { idleRpm: 800, maxRpm: 3000, rpmLagS: 0.5, cylinders: 6 };

describe('hose friction', () => {
  it('is quadratic in flow (manual law 3, L798)', () => {
    const segs = [{ hose: '38L', lengthM: 30 }];
    expect(hoseFrictionKpa(segs, 400)).toBeCloseTo(4 * hoseFrictionKpa(segs, 200), 9);
  });

  it('is linear in length', () => {
    expect(hoseFrictionKpa([{ hose: '65L', lengthM: 90 }], 500)).toBeCloseTo(
      3 * hoseFrictionKpa([{ hose: '65L', lengthM: 30 }], 500),
      9,
    );
  });

  it('65 mm loses an order of magnitude less than 38 mm at 500 L/min (the core contrast)', () => {
    const r =
      hoseFrictionKpa([{ hose: '38L', lengthM: 30 }], 500) /
      hoseFrictionKpa([{ hose: '65L', lengthM: 30 }], 500);
    expect(r).toBeGreaterThan(10);
  });

  it('lined hose loses less than unlined of the same size', () => {
    for (const size of [38, 50, 65, 70]) {
      expect(HOSES[`${String(size)}L`]?.kPerM).toBeLessThan(HOSES[`${String(size)}U`]?.kPerM ?? 0);
    }
  });

  it('rejects unknown hose ids', () => {
    expect(() => hoseType('19L')).toThrow(/Unknown hose/);
  });
});

describe('branch orifice', () => {
  it('pressure and flow are inverse functions', () => {
    const b = { tipMm: 20 };
    expect(branchFlowLpm(b, branchPressureKpa(b, 555))).toBeCloseTo(555, 9);
  });

  it('gives no flow at zero or negative pressure', () => {
    expect(branchFlowLpm({ tipMm: 15 }, 0)).toBe(0);
    expect(branchFlowLpm({ tipMm: 15 }, -50)).toBe(0);
  });
});

describe('pump curve', () => {
  it('reaches shutoff pressure at zero flow and max rpm', () => {
    expect(pumpRiseKpa(PUMP, ENGINE, 3000, 0)).toBe(1400);
  });

  it('follows the affinity law: half speed gives a quarter of the pressure', () => {
    expect(pumpRiseKpa(PUMP, ENGINE, 1500, 0)).toBeCloseTo(350, 9);
  });

  it('droops with flow', () => {
    expect(pumpRiseKpa(PUMP, ENGINE, 3000, 1000)).toBeCloseTo(1000, 9);
  });
});

describe('engine rpm', () => {
  it('targets idle at throttle 0 and max at throttle 1', () => {
    expect(targetRpm(ENGINE, 0)).toBe(800);
    expect(targetRpm(ENGINE, 1)).toBe(3000);
  });

  it('covers 63 % of a step after one time constant', () => {
    expect(lagRpm(ENGINE, 800, 1, 0.5)).toBeCloseTo(800 + 2200 * (1 - Math.exp(-1)), 6);
  });

  it('does not depend on tick size', () => {
    let fine = 800;
    for (let i = 0; i < 10; i++) fine = lagRpm(ENGINE, fine, 1, 0.1);
    expect(fine).toBeCloseTo(lagRpm(ENGINE, 800, 1, 1), 6);
  });
});

describe('tank', () => {
  it('drains litres = L/min × s / 60', () => {
    expect(drainTankL(1000, 600, 1)).toBeCloseTo(990, 9);
  });

  it('never goes below empty', () => {
    expect(drainTankL(1, 600, 1)).toBe(0);
  });
});
