// Plan-view layout of a fireground with several trucks (M5): where each truck stands, its
// lays and supplies (geometry.ts, per truck), the relay hoses between them and portable dams.
// Pure functions of scene art and sim data; no React.
import type { ControlId, HoseLine, RelayLink, SimState, WaterSource } from '../../sim/types';
import type { SceneArt } from '../appliances/types';
import {
  layoutTruck,
  parkTruck,
  PUMP_BAY_U,
  scaleBarFor,
  toScene,
  type CouplingPoint,
  type LayGeometry,
  type Point,
  type SupplyGeometry,
  type SupplyRef,
  type TruckPose,
} from './geometry';
import { ATTACK_AT, DAM, TRUCK_AT } from './site';

/** Gap between two trucks at the same station, across the route, drawing units. */
const SAME_STATION_GAP_U = 110;

/** How far a portable dam stands off the suction coupling that draws from it, drawing units. */
const PORTABLE_DAM_OFFSET_U = 85;

/** Radius of a portable dam on the map, drawing units (a map symbol, not to scale). */
export const PORTABLE_DAM_R_U = 26;

/** How far a relay hose runs straight out of a coupling before it bends, drawing units. */
const RELAY_LEAD_U = 60;

/** One truck on the fireground, as the layout needs it. */
export interface SiteTruckInput {
  id: string;
  art: SceneArt;
  lines: readonly HoseLine[];
  supplies: readonly (SupplyRef & { sourceId: string })[];
}

export interface SiteInput {
  trucks: readonly SiteTruckInput[];
  links: readonly RelayLink[];
  sources: readonly WaterSource[];
}

export interface SiteTruckGeometry {
  id: string;
  pose: TruckPose;
  couplings: CouplingPoint[];
  lines: LayGeometry[];
  supplies: SupplyGeometry[];
}

export interface RelayGeometry {
  linkId: string;
  truckId: string;
  deliveryId: ControlId;
  /** SVG path from the supplying coupling to the far end. */
  path: string;
  /** Halfway along, for its label. */
  mid: Point;
  /** Where the burst length is, if one has burst. */
  burstAt?: Point;
}

/** A portable dam: a static source that holds a fixed amount. */
export interface DamGeometry extends Point {
  sourceId: string;
  r: number;
}

export interface SiteGeometry {
  trucks: SiteTruckGeometry[];
  relays: RelayGeometry[];
  dams: DamGeometry[];
  unitsPerM: number;
  scaleBarM: number;
}

const fmt = (n: number) => n.toFixed(1);
const rad = (deg: number) => (deg * Math.PI) / 180;
const dir = (deg: number): Point => ({ x: Math.cos(rad(deg)), y: Math.sin(rad(deg)) });
const unit = (from: Point, to: Point): Point => {
  const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
};

/** A point on a cubic Bézier at parameter `t`. */
function bezierAt(p: readonly [Point, Point, Point, Point], t: number): Point {
  const u = 1 - t;
  const [a, b, c, d] = p;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return {
    x: w[0] * a.x + w[1] * b.x + w[2] * c.x + w[3] * d.x,
    y: w[0] * a.y + w[1] * b.y + w[2] * c.y + w[3] * d.y,
  };
}

/** Trucks a truck sends water to: by relay into its inlet or tank, or a dam another draws from. */
function feeds(input: SiteInput, truckId: string): string[] {
  return input.links
    .filter((l) => l.truckId === truckId)
    .flatMap((l) => {
      const to = l.to;
      switch (to.kind) {
        case 'inlet':
        case 'tank':
          return [to.truckId];
        case 'dam':
          return input.trucks
            .filter((t) => t.supplies.some((s) => s.sourceId === to.sourceId))
            .map((t) => t.id);
      }
    });
}

/**
 * How far back along the relay each truck stands: 0 for one that feeds no other truck (it works
 * the fire), one more than the deepest truck it feeds otherwise.
 */
