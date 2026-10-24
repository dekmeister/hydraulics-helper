import { HOSES, type HoseType } from './constants';
import type { HoseId, HoseSegment } from './types';

/** Look up a hose type in the shared catalogue. Unknown ids are a data error, so this throws. */
export function hoseType(id: HoseId): HoseType {
  const hose = HOSES[id];
  if (hose === undefined) throw new Error(`Unknown hose type '${id}'`);
  return hose;
}

/** Friction resistance of a run of hose: ΔP = R·Q², R = Σ k_m·L, kPa per (L/min)². */
export function hoseResistance(segments: readonly HoseSegment[]): number {
  return segments.reduce((r, s) => r + hoseType(s.hose).kPerM * s.lengthM, 0);
}

/** Friction loss along a run of hose at `flowLpm`, kPa. Independent of pressure (manual law 5, L815). */
export function hoseFrictionKpa(segments: readonly HoseSegment[], flowLpm: number): number {
  return hoseResistance(segments) * flowLpm * flowLpm;
}
