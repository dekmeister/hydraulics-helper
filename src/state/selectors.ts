// Derived values for the UI. Pure functions of sim state and inputs; no React.
import {
  CAVITATION_FLUTTER_COMPOUND_KPA,
  CAVITATION_FLUTTER_DISCHARGE_KPA,
} from '../sim/constants';
import {
  enginePhase,
  ignitionOn,
  stopWithoutIgnition,
  type EnginePhase,
} from '../sim/engineControl';
import { CREW_WATER_MIN_LPM } from '../sim/lesson/progress';
import { lineFill } from '../sim/lineFill';
import { SCENARIOS } from '../sim/scenarios';
import type { ScenarioSetting } from '../sim/scenarios/types';
import { activeTruck } from './activeTruck';
import type {
  ControlId,
  HoseLine,
  InstrumentKind,
  PlayerInputs,
  RelayLink,
  SimState,
  TruckState,
} from '../sim/types';

interface HasSim {
  sim: SimState;
}

export const selectSimTimeS = (s: HasSim): number => s.sim.timeS;

/** Where the loaded scenario is set, for the scene's backdrop; the bush with none loaded. */
export function sceneSetting(scenarioId: string | null): ScenarioSetting {
  return SCENARIOS.find((x) => x.id === scenarioId)?.setting ?? 'bush';
}

export { activeTruck } from './activeTruck';

export const selectActiveTruck = (s: HasSim): TruckState => activeTruck(s.sim);

/**
 * What an instrument of `kind` shows on `truck`, in its native unit. Pressure gauges carry the
 * pump's flutter, scaled by how hard it is cavitating (the sim's readings are clean); the
 * compound swings opposite to the discharge.
 */
export function instrumentValue(truck: TruckState, kind: InstrumentKind): number {
  const shake = truck.pump.flutter * truck.readings.cavitation;
  switch (kind) {
    case 'compound':
      return Math.max(-100, truck.readings.compoundKpa - shake * CAVITATION_FLUTTER_COMPOUND_KPA);
    case 'discharge':
      return Math.max(0, truck.readings.dischargeKpa + shake * CAVITATION_FLUTTER_DISCHARGE_KPA);
    case 'tacho':
      return truck.rpm;
    case 'tank':
      return truck.tankL;
  }
}

export const INSTRUMENT_UNIT: Readonly<Record<InstrumentKind, string>> = {
  compound: 'kPa',
  discharge: 'kPa',
  tacho: 'rpm',
  tank: 'L',
};

/** The hose lay connected to a delivery of a truck (default: the active one), if any. */
export function lineOnDelivery(
  sim: SimState,
  deliveryId: ControlId,
  truckId = sim.activeTruckId,
): HoseLine | undefined {
  return sim.lines.find((l) => l.truckId === truckId && l.deliveryId === deliveryId);
}

/** The relay hose leaving a delivery of a truck (default: the active one), if any. */
export function relayOnDelivery(
  sim: SimState,
  deliveryId: ControlId,
  truckId = sim.activeTruckId,
): RelayLink | undefined {
  return sim.links.find((l) => l.truckId === truckId && l.deliveryId === deliveryId);
}

export { waterIn, waterRefKey, type WaterRef, type WaterState } from './plumbing';
export { selectWarnings, type Warning, type WarningId, type WarningLevel } from './warnings';

/**
 * Delivery flow at or above which the scene draws a line charged, L/min: the flow at which a lesson
 * counts a crew as having water, so the scene and the objectives agree.
 */
export const CHARGED_MIN_LPM = CREW_WATER_MIN_LPM;

/**
 * How the scene draws a delivery. A lay: 'filling' (water going in, the front part way),
 * 'charged' (full, water at the branch), 'holding' (water standing in it: shut, or the pump
 * stopped; a downhill line drains), 'dry' (empty). A relay: 'charged' while it flows, else 'dry'.
 * 'none': a blank cap.
 */
export type LineState = 'none' | 'dry' | 'filling' | 'charged' | 'holding';

