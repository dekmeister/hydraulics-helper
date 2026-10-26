// A lesson in play (ARCHITECTURE §5): after each sim tick, events fire, objectives count, the coach
// moves on, failures end it, and the debrief's statistics accumulate. Pure and deterministic.
import { VALVE_CLOSED_EPS } from '../constants';
import { connectedSupplies } from '../engine';
import { lineFill } from '../lineFill';
import type { FaultTally, HoseLine, SimState, TruckState } from '../types';
import { holds, type LessonFacts } from './conditions';
import { applyEffect } from './effects';
import { truckOf } from './refs';
import type { LessonDef } from './types';

/**
 * Flow from which a crew counts as having water, L/min; the scene draws a line charged from it too
 * (`CHARGED_MIN_LPM` in state/selectors.ts). A display threshold, not physics: below it the legend
 * would read "0 L/min" on a charged line.
 */
export const CREW_WATER_MIN_LPM = 1;

export type LessonStatus = 'running' | 'passed' | 'failed';

/** What fed a cavitating pump, for the debrief's "why". */
export type CavitationSupply = 'tank' | 'hydrant' | 'static' | 'relay';

/** Why a crew lost water. */
export type DryCause = 'tank' | 'prime' | 'relay' | 'other';

export interface LessonStats {
  /** Lines whose crews have had water, so expect it. */
  watered: string[];
  /** Seconds at least one crew with an open delivery had no water. */
  crewDryS: number;
  dryCauses: Partial<Record<DryCause, number>>;
  cavitationBy: Partial<Record<CavitationSupply, number>>;
  peakTempC: number;
}

export interface LessonProgress {
  playerTruckId: string;
  status: LessonStatus;
  /** Sim time the lesson passed or failed, s. */
  endedAtS?: number;
  /** The failure that ended it. */
  failure?: string;
  /** Faults as they stood when the lesson ended: the player's tally and relay bursts site-wide. */
  final?: { tally: FaultTally; bursts: number };
  objectives: Record<string, { heldS: number; doneAtS?: number }>;
  /** Index of the current coach step; the coach's length once it's finished. */
  coachIndex: number;
  acks: string[];
  firedAtS: Record<string, number>;
  radio: { atS: number; from: string; text: string }[];
  stats: LessonStats;
}

export function startLesson(def: LessonDef, playerTruckId: string): LessonProgress {
  return {
    playerTruckId,
    status: 'running',
    objectives: Object.fromEntries(def.objectives.map((o) => [o.id, { heldS: 0 }])),
    coachIndex: 0,
    acks: [],
    firedAtS: {},
    radio: [],
    stats: { watered: [], crewDryS: 0, dryCauses: {}, cavitationBy: {}, peakTempC: 0 },
  };
}

export function lessonFacts(p: LessonProgress): LessonFacts {
  return {
    playerTruckId: p.playerTruckId,
    acks: p.acks,
    done: Object.keys(p.objectives).filter((id) => p.objectives[id]?.doneAtS !== undefined),
    firedAtS: p.firedAtS,
  };
}

/** The coach moved past every step whose condition (default: acknowledged) now holds. */
export function advanceCoach(def: LessonDef, p: LessonProgress, state: SimState): LessonProgress {
  const coach = def.coach ?? [];
  let coachIndex = p.coachIndex;
  for (let step = coach[coachIndex]; step !== undefined; step = coach[++coachIndex]) {
    const done = step.done ?? { kind: 'ack', step: step.id };
    if (!holds(done, state, lessonFacts(p))) break;
  }
  return coachIndex === p.coachIndex ? p : { ...p, coachIndex };
}

/** The player has read a coach step ('Got it'). Takes effect on the next tick. */
export function acknowledge(def: LessonDef, p: LessonProgress, step: string): LessonProgress {
  if (!(def.coach ?? []).some((c) => c.id === step) || p.acks.includes(step)) return p;
  return { ...p, acks: [...p.acks, step] };
}

function cavitationSupply(state: SimState, truck: TruckState): CavitationSupply {
  const flowing = (inletId: string) => (truck.readings.inletFlowLpm[inletId] ?? 0) > 0;
  const relayIn = state.links.some(
    (l) => l.to.kind === 'inlet' && l.to.truckId === truck.id && flowing(l.to.inletId),
  );
  if (relayIn) return 'relay';
  const kinds = connectedSupplies(state, truck.id)
    .filter((s) => flowing(s.supply.inletId))
    .map((s) => s.source.kind);
  return kinds.includes('hydrant') ? 'hydrant' : kinds.includes('static') ? 'static' : 'tank';
}

function dryCause(state: SimState, truck: TruckState): DryCause {
  const tankOpen = truck.spec.inlets.some(
    (i) => i.kind === 'tank' && (truck.inputs.valves[i.id] ?? 0) >= VALVE_CLOSED_EPS,
  );
  if (
    state.links.some(
      (l) => l.burst !== undefined && l.to.kind === 'inlet' && l.to.truckId === truck.id,
    )
  )
    return 'relay';
  if (tankOpen && truck.tankL <= 0) return 'tank';
  const draughting = connectedSupplies(state, truck.id).some((s) => s.source.kind === 'static');
  if (draughting && !truck.pump.primed) return 'prime';
  return 'other';
}

