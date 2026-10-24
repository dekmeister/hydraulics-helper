import { idleInputs, sanitiseInputs } from './appliances/controls';
import {
  AMBIENT_C,
  FLUTTER_KICK,
  FLUTTER_MEMORY,
  PUMP_TEMP_CAUTION_C,
  VALVE_CLOSED_EPS,
} from './constants';
import { detectHammer } from './hammer';
import { inletPaths, type ConnectedSupply } from './inlets';
import { solveTruck } from './network';
import { stepPrime } from './priming';
import { lagRpm } from './pump';
import { DEFAULT_SEED, nextRandom } from './rng';
import { validateSite } from './site';
import { stepTankL } from './tank';
import { stepTempC } from './thermal';
import type {
  ApplianceSpec,
  HoseLine,
  PlayerInputs,
  PumpState,
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
  /** PRNG seed for noisy behaviour (gauge flutter). */
  seed?: number;
}

/** A pump at rest: not primed, no vacuum, primer rested, casing at ambient. */
export function restingPump(): PumpState {
  return {
    primed: false,
    vacuumKpa: 0,
    primerRunS: 0,
    primerDutyS: 0,
    primerCutOut: false,
    tempC: AMBIENT_C,
    flutter: 0,
  };
}

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
 * Fresh state at t = 0: one truck of `spec`, engine at idle, tank full, all controls shut, plus
 * whatever sources and supply hoses the scenario sets out (checked by `validateSite`). The spec is
 * copied in so the state stays self-contained (ARCHITECTURE §9.2).
 */
export function createInitialState(
  spec: ApplianceSpec,
  lines: readonly HoseLine[] = [],
  site: SiteOptions = {},
): SimState {
  const inputs = idleInputs(spec);
  const sources = structuredClone([...(site.sources ?? [])]);
  const supplies = structuredClone([...(site.supplies ?? [])]);
  const base = {
    id: DEFAULT_TRUCK_ID,
    spec: structuredClone(spec),
    rpm: spec.engine.idleRpm,
    tankL: spec.tank?.capacityL ?? 0,
    inputs,
  };
  validateSite([{ id: DEFAULT_TRUCK_ID, spec }], sources, supplies);
  const ownLines = lines.filter((l) => l.truckId === DEFAULT_TRUCK_ID);
  const truck: TruckState = {
    ...base,
    readings: solveTruck(
      { ...base, supplies: connectedSupplies({ sources, supplies }, DEFAULT_TRUCK_ID) },
      ownLines,
    ),
    pump: restingPump(),
    tally: { cavitationS: 0, overheatS: 0, waterHammer: 0, worstSurgeKpa: 0 },
  };
  return {
    timeS: 0,
    activeTruckId: DEFAULT_TRUCK_ID,
    trucks: [truck],
    lines: structuredClone([...lines]),
    sources,
    supplies,
    rngState: (site.seed ?? DEFAULT_SEED) >>> 0,
  };
}

/** Neutral inputs for a spec: throttle idle, every valve shut, every switch off. */
export function createIdleInputs(spec: ApplianceSpec): PlayerInputs {
  return idleInputs(spec);
}

/** Gauge flutter noise: a smoothed random walk in −1…1 driven by one uniform draw per tick. */
function stepFlutter(flutter: number, uniform: number): number {
  return Math.max(-1, Math.min(1, FLUTTER_MEMORY * flutter + FLUTTER_KICK * (2 * uniform - 1)));
}

/**
 * Advance one truck by `dtS`: engine rpm chases the throttle, priming runs, the network is
 * re-solved, then the slow states move: tank, casing temperature, fault tallies, water hammer.
 */
