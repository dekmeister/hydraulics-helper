// Relay pumping (ARCHITECTURE §4.7): hoses from one truck's delivery to another truck or a dam,
// and the solve order that couples the pumps of a closed relay.
import {
  HEAD_KPA_PER_M,
  HOSE_BURST_KPA,
  RELAY_FIT_MIN_R,
  RELAY_FIT_PROBE_LPM,
  VALVE_CLOSED_EPS,
} from './constants';
import { surgeKpa } from './hammer';
import { hoseResistance, hoseType, isRigid } from './hose';
import type { RelayFeed } from './inlets';
import { solveTruck, valveLossCoeff, type RelayOutlet, type TruckSolveInput } from './network';
import type {
  ApplianceSpec,
  HoseLine,
  PlayerInputs,
  RelayLink,
  RelayReading,
  SimState,
  TruckReadings,
  TruckState,
} from './types';

/** The receiving truck of a live closed relay (one that ends at another truck's inlet). */
export function closedTo(link: RelayLink): string | undefined {
  return link.burst === undefined && link.to.kind === 'inlet' ? link.to.truckId : undefined;
}

/**
 * Truck ids ordered so every supplying pump of a closed relay comes before the pump it feeds
 * (Kahn's topological sort, ties kept in `truckIds` order). Closed relays couple the pumps' solves;
 * open relays and burst hoses don't. Throws if closed relays form a loop.
 */
export function relayOrder(truckIds: readonly string[], links: readonly RelayLink[]): string[] {
  const feeds = links.flatMap((l) => {
    const to = closedTo(l);
    return to === undefined ? [] : [{ from: l.truckId, to }];
  });
  const order: string[] = [];
  const left = [...truckIds];
  while (left.length > 0) {
    const next = left.find((id) => !feeds.some((f) => f.to === id && left.includes(f.from)));
    if (next === undefined)
      throw new Error(`Closed relays form a loop through '${left.join("', '")}'`);
    order.push(next);
    left.splice(left.indexOf(next), 1);
  }
  return order;
}

/**
 * Pressure at the far end of a relay hose, kPa: the start less friction and head, the manual's
 * spacing rule (C12, C13: 700 out − 600 budget = 100 kPa residual).
 */
export function relayEndKpa(
  startKpa: number,
  segments: RelayLink['segments'],
  elevationM: number,
  flowLpm: number,
): number {
  return startKpa - hoseResistance(segments) * flowLpm * flowLpm - HEAD_KPA_PER_M * elevationM;
}

/** Loss coefficient of the supplying delivery valve at its opening, kPa per (L/min)². */
function valveR(spec: ApplianceSpec, link: RelayLink, open: number): number {
  const delivery = spec.deliveries.find((d) => d.id === link.deliveryId);
  if (delivery === undefined) throw new Error(`${spec.id} has no delivery '${link.deliveryId}'`);
  return valveLossCoeff(delivery.sizeMm) / (open * open);
}

/**
 * Hose a relay's water runs through before it reaches the open: the whole hose, or up to and
 * including a burst length, with the head climbed to there (uniform grade assumed).
 */
function openReach(link: RelayLink) {
  const n = link.burst === undefined ? link.segments.length : link.burst.segment + 1;
  const segments = link.segments.slice(0, n);
  const share = link.segments.length > 0 ? n / link.segments.length : 1;
  return { segments, headKpa: HEAD_KPA_PER_M * link.elevationM * share };
}

/**
 * Outlets a truck's relays give its solve. A live closed relay takes `closedFlowLpm(link)`, what
 * the receiving pump draws; an open relay or a burst hose flows to atmosphere through its valve
 * and hose. A shut delivery valve gives nothing.
 */
export function relayOutlets(
  spec: ApplianceSpec,
  inputs: PlayerInputs,
  leaving: readonly RelayLink[],
  closedFlowLpm: (link: RelayLink) => number,
): RelayOutlet[] {
  return leaving.flatMap((link): RelayOutlet[] => {
    const open = inputs.valves[link.deliveryId] ?? 0;
    if (open < VALVE_CLOSED_EPS) return [];
    if (closedTo(link) !== undefined) {
      return [{ deliveryId: link.deliveryId, kind: 'fixed', flowLpm: closedFlowLpm(link) }];
    }
    const reach = openReach(link);
    return [
      {
        deliveryId: link.deliveryId,
        kind: 'open',
        r: valveR(spec, link, open) + hoseResistance(reach.segments),
        headKpa: reach.headKpa,
      },
    ];
  });
}

