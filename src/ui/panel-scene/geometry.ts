// Plan-view scene layout (PLAN M3): where the truck, its couplings, hose lays and branches are
// drawn. Pure functions of the scene art and the sim's lines; no React.
import type { ControlId, HoseLine } from '../../sim/types';
import type { SceneArt } from '../appliances/types';
import { FIRE_HEADING_DEG, TRUCK_AT } from './site';

/** Scene drawing space (SVG viewBox). */
export const SCENE_VIEW = { w: 800, h: 500 } as const;

/** Map scale when every lay fits, drawing units per metre of ground. */
export const DEFAULT_UNITS_PER_M = 5;

/** Laid hose snakes, so a branch sits this fraction of the hose length from the truck. */
const LAY_STRAIGHTNESS = 0.85;

/** How far a branch's spray fan reaches beyond the branch, drawing units. */
export const SPRAY_REACH_U = 70;

/** Gap kept between the spray tip and the edge of the view, drawing units. */
const EDGE_U = 12;

/** Widest fan between the outermost lays, and the most between neighbours, degrees. */
const FAN_SPAN_DEG = 38;
const FAN_STEP_MAX_DEG = 16;

/** How far a hose runs straight out of its coupling before it bends, drawing units. */
const COUPLING_LEAD_U = 60;

/** Branch never closer to the truck than this, drawing units, however short the lay. */
const MIN_REACH_U = 100;

const SCALE_BAR_CHOICES_M = [5, 10, 20, 25, 50, 100, 200] as const;
const SCALE_BAR_MAX_U = 140;

export interface Point {
  x: number;
  y: number;
}

/** Truck position and heading (degrees, 0 = cab pointing right, clockwise with y down). */
export interface TruckPose extends Point {
  headingDeg: number;
}

export interface CouplingPoint extends Point {
  deliveryId: ControlId;
  /** Way the coupling points in the scene, degrees. */
  facingDeg: number;
}

export interface LayGeometry {
  lineId: string;
  deliveryId: ControlId;
  /** SVG path from the coupling to the branch. */
  path: string;
  branch: Point;
  /** Way the branch points (and sprays), degrees. */
  headingDeg: number;
}

