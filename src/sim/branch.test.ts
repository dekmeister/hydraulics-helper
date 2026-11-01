import { describe, expect, it } from 'vitest';
import { branchWorkingBand } from './branch';

describe('branchWorkingBand', () => {
  it('is Table 1’s optimum ± 10 % for a smooth-bore tip', () => {
    const band = branchWorkingBand({ tipMm: 15 });
    expect(band?.targetKpa).toBe(350);
    expect(band?.minKpa).toBeCloseTo(315, 6);
    expect(band?.maxKpa).toBeCloseTo(385, 6);
  });

  it('is undefined for a tip Table 1 doesn’t list', () => {
    expect(branchWorkingBand({ tipMm: 14 })).toBeUndefined();
  });

  // Dek, 2026-11-01: 700 kPa preferred, anything in the maker's 350–1034 kPa band works.
  it.each([3.2, 5, 8])('is 700 kPa within the maker’s band for a %s mm Dial-A-Jet jet', (tipMm) => {
    expect(branchWorkingBand({ tipMm, model: 'dialAJet' })).toEqual({
      targetKpa: 700,
      minKpa: 350,
      maxKpa: 1034,
    });
  });

  it('rejects a Dial-A-Jet jet the maker doesn’t list', () => {
    expect(() => branchWorkingBand({ tipMm: 12, model: 'dialAJet' })).toThrow(/12 mm/);
  });
});