/**
 * The feed a live closed relay gives the receiving inlet. Seen from its relay delivery, the
 * supplying pump is a source P = H − R·Q² (exact for a pump on tank or hydrant with only the relay
 * open: pump curve and inlet loss are both square laws). H and R come from two solves, at no relay
 * flow and at `prevFlowLpm` (the last tick's operating point, or a probe flow), so the fit is exact
 * there and follows the real curve as the flow settles. `supplier.relayOut` holds its other relays.
 * Undefined when the relay delivery is shut or the pump can't lift water to the far end.
 */
export function relayFeed(
  supplier: TruckSolveInput,
  lines: readonly HoseLine[],
  link: RelayLink,
  prevFlowLpm: number,
): RelayFeed | undefined {
  if (link.to.kind !== 'inlet') return undefined;
  const open = supplier.inputs.valves[link.deliveryId] ?? 0;
  if (open < VALVE_CLOSED_EPS) return undefined;
  const others = supplier.relayOut ?? [];
  const dischargeAt = (flowLpm: number) =>
    solveTruck(
      {
        ...supplier,
        relayOut: [...others, { deliveryId: link.deliveryId, kind: 'fixed', flowLpm }],
      },
      lines,
    ).dischargeKpa;
  const qRef = Math.max(prevFlowLpm, RELAY_FIT_PROBE_LPM);
  const h = dischargeAt(0);
  const r = Math.max(RELAY_FIT_MIN_R, (h - dischargeAt(qRef)) / (qRef * qRef));
  const headKpa = h - HEAD_KPA_PER_M * link.elevationM;
  if (headKpa <= 0) return undefined;
  return {
    inletId: link.to.inletId,
    headKpa,
    r: r + valveR(supplier.spec, link, open) + hoseResistance(link.segments),
    rigid: isRigid(link.segments),
  };
}

/** What a relay hose is doing, from its supplying truck's solve (and the receiver's, if closed). */
function relayReading(
  link: RelayLink,
  supplier: TruckSolveInput,
  readings: TruckReadings,
  receiver: TruckReadings | undefined,
): RelayReading {
  const open = supplier.inputs.valves[link.deliveryId] ?? 0;
  const flowLpm = readings.deliveryFlowLpm[link.deliveryId] ?? 0;
  if (open < VALVE_CLOSED_EPS || readings.dischargeKpa <= 0) {
    return { flowLpm, startKpa: 0, endKpa: 0, collapsed: false };
  }
  const startKpa = Math.max(
    0,
    readings.dischargeKpa - valveR(supplier.spec, link, open) * flowLpm * flowLpm,
  );
  if (closedTo(link) === undefined || link.to.kind !== 'inlet') {
    return { flowLpm, startKpa, endKpa: 0, collapsed: false };
  }
  return {
    flowLpm,
    startKpa,
    endKpa: Math.max(0, relayEndKpa(startKpa, link.segments, link.elevationM, flowLpm)),
    collapsed: receiver?.inletCollapsed[link.to.inletId] === true,
  };
}

export interface SiteSolve {
  /** Each truck's solve input as solved, relays included, keyed by truck id. */
  inputs: Map<string, TruckSolveInput>;
  readings: Map<string, TruckReadings>;
  linkReadings: Record<string, RelayReading>;
}

/**
 * Solve every truck on the fireground. Upstream first, each truck is prepared (`prepare` gets the
 * relay feeds into it, e.g. to see whether its casing is flooded) and its live closed relays are
 * turned into feeds for the trucks they supply. Then downstream first, each truck is solved, a
 * closed relay leaving it taking exactly what its receiver drew, so water is conserved.
 */