function stages(input: SiteInput): Map<string, number> {
  const memo = new Map<string, number>();
  const stage = (id: string, seen: ReadonlySet<string>): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const next = feeds(input, id).filter((t) => !seen.has(t));
    const s =
      next.length === 0 ? 0 : 1 + Math.max(...next.map((t) => stage(t, new Set([...seen, id]))));
    memo.set(id, s);
    return s;
  };
  for (const t of input.trucks) stage(t.id, new Set());
  return memo;
}

/**
 * Where each truck stands. One truck: the usual spot by the dam. Several: the deepest stage at
 * that spot, stage 0 up the track at `ATTACK_AT`, stages between evenly spaced, and trucks sharing
 * a stage spread across the route.
 */
function stations(input: SiteInput): Map<string, Point> {
  const out = new Map<string, Point>();
  if (input.trucks.length === 1) {
    const only = input.trucks[0];
    if (only !== undefined) out.set(only.id, TRUCK_AT);
    return out;
  }
  const byStage = stages(input);
  const deepest = Math.max(1, ...byStage.values());
  const along = unit(ATTACK_AT, TRUCK_AT);
  const across = { x: -along.y, y: along.x };
  const taken = new Map<number, number>();
  for (const t of input.trucks) {
    const s = byStage.get(t.id) ?? 0;
    const k = taken.get(s) ?? 0;
    taken.set(s, k + 1);
    const f = s / deepest;
    const side = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * SAME_STATION_GAP_U;
    out.set(t.id, {
      x: ATTACK_AT.x + f * (TRUCK_AT.x - ATTACK_AT.x) + side * across.x,
      y: ATTACK_AT.y + f * (TRUCK_AT.y - ATTACK_AT.y) + side * across.y,
    });
  }
  return out;
}

/** Where a truck's tank takes water from an open relay: its hatch, mid-body. */
function hatchPoint(art: SceneArt, pose: TruckPose): Point {
  const tankStart = -art.lengthU / 2 + PUMP_BAY_U;
  const tankEnd = art.lengthU / 2 - art.cabU;
  return toScene(pose, { x: (tankStart + tankEnd) / 2, y: -6 });
}

/**
 * Lay out a fireground: every truck at its station with its lays and supplies, portable dams by
 * the suction that draws from them, and each relay from its supplying coupling to the far end
 * (an inlet coupling, a tank hatch or a dam). Lays share one map scale, the tightest any truck
 * needs; relay hoses and trucks are map symbols, labelled rather than drawn to scale.
 */