export interface DeliveryLine {
  deliveryId: ControlId;
  /** The hose lay on this delivery, if any. */
  line?: HoseLine;
  /** The relay hose on this delivery, if any (a delivery carries a lay or a relay). */
  relay?: RelayLink;
  /** Flow out of the delivery, L/min. */
  flowLpm: number;
  /** Water leaving the branch, L/min; 0 with no lay, and until the lay has charged. */
  branchFlowLpm: number;
  /** Pressure at the branch, kPa; 0 when no line is laid. */
  branchKpa: number;
  /** How full the hose is, 0–1 from the delivery end (a relay is full while charged). */
  level: number;
  /** Water moving through the delivery into the hose. */
  moving: boolean;
  state: LineState;
}

function layState(level: number, moving: boolean, branchFlowLpm: number): LineState {
  if (level >= 1 && branchFlowLpm >= CHARGED_MIN_LPM) return 'charged';
  if (level < 1 && moving) return 'filling';
  return level > 0 ? 'holding' : 'dry';
}

/**
 * Every delivery of a truck (default: the active one), in spec order, with its line or relay, how
 * full it is and whether it is charged. Branches can't be shut yet, so a charged (pressurised)
 * line is a flowing one.
 */
export function deliveryLines(sim: SimState, truckId = sim.activeTruckId): DeliveryLine[] {
  const truck = sim.trucks.find((t) => t.id === truckId);
  if (truck === undefined) throw new Error(`No truck '${truckId}'`);
  return truck.spec.deliveries.map((d) => {
    const line = lineOnDelivery(sim, d.id, truckId);
    const relay = relayOnDelivery(sim, d.id, truckId);
    const flowLpm = truck.readings.deliveryFlowLpm[d.id] ?? 0;
    const moving = flowLpm >= CHARGED_MIN_LPM;
    const branchKpa = line === undefined ? 0 : (truck.readings.branchKpa[line.id] ?? 0);
    const branchFlowLpm = line === undefined ? 0 : (truck.readings.branchFlowLpm[line.id] ?? 0);
    let state: LineState;
    let level: number;
    if (line !== undefined) {
      level = lineFill(line, sim.lineWaterL[line.id] ?? 0).fraction;
      state = layState(level, moving, branchFlowLpm);
    } else {
      // A relay fills at once (backlog): charged while it flows.
      state = relay === undefined ? 'none' : moving ? 'charged' : 'dry';
      level = state === 'charged' ? 1 : 0;
    }
    return {
      deliveryId: d.id,
      ...(line === undefined ? {} : { line }),
      ...(relay === undefined ? {} : { relay }),
      flowLpm,
      branchFlowLpm,
      branchKpa,
      level,
      moving,
      state,
    };
  });
}

/** Water left in the truck's tank as a fraction of capacity, 0–1; 0 with no tank. */
export function tankFraction(truck: TruckState): number {
  const capacityL = truck.spec.tank?.capacityL ?? 0;
  if (!(capacityL > 0)) return 0;
  return Math.min(1, Math.max(0, truck.tankL / capacityL));
}

/** What the active truck's engine is doing, for its panel. */
export interface EngineStatus {
  phase: EnginePhase;
  ignition: boolean;
  /** The ignition is on and the engine isn't running: the charge and oil lamps are lit. */
  lampsLit: boolean;
  /** STOP is held with the ignition off on a solenoid stop: it does nothing. */
  stopWithoutIgnition: boolean;
  /** One line for the panel and assistive tech. */
  text: string;
}

const PHASE_TEXT: Readonly<Record<EnginePhase, string>> = {
  off: 'Stopped',
  cranking: 'Cranking: hold until it fires',
  running: 'Running',
  stopping: 'Stopping: hold until it stops',
};

/**
 * The active truck's engine under the panel's `inputs` (this tick's switches, before the sim has
 * seen them, so a press shows at once).
 */
export function engineStatus(sim: SimState, inputs: PlayerInputs): EngineStatus {
  const truck = { ...activeTruck(sim), inputs };
  const phase = enginePhase(truck);
  const ignition = ignitionOn(truck);
  const trap = stopWithoutIgnition(truck);
  const detail = trap
    ? 'STOP needs the ignition on'
    : phase === 'off'
      ? `ignition ${ignition ? 'on' : 'off'}`
      : null;
  return {
    phase,
    ignition,
    lampsLit: ignition && !truck.engine.running,
    stopWithoutIgnition: trap,
    text: detail === null ? PHASE_TEXT[phase] : `${PHASE_TEXT[phase]} · ${detail}`,
  };
}