export function solveSite(
  state: SimState,
  prepare: (truck: TruckState, relayIn: RelayFeed[]) => TruckSolveInput,
): SiteSolve {
  const order = relayOrder(
    state.trucks.map((t) => t.id),
    state.links,
  );
  const truckById = new Map(state.trucks.map((t) => [t.id, t]));
  const linesOf = (id: string) => state.lines.filter((l) => l.truckId === id);
  const leavingOf = (id: string) => state.links.filter((l) => l.truckId === id);
  const prevFlow = (link: RelayLink) => state.linkReadings[link.id]?.flowLpm ?? 0;

  const feeds = new Map<string, RelayFeed[]>();
  const inputs = new Map<string, TruckSolveInput>();
  for (const id of order) {
    const truck = truckById.get(id);
    if (truck === undefined) throw new Error(`No truck '${id}'`);
    const input = prepare(truck, feeds.get(id) ?? []);
    inputs.set(id, input);
    const leaving = leavingOf(id);
    for (const link of leaving) {
      const to = closedTo(link);
      if (to === undefined) continue;
      const others = leaving.filter((l) => l !== link);
      const relayOut = relayOutlets(input.spec, input.inputs, others, prevFlow);
      const feed = relayFeed({ ...input, relayOut }, linesOf(id), link, prevFlow(link));
      if (feed !== undefined) feeds.set(to, [...(feeds.get(to) ?? []), feed]);
    }
  }

  const readings = new Map<string, TruckReadings>();
  const drawnBy = (link: RelayLink) =>
    link.to.kind === 'inlet'
      ? (readings.get(link.to.truckId)?.inletFlowLpm[link.to.inletId] ?? 0)
      : 0;
  for (const id of [...order].reverse()) {
    const prepared = inputs.get(id);
    if (prepared === undefined) throw new Error(`No truck '${id}'`);
    const relayOut = relayOutlets(prepared.spec, prepared.inputs, leavingOf(id), drawnBy);
    const input = { ...prepared, relayOut };
    inputs.set(id, input);
    readings.set(id, solveTruck(input, linesOf(id)));
  }

  const linkReadings: Record<string, RelayReading> = {};
  for (const link of state.links) {
    const supplier = inputs.get(link.truckId);
    const own = readings.get(link.truckId);
    if (supplier === undefined || own === undefined) throw new Error(`No truck '${link.truckId}'`);
    const receiver = link.to.kind === 'inlet' ? readings.get(link.to.truckId) : undefined;
    linkReadings[link.id] = relayReading(link, supplier, own, receiver);
  }
  return { inputs, readings, linkReadings };
}

/** Valve openings of each truck last tick and this tick, to tell who cut a relay's flow. */
export interface ValveChange {
  before: (truckId: string) => Record<string, number>;
  now: (truckId: string) => Record<string, number>;
}

/**
 * Relays after this tick's over-pressure check. A live closed relay's peak pressure is its higher
 * end now, or its far end as it was plus a Joukowsky surge if the receiving pump cut the flow this
 * tick (the shutdown spike, L3865–3873). A drop because the supplying pump shut its own delivery
 * is water hammer on that pump instead. At `HOSE_BURST_KPA` a length bursts: the first if the
 * supplying end peaked, the last if the far end did.
 */
export function checkBursts(
  links: readonly RelayLink[],
  before: Readonly<Record<string, RelayReading>>,
  now: Readonly<Record<string, RelayReading>>,
  valves: ValveChange,
  timeS: number,
): RelayLink[] {
  return links.map((link) => {
    const r = now[link.id];
    const first = link.segments[0];
    if (closedTo(link) === undefined || r === undefined || first === undefined) return link;
    const prev = before[link.id];
    const id = link.deliveryId;
    const supplierShut =
      (valves.now(link.truckId)[id] ?? 0) < (valves.before(link.truckId)[id] ?? 0);
    const dropLpm = prev === undefined || supplierShut ? 0 : prev.flowLpm - r.flowLpm;
    const surge = dropLpm > 0 ? surgeKpa(dropLpm, hoseType(first.hose).sizeMm) : 0;
    const farKpa = Math.max(r.endKpa, (prev?.endKpa ?? 0) + surge);
    const peakKpa = Math.max(r.startKpa, farKpa);
    if (peakKpa < HOSE_BURST_KPA) return link;
    const segment = r.startKpa >= farKpa ? 0 : link.segments.length - 1;
    return { ...link, burst: { atS: timeS, segment, peakKpa } };
  });
}
