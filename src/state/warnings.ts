// Warning lamps for the active truck (ARCHITECTURE §7 HUD). Pure functions of sim state and inputs.
import { PUMP_TEMP_ALARM_C, PUMP_TEMP_CAUTION_C, VALVE_CLOSED_EPS } from '../sim/constants';
import { connectedSupplies } from '../sim/engine';
import { draughtSupply } from '../sim/priming';
import type { PlayerInputs, SimState, TruckState } from '../sim/types';
import { activeTruck } from './activeTruck';
import { tankLevelState } from './tankLevel';

export type WarningLevel = 'off' | 'caution' | 'alarm';

export type WarningId = 'tank' | 'supply' | 'over-pressure' | 'overheat' | 'cavitation' | 'hammer';

export interface Warning {
  id: WarningId;
  /** Lamp caption, uppercase on the panel. */
  label: string;
  level: WarningLevel;
  /** Plain-language explanation when lit. */
  message: string;
}

/** Sim seconds the hammer lamp stays lit after a water hammer: long enough to read. UI choice. */
export const HAMMER_LAMP_S = 5;

/** Cavitation intensity from which the lamp turns from caution to alarm. UI choice. */
export const CAVITATION_ALARM = 0.5;

const isOpen = (x: number | undefined) => (x ?? 0) >= VALVE_CLOSED_EPS;
const off = (id: WarningId, label: string): Warning => ({ id, label, level: 'off', message: '' });

function tankWarning(truck: TruckState): Warning[] {
  const tank = truck.spec.tank;
  if (tank === undefined) return [];
  const level = tankLevelState(truck.tankL, tank.capacityL);
  if (level === 'ok') return [off('tank', 'Tank')];
  return [
    {
      id: 'tank',
      label: 'Tank',
      level: level === 'empty' ? 'alarm' : 'caution',
      message:
        level === 'empty'
          ? 'Tank empty: the pump has no water.'
          : // No litres here: this text feeds a live region, and a changing number would be
            // re-announced every few ticks. The tank gauge carries the reading.
            'Tank low: watch the tank gauge.',
    },
  ];
}

/**
 * Why water isn't reaching the pump while a delivery is open, or '' if it is (or the tank lamp
 * already says the tank is empty).
 */
function supplyProblem(sim: SimState, truck: TruckState, inputs: PlayerInputs): string {
  const { spec } = truck;
  if (!spec.deliveries.some((d) => isOpen(inputs.valves[d.id]))) return '';
  const openInlets = spec.inlets.filter((i) => isOpen(inputs.valves[i.id]));
  if (openInlets.length === 0) {
    return `No supply: open ${spec.inlets.map((i) => i.label.toLowerCase()).join(' or ')}.`;
  }
  if (Object.values(truck.readings.inletFlowLpm).some((q) => q > 0)) return '';
  if (openInlets.some((i) => i.kind === 'tank')) return '';
  const supplies = connectedSupplies(sim, truck.id);
  const draught = draughtSupply(supplies);
  if (draught !== undefined && openInlets.some((i) => i.id === draught.supply.inletId)) {
    if (draught.source.volumeL <= 0)
      return `Lost prime: the ${draught.source.label.toLowerCase()} is empty.`;
    if (!truck.pump.primed) {
      return spec.primer?.kind === 'selfPriming'
        ? 'Not primed yet: shut the deliveries while the pump primes.'
        : 'Not primed: shut the deliveries and run the primer.';
    }
  }
  if (openInlets.every((i) => !supplies.some((s) => s.supply.inletId === i.id))) {
    return 'Nothing is connected to the open inlet.';
  }
  return '';
}

function cavitationMessage(sim: SimState, truck: TruckState): string {
  const kinds = connectedSupplies(sim, truck.id)
    .filter((s) => (truck.readings.inletFlowLpm[s.supply.inletId] ?? 0) > 0)
    .map((s) => s.source.kind);
  const why = kinds.includes('hydrant')
    ? 'Over-running the hydrant: the supply hose is going soft.'
    : kinds.includes('static')
      ? 'Cavitation: the lift can’t supply this much water.'
      : 'Cavitation: the supply can’t keep up.';
  return `${why} More throttle won’t help; ease it back until the gauges steady.`;
}

/** Warning lamps for the active truck, in panel order. */
export function selectWarnings(sim: SimState, inputs: PlayerInputs): Warning[] {
  const truck = activeTruck(sim);
  const { spec, readings, pump } = truck;
  const warnings: Warning[] = [...tankWarning(truck)];

  const problem = supplyProblem(sim, truck, inputs);
  warnings.push(
    problem === ''
      ? off('supply', 'Supply')
      : {
          id: 'supply',
          label: 'Supply',
          level: problem.startsWith('Lost prime') ? 'alarm' : 'caution',
          message: problem,
        },
  );

  if (spec.relief !== undefined) {
    warnings.push(
      readings.reliefFlowLpm > 0
        ? {
            id: 'over-pressure',
            label: 'Relief',
            level: 'caution',
            message: 'Relief valve open: discharge is at its set pressure.',
          }
        : off('over-pressure', 'Relief'),
    );
  }

  warnings.push(
    pump.tempC >= PUMP_TEMP_CAUTION_C
      ? {
          id: 'overheat',
          label: 'Temp',
          level: pump.tempC >= PUMP_TEMP_ALARM_C ? 'alarm' : 'caution',
          message:
            'Pump hot: water is churning with nowhere to go. Open a delivery or ease the throttle.',
        }
      : off('overheat', 'Temp'),
  );

  warnings.push(
    readings.cavitation > 0
      ? {
          id: 'cavitation',
          label: 'Cavitation',
          level: readings.cavitation >= CAVITATION_ALARM ? 'alarm' : 'caution',
          message: cavitationMessage(sim, truck),
        }
      : off('cavitation', 'Cavitation'),
  );

  const hammer = truck.lastHammer;
  const label = spec.deliveries.find((d) => d.id === hammer?.deliveryId)?.label ?? 'A delivery';
  warnings.push(
    hammer !== undefined && sim.timeS - hammer.atS < HAMMER_LAMP_S
      ? {
          id: 'hammer',
          label: 'Hammer',
          level: 'caution',
          message: `Water hammer: ${label} was shut too fast. Close valves slowly.`,
        }
      : off('hammer', 'Hammer'),
  );
  return warnings;
}
