// Water gushing out of a burst relay length, or out of a bare delivery opened at the truck (issue
// #16), for the scene: how big, and the shapes. A split 65 mm length pours a heavy sheet sideways
// out of both sides of the split, not a fine spray; a bare outlet throws one straight out.
import { CHARGED_MIN_LPM } from '../../state/selectors';
import { SPRAY_REACH_U, type Point } from './geometry';

/**
 * Flow out of the hole at which the gush is drawn its largest, L/min: about what a Cat 1 base pump
 * runs out of an open 65 mm length. Presentation, not hydraulics.
 */
export const BURST_GUSH_FULL_LPM = 800;

/** Smallest gush drawn while water flows, of the largest: a small flow still shows. UI choice. */
export const BURST_GUSH_MIN_SCALE = 0.35;

/** Width of a lobe at its widest, of its reach. UI choice. */
const LOBE_WIDTH = 0.5;

/** Streaks per lobe and how far out they run, of the reach. UI choice. */
const STREAK_OFFSETS = [-0.3, 0, 0.3] as const;
const STREAK_REACH = 0.85;

/**
 * How big to draw the gush, 0–1 of the largest: nothing below the scene's "water moving" flow
 * (`CHARGED_MIN_LPM`), then growing linearly with the flow out of the hole (a jet's throw goes with
 * its velocity, so with flow through a fixed split) from `BURST_GUSH_MIN_SCALE` to 1 at
 * `BURST_GUSH_FULL_LPM`.
 */
export function burstGushScale(flowLpm: number): number {
  if (!(flowLpm >= CHARGED_MIN_LPM)) return 0;
  const f = Math.min(1, (flowLpm - CHARGED_MIN_LPM) / (BURST_GUSH_FULL_LPM - CHARGED_MIN_LPM));
  return BURST_GUSH_MIN_SCALE + (1 - BURST_GUSH_MIN_SCALE) * f;
}

/** One side's gush: an outline, the white streaks running out along it, and its far tip. */
export interface GushLobe {
  body: string;
  streaks: string[];
  tip: Point;
}

const fmt = (n: number) => n.toFixed(1);

/**
 * The two lobes of water thrown out square to a hose running at `headingDeg` (degrees, scene
 * axes), relative to the split: narrow at the hole, fanning out to `SPRAY_REACH_U × scale`.
 */
export function burstGushLobes(scale: number, headingDeg: number): GushLobe[] {
  return [90, -90].map((side) => gushLobe(SPRAY_REACH_U * scale, headingDeg + side));
}

/**
 * The one lobe thrown straight out of a bare outlet facing `facingDeg` (degrees, the drawing's
 * axes), relative to the coupling: narrow at the outlet, fanning out to `SPRAY_REACH_U × scale`.
 */
export function outletGushLobe(scale: number, facingDeg: number): GushLobe {
  return gushLobe(SPRAY_REACH_U * scale, facingDeg);
}

/** A lobe of water thrown `reach` out from the hole along `outDeg`. */
function gushLobe(reach: number, outDeg: number): GushLobe {
  const w = reach * LOBE_WIDTH;
  const a = (outDeg * Math.PI) / 180;
  const out = { x: Math.cos(a), y: Math.sin(a) };
  const across = { x: -out.y, y: out.x };
  // A point `u` out from the hole and `v` across the lobe.
  const at = (u: number, v: number): Point => ({
    x: u * out.x + v * across.x,
    y: u * out.y + v * across.y,
  });
  const p = (u: number, v: number) => {
    const q = at(u, v);
    return `${fmt(q.x)} ${fmt(q.y)}`;
  };
  const body =
    `M${p(0, -2)} ` +
    `C${p(reach * 0.35, -w * 0.6)}, ${p(reach * 0.8, -w / 2)}, ${p(reach, -w * 0.15)} ` +
    `Q${p(reach * 1.05, 0)}, ${p(reach, w * 0.15)} ` +
    `C${p(reach * 0.8, w / 2)}, ${p(reach * 0.35, w * 0.6)}, ${p(0, 2)} Z`;
  const streaks = STREAK_OFFSETS.map(
    (k) => `M${p(reach * 0.1, 0)} L${p(reach * STREAK_REACH, k * w)}`,
  );
  return { body, streaks, tip: at(reach, 0) };
}
