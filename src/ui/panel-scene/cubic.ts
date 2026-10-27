// Cubic Bézier hoses on the scene: the SVG path, and the part of a hose that water fills (issues
// #6, #8). Pure; no React.

export interface Pt {
  x: number;
  y: number;
}

/** A cubic Bézier: start, two control points, end. */
export interface Cubic {
  p0: Pt;
  c1: Pt;
  c2: Pt;
  p3: Pt;
}

/** Samples along a curve for its arc length: plenty for a hose a few hundred units long. */
const ARC_SAMPLES = 64;

const fmt = (n: number) => n.toFixed(1);
const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** The SVG path of a cubic, coordinates to 0.1 unit. */
export function cubicPath({ p0, c1, c2, p3 }: Cubic): string {
  return (
    `M${fmt(p0.x)} ${fmt(p0.y)} ` +
    `C${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(p3.x)} ${fmt(p3.y)}`
  );
}

/** The point at parameter `t` (0–1). */
export function cubicAt({ p0, c1, c2, p3 }: Cubic, t: number): Pt {
  const a = lerp(p0, c1, t);
  const b = lerp(c1, c2, t);
  const c = lerp(c2, p3, t);
  return lerp(lerp(a, b, t), lerp(b, c, t), t);
}

/** The curve from its start up to parameter `t`, itself a cubic (de Casteljau split). */
function headTo({ p0, c1, c2, p3 }: Cubic, t: number): Cubic {
  const a = lerp(p0, c1, t);
  const b = lerp(c1, c2, t);
  const c = lerp(c2, p3, t);
  const ab = lerp(a, b, t);
  const bc = lerp(b, c, t);
  return { p0, c1: a, c2: ab, p3: lerp(ab, bc, t) };
}

/** Parameter at which the arc length from the start is `fraction` of the whole. */
function paramAtArc(curve: Cubic, fraction: number): number {
  const lengths = [0];
  let prev = curve.p0;
  for (let i = 1; i <= ARC_SAMPLES; i++) {
    const p = cubicAt(curve, i / ARC_SAMPLES);
    lengths.push((lengths[i - 1] ?? 0) + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  const target = fraction * (lengths[ARC_SAMPLES] ?? 0);
  const i = lengths.findIndex((s) => s >= target);
  if (i <= 0) return 0;
  const s0 = lengths[i - 1] ?? 0;
  const s1 = lengths[i] ?? s0;
  return (i - 1 + (s1 > s0 ? (target - s0) / (s1 - s0) : 0)) / ARC_SAMPLES;
}

/** The point `fraction` (0–1) of the way along the curve by arc length. */
export function cubicPointAtArc(curve: Cubic, fraction: number): Pt {
  return cubicAt(curve, paramAtArc(curve, fraction));
}

/**
 * The part of a hose `fraction` (0–1) of its length long, measured along the hose from `from`,
 * as a cubic running the way the water travels: from the start, or from the end back towards the
 * start (a suction filling from the strainer). Undefined when there is none.
 */
export function cubicPortion(
  curve: Cubic,
  fraction: number,
  from: 'start' | 'end',
): Cubic | undefined {
  if (!(fraction > 0)) return undefined;
  const run = from === 'start' ? curve : { p0: curve.p3, c1: curve.c2, c2: curve.c1, p3: curve.p0 };
  return fraction >= 1 ? run : headTo(run, paramAtArc(run, fraction));
}
