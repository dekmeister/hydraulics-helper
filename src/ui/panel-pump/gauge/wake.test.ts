import { describe, expect, it } from 'vitest';
import { computeWake, WAKE, type WakePoint } from './wake';

const series = (f: (tS: number) => number, seconds = 4): WakePoint[] =>
  Array.from({ length: seconds * 10 + 1 }, (_, i) => ({ tS: i / 10, v: f(i / 10) }));

describe('the Wake', () => {
  it('is empty with no samples', () => {
    expect(computeWake([])).toEqual({ band: null, ghosts: [] });
  });

  it('is a sliver when the reading is steady', () => {
    const w = computeWake(series(() => 700));
    expect(w.band).toEqual({ lo: 700, hi: 700 });
    expect(w.ghosts).toHaveLength(WAKE.ghostCount);
  });

  it('band covers only the last 3 s', () => {
    const w = computeWake(series((t) => (t < 0.5 ? 0 : 500)));
    expect(w.band).toEqual({ lo: 500, hi: 500 });
  });

  it('ghosts step back 0.6 s each, fading from 0.26 to 0.07', () => {
    const w = computeWake(series((t) => t * 100));
    expect(w.ghosts.map((g) => Math.round(g.value))).toEqual([340, 280, 220, 160, 100]);
    expect(w.ghosts[0]?.opacity).toBeCloseTo(0.26, 9);
    expect(w.ghosts.at(-1)?.opacity).toBeCloseTo(0.07, 9);
  });

  it('fans out on both sides when hunting', () => {
    const w = computeWake(series((t) => 600 + 40 * Math.sin(2 * Math.PI * 2.4 * t)));
    expect((w.band?.hi ?? 0) - (w.band?.lo ?? 0)).toBeGreaterThan(70);
  });

  it('has fewer ghosts while history is short', () => {
    expect(computeWake(series(() => 1, 1)).ghosts).toHaveLength(1);
  });
});
