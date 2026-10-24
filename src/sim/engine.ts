import { idleInputs, sanitiseInputs } from './appliances/controls';
import { DEFAULT_TRUCK_ID, siteState, type SiteOptions, type TruckSetup } from './create';
import { FLUTTER_KICK, FLUTTER_MEMORY, PUMP_TEMP_CAUTION_C, VALVE_CLOSED_EPS } from './constants';
import { detectHammer } from './hammer';
import { inletPaths, type ConnectedSupply, type RelayFeed } from './inlets';
import type { TruckSolveInput } from './network';
import { stepPrime } from './priming';
import { lagRpm } from './pump';
import { checkBursts, solveSite } from './relay';
import { nextRandom } from './rng';
import { stepTankL } from './tank';
import { stepTempC } from './thermal';
import type {
  ApplianceSpec,
  HoseLine,
  PlayerInputs,
  PumpState,
  RelayReading,
  SimState,
  TruckReadings,
  TruckState,
  WaterSource,
} from './types';

export {
  DEFAULT_TRUCK_ID,
  reseed,
  restingPump,
  switchTruck,
  type SiteOptions,
  type TruckSetup,
} from './create';

/** This truck's supplies, each joined to its source; supplies to unknown sources are a data error. */
export function connectedSupplies(
  state: Pick<SimState, 'sources' | 'supplies'>,
  truckId: string,
): ConnectedSupply[] {
  return state.supplies
    .filter((s) => s.truckId === truckId)
    .map((supply) => {
      const source = state.sources.find((x) => x.id === supply.sourceId);
      if (source === undefined)
        throw new Error(`Supply '${supply.id}' has no source '${supply.sourceId}'`);
      return { supply, source };
    });
}

/**
 * Fresh state at t = 0 with any number of trucks (`TruckSetup`: spec, label, held inputs), their
 * lays, and whatever sources, supply hoses and relays the scenario sets out (checked by
 * `validateSite`). Specs are copied in so the state stays self-contained (ARCHITECTURE §9.2).
 */
export function createSiteState(
  trucks: readonly TruckSetup[],
  lines: readonly HoseLine[] = [],
  site: SiteOptions & { activeTruckId?: string } = {},
): SimState {
  const state = siteState(trucks, lines, site);
  const solved = solveSite(state, (truck, relayIn) => ({
    spec: truck.spec,
    rpm: truck.rpm,
    tankL: truck.tankL,
    inputs: truck.inputs,
    primed: truck.pump.primed,
    supplies: connectedSupplies(state, truck.id),
    relayIn,
  }));
  return {
    ...state,
    trucks: state.trucks.map((truck) => ({
      ...truck,
      readings: solved.readings.get(truck.id) ?? truck.readings,
    })),
    linkReadings: solved.linkReadings,
  };
}

/** Fresh state with one truck of `spec` (`DEFAULT_TRUCK_ID`), engine at idle, every control shut. */
export function createInitialState(
  spec: ApplianceSpec,
  lines: readonly HoseLine[] = [],
  site: SiteOptions = {},
): SimState {
  return createSiteState([{ id: DEFAULT_TRUCK_ID, spec }], lines, site);
}

/** Neutral inputs for a spec: throttle idle, every valve shut, every switch off. */
export function createIdleInputs(spec: ApplianceSpec): PlayerInputs {
  return idleInputs(spec);
}

/** Gauge flutter noise: a smoothed random walk in −1…1 driven by one uniform draw per tick. */
function stepFlutter(flutter: number, uniform: number): number {
  return Math.max(-1, Math.min(1, FLUTTER_MEMORY * flutter + FLUTTER_KICK * (2 * uniform - 1)));
}

/** One truck part-way through a tick: inputs applied, engine and priming moved on. */
interface Prepared {
  truck: TruckState;
  inputs: PlayerInputs;
  rpm: number;
  pump: PumpState;
  /** Water reaches the pump: an open tank, hydrant or relay floods it, or a primed suction. */
  wet: boolean;
}

