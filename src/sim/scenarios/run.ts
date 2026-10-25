import { TICK_S } from '../constants';
import { advance } from '../engine';
import type { PlayerInputs, SimState, TruckState } from '../types';
import type { ScriptedRun } from './types';

export interface TraceSample {
  /** Sample time, s (from the tick count, so free of float drift). */
  tS: number;
  inputs: PlayerInputs;
  /** The active truck. */
  truck: TruckState;
  /** The whole state, for multi-truck traces. */
  state: SimState;
}

function activeTruck(state: SimState): TruckState {
  const truck = state.trucks.find((t) => t.id === state.activeTruckId);
  if (truck === undefined) throw new Error(`No active truck '${state.activeTruckId}'`);
  return truck;
}

/**
 * Run a scripted scenario at the fixed tick rate, sampling every `sampleEveryS`. The script drives
 * the active truck; other trucks hold their settings.
 * Script steps fire on the first tick at or after their time.
 */
export function runScript(run: ScriptedRun, sampleEveryS = 1): TraceSample[] {
  const totalTicks = Math.round(run.durationS / TICK_S);
  const sampleTicks = Math.round(sampleEveryS / TICK_S);
  const steps = [...run.script].sort((x, y) => x.tS - y.tS);
  let state = run.state;
  let inputs = activeTruck(state).inputs;
  let next = 0;
  const samples: TraceSample[] = [];
  for (let tick = 0; tick <= totalTicks; tick++) {
    for (
      let step = steps[next];
      step !== undefined && Math.round(step.tS / TICK_S) <= tick;
      step = steps[++next]
    ) {
      inputs = {
        ...inputs,
        throttle: step.throttle ?? inputs.throttle,
        valves: { ...inputs.valves, ...step.valves },
        switches: { ...inputs.switches, ...step.switches },
      };
    }
    if (tick > 0) state = advance(state, inputs, TICK_S);
    if (tick % sampleTicks === 0)
      samples.push({ tS: tick * TICK_S, inputs, truck: activeTruck(state), state });
  }
  return samples;
}
