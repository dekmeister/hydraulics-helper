import { idleInputs, sanitiseInputs } from './appliances/controls';
import { DEFAULT_TRUCK_ID, siteState, type SiteOptions, type TruckSetup } from './create';
import { FLUTTER_KICK, FLUTTER_MEMORY, PUMP_TEMP_CAUTION_C, VALVE_CLOSED_EPS } from './constants';
import { detectHammer } from './hammer';
import { inletPaths, type ConnectedSupply } from './inlets';
import { solveTruck } from './network';
import { stepPrime } from './priming';
import { lagRpm } from './pump';
import { nextRandom } from './rng';
import { stepTankL } from './tank';
import { stepTempC } from './thermal';
import type {
  ApplianceSpec,
  HoseLine,
  PlayerInputs,
  PumpState,
  SimState,
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
  return {
    ...state,
    trucks: state.trucks.map((truck) => ({
      ...truck,
      readings: solveTruck(
        {
          spec: truck.spec,
          rpm: truck.rpm,
          tankL: truck.tankL,
          inputs: truck.inputs,
          primed: truck.pump.primed,
          supplies: connectedSupplies(state, truck.id),
        },
        state.lines.filter((l) => l.truckId === truck.id),
      ),
    })),
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
  const [uniform, rngState] = nextRandom(truck.rngState);
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
    hoseBursts: t.hoseBursts,
  };

  return {
    ...truck,
    rpm,
    inputs: clean,
    readings,
    pump,
    tally,
    tankL: stepTankL(truck.tankL, spec.tank?.capacityL ?? 0, tankDrawLpm, reliefToTankLpm, dtS),
    rngState,
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
 * `inputs` apply to the active truck; other trucks keep their held inputs. Noise comes from each
 * truck's own seeded PRNG stream, one draw per tick.
 */
export function advance(state: SimState, inputs: PlayerInputs, dtS: number): SimState {
  const timeS = state.timeS + dtS;
  const trucks = state.trucks.map((truck) =>
    advanceTruck(
      truck,
      truck.id === state.activeTruckId ? inputs : truck.inputs,
      state.lines.filter((l) => l.truckId === truck.id),
      connectedSupplies(state, truck.id),
      state.timeS,
      timeS,
      dtS,
    ),
  );
  return { ...state, timeS, trucks, sources: drainSources(state, trucks, dtS) };
}
