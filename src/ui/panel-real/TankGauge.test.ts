// The electronic tank gauge lights the band the level is in (TankDisplay 'bands').
import { describe, expect, it } from 'vitest';
import type { TankBand } from '../../sim/types';
import { activeBand } from './TankGauge';

const BANDS: readonly TankBand[] = [
  { fromFraction: 0, tone: 'red' },
  { fromFraction: 0.25, tone: 'blue' },
  { fromFraction: 0.75, tone: 'green' },
];

describe('activeBand', () => {
  it('lights the last band whose start the level has reached', () => {
    expect(activeBand(BANDS, 0)?.tone).toBe('red');
    expect(activeBand(BANDS, 0.249)?.tone).toBe('red');
    expect(activeBand(BANDS, 0.25)?.tone).toBe('blue');
    expect(activeBand(BANDS, 0.74)?.tone).toBe('blue');
    expect(activeBand(BANDS, 0.75)?.tone).toBe('green');
    expect(activeBand(BANDS, 1)?.tone).toBe('green');
  });

  it('falls back to the lowest band below the first start, and to none with no bands', () => {
    expect(activeBand([{ fromFraction: 0.1, tone: 'red' }], 0)?.tone).toBe('red');
    expect(activeBand([], 0.5)).toBeUndefined();
  });
});
