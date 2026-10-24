import type { PlayerInputs, SimState } from './types';

/** Fresh state at t = 0. */
export function createInitialState(): SimState {
  return { timeS: 0 };
}

/** Neutral inputs: throttle idle, nothing open, nothing switched on. */
export function createIdleInputs(): PlayerInputs {
  return { throttle: 0, valves: {}, switches: {} };
}

/**
 * Advance the sim by `dtS` seconds. Pure and deterministic: returns new state, never mutates.
 * M0 stub: only the clock moves; hydraulics arrive in M1.
 */
export function advance(state: SimState, _inputs: PlayerInputs, dtS: number): SimState {
  return { ...state, timeS: state.timeS + dtS };
}
