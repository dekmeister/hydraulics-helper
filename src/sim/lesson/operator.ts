// A scripted pump operator that plays a scenario's `solution` like a competent player: it sets
// controls, eases valves, and trims the throttle or gates a delivery against what the gauges and
// branches show, once a second. Used to prove every ladder scenario can be passed on every appliance
// (ladder.test.ts) and to build debrief fixtures. Pure and deterministic.
import { primerControlId } from '../appliances/controls';
import { TICK_S } from '../constants';
import { advance } from '../engine';
import type { PlayerInputs, SimState } from '../types';
import { holds } from './conditions';
import { acknowledge, lessonFacts, stepLesson, type LessonProgress } from './progress';
import { branchBand, branchKpa, resolveValve } from './refs';
import type { Condition, LessonDef, ValveRef } from './types';

/** What the throttle is trimmed to hold: a branch at its band's target, or the compound at a floor. */
export type TrimTarget = { branch: string } | { compoundKpa: number };

export type OperatorStep =
  /** Set a valve (default fully open). */
  | { open: ValveRef; to?: number }
  /** Move a valve to `to` in even steps over `overS` seconds, as a careful hand would. */
  | { ease: ValveRef; to: number; overS: number }
  | { throttle: number }
  /** Run (or stop, false) the player's primer, if it has one to operate. */
  | { primer: boolean }
  /** Trim the throttle once a second to hold a target; null stops trimming. */
  | { trim: TrimTarget | null }
  /** Gate this line's delivery back once a second whenever its branch is over its band. */
  | { gate: string }
  /** Play until the condition holds; throws after `maxS`. */
  | { until: Condition; maxS: number }
  | { wait: number };

/** Called after every tick with the state and the inputs that produced it. */
export type OnTick = (state: SimState, inputs: PlayerInputs) => void;

interface Play {
  def: LessonDef;
  onTick?: OnTick;
  state: SimState;
  progress: LessonProgress;
  inputs: PlayerInputs;
  trim: TrimTarget | null;
  gates: string[];
}

const TICKS_PER_S = Math.round(1 / TICK_S);
/** Throttle change per second per unit of relative error, and its limit. Tuned, not physics. */
const TRIM_GAIN = 0.15;
const TRIM_MAX_STEP = 0.04;
/** Delivery valve change per second per unit of relative branch over-pressure. */
const GATE_GAIN = 0.4;

function valveId(p: Play, ref: ValveRef): string {
  const v = resolveValve(p.state, p.progress.playerTruckId, ref);
  if (v === undefined) throw new Error(`operator: no valve ${JSON.stringify(ref)}`);
  return v.control;
}

function setValve(p: Play, id: string, to: number): Play {
  return { ...p, inputs: { ...p.inputs, valves: { ...p.inputs.valves, [id]: to } } };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Once-a-second corrections: throttle towards the trim target, gated deliveries back into band. */
function correct(p: Play): Play {
  let next = p;
  const truck = p.state.trucks.find((t) => t.id === p.progress.playerTruckId);
  if (truck === undefined) return p;
  if (p.trim !== null) {
    let error: number;
    if ('branch' in p.trim) {
      const band = branchBand(p.state, p.trim.branch);
      error =
        band === undefined
          ? 0
          : (band.targetKpa - branchKpa(p.state, p.trim.branch)) / band.targetKpa;
    } else {
      error = (truck.readings.compoundKpa - p.trim.compoundKpa) / 400;
    }
    // Cavitating: ease off until the gauges steady, whatever the target says (manual L3353–3355).
    const step =
      truck.readings.cavitation > 0
        ? -TRIM_MAX_STEP
        : Math.max(-TRIM_MAX_STEP, Math.min(TRIM_MAX_STEP, TRIM_GAIN * error));
    next = { ...next, inputs: { ...next.inputs, throttle: clamp01(next.inputs.throttle + step) } };
  }
  for (const line of p.gates) {
    const band = branchBand(p.state, line);
    const id = valveId(p, { line });
    if (band === undefined) continue;
    const over = (branchKpa(p.state, line) - band.targetKpa) / band.targetKpa;
    const open = next.inputs.valves[id] ?? 0;
    next = setValve(next, id, clamp01(open - GATE_GAIN * over));
  }
  return next;
}

/** One sim tick and lesson step; read-only coach steps are acknowledged as a reader would. */
function tick(p: Play, n: number): Play {
  const coach = p.def.coach?.[p.progress.coachIndex];
  const progress =
    coach !== undefined && coach.done === undefined
      ? acknowledge(p.def, p.progress, coach.id)
      : p.progress;
  const stepped = stepLesson(p.def, progress, advance(p.state, p.inputs, TICK_S), TICK_S);
  p.onTick?.(stepped.state, p.inputs);
  const after = { ...p, ...stepped };
  return (n + 1) % TICKS_PER_S === 0 ? correct(after) : after;
}

function runFor(p: Play, seconds: number, until?: Condition): Play {
  let next = p;
  const ticks = Math.round(seconds / TICK_S);
  for (let i = 0; i < ticks; i++) {
    if (until !== undefined && holds(until, next.state, lessonFacts(next.progress))) return next;
    next = tick(next, i);
  }
  if (until !== undefined && !holds(until, next.state, lessonFacts(next.progress)))
    throw new Error(
      `operator: still waiting after ${String(seconds)} s for ${JSON.stringify(until)}`,
    );
  return next;
}

/** Play `steps` from a loaded lesson; returns where it ended up. `onTick` sees every tick (traces). */
export function operate(
  def: LessonDef,
  start: { state: SimState; progress: LessonProgress },
  steps: readonly OperatorStep[],
  onTick?: OnTick,
): { state: SimState; progress: LessonProgress; inputs: PlayerInputs } {
  const player = start.state.trucks.find((t) => t.id === start.progress.playerTruckId);
  if (player === undefined) throw new Error('operator: no player truck');
  let p: Play = {
    def,
    ...(onTick === undefined ? {} : { onTick }),
    ...start,
    inputs: player.inputs,
    trim: null,
    gates: [],
  };
  for (const step of steps) {
    if ('open' in step) p = setValve(p, valveId(p, step.open), step.to ?? 1);
    else if ('ease' in step) {
      const id = valveId(p, step.ease);
      const from = p.inputs.valves[id] ?? 0;
      const n = Math.max(1, Math.round(step.overS));
      for (let i = 1; i <= n; i++)
        p = runFor(setValve(p, id, from + ((step.to - from) * i) / n), 1);
    } else if ('throttle' in step) p = { ...p, inputs: { ...p.inputs, throttle: step.throttle } };
    else if ('primer' in step) {
      const id = primerControlId(player.spec);
      if (id !== undefined)
        p = {
          ...p,
          inputs: { ...p.inputs, switches: { ...p.inputs.switches, [id]: step.primer } },
        };
    } else if ('trim' in step) p = { ...p, trim: step.trim };
    else if ('gate' in step) p = { ...p, gates: [...p.gates, step.gate] };
    else if ('until' in step) p = runFor(p, step.maxS, step.until);
    else p = runFor(p, step.wait);
  }
  return { state: p.state, progress: p.progress, inputs: p.inputs };
}
