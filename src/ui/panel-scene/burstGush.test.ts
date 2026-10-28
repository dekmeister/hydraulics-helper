import { describe, expect, it } from 'vitest';
import { CHARGED_MIN_LPM } from '../../state/selectors';
import {
  BURST_GUSH_FULL_LPM,
  BURST_GUSH_MIN_SCALE,
  burstGushLobes,
  burstGushScale,
} from './burstGush';
import { SPRAY_REACH_U } from './geometry';

describe('burstGushScale', () => {
  it('draws nothing when no water leaves the hole, or for a bad value', () => {
    expect(burstGushScale(0)).toBe(0);
    expect(burstGushScale(CHARGED_MIN_LPM - 0.01)).toBe(0);
    expect(burstGushScale(-100)).toBe(0);
    expect(burstGushScale(Number.NaN)).toBe(0);
  });

  it('shows even a small flow, and grows with the flow', () => {
    expect(burstGushScale(CHARGED_MIN_LPM)).toBe(BURST_GUSH_MIN_SCALE);
    const flows = [CHARGED_MIN_LPM, 200, 400, 600, BURST_GUSH_FULL_LPM];
    const scales = flows.map(burstGushScale);
    for (let i = 1; i < scales.length; i++)
      expect(scales[i]).toBeGreaterThan(scales[i - 1] ?? Infinity);
  });

  it('stops growing at the full flow', () => {
    expect(burstGushScale(BURST_GUSH_FULL_LPM)).toBe(1);
    expect(burstGushScale(BURST_GUSH_FULL_LPM * 3)).toBe(1);
  });
});

describe('burstGushLobes', () => {
  const tips = (scale: number, headingDeg: number) =>
    burstGushLobes(scale, headingDeg).map((l) => l.tip);

  it('throws one lobe off each side of the hose, square to it', () => {
    // Hose running along x: the lobes go out along ±y.
    const [a, b] = tips(1, 0);
    expect(a?.x).toBeCloseTo(0, 6);
    expect(b?.x).toBeCloseTo(0, 6);
    expect(Math.abs(a?.y ?? 0)).toBeCloseTo(SPRAY_REACH_U, 6);
    expect((a?.y ?? 0) * (b?.y ?? 0)).toBeLessThan(0);
  });

  it('reaches further with more flow', () => {
    const reach = (scale: number) =>
      Math.hypot(tips(scale, 30)[0]?.x ?? 0, tips(scale, 30)[0]?.y ?? 0);
    expect(reach(1)).toBeGreaterThan(reach(0.5));
    expect(reach(0.5)).toBeCloseTo(SPRAY_REACH_U / 2, 6);
  });

  it('gives every lobe a body and streaks', () => {
    for (const lobe of burstGushLobes(0.6, 45)) {
      expect(lobe.body).toMatch(/^M/);
      expect(lobe.streaks.length).toBeGreaterThan(1);
    }
  });
});
