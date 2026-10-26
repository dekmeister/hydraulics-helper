// Water in a delivery line (ARCHITECTURE §4.5, issue #6). A line holds `waterL` litres, filled from
// the pump end. While it fills, the air ahead of the front leaves through the open branch, which
// barely resists it (orifice loss scales with density; air is ~1/830 of water), so the pump sees
// only the valve, the friction of the wet length and the head up to the front. Plug flow, uniform
// grade, no fluid inertia (ρ·L·v/Δp ≲ 0.6 s, well under a fill): CALIBRATION "needs Dek".
import { branchFlowLpm } from './branch';
import { HEAD_KPA_PER_M } from './constants';
import { hoseResistance, hoseVolumeL } from './hose';
import type { HoseLine, HoseSegment } from './types';

export interface LineFill {
  /** What the hose holds full, L. */
  volumeL: number;
  /** Water in it, clamped to [0, volumeL], L. */
  waterL: number;
  /** waterL / volumeL, 0–1 (1 for a hose of no volume). */
  fraction: number;
  /** The front has reached the branch: solve the line whole. */
  full: boolean;
}

/** How full `line` is with `waterL` litres in it. */
export function lineFill(line: HoseLine, waterL: number): LineFill {
  const volumeL = hoseVolumeL(line.segments);
  const w = Math.min(volumeL, Math.max(0, Number.isFinite(waterL) ? waterL : 0));
  return {
    volumeL,
    waterL: w,
    fraction: volumeL > 0 ? w / volumeL : 1,
    full: w >= volumeL,
  };
}

/** The segments `waterL` litres wet, from the pump end; the last is cut to the front. */
export function wetSegments(segments: readonly HoseSegment[], waterL: number): HoseSegment[] {
  const wet: HoseSegment[] = [];
  let left = waterL;
  for (const s of segments) {
    if (left <= 0) break;
    const v = hoseVolumeL([s]);
    if (v <= left) {
      wet.push(s);
      left -= v;
    } else {
      wet.push({ hose: s.hose, lengthM: (s.lengthM * left) / v });
      left = 0;
    }
  }
  return wet;
}

/**
 * What a filling line costs the pump beyond its valve: friction of the wet length only, kPa per
 * (L/min)², and the head up to the front, kPa (uniform grade, so the front has climbed the
 * filled fraction of the line's rise). No branch term: the branch vents air, not water.
 */
export function fillingLoad(line: HoseLine, waterL: number): { hoseR: number; headKpa: number } {
  const fill = lineFill(line, waterL);
  if (fill.waterL <= 0) return { hoseR: 0, headKpa: 0 };
  return {
    hoseR: hoseResistance(wetSegments(line.segments, fill.waterL)),
    headKpa: HEAD_KPA_PER_M * line.elevationM * fill.fraction,
  };
}

/**
 * A line with nothing coming in empties only through its branch, under its own head. Downhill
 * the water gathers at the branch end, its top the filled fraction of the drop above the branch
 * (uniform grade; the layflat flattens behind it rather than holding a vacuum). On the flat or
 * uphill the branch is at or above the water, so the line keeps it (seepage ignored).
 */
export function drainOut(line: HoseLine, waterL: number): { flowLpm: number; branchKpa: number } {
  const fill = lineFill(line, waterL);
  if (line.elevationM >= 0 || fill.waterL <= 0) return { flowLpm: 0, branchKpa: 0 };
  const branchKpa = HEAD_KPA_PER_M * -line.elevationM * fill.fraction;
  return { flowLpm: branchFlowLpm(line.branch, branchKpa), branchKpa };
}

/** Water in the line after `dtS`: what came in less what left by the branch, clamped to the hose. */
export function stepLineWater(
  line: HoseLine,
  waterL: number,
  inLpm: number,
  outLpm: number,
  dtS: number,
): number {
  return lineFill(line, waterL + ((inLpm - outLpm) * dtS) / 60).waterL;
}