/** Deliveries with a hose on them, lay or relay: what an open valve leaks air from, or hammers. */
function hosesOn(state: SimState, truckId: string) {
  return [...state.lines, ...state.links].filter((h) => h.truckId === truckId);
}

/**
 * First half of a truck's tick: engine rpm chases the throttle and priming runs. The casing is
 * flooded if a tank, hydrant or relay feed is open to it; an open delivery with a hose leaks air.
 */
function prepareTruck(
  state: SimState,
  truck: TruckState,
  inputs: PlayerInputs,
  relayIn: readonly RelayFeed[],
  dtS: number,
): { prepared: Prepared; input: TruckSolveInput } {
  const { spec } = truck;
  const clean = sanitiseInputs(spec, inputs);
  const rpm = lagRpm(spec.engine, truck.rpm, clean.throttle, dtS);
  const supplies = connectedSupplies(state, truck.id);
  const flooded =
    inletPaths({
      spec,
      tankL: truck.tankL,
      inputs: clean,
      primed: false,
      supplies,
      relays: relayIn,
    }).length > 0;
  const openToAir = hosesOn(state, truck.id).some(
    (h) => (clean.valves[h.deliveryId] ?? 0) >= VALVE_CLOSED_EPS,
  );
  const pump = stepPrime(truck.pump, { spec, inputs: clean, supplies, flooded, openToAir }, dtS);
  return {
    prepared: { truck, inputs: clean, rpm, pump, wet: flooded || pump.primed },
    input: {
      spec,
      rpm,
      tankL: truck.tankL,
      inputs: clean,
      primed: pump.primed,
      supplies,
      vacuumKpa: pump.vacuumKpa,
      relayIn,
    },
  };
}

/**
 * Second half of a truck's tick, once the site is solved: the slow states move. Tank (drawn, refilled
 * by relief dumped to it and by open relays into it), casing temperature, flutter, fault tallies and
 * water hammer on any delivery with a hose on it.
 */
function finishTruck(
  state: SimState,
  p: Prepared,
  readings: TruckReadings,
  linkReadings: Record<string, RelayReading>,
  timeS: number,
  dtS: number,
): TruckState {
  const { truck, inputs, rpm } = p;
  const { spec } = truck;
  const outLpm = Object.values(readings.deliveryFlowLpm).reduce((a, b) => a + b, 0);
  const reliefToTankLpm = spec.relief?.dumpTo === 'tank' ? readings.reliefFlowLpm : 0;
  const tankDrawLpm = spec.inlets
    .filter((i) => i.kind === 'tank')
    .reduce((q, i) => q + (readings.inletFlowLpm[i.id] ?? 0), 0);
  const relayInLpm = state.links
    .filter((l) => l.burst === undefined && l.to.kind === 'tank' && l.to.truckId === truck.id)
    .reduce((q, l) => q + (linkReadings[l.id]?.flowLpm ?? 0), 0);
  const tempC = stepTempC(
    p.pump.tempC,
    { spec, rpm, wet: p.wet, throughLpm: outLpm + reliefToTankLpm },
    dtS,
  );
  const [uniform, rngState] = nextRandom(truck.rngState);
  const pump: PumpState = { ...p.pump, tempC, flutter: stepFlutter(p.pump.flutter, uniform) };

  const hammer = detectHammer({
    lines: hosesOn(state, truck.id),
    valvesBefore: truck.inputs.valves,
    valvesNow: inputs.valves,
    flowBefore: truck.readings.deliveryFlowLpm,
    flowNow: readings.deliveryFlowLpm,
    timeS,
  });
  // A closure that stays hard over consecutive ticks is one event, not one per tick.
  const continuing =
    hammer !== undefined &&
    truck.lastHammer?.deliveryId === hammer.deliveryId &&
    truck.lastHammer.atS === state.timeS;
  const t = truck.tally;
  const tally = {
    cavitationS: t.cavitationS + (readings.cavitation > 0 ? dtS : 0),
    overheatS: t.overheatS + (tempC >= PUMP_TEMP_CAUTION_C ? dtS : 0),
    waterHammer: t.waterHammer + (hammer === undefined || continuing ? 0 : 1),
    worstSurgeKpa: Math.max(t.worstSurgeKpa, hammer?.surgeKpa ?? 0),
    hoseBursts: t.hoseBursts,
  };

  return {
    ...truck,
    rpm,
    inputs,
    readings,
    pump,
    tally,
    tankL: stepTankL(
      truck.tankL,
      spec.tank?.capacityL ?? 0,
      tankDrawLpm,
      reliefToTankLpm + relayInLpm,
      dtS,
    ),
    rngState,
    ...(hammer === undefined ? {} : { lastHammer: hammer }),
  };
}

