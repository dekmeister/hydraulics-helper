// Warning lamps for the active truck (ARCHITECTURE §7 HUD). Pure functions of sim state and inputs.
import {
  HOSE_WORKING_KPA,
  PUMP_TEMP_ALARM_C,
  PUMP_TEMP_CAUTION_C,
  RELAY_MIN_RESIDUAL_KPA,
  VALVE_CLOSED_EPS,
} from '../sim/constants';
import { pumpInlets } from '../sim/appliances/controls';
import { connectedSupplies } from '../sim/engine';
import { isRigid } from '../sim/hose';
import { draughtSupply } from '../sim/priming';
import type { PlayerInputs, RelayLink, SimState, TruckState } from '../sim/types';
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

/** A supply problem and how loud its lamp is. */
interface SupplyProblem {
  level: Exclude<WarningLevel, 'off'>;
  message: string;
}

const caution = (message: string): SupplyProblem => ({ level: 'caution', message });

/** Closed relays into this truck's inlets. */
function relaysInto(sim: SimState, truck: TruckState): RelayLink[] {
  return sim.links.filter((l) => l.to.kind === 'inlet' && l.to.truckId === truck.id);
}

/** The supplying truck's name in a sentence: 'the base pump'. */
function supplierOf(sim: SimState, link: RelayLink): string {
  const label = sim.trucks.find((t) => t.id === link.truckId)?.label ?? link.truckId;
  return `the ${label.toLowerCase()}`;
}

/**
 * Relay problems that matter whatever is open: a burst relay hose (alarm), or one pushed past the
 * hose's working pressure (the receiving operator sees the compound climb).
 */
function relayHoseProblem(sim: SimState, truck: TruckState): SupplyProblem | undefined {
  const relays = relaysInto(sim, truck);
  const burst = relays.find((l) => l.burst !== undefined);
  if (burst !== undefined) {
    return {
      level: 'alarm',
      message: `Relay hose burst: no water from ${supplierOf(sim, burst)}. Shut down the lines.`,
    };
  }
  const high = relays.find((l) => (sim.linkReadings[l.id]?.endKpa ?? 0) > HOSE_WORKING_KPA);
  if (high !== undefined) {
    return caution(
      `Relay pressure high: ask ${supplierOf(sim, high)} to ease off before a length bursts.`,
    );
  }
  return undefined;
}

/**
 * A relay that's open but not doing its job: residual under the 100 kPa minimum (L3794–3796) while
 * water flows, or no water at all.
 */
function relayFlowProblem(
  sim: SimState,
  truck: TruckState,
  inputs: PlayerInputs,
): SupplyProblem | undefined {
  for (const link of relaysInto(sim, truck)) {
    if (link.to.kind !== 'inlet' || !isOpen(inputs.valves[link.to.inletId])) continue;
    const flowing = (truck.readings.inletFlowLpm[link.to.inletId] ?? 0) > 0;
    if (flowing && truck.readings.compoundKpa < RELAY_MIN_RESIDUAL_KPA) {
      return caution(
        `Relay residual low: keep the compound above ${String(RELAY_MIN_RESIDUAL_KPA)} kPa. ` +
          `Ease the throttle or ask ${supplierOf(sim, link)} for more pressure.`,
      );
    }
    if (!flowing && Object.values(truck.readings.inletFlowLpm).every((q) => q <= 0)) {
      return caution(`No water from the relay: ${supplierOf(sim, link)} isn’t pumping to you.`);
    }
  }
  return undefined;
}

/**
 * Why water isn't reaching the pump properly while a delivery is open, or undefined if it is (or
 * the tank lamp already says the tank is empty). A relay hose burst or over-pressured is reported
 * whatever is open. Losing prime and a burst relay are alarms; the rest are cautions.
 */
function supplyProblem(
  sim: SimState,
  truck: TruckState,
  inputs: PlayerInputs,
): SupplyProblem | undefined {
  const { spec } = truck;
  const hose = relayHoseProblem(sim, truck);
  if (hose !== undefined) return hose;
  if (!spec.deliveries.some((d) => isOpen(inputs.valves[d.id]))) return undefined;
  // Hydrant to tank fills the tank, not the pump, so it isn't a supply here.
  const inlets = pumpInlets(spec);
  const openInlets = inlets.filter((i) => isOpen(inputs.valves[i.id]));
  if (openInlets.length === 0) {
    return caution(`No supply: open ${inlets.map((i) => i.label.toLowerCase()).join(' or ')}.`);
  }
  const relay = relayFlowProblem(sim, truck, inputs);
  if (relay !== undefined) return relay;
  if (inlets.some((i) => (truck.readings.inletFlowLpm[i.id] ?? 0) > 0)) return undefined;
  if (openInlets.some((i) => i.kind === 'tank')) return undefined;
  const supplies = connectedSupplies(sim, truck.id);
  const draught = draughtSupply(supplies);
  if (draught !== undefined && openInlets.some((i) => i.id === draught.supply.inletId)) {
    if (draught.source.volumeL <= 0) {
      return {
        level: 'alarm',
        message: `Lost prime: the ${draught.source.label.toLowerCase()} is empty.`,
      };
    }
    if (!isRigid(draught.supply.segments)) {
      return caution('Layflat can’t draught: it flattens under vacuum. Use hard suction.');
    }
    if (!truck.pump.primed) {
      return caution(
        spec.primer?.kind === 'selfPriming'
          ? 'Not primed yet: shut the deliveries while the pump primes.'
          : 'Not primed: shut the deliveries and run the primer.',
      );
    }
  }
  const connected = (inletId: string) =>
    supplies.some((s) => s.supply.inletId === inletId) ||
    relaysInto(sim, truck).some((l) => l.to.kind === 'inlet' && l.to.inletId === inletId);
  if (openInlets.every((i) => !connected(i.id))) {
    return caution('Nothing is connected to the open inlet.');
  }
  return undefined;
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
    problem === undefined ? off('supply', 'Supply') : { id: 'supply', label: 'Supply', ...problem },
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
