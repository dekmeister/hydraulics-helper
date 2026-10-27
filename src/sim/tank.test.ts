import { describe, expect, it } from 'vitest';
import { SPILL_SOAK_TAU_S } from './constants';
import { stepStore } from './tank';

describe('stepStore (a tank or dam, and the pool it spills onto)', () => {
  it('fills below capacity and spills nothing', () => {
    const s = stepStore(500, 1000, 0, 600, 0, 1);
    expect(s.levelL).toBeCloseTo(510, 9);
    expect(s.spilledL).toBe(0);
    expect(s.overflowLpm).toBe(0);
  });

  it('spills what a full tank cannot hold: (in − draw)·dt', () => {
    const s = stepStore(1000, 1000, 300, 1200, 0, 1);
    expect(s.levelL).toBe(1000);
    expect(s.spilledL).toBeCloseTo(15, 9);
    expect(s.overflowLpm).toBeCloseTo(900, 9);
  });

  it('tops up and spills only the remainder in the tick it fills', () => {
    const s = stepStore(990, 1000, 0, 1200, 0, 1);
    expect(s.levelL).toBe(1000);
    expect(s.spilledL).toBeCloseTo(10, 9);
    // Averaged over the tick: half of it ran out the overflow.
    expect(s.overflowLpm).toBeCloseTo(600, 9);
  });

  it('does not spill when drawn as fast as it is filled', () => {
    const s = stepStore(1000, 1000, 1200, 1200, 0, 1);
    expect(s.levelL).toBe(1000);
    expect(s.spilledL).toBe(0);
  });

  it('soaks the pool away: about 37 % left after one time constant with nothing spilling', () => {
    const s = stepStore(500, 1000, 0, 0, 100, SPILL_SOAK_TAU_S);
    expect(s.levelL).toBe(500);
    expect(s.spilledL).toBeCloseTo(100 * Math.exp(-1), 9);
  });

  it('never spills open water with no capacity', () => {
    const s = stepStore(1e6, Number.POSITIVE_INFINITY, 0, 5000, 0, 1);
    expect(s.levelL).toBeCloseTo(1e6 + 5000 / 60, 6);
    expect(s.spilledL).toBe(0);
  });

  it('changes nothing over no time, and holds the floor at empty', () => {
    expect(stepStore(1000, 1000, 0, 1200, 40, 0)).toEqual({
      levelL: 1000,
      spilledL: 40,
      overflowLpm: 0,
    });
    expect(stepStore(1, 1000, 600, 0, 0, 1)).toEqual({ levelL: 0, spilledL: 0, overflowLpm: 0 });
  });
});
