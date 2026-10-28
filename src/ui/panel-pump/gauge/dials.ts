import type { GaugeScaleSpec } from '../../../sim/types';
import type { DialSpec, ScaleSegment, Zone } from './gaugeScale';

// Dial faces (Design sheet 02). A layout picks a face per instrument; the range and zones come
// from that instrument's scale on the appliance spec, so each truck's gauges read its own figures.

const hundreds = (v: number) => String(v / 100);

/** Tick steps a face may use: round numbers a gauge maker would print. */
const NICE_STEPS = [50, 100, 200, 250, 400, 500, 1000, 2000, 2500, 5000] as const;

/**
 * Smallest nice major step giving at most `maxMajors` intervals over `span`, preferring one that
 * divides it, so the last major lands on full scale as on a printed face. Minor = major / 4.
 */
export function majorStep(span: number, maxMajors: number): number {
  const fits = NICE_STEPS.filter((s) => span / s <= maxMajors + 1e-9);
  return fits.find((s) => span % s === 0) ?? fits[0] ?? span;
}

function linear(
  fullScale: number,
  a: readonly [number, number],
  maxMajors: number,
  extra: Partial<ScaleSegment> = {},
): ScaleSegment {
  const major = majorStep(fullScale, maxMajors);
  return { v: [0, fullScale], a, major, minor: major / 4, label: hundreds, ...extra };
}

const zonesOf = (scale: GaugeScaleSpec): Zone[] =>
  scale.zones.map((z) => ({ v: [z.from, z.to], tone: z.tone }));

/** Discharge (pressure) gauge, 0 to full scale kPa over 270°. */
export function dischargeDial(scale: GaugeScaleSpec): DialSpec {
  return {
    id: 'discharge',
    segments: [linear(scale.fullScale, [-135, 135], 8)],
    zones: zonesOf(scale),
    units: 'kPa ×100',
    plate: 'DISCHARGE',
  };
}

/**
 * Compound gauge: vacuum −100…0 kPa (near full vacuum) on a stretched sector, then pressure to full
 * scale, joined at −75°.
 */
export function compoundDial(scale: GaugeScaleSpec): DialSpec {
  return {
    id: 'compound',
    segments: [
      {
        v: [-100, 0],
        a: [-135, -75],
        major: 50,
        minor: 10,
        label: (v) => (v === 0 ? null : `−${String(Math.abs(v))}`),
        labelSize: 15,
        labelMuted: true,
        tint: true,
      },
      linear(scale.fullScale, [-75, 135], 5),
    ],
    zones: zonesOf(scale),
    breaks: [0],
    units: 'kPa ×100',
    plate: 'COMPOUND',
    subLabel: { text: 'VAC kPa', atValue: -50, r: 28 },
  };
}

/** Engine tachometer, 0 to full scale rpm. */
export function tachoDial(scale: GaugeScaleSpec): DialSpec {
  return {
    id: 'tacho',
    segments: [
      linear(scale.fullScale, [-135, 135], 4, {
        label: (v) => (v % 1000 === 0 ? String(v / 1000) : null),
        labelSize: 22,
      }),
    ],
    zones: zonesOf(scale),
    units: 'RPM ×1000',
    plate: 'ENGINE',
  };
}

/** Faces a layout can name. */
export const DIALS = {
  discharge: dischargeDial,
  compound: compoundDial,
  tacho: tachoDial,
} as const satisfies Record<string, (scale: GaugeScaleSpec) => DialSpec>;

export type DialId = keyof typeof DIALS;
