import { idleInputs, sanitiseInputs } from './appliances/controls';
import { solveTruck } from './network';
import { lagRpm } from './pump';
import { drainTankL } from './tank';
import type { ApplianceSpec, HoseLine, PlayerInputs, SimState, TruckState } from './types';

/** Id given to the truck in a single-truck state. */
export const DEFAULT_TRUCK_ID = 'truck-1';

/**
 * Fresh state at t = 0: one truck of `spec`, engine at idle, tank full, all controls shut.
 * The spec is copied in so the state stays self-contained (ARCHITECTURE §9.2).
 */
export function createInitialState(spec: ApplianceSpec, lines: readonly HoseLine[] = []): SimState {
  const inputs = idleInputs(spec);
  const base = {
    id: DEFAULT_TRUCK_ID,
    spec: structuredClone(spec),
    rpm: spec.engine.idleRpm,
    tankL: spec.tank?.capacityL ?? 0,
    inputs,
  };
  const ownLines = lines.filter((l) => l.truckId === DEFAULT_TRUCK_ID);
  const truck: TruckState = { ...base, readings: solveTruck(base, ownLines) };
  return {
    timeS: 0,
    activeTruckId: DEFAULT_TRUCK_ID,
    trucks: [truck],
    lines: structuredClone([...lines]),
  };
}

/** Neutral inputs for a spec: throttle idle, every valve shut, every switch off. */
export function createIdleInputs(spec: ApplianceSpec): PlayerInputs {
  return idleInputs(spec);
}

/**
 * Advance one truck by `dtS`: engine rpm chases the throttle, the network is re-solved at the new
 * rpm, then the tank drains by the water that left through the deliveries.
 */
function advanceTruck(
  truck: TruckState,
  inputs: PlayerInputs,
  lines: readonly HoseLine[],
  dtS: number,
): TruckState {
  const clean = sanitiseInputs(truck.spec, inputs);
  const rpm = lagRpm(truck.spec.engine, truck.rpm, clean.throttle, dtS);
  const readings = solveTruck({ spec: truck.spec, rpm, tankL: truck.tankL, inputs: clean }, lines);
  const outLpm = Object.values(readings.deliveryFlowLpm).reduce((a, b) => a + b, 0);
  return { ...truck, rpm, inputs: clean, readings, tankL: drainTankL(truck.tankL, outLpm, dtS) };
}

/**
 * Advance the sim by `dtS` seconds. Pure and deterministic: returns new state, never mutates.
 * `inputs` apply to the active truck; other trucks keep their last inputs.
 */
export function advance(state: SimState, inputs: PlayerInputs, dtS: number): SimState {
  return {
    ...state,
    timeS: state.timeS + dtS,
    trucks: state.trucks.map((truck) =>
      advanceTruck(
        truck,
        truck.id === state.activeTruckId ? inputs : truck.inputs,
        state.lines.filter((l) => l.truckId === truck.id),
        dtS,
      ),
    ),
  };
}
