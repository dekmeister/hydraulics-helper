// Test-only helpers for sim tests. Pure; never imported by app code.
import { expect } from 'vitest';
import { STANDARD_LENGTH_M, TICK_S } from './constants';
import { inletOfKind } from './appliances/controls';
import { DEFAULT_TRUCK_ID, advance, createSiteState, type SiteOptions } from './engine';
import { nextRandom } from './rng';
import type {
  ApplianceSpec,
  ControlId,
  HoseLine,
  PlayerInputs,
  RelayLink,
  SimState,
  TruckState,
} from './types';

/** A flat line of `lengths` × 30 m of `hose` from `deliveryId` to a `tipMm` branch. */
export function layLine(
  deliveryId: ControlId,
  hose: string,
  lengths: number,
  tipMm: number,
  elevationM = 0,
): HoseLine {
  return {
    id: `line-${deliveryId}`,
    truckId: DEFAULT_TRUCK_ID,
    deliveryId,
    segments: Array.from({ length: lengths }, () => ({ hose, lengthM: STANDARD_LENGTH_M })),
    elevationM,
    branch: { tipMm },
  };
}

/** One 2-length 38 mm line with a 15 mm branch on every delivery of `spec`. */
export function lineOnEveryDelivery(spec: ApplianceSpec): HoseLine[] {
  return spec.deliveries.map((d) => layLine(d.id, '38L', 2, 15));
}

/** Inputs with every tank inlet open and the given deliveries open. */
export function tankAttackInputs(
  spec: ApplianceSpec,
  throttle: number,
  open: readonly ControlId[],
): PlayerInputs {
  const valves: Record<ControlId, number> = {};
  for (const i of spec.inlets) if (i.kind === 'tank') valves[i.id] = 1;
  for (const id of open) valves[id] = 1;
  return { throttle, valves, switches: {} };
}

/** Run `ticks` fixed ticks with constant inputs. */
export function run(state: SimState, inputs: PlayerInputs, ticks: number): SimState {
  let s = state;
  for (let i = 0; i < ticks; i++) s = advance(s, inputs, TICK_S);
  return s;
}

/** The truck with `id`; throws if there is none. */
export function truck(state: SimState, id: string): TruckState {
  const t = state.trucks.find((x) => x.id === id);
  if (t === undefined) throw new Error(`state has no truck '${id}'`);
  return t;
}

/** Every reading on `t` finite and in range: no NaN, no negative flow, gauges within their stops. */
export function expectSaneTruck(t: TruckState): void {
  const r = t.readings;
  const numbers = [
    t.rpm,
    t.tankL,
    r.dischargeKpa,
    r.compoundKpa,
    r.pumpFlowLpm,
    r.reliefFlowLpm,
    r.pumpToTankLpm,
    r.recircLpm,
    ...Object.values(r.deliveryFlowLpm),
    ...Object.values(r.branchKpa),
    t.pump.tempC,
    t.pump.vacuumKpa,
    t.pump.flutter,
    r.cavitation,
    ...Object.values(r.inletFlowLpm),
  ];
  for (const n of numbers) expect(Number.isFinite(n)).toBe(true);
  expect(r.compoundKpa).toBeGreaterThanOrEqual(-100);
  expect(r.cavitation).toBeGreaterThanOrEqual(0);
  expect(r.cavitation).toBeLessThanOrEqual(1);
  expect(t.pump.vacuumKpa).toBeGreaterThanOrEqual(0);
  for (const q of Object.values(r.inletFlowLpm)) expect(q).toBeGreaterThanOrEqual(0);
  expect(r.dischargeKpa).toBeGreaterThanOrEqual(0);
  expect(r.pumpToTankLpm).toBeGreaterThanOrEqual(0);
  expect(r.recircLpm).toBeGreaterThanOrEqual(0);
  for (const q of Object.values(r.deliveryFlowLpm)) expect(q).toBeGreaterThanOrEqual(0);
  expect(t.tankL).toBeGreaterThanOrEqual(0);
  expect(t.tankL).toBeLessThanOrEqual(t.spec.tank?.capacityL ?? 0);
  expect(t.rpm).toBeGreaterThanOrEqual(t.spec.engine.idleRpm - 1e-9);
  expect(t.rpm).toBeLessThanOrEqual(t.spec.engine.maxRpm + 1e-9);
}

/**
 * `state` with every hose lay swapped for one length of 65 mm and a 32 mm branch: lines that take
 * all a pump can give, to push any appliance past what its supply allows (a light tanker's crew
 * lines can't over-run a hydrant or a 4 m draught).
 */
export function withBigLines(state: SimState): SimState {
  return {
    ...state,
    lines: state.lines.map((l) => ({
      ...l,
      segments: [{ hose: '65L', lengthM: 30 }],
      elevationM: 0,
      branch: { tipMm: 32 },
    })),
  };
}

/** Every truck, relay reading and source in `state` sane (see `expectSaneTruck`). */
export function expectSane(state: SimState): void {
  for (const t of state.trucks) expectSaneTruck(t);
  for (const r of Object.values(state.linkReadings)) {
    for (const n of [r.flowLpm, r.startKpa, r.endKpa]) expect(Number.isFinite(n)).toBe(true);
    expect(r.flowLpm).toBeGreaterThanOrEqual(0);
  }
  for (const s of state.sources) {
    if (s.kind !== 'static') continue;
    expect(s.volumeL).toBeGreaterThanOrEqual(0);
    expect(s.volumeL).toBeLessThanOrEqual(s.capacityL ?? Number.POSITIVE_INFINITY);
  }
}

