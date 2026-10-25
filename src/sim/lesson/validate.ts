// Checking a lesson against the fireground it will be played on (the scenario loader's job).
import type { InstrumentKind, SimState } from '../types';
import { gaugeInstrument, validateCondition, type LessonNames } from './conditions';
import { applyEffect } from './effects';
import { resolvePrimer, resolveValve, truckOf } from './refs';
import { lessonTextProblems } from './text';
import type { CoachTarget, Condition, LessonDef } from './types';

function duplicates(ids: readonly string[], kind: string): string[] {
  return ids.filter((id, i) => ids.indexOf(id) !== i).map((id) => `duplicate ${kind} '${id}'`);
}

function targetProblems(state: SimState, player: string, target: CoachTarget): string[] {
  if ('valve' in target)
    return resolveValve(state, player, target.valve) === undefined
      ? [`coach target: no valve ${JSON.stringify(target.valve)}`]
      : [];
  if ('primer' in target)
    return resolvePrimer(state, player) === undefined ? ['coach target: no primer control'] : [];
  if ('gauge' in target) {
    const kind: InstrumentKind = target.gauge;
    const fitted = truckOf(state, player, undefined)?.spec.instruments.some((i) => i.kind === kind);
    return fitted === true ? [] : [`coach target: no ${kind} instrument`];
  }
  return [];
}

/** Conditions in the lesson, coach steps' included. */
function allConditions(def: LessonDef): Condition[] {
  return [
    ...def.objectives.map((o) => o.when),
    ...(def.failures ?? []).map((f) => f.when),
    ...(def.events ?? []).map((e) => e.when),
    ...(def.coach ?? []).flatMap((c) => (c.done === undefined ? [] : [c.done])),
  ];
}

function gaugesIn(c: Condition): InstrumentKind[] {
  switch (c.kind) {
    case 'gauge':
      return c.truck === undefined ? [gaugeInstrument(c.gauge)] : [];
    case 'all':
    case 'any':
      return c.of.flatMap(gaugesIn);
    case 'not':
      return gaugesIn(c.of);
    default:
      return [];
  }
}

/**
 * Instruments the lesson asks the player to read on their own truck: gauge conditions and the
 * coach's gauge targets. A truck without one can't be taught it (it would have to be guessed).
 */
export function playerInstruments(def: LessonDef): InstrumentKind[] {
  const kinds = [
    ...allConditions(def).flatMap(gaugesIn),
    ...(def.coach ?? []).flatMap((c) =>
      c.target !== undefined && 'gauge' in c.target ? [c.target.gauge] : [],
    ),
  ];
  return [...new Set(kinds)];
}

/**
 * The fireground once every event's effects have applied, in event order (so a line an event lays
 * can be named by an objective or the copy), with any effect that doesn't fit.
 */
export function projectEvents(
  def: LessonDef,
  state: SimState,
  player: string,
): { state: SimState; problems: string[] } {
  let projected = state;
  const problems: string[] = [];
  for (const event of def.events ?? []) {
    for (const effect of event.effects ?? []) {
      try {
        projected = applyEffect(projected, player, effect);
      } catch (e) {
        problems.push(`event '${event.id}': ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return { state: projected, problems };
}

/**
 * Every problem with playing `def` on `state` with `player`'s truck; empty when sound. Effects are
 * applied in event order to a projection of the fireground (so a line laid by an event can be named
 * by a later objective), and every condition is checked against the result.
 */
export function validateLesson(def: LessonDef, state: SimState, player: string): string[] {
  const events = def.events ?? [];
  const coach = def.coach ?? [];
  const names: LessonNames = {
    objectives: def.objectives.map((o) => o.id),
    events: events.map((e) => e.id),
    coach: coach.map((c) => c.id),
  };
  const problems = [
    ...(def.objectives.length === 0 ? ['no objectives'] : []),
    ...duplicates(names.objectives, 'objective'),
    ...duplicates(names.events, 'event'),
    ...duplicates(names.coach, 'coach step'),
    ...duplicates(
      (def.failures ?? []).map((f) => f.id),
      'failure',
    ),
  ];
  if (truckOf(state, player, undefined) === undefined) return [...problems, `no truck '${player}'`];
  def.objectives.forEach((o, i) => {
    const earlier = names.objectives.slice(0, i);
    for (const a of o.after ?? [])
      if (!earlier.includes(a))
        problems.push(`objective '${o.id}': '${a}' is not an earlier objective`);
  });

  const { state: projected, problems: effectProblems } = projectEvents(def, state, player);
  problems.push(...effectProblems, ...lessonTextProblems(def, projected));
  const conditions: [string, Condition][] = [
    ...def.objectives.map((o): [string, Condition] => [`objective '${o.id}'`, o.when]),
    ...(def.failures ?? []).map((f): [string, Condition] => [`failure '${f.id}'`, f.when]),
    ...events.map((e): [string, Condition] => [`event '${e.id}'`, e.when]),
    ...coach.flatMap((c): [string, Condition][] =>
      c.done === undefined ? [] : [[`coach step '${c.id}'`, c.done]],
    ),
  ];
  for (const [where, c] of conditions)
    for (const p of validateCondition(c, projected, player, names)) problems.push(`${where}: ${p}`);
  for (const c of coach)
    if (c.target !== undefined)
      for (const p of targetProblems(projected, player, c.target))
        problems.push(`coach step '${c.id}': ${p}`);
  return problems;
}
