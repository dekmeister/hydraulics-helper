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

/** Whether a run of hose holds a vacuum: every length must be hard suction. */
export function isRigid(segments: readonly HoseSegment[]): boolean {
  return segments.length > 0 && segments.every((s) => hoseType(s.hose).hardSuction === true);
}

/** Water a run of hose holds, L (bore area × length). */
export function hoseVolumeL(segments: readonly HoseSegment[]): number {
  return segments.reduce((v, s) => {
    const boreM = hoseType(s.hose).sizeMm / 1000;
    return v + (Math.PI / 4) * boreM * boreM * s.lengthM * 1000;
  }, 0);
}