export function truckOf(state: SimState): TruckState {
  const t = state.trucks[0];
  if (t === undefined) throw new Error('state has no truck');
  return t;
}

/** The sim's seeded PRNG as a stream, so fuzz tests are reproducible. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    const [x, next] = nextRandom(state);
    state = next;
    return x;
  };
}

/** Assert |actual − expected| ≤ relTol·|expected|. */
export function expectWithinRel(actual: number, expected: number, relTol: number): void {
  expect(
    Math.abs(actual - expected),
    `${actual.toFixed(1)} vs ${expected.toFixed(1)}`,
  ).toBeLessThanOrEqual(relTol * Math.abs(expected));
}

/** The spec's first suction inlet; throws if it has none. */
export function suctionInletOf(spec: ApplianceSpec): ControlId {
  return inletOfKind(spec, 'suction');
}

/** A dam `liftM` below the pump on 2 × 3 m of hard suction to the spec's suction inlet. */
export function draughtSite(spec: ApplianceSpec, liftM: number, volumeL = 1e6): SiteOptions {
  return {
    sources: [{ id: 'dam', kind: 'static', label: 'Dam', liftM, volumeL }],
    supplies: [
      {
        id: 'suction-hose',
        truckId: DEFAULT_TRUCK_ID,
        inletId: suctionInletOf(spec),
        sourceId: 'dam',
        segments: [
          { hose: '65H', lengthM: 3 },
          { hose: '65H', lengthM: 3 },
        ],
      },
    ],
  };
}

/** A hydrant (static `staticKpa`, `mainLoss`) on `lengths` × 30 m of 65 mm layflat to the suction inlet. */
export function hydrantSite(
  spec: ApplianceSpec,
  staticKpa = 400,
  mainLoss = 100 / 1100 ** 2,
  lengths = 2,
): SiteOptions {
  return {
    sources: [
      { id: 'hydrant', kind: 'hydrant', label: 'Hydrant', staticKpa, mainLossKpaPerLpm2: mainLoss },
    ],
    supplies: [
      {
        id: 'hydrant-line',
        truckId: DEFAULT_TRUCK_ID,
        inletId: suctionInletOf(spec),
        sourceId: 'hydrant',
        segments: Array.from({ length: lengths }, () => ({
          hose: '65L',
          lengthM: STANDARD_LENGTH_M,
        })),
      },
    ],
  };
}

/** Inputs with the given valves open (1) and switches on. */
export function inputsWith(
  throttle: number,
  open: readonly ControlId[],
  switches: readonly ControlId[] = [],
): PlayerInputs {
  return {
    throttle,
    valves: Object.fromEntries(open.map((id) => [id, 1])),
    switches: Object.fromEntries(switches.map((id) => [id, true])),
  };
}

/** `state` with its first truck's pump primed (skips the priming run). */
export function primedState(state: SimState): SimState {
  return {
    ...state,
    trucks: state.trucks.map((t) => ({ ...t, pump: { ...t.pump, primed: true } })),
  };
}

/** First delivery closest to 65 mm: where a relay leaves (as `attachLines` would choose). */
export const relayDelivery = (spec: ApplianceSpec) =>
  spec.deliveries.reduce((a, b) => (Math.abs(b.sizeMm - 65) < Math.abs(a.sizeMm - 65) ? b : a)).id;

export interface PairOptions {
  lengths?: number;
  elevationM?: number;
  baseThrottle?: number;
  /** Tip of the receiving truck's branches. */
  tipMm?: number;
}

/**
 * A base pump of `base` on its own tank, relay delivery held open, pushing `lengths` × 30 m of
 * 65 mm up `elevationM` to the suction inlet of a receiving pump of `receiver`, which has a 38 mm
 * line on every delivery. The receiver is active.
 */
export function closedRelayPair(
  base: ApplianceSpec,
  receiver: ApplianceSpec,
  opts: PairOptions = {},
) {
  const { lengths = 4, elevationM = 0, baseThrottle = 0.8, tipMm = 15 } = opts;
  const out = relayDelivery(base);
  const inlet = suctionInletOf(receiver);
  const link: RelayLink = {
    id: 'relay',
    truckId: 'base',
    deliveryId: out,
    segments: Array.from({ length: lengths }, () => ({ hose: '65L', lengthM: 30 })),
    elevationM,
    to: { kind: 'inlet', truckId: 'attack', inletId: inlet },
  };
  const lines = receiver.deliveries.map((d) => ({
    ...layLine(d.id, '38L', 2, tipMm),
    id: `attack-${d.id}`,
    truckId: 'attack',
  }));
  const tankIn = base.inlets.filter((i) => i.kind === 'tank').map((i) => i.id);
  const state = createSiteState(
    [
      { id: 'attack', label: 'Attack pump', spec: receiver },
      {
        id: 'base',
        label: 'Base pump',
        spec: base,
        inputs: inputsWith(baseThrottle, [...tankIn, out]),
      },
    ],
    lines,
    { links: [link] },
  );
  const attackInputs = (throttle: number, open = receiver.deliveries.map((d) => d.id)) =>
    inputsWith(throttle, [inlet, ...open]);
  return { state, link, inlet, out, attackInputs };
}