export function layoutSite(input: SiteInput): SiteGeometry {
  const at = stations(input);
  const placed = input.trucks.map((t) => {
    const pose = parkTruck(t.art, at.get(t.id) ?? TRUCK_AT);
    return { input: t, pose, bare: layoutTruck(t.art, pose, []) };
  });

  const dams = input.sources.flatMap((source): DamGeometry[] => {
    if (source.kind !== 'static' || source.capacityL === undefined) return [];
    const drawer = placed.find((p) => p.input.supplies.some((s) => s.sourceId === source.id));
    const supply = drawer?.input.supplies.find((s) => s.sourceId === source.id);
    const coupling = drawer?.bare.couplings.find(
      (c) => c.kind === 'inlet' && c.control === supply?.inletId,
    );
    const centre =
      coupling === undefined
        ? { x: ATTACK_AT.x, y: ATTACK_AT.y + 90 }
        : {
            x: coupling.x + PORTABLE_DAM_OFFSET_U * dir(coupling.facingDeg).x,
            y: coupling.y + PORTABLE_DAM_OFFSET_U * dir(coupling.facingDeg).y,
          };
    return [{ sourceId: source.id, ...centre, r: PORTABLE_DAM_R_U }];
  });
  const damAt = (sourceId: string) => dams.find((d) => d.sourceId === sourceId);

  const trucks = placed.map(({ input: t, pose }) => {
    const supplies = t.supplies.map((s) => {
      const d = damAt(s.sourceId);
      return d === undefined ? s : { ...s, at: { x: d.x, y: d.y } };
    });
    return { id: t.id, layout: layoutTruck(t.art, pose, t.lines, supplies) };
  });
  const unitsPerM = Math.min(...trucks.map((t) => t.layout.fitUnitsPerM));
  const truckGeometry: SiteTruckGeometry[] = trucks.map(({ id, layout }) => ({
    id,
    pose: layout.pose,
    couplings: layout.couplings,
    ...layout.at(unitsPerM),
  }));

  const relays = input.links.flatMap((link): RelayGeometry[] => {
    const from = truckGeometry.find((t) => t.id === link.truckId);
    const start = from?.couplings.find(
      (c) => c.kind === 'delivery' && c.control === link.deliveryId,
    );
    if (start === undefined) return [];
    const far = relayEnd(link, truckGeometry, input, damAt, start);
    if (far === undefined) return [];
    const lead = dir(start.facingDeg);
    const p = [
      start,
      { x: start.x + RELAY_LEAD_U * lead.x, y: start.y + RELAY_LEAD_U * lead.y },
      {
        x: far.end.x + RELAY_LEAD_U * far.approach.x,
        y: far.end.y + RELAY_LEAD_U * far.approach.y,
      },
      far.end,
    ] as const;
    const path =
      `M${fmt(p[0].x)} ${fmt(p[0].y)} ` +
      `C${fmt(p[1].x)} ${fmt(p[1].y)}, ${fmt(p[2].x)} ${fmt(p[2].y)}, ${fmt(p[3].x)} ${fmt(p[3].y)}`;
    const n = Math.max(1, link.segments.length);
    return [
      {
        linkId: link.id,
        truckId: link.truckId,
        deliveryId: link.deliveryId,
        path,
        mid: bezierAt(p, 0.5),
        ...(link.burst === undefined
          ? {}
          : { burstAt: bezierAt(p, (link.burst.segment + 0.5) / n) }),
      },
    ];
  });

  return { trucks: truckGeometry, relays, dams, unitsPerM, scaleBarM: scaleBarFor(unitsPerM) };
}

/** Where a relay ends, and the way its hose comes in (pointing back out of the end). */
function relayEnd(
  link: RelayLink,
  trucks: readonly SiteTruckGeometry[],
  input: SiteInput,
  damAt: (id: string) => DamGeometry | undefined,
  start: Point,
): { end: Point; approach: Point } | undefined {
  const to = link.to;
  switch (to.kind) {
    case 'inlet': {
      const c = trucks
        .find((t) => t.id === to.truckId)
        ?.couplings.find((x) => x.kind === 'inlet' && x.control === to.inletId);
      return c === undefined ? undefined : { end: c, approach: dir(c.facingDeg) };
    }
    case 'tank': {
      const t = trucks.find((x) => x.id === to.truckId);
      const art = input.trucks.find((x) => x.id === to.truckId)?.art;
      if (t === undefined || art === undefined) return undefined;
      const end = hatchPoint(art, t.pose);
      return { end, approach: unit(end, start) };
    }
    case 'dam': {
      const d = damAt(to.sourceId);
      if (d === undefined) return { end: DAM.intake, approach: unit(DAM.intake, start) };
      const toward = unit(d, start);
      return { end: { x: d.x + d.r * toward.x, y: d.y + d.r * toward.y }, approach: toward };
    }
  }
}

/** The layout's input from sim state: every truck with its art, lays and supplies. */
export function siteInput(sim: SimState, artFor: (applianceId: string) => SceneArt): SiteInput {
  return {
    trucks: sim.trucks.map((t) => ({
      id: t.id,
      art: artFor(t.spec.id),
      lines: sim.lines.filter((l) => l.truckId === t.id),
      supplies: sim.supplies
        .filter((s) => s.truckId === t.id)
        .flatMap((s) => {
          const source = sim.sources.find((x) => x.id === s.sourceId);
          return source === undefined
            ? []
            : [{ id: s.id, inletId: s.inletId, sourceKind: source.kind, sourceId: source.id }];
        }),
    })),
    links: sim.links,
    sources: sim.sources,
  };
}
