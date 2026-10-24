import { describe, expect, it } from 'vitest';
import { LOW_TANK_FRACTION, tankSegments } from './tankLevel';

describe('tank level segments', () => {
  it('lights all five when full and rounds partial segments up', () => {
    expect(tankSegments(3000, 3000)).toEqual({ lit: 5, level: 'ok' });
    expect(tankSegments(2400, 3000)).toEqual({ lit: 4, level: 'ok' });
    expect(tankSegments(2401, 3000)).toEqual({ lit: 5, level: 'ok' });
  });

  it('turns low at the low mark, and still lights one segment for a little water', () => {
    expect(tankSegments(LOW_TANK_FRACTION * 3000, 3000).level).toBe('low');
    expect(tankSegments(LOW_TANK_FRACTION * 3000 + 1, 3000).level).toBe('ok');
    expect(tankSegments(10, 3000)).toEqual({ lit: 1, level: 'low' });
  });

  it('is empty at zero, on residue, with no tank and on NaN', () => {
    expect(tankSegments(0, 3000)).toEqual({ lit: 0, level: 'empty' });
    expect(tankSegments(0.1, 3000).level).toBe('empty');
    expect(tankSegments(100, 0).level).toBe('empty');
    expect(tankSegments(Number.NaN, 3000).level).toBe('empty');
  });
});
