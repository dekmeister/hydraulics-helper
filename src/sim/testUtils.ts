// Test-only helpers for sim tests. Pure; never imported by app code.
import { expect } from 'vitest';
import { STANDARD_LENGTH_M, TICK_S } from './constants';
import { DEFAULT_TRUCK_ID, advance, type SiteOptions } from './engine';
import type {
  ApplianceSpec,
  ControlId,
  HoseLine,
  PlayerInputs,
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

export function truckOf(state: SimState): TruckState {
  const t = state.trucks[0];
  if (t === undefined) throw new Error('state has no truck');
  return t;
}

/** Small seeded PRNG (mulberry32) so fuzz tests are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
  const inlet = spec.inlets.find((i) => i.kind === 'suction');
  if (inlet === undefined) throw new Error(`${spec.id} has no suction inlet`);
  return inlet.id;
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
