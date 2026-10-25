import { TICK_S } from '../constants';
import { advance } from '../engine';
import { holds, noFacts } from '../lesson/conditions';
import { lessonFacts, startLesson, stepLesson, type LessonProgress } from '../lesson/progress';
import type { LessonDef } from '../lesson/types';
import type { PlayerInputs, SimState, TruckState } from '../types';
import type { ScriptedRun, ScriptStep } from './types';

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
 * the active truck; other trucks hold their settings. Steps fire in order, each on the first tick
 * at or after its time once its `when` (if any) holds. With a `lesson`, it is played alongside, so
 * its events change the fireground as they would for a player.
 */
export function runScript(run: ScriptedRun, sampleEveryS = 1, lesson?: LessonDef): TraceSample[] {
  const totalTicks = Math.round(run.durationS / TICK_S);
  const sampleTicks = Math.round(sampleEveryS / TICK_S);
  const steps = [...run.script].sort((x, y) => x.tS - y.tS);
  const player = run.state.activeTruckId;
  let state = run.state;
  let progress: LessonProgress | undefined =
    lesson === undefined ? undefined : startLesson(lesson, player);
  let inputs = activeTruck(state).inputs;
  let next = 0;
  const samples: TraceSample[] = [];
  const due = (step: ScriptStep, tick: number) =>
    Math.round(step.tS / TICK_S) <= tick &&
    (step.when === undefined ||
      holds(step.when, state, progress === undefined ? noFacts(player) : lessonFacts(progress)));
  for (let tick = 0; tick <= totalTicks; tick++) {
    for (let step = steps[next]; step !== undefined && due(step, tick); step = steps[++next]) {
      inputs = {
        ...inputs,
        throttle: step.throttle ?? inputs.throttle,
        valves: { ...inputs.valves, ...step.valves },
        switches: { ...inputs.switches, ...step.switches },
      };
    }
    if (tick > 0) {
      state = advance(state, inputs, TICK_S);
      if (lesson !== undefined && progress !== undefined)
        ({ state, progress } = stepLesson(lesson, progress, state, TICK_S));
    }
    if (tick % sampleTicks === 0)
      samples.push({ tS: tick * TICK_S, inputs, truck: activeTruck(state), state });
  }
  return samples;
}
