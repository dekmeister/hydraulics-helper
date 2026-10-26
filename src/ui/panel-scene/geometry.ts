// Plan-view scene layout (M3): where the truck, its couplings, hose lays and branches are
// drawn. Pure functions of the scene art and the sim's lines; no React.
import type { ControlId, HoseLine, WaterSource } from '../../sim/types';
import type { SceneArt } from '../appliances/types';
import { DAM, FIRE_HEADING_DEG, HYDRANT, TRUCK_AT } from './site';

/** Scene drawing space (SVG viewBox). */
export const SCENE_VIEW = { w: 800, h: 500 } as const;

/** Map scale when every lay fits, drawing units per metre of ground. */
export const DEFAULT_UNITS_PER_M = 5;

/** Length of the pump bay at the rear of a truck's body, drawing units (`ApplianceArt`). */
export const PUMP_BAY_U = 14;

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
  /** Spec control id: a delivery or a suction inlet. */
  control: ControlId;
  kind: 'delivery' | 'inlet';
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

/** A supply hose from a truck's inlet coupling to its source. */
export interface SupplyGeometry {
  supplyId: string;
  inletId: ControlId;
  sourceKind: WaterSource['kind'];
  path: string;
  /** The source end: strainer in the dam, or the hydrant. */
  end: Point;
}

/** What `layoutScene` needs to know about a supply hose. */
export interface SupplyRef {
  id: string;
  inletId: ControlId;
  sourceKind: WaterSource['kind'];
  /** Where the source is drawn, if not at its usual place (the dam, the hydrant). */
  at?: Point;
}

