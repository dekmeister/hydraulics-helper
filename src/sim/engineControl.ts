// Starting and stopping the pump engine: ignition, a held START that cranks
// until the engine fires, and a held STOP that cuts the fuel until it has run down.
import { ENGINE_AT_REST_FRACTION_OF_IDLE } from './constants';
import { lagRpm } from './pump';
import type { EngineSpec, EngineState, PlayerInputs, TruckState } from './types';

/** What the engine is doing, for the panel and the coach. */
export type EnginePhase = 'off' | 'cranking' | 'running' | 'stopping';

interface EngineSwitches {
  ignition: boolean;
  start: boolean;
  /** STOP is held and cutting the fuel: a solenoid stop only does with the ignition on. */
  stopping: boolean;
}

function switches(engine: EngineSpec, inputs: PlayerInputs): EngineSwitches {
  const { ignition, start, stop } = engine.controls;
  const ign = inputs.switches[ignition] === true;
  const stopHeld = inputs.switches[stop.id] === true;
  return {
    ignition: ign,
    start: inputs.switches[start] === true,
    stopping: stopHeld && (ign || !stop.needsIgnition),
  };
}

/** Speed with no fuel and no starter, after `dtS`: an exponential run-down, stopping dead near 0. */
function runDown(engine: EngineSpec, rpm: number, dtS: number): number {
  const next = rpm * Math.exp(-dtS / engine.runDownS);
  return next < ENGINE_AT_REST_FRACTION_OF_IDLE * engine.idleRpm ? 0 : next;
}

/**
 * Engine after `dtS`. Running and fuelled, rpm chases the throttle (`lagRpm`). STOP cuts the fuel
 * while it's held: the engine runs down and is stopped once below `refireRpm`, but let go above
 * that and the fuel rack returns, so it picks up again. Stopped, with the ignition on and START
 * held, the starter spins it at `crankRpm` and it fires after `crankS` unbroken; START does nothing
 * while it runs.
 */
export function stepEngine(
  engine: EngineSpec,
  state: { rpm: number; engine: EngineState },
  inputs: PlayerInputs,
  dtS: number,
): { rpm: number; engine: EngineState } {
  const sw = switches(engine, inputs);
  if (state.engine.running) {
    if (!sw.stopping) {
      return { rpm: lagRpm(engine, state.rpm, inputs.throttle, dtS), engine: state.engine };
    }
    const rpm = runDown(engine, state.rpm, dtS);
    return { rpm, engine: { running: rpm >= engine.refireRpm, crankS: 0 } };
  }
  if (sw.ignition && sw.start && !sw.stopping) {
    const crankS = state.engine.crankS + dtS;
    const fires = crankS >= engine.crankS;
    // The starter spins it up to cranking speed with the same lag as the governor.
    const rpm = engine.crankRpm + (state.rpm - engine.crankRpm) * Math.exp(-dtS / engine.rpmLagS);
    return { rpm, engine: { running: fires, crankS: fires ? 0 : crankS } };
  }
  return { rpm: runDown(engine, state.rpm, dtS), engine: { running: false, crankS: 0 } };
}

/** What the truck's engine is doing under the inputs it last had. */
export function enginePhase(
  truck: Pick<TruckState, 'spec' | 'engine' | 'inputs' | 'rpm'>,
): EnginePhase {
  const sw = switches(truck.spec.engine, truck.inputs);
  if (truck.engine.running) return sw.stopping ? 'stopping' : 'running';
  return sw.ignition && sw.start && !sw.stopping ? 'cranking' : 'off';
}

/** Whether the truck's ignition switch is on. */
export function ignitionOn(truck: Pick<TruckState, 'spec' | 'inputs'>): boolean {
  return truck.inputs.switches[truck.spec.engine.controls.ignition] === true;
}

/** STOP is held but can't work: a solenoid stop with the ignition off. The Cat 1's placard trap. */
export function stopWithoutIgnition(truck: Pick<TruckState, 'spec' | 'inputs'>): boolean {
  const { stop } = truck.spec.engine.controls;
  return stop.needsIgnition && truck.inputs.switches[stop.id] === true && !ignitionOn(truck);
}

/**
 * An electronic speed controller (`EngineSpec.speedController`) has no effect with the engine
 * stopped, and the governor goes back to idle when the engine stops. A cable throttle is a lever
 * that stays where it's left, so a truck without one is never dead (issue #29).
 */
export function speedControllerDead(truck: Pick<TruckState, 'spec' | 'engine'>): boolean {
  return truck.spec.engine.speedController !== undefined && !truck.engine.running;
}