export interface SceneGeometry {
  truck: TruckPose;
  couplings: CouplingPoint[];
  lines: LayGeometry[];
  unitsPerM: number;
  /** Length the scale bar stands for, m. */
  scaleBarM: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const dir = (deg: number): Point => ({ x: Math.cos(rad(deg)), y: Math.sin(rad(deg)) });
const fmt = (n: number) => n.toFixed(1);

/** A truck-local point (art frame) in scene coordinates. */
export function toScene(pose: TruckPose, local: Point): Point {
  const c = Math.cos(rad(pose.headingDeg));
  const s = Math.sin(rad(pose.headingDeg));
  return { x: pose.x + local.x * c - local.y * s, y: pose.y + local.x * s + local.y * c };
}

/**
 * Park the truck so its couplings, on average, point towards the fireground (a crew lays out from
 * where the outlets are). Couplings pointing every way at once leave the truck square to the view.
 */
function parkTruck(art: SceneArt): TruckPose {
  let sx = 0;
  let sy = 0;
  for (const c of art.couplings) {
    sx += Math.cos(rad(c.facingDeg));
    sy += Math.sin(rad(c.facingDeg));
  }
  const balanced = Math.hypot(sx, sy) < 0.1 * Math.max(1, art.couplings.length);
  const meanFacingDeg = (Math.atan2(sy, sx) * 180) / Math.PI;
  return { ...TRUCK_AT, headingDeg: balanced ? 0 : FIRE_HEADING_DEG - meanFacingDeg };
}

/** Distance from `from` along `headingDeg` to the edge of the view less `EDGE_U`. */
function roomAlong(from: Point, headingDeg: number): number {
  const d = dir(headingDeg);
  const limits: number[] = [];
  if (d.x > 1e-9) limits.push((SCENE_VIEW.w - EDGE_U - from.x) / d.x);
  if (d.x < -1e-9) limits.push((EDGE_U - from.x) / d.x);
  if (d.y > 1e-9) limits.push((SCENE_VIEW.h - EDGE_U - from.y) / d.y);
  if (d.y < -1e-9) limits.push((EDGE_U - from.y) / d.y);
  return Math.min(...limits);
}

const layLengthM = (line: HoseLine) => line.segments.reduce((sum, s) => sum + s.lengthM, 0);

/** Largest round scale-bar length that stays a comfortable size at `unitsPerM`. */
function scaleBarFor(unitsPerM: number): number {
  const fits = SCALE_BAR_CHOICES_M.filter((m) => m * unitsPerM <= SCALE_BAR_MAX_U);
  return fits.at(-1) ?? SCALE_BAR_CHOICES_M[0];
}

/**
 * Lay out the scene for one truck: park it, place a coupling per delivery, and run each laid line
 * from its coupling to a branch on a fan towards the fire. A branch's distance from the truck is
 * proportional to the hose laid; the scale shrinks so the longest lay and its spray stay in view.
 */
export function layoutScene(art: SceneArt, lines: readonly HoseLine[]): SceneGeometry {
  const truck = parkTruck(art);
  const couplings: CouplingPoint[] = art.couplings.map((c) => ({
    deliveryId: c.delivery,
    ...toScene(truck, c),
    facingDeg: c.facingDeg + truck.headingDeg,
  }));
  const couplingFor = (id: ControlId) => couplings.find((c) => c.deliveryId === id);

  // Order lays across the fan by where their couplings sit, so neighbouring hoses don't cross.
  const across = dir(FIRE_HEADING_DEG - 90);
  const laid = lines
    .map((line) => ({ line, coupling: couplingFor(line.deliveryId) }))
    .filter((l): l is { line: HoseLine; coupling: CouplingPoint } => l.coupling !== undefined)
    .sort(
      (a, b) =>
        b.coupling.x * across.x +
          b.coupling.y * across.y -
          (a.coupling.x * across.x + a.coupling.y * across.y) || a.line.id.localeCompare(b.line.id),
    );

  const n = laid.length;
  const step = n > 1 ? Math.min(FAN_STEP_MAX_DEG, FAN_SPAN_DEG / (n - 1)) : 0;
  const headings = laid.map((_, i) => FIRE_HEADING_DEG + (i - (n - 1) / 2) * step);

  const fits = laid.map(
    ({ line }, i) =>
      (roomAlong(truck, headings[i] ?? FIRE_HEADING_DEG) - SPRAY_REACH_U) /
      (LAY_STRAIGHTNESS * Math.max(1, layLengthM(line))),
  );
  const unitsPerM = Math.max(0.1, Math.min(DEFAULT_UNITS_PER_M, ...fits));

  const lays = laid.map(({ line, coupling }, i): LayGeometry => {
    const headingDeg = headings[i] ?? FIRE_HEADING_DEG;
    const room = roomAlong(truck, headingDeg) - SPRAY_REACH_U;
    const reach = Math.min(
      room,
      Math.max(MIN_REACH_U, LAY_STRAIGHTNESS * layLengthM(line) * unitsPerM),
    );
    const h = dir(headingDeg);
    const branch = { x: truck.x + reach * h.x, y: truck.y + reach * h.y };
    // Out of the coupling first, then sweep in to the branch from a little off its heading.
    const lead = dir(coupling.facingDeg);
    const c1 = {
      x: coupling.x + COUPLING_LEAD_U * lead.x,
      y: coupling.y + COUPLING_LEAD_U * lead.y,
    };
    const approach = dir(headingDeg + (i % 2 === 0 ? 14 : -14));
    const c2 = { x: branch.x - 0.35 * reach * approach.x, y: branch.y - 0.35 * reach * approach.y };
    const path =
      `M${fmt(coupling.x)} ${fmt(coupling.y)} ` +
      `C${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(branch.x)} ${fmt(branch.y)}`;
    return { lineId: line.id, deliveryId: line.deliveryId, path, branch, headingDeg };
  });

  return { truck, couplings, lines: lays, unitsPerM, scaleBarM: scaleBarFor(unitsPerM) };
}
