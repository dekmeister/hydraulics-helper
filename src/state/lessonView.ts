// What the lesson dock shows: objectives with live readings against their targets, and the coach
// step with the panel item it points at. Pure functions of the lesson and the sim.
import {
  branchBand,
  branchKpa,
  hoseById,
  resolvePrimer,
  resolveValve,
  truckOf,
  workingFlowLpm,
} from '../sim/lesson/refs';
import type { CoachStep, Condition, GaugeId } from '../sim/lesson/types';
import type { SimState } from '../sim/types';
import type { ActiveLesson } from './lesson';

/** A reading an objective is judged on, with its target. */
export type Metric =
  | { kind: 'branch'; line: string; kpa: number; minKpa: number; maxKpa: number }
  | { kind: 'gauge'; gauge: GaugeId; value: number; min?: number; max?: number }
  | { kind: 'flow'; line: string; lpm: number; min?: number; max?: number };

export type ObjectiveState = 'done' | 'active' | 'waiting';

export interface ObjectiveRow {
  id: string;
  text: string;
  state: ObjectiveState;
  /** Seconds held so far, and needed (0: once is enough). */
  heldS: number;
  holdS: number;
  metrics: Metric[];
}

function metrics(c: Condition, sim: SimState, player: string): Metric[] {
  switch (c.kind) {
    case 'branch': {
      const band = branchBand(sim, c.line);
      return band === undefined
        ? []
        : [
            {
              kind: 'branch',
              line: c.line,
              kpa: branchKpa(sim, c.line),
              minKpa: band.minKpa,
              maxKpa: band.maxKpa,
            },
          ];
    }
    case 'gauge': {
      const t = truckOf(sim, player, c.truck);
      if (t === undefined || c.truck !== undefined) return [];
      const value =
        c.gauge === 'discharge'
          ? t.readings.dischargeKpa
          : c.gauge === 'compound'
            ? t.readings.compoundKpa
            : t.rpm;
      return [{ kind: 'gauge', gauge: c.gauge, value, ...range(c) }];
    }
    case 'flow': {
      const hose = hoseById(sim, c.line);
      const t = hose === undefined ? undefined : truckOf(sim, player, hose.truckId);
      if (hose === undefined || t === undefined) return [];
      // A target given as a fraction of the line's working flow reads in L/min, as the copy does.
      const scale = c.ofWorking === true ? (workingFlowLpm(sim, c.line) ?? 0) : 1;
      return [
        {
          kind: 'flow',
          line: c.line,
          lpm: t.readings.deliveryFlowLpm[hose.deliveryId] ?? 0,
          ...range({
            ...(c.min === undefined ? {} : { min: c.min * scale }),
            ...(c.max === undefined ? {} : { max: c.max * scale }),
          }),
        },
      ];
    }
    case 'all':
    case 'any':
      return c.of.flatMap((x) => metrics(x, sim, player));
    default:
      return [];
  }
}

function range(r: { min?: number; max?: number }): { min?: number; max?: number } {
  return {
    ...(r.min === undefined ? {} : { min: r.min }),
    ...(r.max === undefined ? {} : { max: r.max }),
  };
}

/** Every objective in order: done, active (its prerequisites are done) or waiting. */
export function objectiveRows(lesson: ActiveLesson, sim: SimState): ObjectiveRow[] {
  const { def, progress } = lesson;
  const isDone = (id: string) => progress.objectives[id]?.doneAtS !== undefined;
  return def.objectives.map((o) => {
    const state: ObjectiveState = isDone(o.id)
      ? 'done'
      : (o.after ?? []).every(isDone)
        ? 'active'
        : 'waiting';
    return {
      id: o.id,
      text: o.text,
      state,
      heldS: progress.objectives[o.id]?.heldS ?? 0,
      holdS: o.holdS ?? 0,
      metrics: state === 'active' ? metrics(o.when, sim, progress.playerTruckId) : [],
    };
  });
}

/**
 * The panel item a coach step points at, keyed as the pump panel keys its items: 'c:<control id>',
 * 'i:<instrument id>', 'throttle' or 'warnings'. Undefined if it points at nothing on this truck.
 */
export function coachTargetKey(step: CoachStep, sim: SimState, player: string): string | undefined {
  const target = step.target;
  if (target === undefined) return undefined;
  if ('valve' in target) {
    const v = resolveValve(sim, player, target.valve);
    return v === undefined || v.truck.id !== sim.activeTruckId ? undefined : `c:${v.control}`;
  }
  if ('primer' in target) {
    const id = resolvePrimer(sim, player);
    return id === undefined ? undefined : `c:${id}`;
  }
  if ('gauge' in target) {
    const t = truckOf(sim, player, undefined);
    const instrument = t?.spec.instruments.find((i) => i.kind === target.gauge);
    return instrument === undefined ? undefined : `i:${instrument.id}`;
  }
  return 'throttle' in target ? 'throttle' : 'warnings';
}

export interface CoachView {
  step: CoachStep;
  /** 1-based position, and how many steps. */
  number: number;
  count: number;
  /** Panel item key it points at, if any (see `coachTargetKey`). */
  targetKey?: string;
}

/** The current coach step, or undefined when there's no coach or it's finished. */
export function coachView(lesson: ActiveLesson, sim: SimState): CoachView | undefined {
  const coach = lesson.def.coach ?? [];
  const step = coach[lesson.progress.coachIndex];
  if (step === undefined || lesson.progress.status !== 'running') return undefined;
  const targetKey = coachTargetKey(step, sim, lesson.progress.playerTruckId);
  return {
    step,
    number: lesson.progress.coachIndex + 1,
    count: coach.length,
    ...(targetKey === undefined ? {} : { targetKey }),
  };
}
