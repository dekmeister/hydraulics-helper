// Derived values for the UI. Pure functions of sim state and inputs; no React.
import {
  CAVITATION_FLUTTER_COMPOUND_KPA,
  CAVITATION_FLUTTER_DISCHARGE_KPA,
} from '../sim/constants';
import { CREW_WATER_MIN_LPM } from '../sim/lesson/progress';
import { activeTruck } from './activeTruck';
import type {
  ControlId,
  HoseLine,
  InstrumentKind,
  RelayLink,
  SimState,
  TruckState,
} from '../sim/types';

interface HasSim {
  sim: SimState;
}

export const selectSimTimeS = (s: HasSim): number => s.sim.timeS;

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

/** How the scene draws a delivery: a flowing line, a laid but dry line, or a blank cap. */
export type LineState = 'charged' | 'dry' | 'none';

export interface DeliveryLine {
  deliveryId: ControlId;
  /** The hose lay on this delivery, if any. */
  line?: HoseLine;
  /** The relay hose on this delivery, if any (a delivery carries a lay or a relay). */
  relay?: RelayLink;
  /** Flow out of the delivery, L/min. */
  flowLpm: number;
  /** Pressure at the branch, kPa; 0 when no line is laid. */
  branchKpa: number;
  state: LineState;
}

/**
 * Every delivery of a truck (default: the active one), in spec order, with its line or relay and
 * whether it is charged. Branches can't be shut yet, so a charged (pressurised) line is a flowing one.
 */
export function deliveryLines(sim: SimState, truckId = sim.activeTruckId): DeliveryLine[] {
  const truck = sim.trucks.find((t) => t.id === truckId);
  if (truck === undefined) throw new Error(`No truck '${truckId}'`);
  return truck.spec.deliveries.map((d) => {
    const line = lineOnDelivery(sim, d.id, truckId);
    const relay = relayOnDelivery(sim, d.id, truckId);
    const flowLpm = truck.readings.deliveryFlowLpm[d.id] ?? 0;
    const state: LineState =
      line === undefined && relay === undefined
        ? 'none'
        : flowLpm >= CHARGED_MIN_LPM
          ? 'charged'
          : 'dry';
    const branchKpa = line === undefined ? 0 : (truck.readings.branchKpa[line.id] ?? 0);
    return {
      deliveryId: d.id,
      ...(line === undefined ? {} : { line }),
      ...(relay === undefined ? {} : { relay }),
      flowLpm,
      branchKpa,
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
