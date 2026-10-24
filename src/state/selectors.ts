// Derived values for the UI. Pure functions of sim state and inputs; no React.
import { VALVE_CLOSED_EPS } from '../sim/constants';
import type {
  ControlId,
  HoseLine,
  InstrumentKind,
  PlayerInputs,
  SimState,
  TruckState,
} from '../sim/types';
import { tankLevelState } from './tankLevel';

interface HasSim {
  sim: SimState;
}

export const selectSimTimeS = (s: HasSim): number => s.sim.timeS;

/** The truck the player is operating. */
export function activeTruck(sim: SimState): TruckState {
  const truck = sim.trucks.find((t) => t.id === sim.activeTruckId);
  if (truck === undefined) throw new Error(`No active truck '${sim.activeTruckId}'`);
  return truck;
}

export const selectActiveTruck = (s: HasSim): TruckState => activeTruck(s.sim);

/** What an instrument of `kind` reads on `truck`, in its native unit. */
export function instrumentValue(truck: TruckState, kind: InstrumentKind): number {
  switch (kind) {
    case 'compound':
      return truck.readings.compoundKpa;
    case 'discharge':
      return truck.readings.dischargeKpa;
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

/** The hose lay connected to a delivery of the active truck, if any. */
export function lineOnDelivery(sim: SimState, deliveryId: ControlId): HoseLine | undefined {
  return sim.lines.find((l) => l.truckId === sim.activeTruckId && l.deliveryId === deliveryId);
}

export type WarningLevel = 'off' | 'caution' | 'alarm' | 'unavailable';

export type WarningId = 'tank' | 'supply' | 'over-pressure' | 'overheat' | 'cavitation';

export interface Warning {
  id: WarningId;
  /** Lamp caption, uppercase on the panel. */
  label: string;
  level: WarningLevel;
  /** Plain-language explanation when lit (or why it's unavailable). */
  message: string;
}

const isOpen = (x: number | undefined) => (x ?? 0) >= VALVE_CLOSED_EPS;

/**
 * Warning lamps for the active truck (ARCHITECTURE §7 HUD). Overheat and cavitation are shown
 * but report 'unavailable' until the sim models them (M4).
 */
export function selectWarnings(sim: SimState, inputs: PlayerInputs): Warning[] {
  const truck = activeTruck(sim);
  const { spec } = truck;
  const warnings: Warning[] = [];

  if (spec.tank !== undefined) {
    const level = tankLevelState(truck.tankL, spec.tank.capacityL);
    warnings.push({
      id: 'tank',
      label: 'Tank',
      level: level === 'empty' ? 'alarm' : level === 'low' ? 'caution' : 'off',
      message:
        level === 'empty'
          ? 'Tank empty: the pump has no water.'
          : level === 'low'
            ? // No litres here: this text feeds a live region, and a changing number would be
              // re-announced every few ticks. The tank gauge carries the reading.
              'Tank low: watch the tank gauge.'
            : '',
    });
  }

  const anyDeliveryOpen = spec.deliveries.some((d) => isOpen(inputs.valves[d.id]));
  const anyInletOpen = spec.inlets.some((i) => isOpen(inputs.valves[i.id]));
  const inletNames = spec.inlets.map((i) => i.label.toLowerCase()).join(' or ');
  warnings.push({
    id: 'supply',
    label: 'Supply',
    level: anyDeliveryOpen && !anyInletOpen ? 'caution' : 'off',
    message: anyDeliveryOpen && !anyInletOpen ? `No supply: open ${inletNames}.` : '',
  });

  if (spec.relief !== undefined) {
    const dumping = truck.readings.reliefFlowLpm > 0;
    warnings.push({
      id: 'over-pressure',
      label: 'Relief',
      level: dumping ? 'caution' : 'off',
      message: dumping ? 'Relief valve open: discharge is at its set pressure.' : '',
    });
  }

  warnings.push(
    {
      id: 'overheat',
      label: 'Temp',
      level: 'unavailable',
      message: 'Pump temperature is not simulated yet.',
    },
    {
      id: 'cavitation',
      label: 'Cavitation',
      level: 'unavailable',
      message: 'Cavitation is not simulated yet.',
    },
  );
  return warnings;
}

/**
 * Delivery flow at or above which the scene draws a line charged, L/min. A display threshold, not
 * physics: below it the legend would read "0 L/min" on a charged line.
 */
export const CHARGED_MIN_LPM = 1;

/** How the scene draws a delivery: a flowing line, a laid but dry line, or a blank cap. */
export type LineState = 'charged' | 'dry' | 'none';

export interface DeliveryLine {
  deliveryId: ControlId;
  /** The hose lay on this delivery, if any. */
  line?: HoseLine;
  /** Flow out of the delivery, L/min. */
  flowLpm: number;
  /** Pressure at the branch, kPa; 0 when no line is laid. */
  branchKpa: number;
  state: LineState;
}

/**
 * Every delivery of the active truck, in spec order, with its line and whether it is charged.
 * Branches can't be shut yet, so a charged (pressurised) line is a flowing one.
 */
export function deliveryLines(sim: SimState): DeliveryLine[] {
  const truck = activeTruck(sim);
  return truck.spec.deliveries.map((d) => {
    const line = lineOnDelivery(sim, d.id);
    const flowLpm = truck.readings.deliveryFlowLpm[d.id] ?? 0;
    const state: LineState =
      line === undefined ? 'none' : flowLpm >= CHARGED_MIN_LPM ? 'charged' : 'dry';
    const branchKpa = line === undefined ? 0 : (truck.readings.branchKpa[line.id] ?? 0);
    return { deliveryId: d.id, ...(line === undefined ? {} : { line }), flowLpm, branchKpa, state };
  });
}

/** Water left in the truck's tank as a fraction of capacity, 0–1; 0 with no tank. */
export function tankFraction(truck: TruckState): number {
  const capacityL = truck.spec.tank?.capacityL ?? 0;
  if (!(capacityL > 0)) return 0;
  return Math.min(1, Math.max(0, truck.tankL / capacityL));
}