function advanceTruck(
  truck: TruckState,
  inputs: PlayerInputs,
  lines: readonly HoseLine[],
  supplies: readonly ConnectedSupply[],
  prevTimeS: number,
  timeS: number,
  uniform: number,
  dtS: number,
): TruckState {
  const { spec } = truck;
  const clean = sanitiseInputs(spec, inputs);
  const rpm = lagRpm(spec.engine, truck.rpm, clean.throttle, dtS);

  // Priming sees the casing as it stands: flooded if a non-draught source is open to it.
  const flooded =
    inletPaths({ spec, tankL: truck.tankL, inputs: clean, primed: false, supplies }).length > 0;
  const openToAir = lines.some((l) => (clean.valves[l.deliveryId] ?? 0) >= VALVE_CLOSED_EPS);
  const primed = stepPrime(truck.pump, { spec, inputs: clean, supplies, flooded, openToAir }, dtS);

  const readings = solveTruck(
    {
      spec,
      rpm,
      tankL: truck.tankL,
      inputs: clean,
      primed: primed.primed,
      supplies,
      vacuumKpa: primed.vacuumKpa,
    },
    lines,
  );
  const outLpm = Object.values(readings.deliveryFlowLpm).reduce((a, b) => a + b, 0);
  const reliefToTankLpm = spec.relief?.dumpTo === 'tank' ? readings.reliefFlowLpm : 0;
  const tankDrawLpm = spec.inlets
    .filter((i) => i.kind === 'tank')
    .reduce((q, i) => q + (readings.inletFlowLpm[i.id] ?? 0), 0);
  // Water reaches the pump from an open tank or hydrant, or up a primed suction.
  const wet = flooded || primed.primed;
  const tempC = stepTempC(
    primed.tempC,
    { spec, rpm, wet, throughLpm: outLpm + reliefToTankLpm },
    dtS,
  );
  const pump: PumpState = {
    ...primed,
    tempC,
    flutter: stepFlutter(primed.flutter, uniform),
  };

  const hammer = detectHammer({
    lines,
    valvesBefore: truck.inputs.valves,
    valvesNow: clean.valves,
    flowBefore: truck.readings.deliveryFlowLpm,
    flowNow: readings.deliveryFlowLpm,
    timeS,
  });
  // A closure that stays hard over consecutive ticks is one event, not one per tick.
  const continuing =
    hammer !== undefined &&
    truck.lastHammer?.deliveryId === hammer.deliveryId &&
    truck.lastHammer.atS === prevTimeS;
  const t = truck.tally;
  const tally = {
    cavitationS: t.cavitationS + (readings.cavitation > 0 ? dtS : 0),
    overheatS: t.overheatS + (tempC >= PUMP_TEMP_CAUTION_C ? dtS : 0),
    waterHammer: t.waterHammer + (hammer === undefined || continuing ? 0 : 1),
    worstSurgeKpa: Math.max(t.worstSurgeKpa, hammer?.surgeKpa ?? 0),
  };

  return {
    ...truck,
    rpm,
    inputs: clean,
    readings,
    pump,
    tally,
    tankL: stepTankL(truck.tankL, spec.tank?.capacityL ?? 0, tankDrawLpm, reliefToTankLpm, dtS),
    ...(hammer === undefined ? {} : { lastHammer: hammer }),
  };
}

/** Static sources after `dtS` of every truck drawing on them through their supplies. */
function drainSources(state: SimState, trucks: readonly TruckState[], dtS: number): WaterSource[] {
  return state.sources.map((source) => {
    if (source.kind !== 'static') return source;
    const drawLpm = state.supplies
      .filter((s) => s.sourceId === source.id)
      .reduce((q, s) => {
        const truck = trucks.find((t) => t.id === s.truckId);
        return q + (truck?.readings.inletFlowLpm[s.inletId] ?? 0);
      }, 0);
    return { ...source, volumeL: Math.max(0, source.volumeL - (drawLpm * dtS) / 60) };
  });
}

/**
 * Advance the sim by `dtS` seconds. Pure and deterministic: returns new state, never mutates.
 * `inputs` apply to the active truck; other trucks keep their last inputs. Noise comes from the
 * seeded PRNG in the state, one draw per truck per tick.
 */
export function advance(state: SimState, inputs: PlayerInputs, dtS: number): SimState {
  const timeS = state.timeS + dtS;
  let rngState = state.rngState;
  const trucks = state.trucks.map((truck) => {
    const [uniform, next] = nextRandom(rngState);
    rngState = next;
    return advanceTruck(
      truck,
      truck.id === state.activeTruckId ? inputs : truck.inputs,
      state.lines.filter((l) => l.truckId === truck.id),
      connectedSupplies(state, truck.id),
      state.timeS,
      timeS,
      uniform,
      dtS,
    );
  });
  return { ...state, timeS, trucks, sources: drainSources(state, trucks, dtS), rngState };
}