function stepStats(
  stats: LessonStats,
  state: SimState,
  truck: TruckState,
  dtS: number,
  windingDown: boolean,
): LessonStats {
  const lines = state.lines.filter((l) => l.truckId === truck.id);
  const atBranch = (id: string) => truck.readings.branchFlowLpm[id] ?? 0;
  // Water going into a line that hasn't filled (fresh lengths added) is on its way: not a fault.
  const charging = (l: HoseLine) =>
    (truck.readings.deliveryFlowLpm[l.deliveryId] ?? 0) >= CREW_WATER_MIN_LPM &&
    !lineFill(l, state.lineWaterL[l.id] ?? 0).full;
  const watered = [
    ...stats.watered,
    ...lines
      .filter((l) => !stats.watered.includes(l.id) && atBranch(l.id) >= CREW_WATER_MIN_LPM)
      .map((l) => l.id),
  ];
  const dry =
    !windingDown &&
    lines.some(
      (l) =>
        watered.includes(l.id) &&
        (truck.inputs.valves[l.deliveryId] ?? 0) >= VALVE_CLOSED_EPS &&
        atBranch(l.id) < CREW_WATER_MIN_LPM &&
        !charging(l),
    );
  const add = <K extends string>(m: Partial<Record<K, number>>, k: K) => ({
    ...m,
    [k]: (m[k] ?? 0) + dtS,
  });
  return {
    watered,
    crewDryS: stats.crewDryS + (dry ? dtS : 0),
    dryCauses: dry ? add(stats.dryCauses, dryCause(state, truck)) : stats.dryCauses,
    cavitationBy:
      truck.readings.cavitation > 0
        ? add(stats.cavitationBy, cavitationSupply(state, truck))
        : stats.cavitationBy,
    peakTempC: Math.max(stats.peakTempC, truck.pump.tempC),
  };
}

function ended(
  p: LessonProgress,
  state: SimState,
  truck: TruckState,
  status: LessonStatus,
): LessonProgress {
  const bursts = state.trucks.reduce((n, t) => n + t.tally.hoseBursts, 0);
  return { ...p, status, endedAtS: state.timeS, final: { tally: truck.tally, bursts } };
}

/**
 * The lesson after a sim tick of `dtS` that produced `state`: events whose condition holds fire
 * (radio call, effects on the sim, so the returned state may differ), objectives whose condition
 * held long enough are done, the coach moves past satisfied steps, statistics accumulate, and a
 * failure or the last objective ends it. An ended lesson no longer changes.
 */
export function stepLesson(
  def: LessonDef,
  progress: LessonProgress,
  state: SimState,
  dtS: number,
): { state: SimState; progress: LessonProgress } {
  if (progress.status !== 'running') return { state, progress };
  const truck = truckOf(state, progress.playerTruckId, undefined);
  if (truck === undefined) throw new Error(`Lesson: no player truck '${progress.playerTruckId}'`);
  let p = progress;
  let s = state;

  for (const event of def.events ?? []) {
    if (p.firedAtS[event.id] !== undefined || !holds(event.when, s, lessonFacts(p))) continue;
    s = (event.effects ?? []).reduce((acc, e) => applyEffect(acc, p.playerTruckId, e), s);
    p = {
      ...p,
      firedAtS: { ...p.firedAtS, [event.id]: s.timeS },
      radio: event.radio === undefined ? p.radio : [...p.radio, { atS: s.timeS, ...event.radio }],
    };
  }

  const objectives = { ...p.objectives };
  for (const o of def.objectives) {
    const now = objectives[o.id] ?? { heldS: 0 };
    if (now.doneAtS !== undefined) continue;
    // As things stood before this tick: an objective starts counting the tick after its `after`.
    const facts = lessonFacts(p);
    const ready = (o.after ?? []).every((id) => facts.done.includes(id));
    const heldS = ready && holds(o.when, s, facts) ? now.heldS + dtS : 0;
    const done = ready && heldS > 0 && heldS >= (o.holdS ?? 0) - 1e-9;
    objectives[o.id] = done ? { heldS, doneAtS: s.timeS } : { heldS };
  }
  const done = lessonFacts(p).done;
  const windingDown = def.objectives.some(
    (o) => o.windDown === true && (o.after ?? []).every((id) => done.includes(id)),
  );
  p = { ...p, objectives, stats: stepStats(p.stats, s, truck, dtS, windingDown) };

  p = advanceCoach(def, p, s);

  const finalTruck = truckOf(s, p.playerTruckId, undefined) ?? truck;
  if (def.objectives.every((o) => p.objectives[o.id]?.doneAtS !== undefined))
    return { state: s, progress: ended(p, s, finalTruck, 'passed') };
  const failure = (def.failures ?? []).find((f) => holds(f.when, s, lessonFacts(p)));
  if (failure !== undefined)
    return { state: s, progress: { ...ended(p, s, finalTruck, 'failed'), failure: failure.id } };
  return { state: s, progress: p };
}
