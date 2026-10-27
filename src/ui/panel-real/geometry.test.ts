import { describe, expect, it } from 'vitest';
import { couplingRadiusFrac } from './geometry';

describe('delivery coupling size (issue #15)', () => {
  it('draws a bigger fitting bigger: 25 < 38 < 65 mm', () => {
    expect(couplingRadiusFrac(25)).toBeLessThan(couplingRadiusFrac(38));
    expect(couplingRadiusFrac(38)).toBeLessThan(couplingRadiusFrac(65));
  });

  it('keeps the 65 mm coupling at its old size, and every size inside the locate ring', () => {
    expect(couplingRadiusFrac(65)).toBeCloseTo(0.32, 9);
    expect(couplingRadiusFrac(90)).toBeLessThan(0.38);
    expect(couplingRadiusFrac(0)).toBe(0);
  });
});