export interface SceneGeometry {
  truck: TruckPose;
  couplings: CouplingPoint[];
  lines: LayGeometry[];
  supplies: SupplyGeometry[];
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
 * Park the truck at `at` so its couplings, on average, point towards the fireground (a crew lays
 * out from where the outlets are). Couplings pointing every way at once leave it square to the view.
 */
export function parkTruck(art: SceneArt, at: Point = TRUCK_AT): TruckPose {
  let sx = 0;
  let sy = 0;
  const deliveries = art.couplings.filter((c) => c.kind === 'delivery');
  for (const c of deliveries) {
    sx += Math.cos(rad(c.facingDeg));
    sy += Math.sin(rad(c.facingDeg));
  }
  const balanced = Math.hypot(sx, sy) < 0.1 * Math.max(1, deliveries.length);
  const meanFacingDeg = (Math.atan2(sy, sx) * 180) / Math.PI;
  return { x: at.x, y: at.y, headingDeg: balanced ? 0 : FIRE_HEADING_DEG - meanFacingDeg };
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
export function scaleBarFor(unitsPerM: number): number {
  const fits = SCALE_BAR_CHOICES_M.filter((m) => m * unitsPerM <= SCALE_BAR_MAX_U);
  return fits.at(-1) ?? SCALE_BAR_CHOICES_M[0];
}

/** How far a supply hose runs straight out of its inlet coupling, drawing units. */
const INLET_LEAD_U = 36;

/** Where a supply from a source of `kind` ends on the map, by default. */
function sourcePoint(kind: WaterSource['kind']): Point {
  switch (kind) {
    case 'static':
      return DAM.intake;
    case 'hydrant':
      return HYDRANT;
  }
}

/** A supply hose: out of its coupling along its facing, then into the source. */
export function supplyPath(coupling: CouplingPoint, end: Point): string {
  const lead = dir(coupling.facingDeg);
  const c1 = { x: coupling.x + INLET_LEAD_U * lead.x, y: coupling.y + INLET_LEAD_U * lead.y };
  const c2 = { x: (c1.x + end.x) / 2, y: Math.max(c1.y, end.y) };
  return (
    `M${fmt(coupling.x)} ${fmt(coupling.y)} ` +
    `C${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(end.x)} ${fmt(end.y)}`
  );
}

/** What a truck's fan of lays looks like before the map scale is known. */
interface Fan {
  laid: { line: HoseLine; coupling: CouplingPoint }[];
  headings: number[];
}

/** Couplings of `art` parked at `pose`, in scene coordinates. */
function placeCouplings(art: SceneArt, pose: TruckPose): CouplingPoint[] {
  return art.couplings.map((c) => ({
    control: c.control,
    kind: c.kind,
    ...toScene(pose, c),
    facingDeg: c.facingDeg + pose.headingDeg,
  }));
}

/** The truck's laid lines on a fan towards the fire, ordered so neighbouring hoses don't cross. */
function fanOut(couplings: readonly CouplingPoint[], lines: readonly HoseLine[]): Fan {
  const couplingFor = (id: ControlId) =>
    couplings.find((c) => c.kind === 'delivery' && c.control === id);
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
  return { laid, headings: laid.map((_, i) => FIRE_HEADING_DEG + (i - (n - 1) / 2) * step) };
}

/** Largest map scale at which every lay of the fan, with its spray, stays in view. */
function fitScale(pose: TruckPose, fan: Fan): number {
  const fits = fan.laid.map(
    ({ line }, i) =>
      (roomAlong(pose, fan.headings[i] ?? FIRE_HEADING_DEG) - SPRAY_REACH_U) /
      (LAY_STRAIGHTNESS * Math.max(1, layLengthM(line))),
  );
  return Math.max(0.1, Math.min(DEFAULT_UNITS_PER_M, ...fits));
}

/** Each lay of the fan from its coupling to its branch, at `unitsPerM`. */
function fanLays(pose: TruckPose, fan: Fan, unitsPerM: number): LayGeometry[] {
  return fan.laid.map(({ line, coupling }, i): LayGeometry => {
    const headingDeg = fan.headings[i] ?? FIRE_HEADING_DEG;
    const room = roomAlong(pose, headingDeg) - SPRAY_REACH_U;
    const reach = Math.min(
      room,
      Math.max(MIN_REACH_U, LAY_STRAIGHTNESS * layLengthM(line) * unitsPerM),
    );
    const h = dir(headingDeg);
    const branch = { x: pose.x + reach * h.x, y: pose.y + reach * h.y };
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
}

/** Supply hoses from their inlet couplings to their sources. */
function supplyLays(
  couplings: readonly CouplingPoint[],
  supplies: readonly SupplyRef[],
): SupplyGeometry[] {
  return supplies.flatMap((s): SupplyGeometry[] => {
    const coupling = couplings.find((c) => c.kind === 'inlet' && c.control === s.inletId);
    if (coupling === undefined) return [];
    const end = s.at ?? sourcePoint(s.sourceKind);
    return [
      {
        supplyId: s.id,
        inletId: s.inletId,
        sourceKind: s.sourceKind,
        path: supplyPath(coupling, end),
        end,
      },
    ];
  });
}

/** One truck's part of the scene, before the shared map scale is applied. */
export interface TruckLayout {
  pose: TruckPose;
  couplings: CouplingPoint[];
  /** Largest map scale its lays fit at. */
  fitUnitsPerM: number;
  /** Its lays and supply hoses at a map scale. */
  at: (unitsPerM: number) => { lines: LayGeometry[]; supplies: SupplyGeometry[] };
}

/** Lay out one truck parked at `pose`: couplings, its lays' fan and its supply hoses. */
export function layoutTruck(
  art: SceneArt,
  pose: TruckPose,
  lines: readonly HoseLine[],
  supplies: readonly SupplyRef[] = [],
): TruckLayout {
  const couplings = placeCouplings(art, pose);
  const fan = fanOut(couplings, lines);
  return {
    pose,
    couplings,
    fitUnitsPerM: fitScale(pose, fan),
    at: (unitsPerM) => ({
      lines: fanLays(pose, fan, unitsPerM),
      supplies: supplyLays(couplings, supplies),
    }),
  };
}

/**
 * Lay out the scene for one truck: park it, place its couplings, and run each laid line from its
 * coupling to a branch on a fan towards the fire. A branch's distance from the truck is
 * proportional to the hose laid; the scale shrinks so the longest lay and its spray stay in view.
 * Supply hoses run from their inlet couplings to the dam or the hydrant (map symbols, not to scale).
 */
export function layoutScene(
  art: SceneArt,
  lines: readonly HoseLine[],
  supplies: readonly SupplyRef[] = [],
): SceneGeometry {
  const truck = layoutTruck(art, parkTruck(art), lines, supplies);
  const unitsPerM = truck.fitUnitsPerM;
  return {
    truck: truck.pose,
    couplings: truck.couplings,
    ...truck.at(unitsPerM),
    unitsPerM,
    scaleBarM: scaleBarFor(unitsPerM),
  };
}
