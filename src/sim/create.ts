// Building a fireground state (ARCHITECTURE §4.8): trucks, lays, sources, supplies and relays.
import { idleInputs, sanitiseInputs, validateInputs } from './appliances/controls';
import { AMBIENT_C } from './constants';
import { DEFAULT_SEED } from './rng';
import { validateSite } from './site';
import type {
  ApplianceSpec,
  HoseLine,
  PlayerInputs,
  PumpState,
  RelayLink,
  SimState,
  SupplyLine,
  TruckState,
  WaterSource,
} from './types';

/** Id given to the truck in a single-truck state. */
export const DEFAULT_TRUCK_ID = 'truck-1';

export interface SiteOptions {
  /** Water sources on the fireground (hydrants, dams). */
  sources?: readonly WaterSource[];
  /** Supply hoses from those sources to truck inlets. */
  supplies?: readonly SupplyLine[];
  /** Relay hoses from truck deliveries to other trucks, tanks or dams. */
  links?: readonly RelayLink[];
  /** PRNG seed for noisy behaviour (gauge flutter). */
  seed?: number;
}

/** One truck a scenario puts on the fireground. */
export interface TruckSetup {
  id: string;
  /** UI name, e.g. 'Base pump'; defaults to 'Truck <n>'. */
  label?: string;
  spec: ApplianceSpec;
  /** Controls as the scenario leaves them (a support truck holds these); default all shut. */
  inputs?: PlayerInputs;
  /** Start with the suction already primed (a support truck already set up at its dam). */
  primed?: boolean;
}

/** A pump at rest: not primed, no vacuum, primer rested, casing at ambient. */
export function restingPump(): PumpState {
  return {
    primed: false,
    casingWet: false,
    vacuumKpa: 0,
    primerRunS: 0,
    primerDutyS: 0,
    primerCutOut: false,
    tempC: AMBIENT_C,
    flutter: 0,
  };
}

/**
 * The PRNG seed for the truck at `index`. The first truck takes the scenario seed as it is, so a
 * one-truck state replays as before; the others get well-separated streams of their own.
 */
function truckSeed(seed: number, index: number): number {
  return (seed + Math.imul(index, 0x9e3779b9)) >>> 0;
}

/** `state` with every truck's noise restarted from `seed` (the e2e test API's `load({ seed })`). */
export function reseed(state: SimState, seed: number): SimState {
  return {
    ...state,
    trucks: state.trucks.map((t, i) => ({ ...t, rngState: truckSeed(seed >>> 0, i) })),
  };
}

/** Readings of a truck before anything has been solved: every gauge at rest. */
function restingReadings(spec: ApplianceSpec): TruckState['readings'] {
  const zero = (ids: readonly { id: string }[]) => Object.fromEntries(ids.map((x) => [x.id, 0]));
  return {
    dischargeKpa: 0,
    compoundKpa: 0,
    pumpFlowLpm: 0,
    reliefFlowLpm: 0,
    pumpToTankLpm: 0,
    deliveryFlowLpm: zero(spec.deliveries),
    branchKpa: {},
    inletFlowLpm: zero(spec.inlets),
    inletCollapsed: Object.fromEntries(spec.inlets.map((i) => [i.id, false])),
    cavitation: 0,
  };
}

/**
 * Trucks at t = 0 with readings not yet solved (`createSiteState` solves them). Throws on
 * duplicate ids or held inputs naming controls a truck's spec doesn't have.
 */
export function buildTrucks(setups: readonly TruckSetup[], seed: number): TruckState[] {
  return setups.map((setup, i) => {
    const { spec } = setup;
    if (setup.inputs !== undefined) {
      const problems = validateInputs(spec, setup.inputs);
      if (problems.length > 0) throw new Error(`Truck '${setup.id}': ${problems.join('; ')}`);
    }
    return {
      id: setup.id,
      label: setup.label ?? `Truck ${String(i + 1)}`,
      spec: structuredClone(spec),
      rpm: spec.engine.idleRpm,
      tankL: spec.tank?.capacityL ?? 0,
      inputs: setup.inputs === undefined ? idleInputs(spec) : sanitiseInputs(spec, setup.inputs),
      readings: restingReadings(spec),
      pump: { ...restingPump(), primed: setup.primed === true, casingWet: setup.primed === true },
      tally: { cavitationS: 0, overheatS: 0, waterHammer: 0, worstSurgeKpa: 0, hoseBursts: 0 },
      rngState: truckSeed(seed, i),
    };
  });
}

/**
 * The unsolved state at t = 0: trucks, a copy of every lay, source, supply and relay, checked by
 * `validateSite`. The first truck is the active one unless `activeTruckId` says otherwise.
 */
export function siteState(
  setups: readonly TruckSetup[],
  lines: readonly HoseLine[],
  site: SiteOptions & { activeTruckId?: string },
): SimState {
  const trucks = buildTrucks(setups, (site.seed ?? DEFAULT_SEED) >>> 0);
  const sources = structuredClone([...(site.sources ?? [])]);
  const supplies = structuredClone([...(site.supplies ?? [])]);
  const links = structuredClone([...(site.links ?? [])]);
  validateSite(trucks, sources, supplies, links, lines);
  const activeTruckId = site.activeTruckId ?? trucks[0]?.id;
  if (activeTruckId === undefined || !trucks.some((t) => t.id === activeTruckId)) {
    throw new Error(`Site has no truck '${activeTruckId ?? ''}' to make active`);
  }
  return {
    timeS: 0,
    activeTruckId,
    trucks,
    lines: structuredClone([...lines]),
    sources,
    supplies,
    links,
    linkReadings: {},
  };
}

/**
 * Make `truckId` the truck the player operates. The truck being left holds `held`, the controls
 * as the player leaves them (the store's inputs, which may not have reached the sim yet), so the
 * player's settings on each truck have one home: the store for the active truck, the sim for the rest.
 */
export function switchTruck(state: SimState, truckId: string, held: PlayerInputs): SimState {
  if (!state.trucks.some((t) => t.id === truckId))
    throw new Error(`Site has no truck '${truckId}'`);
  return {
    ...state,
    activeTruckId: truckId,
    trucks: state.trucks.map((t) =>
      t.id === state.activeTruckId ? { ...t, inputs: sanitiseInputs(t.spec, held) } : t,
    ),
  };
}
