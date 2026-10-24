/**
 * Gauge geometry: pure functions, no DOM, no React. Ported from Design/reference-impl/gaugeScale.ts.
 *
 * Conventions (Design sheet 02):
 *   - Dial units: outer bezel radius R = 100. Render inside viewBox "-106 -106 214 214".
 *   - Angles θ in degrees, clockwise from 12 o'clock. A standard dial sweeps 270°, −135 → +135.
 *   - An element drawn pointing up is placed with `rotate(θ)`, so markup needs no trigonometry.
 *   - Arcs are dash-arrayed circles rotated to their start angle; a circle's path starts at
 *     3 o'clock (θ = 90), hence rotate(θstart − 90).
 */

export interface ScaleSegment {
  /** Value range [v0, v1], v0 < v1. */
  v: readonly [number, number];
  /** Angle range for v0 and v1. */
  a: readonly [number, number];
  /** Major tick step, value units. */
  major: number;
  /** Minor tick step, value units. */
  minor: number;
  /** Numeral for a major tick, or null for none. */
  label?: (v: number) => string | null;
  /** Numeral size, dial units (default GEOM.numeralSize). */
  labelSize?: number;
  /** Muted numerals (compound vacuum scale). */
  labelMuted?: boolean;
  /** Tint the face behind this segment (compound vacuum sector). */
  tint?: boolean;
}

export type ZoneTone = 'caution' | 'alarm';

export interface Zone {
  v: readonly [number, number];
  tone: ZoneTone;
}

export interface DialSpec {
  id: string;
  segments: readonly ScaleSegment[];
  zones: readonly Zone[];
  /** Units line on the face, e.g. 'kPa ×100'. */
  units: string;
  /** Name plate on the face, e.g. 'DISCHARGE'. */
  plate?: string;
  /** Values that get a heavier scale-break tick (compound gauge at 0). */
  breaks?: readonly number[];
  /** Small secondary label inside a sector, e.g. 'VAC kPa'. */
  subLabel?: { text: string; atValue: number; r: number };
  /** Mini dials (< 100 px rendered): no numerals, heavier ticks. */
  mini?: boolean;
}

export const GEOM = {
  bezelR: 100,
  lipR: 93,
  faceR: 92,
  scaleArcR: 88,
  scaleArcW: 1.2,
  zoneR: 84,
  zoneW: 7,
  tickOuter: 88,
  majorInner: 72,
  minorInner: 80,
  majorW: 2.5,
  minorW: 1.2,
  breakOuter: 91,
  breakInner: 66,
  breakW: 3.4,
  numeralR: 61,
  numeralSize: 20,
  unitsY: 33,
  unitsSize: 10,
  plate: { x: -38, y: 54, w: 76, h: 18, textY: 66.6, textSize: 11 },
  needle: {
    tip: 82,
    tail: 18,
    halfWidth: 3.2,
    counterweightR: 6.2,
    insetR: 3.4,
    counterweightY: 15,
  },
  hub: { r: 8.5, capR: 3.4 },
  mini: { zoneR: 82, zoneW: 12, majorInner: 66, majorW: 5, scaleArcW: 2 },
} as const;

const EPS = 1e-9;

/** Lowest and highest value on the dial. */
export function range(spec: DialSpec): [number, number] {
  const first = spec.segments[0];
  const last = spec.segments[spec.segments.length - 1];
  if (first === undefined || last === undefined) throw new Error(`dial ${spec.id} has no scale`);
  return [first.v[0], last.v[1]];
}

/** Needle angle for a value. Values off the scale clamp to the stop pins, like a real needle. */
export function valueToAngle(spec: DialSpec, value: number): number {
  const [lo, hi] = range(spec);
  const v = Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : lo;
  for (const s of spec.segments) {
    if (v >= s.v[0] - EPS && v <= s.v[1] + EPS) {
      const t = (v - s.v[0]) / (s.v[1] - s.v[0]);
      return s.a[0] + t * (s.a[1] - s.a[0]);
    }
  }
  throw new Error(`value ${String(value)} falls between segments of dial ${spec.id}`);
}

