import { describe, expect, it } from 'vitest';
import { cubicAt, cubicPath, cubicPointAtArc, cubicPortion, type Cubic } from './cubic';

const straight: Cubic = {
  p0: { x: 0, y: 0 },
  c1: { x: 10, y: 0 },
  c2: { x: 50, y: 0 },
  p3: { x: 100, y: 0 },
};
const bent: Cubic = {
  p0: { x: 0, y: 0 },
  c1: { x: 60, y: 0 },
  c2: { x: 100, y: 40 },
  p3: { x: 100, y: 100 },
};

/** Arc length by brute force. */
function arc(c: Cubic, n = 2000): number {
  let s = 0;
  let prev = c.p0;
  for (let i = 1; i <= n; i++) {
    const p = cubicAt(c, i / n);
    s += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return s;
}

describe('cubic hoses', () => {
  it('draws a path from the start to the end', () => {
    expect(cubicPath(bent)).toBe('M0.0 0.0 C60.0 0.0, 100.0 40.0, 100.0 100.0');
  });

  it('cuts a portion by arc length, not by parameter (uneven control points)', () => {
    const half = cubicPortion(straight, 0.5, 'start');
    expect(half?.p0).toEqual(straight.p0);
    expect(half?.p3.x).toBeCloseTo(50, 1);
    expect(half?.p3.y).toBeCloseTo(0, 9);
  });

  it('keeps the portion on the curve, at its share of the length', () => {
    for (const f of [0.1, 0.37, 0.8]) {
      const part = cubicPortion(bent, f, 'start');
      if (part === undefined) throw new Error('no portion');
      expect(arc(part) / arc(bent)).toBeCloseTo(f, 2);
      // The cut end is a point of the original curve.
      const near = Array.from({ length: 2001 }, (_, i) => cubicAt(bent, i / 2000)).some(
        (p) => Math.hypot(p.x - part.p3.x, p.y - part.p3.y) < 0.2,
      );
      expect(near).toBe(true);
    }
  });

  it('measures from the end and runs back towards the start (water rising from the strainer)', () => {
    const part = cubicPortion(bent, 0.25, 'end');
    expect(part?.p0).toEqual(bent.p3);
    if (part === undefined) throw new Error('no portion');
    expect(arc(part) / arc(bent)).toBeCloseTo(0.25, 2);
    expect(cubicPortion(bent, 1, 'end')?.p3).toEqual(bent.p0);
  });

  it('finds a point by arc length: the ends at 0 and 1, the middle by distance (uneven control points)', () => {
    expect(cubicPointAtArc(bent, 0)).toEqual(bent.p0);
    const end = cubicPointAtArc(bent, 1);
    expect(end.x).toBeCloseTo(bent.p3.x, 6);
    expect(end.y).toBeCloseTo(bent.p3.y, 6);
    // Halfway along a straight hose with bunched control points is at x = 50, not cubicAt(0.5).
    expect(cubicPointAtArc(straight, 0.5).x).toBeCloseTo(50, 0);
  });

  it('has nothing to draw when empty', () => {
    expect(cubicPortion(bent, 0, 'start')).toBeUndefined();
    expect(cubicPortion(bent, Number.NaN, 'end')).toBeUndefined();
    expect(cubicPortion(bent, 1, 'start')).toEqual(bent);
  });
});
