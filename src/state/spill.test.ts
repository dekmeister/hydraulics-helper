import { describe, expect, it } from 'vitest';
import { SPILL_POOL_FULL_L, SPILL_POOL_MIN_L, spillPoolSize } from './spill';

describe('spillPoolSize', () => {
  it('draws nothing for no spill, a trickle, or a bad value', () => {
    expect(spillPoolSize(0)).toBeUndefined();
    expect(spillPoolSize(SPILL_POOL_MIN_L - 1)).toBeUndefined();
    expect(spillPoolSize(Number.NaN)).toBeUndefined();
  });

  it('spreads as √volume and stops at the largest drawn', () => {
    expect(spillPoolSize(SPILL_POOL_FULL_L / 4)).toBeCloseTo(0.5, 9);
    expect(spillPoolSize(SPILL_POOL_FULL_L)).toBe(1);
    expect(spillPoolSize(SPILL_POOL_FULL_L * 10)).toBe(1);
  });
});