export interface Tick {
  value: number;
  angle: number;
  major: boolean;
  label: string | null;
  labelSize: number;
  labelMuted: boolean;
}

/** All ticks for a dial, de-duplicated at segment joins (the later segment wins the label). */
export function ticks(spec: DialSpec): Tick[] {
  const byValue = new Map<number, Tick>();
  for (const s of spec.segments) {
    const n = Math.round((s.v[1] - s.v[0]) / s.minor);
    for (let i = 0; i <= n; i++) {
      const value = round(s.v[0] + i * s.minor);
      const steps = (value - s.v[0]) / s.major;
      const major = Math.abs(steps - Math.round(steps)) < 1e-6;
      const label = major && s.label ? s.label(value) : null;
      const prev = byValue.get(value);
      byValue.set(value, {
        value,
        angle: valueToAngle(spec, value),
        major: major || (prev?.major ?? false),
        label: label ?? prev?.label ?? null,
        labelSize: label
          ? (s.labelSize ?? GEOM.numeralSize)
          : (prev?.labelSize ?? GEOM.numeralSize),
        labelMuted: label ? (s.labelMuted ?? false) : (prev?.labelMuted ?? false),
      });
    }
  }
  return [...byValue.values()].sort((a, b) => a.value - b.value);
}

export interface DashArc {
  r: number;
  strokeWidth: number;
  strokeDasharray: string;
  transform: string;
}

/** A circular arc between two angles, as a dash-arrayed circle. */
export function arc(r: number, a0: number, a1: number, strokeWidth: number): DashArc {
  const lo = Math.min(a0, a1);
  const hi = Math.max(a0, a1);
  const c = 2 * Math.PI * r;
  const len = ((hi - lo) / 360) * c;
  return {
    r,
    strokeWidth,
    strokeDasharray: `${fix(len)} ${fix(c)}`,
    transform: `rotate(${fix(lo - 90)})`,
  };
}

/** A filled sector from the centre to rOuter: a circle of radius rOuter/2, stroke-width rOuter. */
export function sector(rOuter: number, a0: number, a1: number): DashArc {
  return arc(rOuter / 2, a0, a1, rOuter);
}

export function zoneArcs(spec: DialSpec): (DashArc & { tone: ZoneTone })[] {
  const r = spec.mini ? GEOM.mini.zoneR : GEOM.zoneR;
  const w = spec.mini ? GEOM.mini.zoneW : GEOM.zoneW;
  return spec.zones.map((z) => ({
    ...arc(r, valueToAngle(spec, z.v[0]), valueToAngle(spec, z.v[1]), w),
    tone: z.tone,
  }));
}

/** Zone a value sits in; alarm wins over caution. */
export function zoneAt(spec: DialSpec, value: number): ZoneTone | null {
  let hit: ZoneTone | null = null;
  for (const z of spec.zones) {
    const lo = Math.min(...z.v);
    const hi = Math.max(...z.v);
    if (value >= lo && value <= hi) hit = z.tone === 'alarm' ? 'alarm' : (hit ?? 'caution');
  }
  return hit;
}

export function scaleArc(spec: DialSpec): DashArc {
  const [lo, hi] = range(spec);
  return arc(
    GEOM.scaleArcR,
    valueToAngle(spec, lo),
    valueToAngle(spec, hi),
    spec.mini ? GEOM.mini.scaleArcW : GEOM.scaleArcW,
  );
}

/** Transform that places upright text at angle θ, radius r. */
export function radialText(angle: number, r: number): string {
  return `rotate(${fix(angle)}) translate(0 ${fix(-r)}) rotate(${fix(-angle)})`;
}

function round(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

function fix(v: number): string {
  return String(Math.round(v * 100) / 100);
}