/**
 * Static sources after `dtS`: drawn by every truck's supplies on them, filled by open relays into
 * them. A dam with a capacity (a portable dam) overflows at it.
 */
function stepSources(
  state: SimState,
  trucks: readonly TruckState[],
  linkReadings: Record<string, RelayReading>,
  dtS: number,
): WaterSource[] {
  return state.sources.map((source) => {
    if (source.kind !== 'static') return source;
    const drawLpm = state.supplies
      .filter((s) => s.sourceId === source.id)
      .reduce((q, s) => {
        const truck = trucks.find((t) => t.id === s.truckId);
        return q + (truck?.readings.inletFlowLpm[s.inletId] ?? 0);
      }, 0);
    const fillLpm = state.links
      .filter((l) => l.burst === undefined && l.to.kind === 'dam' && l.to.sourceId === source.id)
      .reduce((q, l) => q + (linkReadings[l.id]?.flowLpm ?? 0), 0);
    const volumeL = source.volumeL + ((fillLpm - drawLpm) * dtS) / 60;
    return {
      ...source,
      volumeL: Math.min(source.capacityL ?? Number.POSITIVE_INFINITY, Math.max(0, volumeL)),
    };
  });
}

/**
 * Advance the sim by `dtS` seconds. Pure and deterministic: returns new state, never mutates.
 * `inputs` apply to the active truck; other trucks keep their held inputs. Trucks are prepared
 * (engine, priming) in relay order, the whole site is solved (`solveSite`), each truck's slow
 * states move, and relay hoses are checked for over-pressure (`checkBursts`). Noise comes from each truck's own seeded PRNG stream, one draw per tick.
 */
export function advance(state: SimState, inputs: PlayerInputs, dtS: number): SimState {
  const timeS = state.timeS + dtS;
  const prepared = new Map<string, Prepared>();
  const site = solveSite(state, (truck, relayIn) => {
    const own = truck.id === state.activeTruckId ? inputs : truck.inputs;
    const p = prepareTruck(state, truck, own, relayIn, dtS);
    prepared.set(truck.id, p.prepared);
    return p.input;
  });
  const finished = state.trucks.map((truck) => {
    const p = prepared.get(truck.id);
    const readings = site.readings.get(truck.id);
    if (p === undefined || readings === undefined) throw new Error(`Truck '${truck.id}' unsolved`);
    return finishTruck(state, p, readings, site.linkReadings, timeS, dtS);
  });
  const valvesOf = (trucks: readonly TruckState[]) => (id: string) =>
    trucks.find((t) => t.id === id)?.inputs.valves ?? {};
  const links = checkBursts(
    state.links,
    state.linkReadings,
    site.linkReadings,
    { before: valvesOf(state.trucks), now: valvesOf(finished) },
    timeS,
  );
  // A burst is tallied against the truck whose delivery the hose is on.
  const burstNow = links.filter(
    (l, i) => l.burst !== undefined && state.links[i]?.burst === undefined,
  );
  const trucks = finished.map((t) => {
    const n = burstNow.filter((l) => l.truckId === t.id).length;
    return n === 0 ? t : { ...t, tally: { ...t.tally, hoseBursts: t.tally.hoseBursts + n } };
  });
  return {
    ...state,
    timeS,
    trucks,
    sources: stepSources(state, trucks, site.linkReadings, dtS),
    links,
    linkReadings: site.linkReadings,
  };
}
