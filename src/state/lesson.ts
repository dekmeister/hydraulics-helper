// The lesson being played, as the store holds it, and the pure steps the store takes with it.
import { getScenario } from '../sim/scenarios';
import { loadScenario } from '../sim/scenarios/load';
import type { SupportSpecs } from '../sim/scenarios/types';
import { stepLesson, type LessonProgress } from '../sim/lesson/progress';
import { scoreLesson, type Score } from '../sim/lesson/score';
import type { LessonDef } from '../sim/lesson/types';
import type { ApplianceSpec, SimState } from '../sim/types';
import { recordResult, type Saved } from './persist';

export interface ActiveLesson {
  scenarioId: string;
  /** The player's appliance: results are kept per scenario and appliance. */
  applianceId: string;
  def: LessonDef;
  progress: LessonProgress;
}

/** A scenario's lesson started on `spec`, with its initial fireground. Throws if it can't play. */
export function beginLesson(
  scenarioId: string,
  spec: ApplianceSpec,
  support?: SupportSpecs,
): { sim: SimState; lesson: ActiveLesson } {
  const loaded = loadScenario(getScenario(scenarioId), spec, support);
  if (loaded.lesson === undefined) throw new Error(`'${scenarioId}' has no lesson`);
  return {
    sim: loaded.run.state,
    lesson: { scenarioId, applianceId: spec.id, ...loaded.lesson },
  };
}

/** The lesson after a tick that produced `sim` (its events may change the sim). */
export function stepActive(
  lesson: ActiveLesson,
  sim: SimState,
  dtS: number,
): { sim: SimState; lesson: ActiveLesson } {
  const next = stepLesson(lesson.def, lesson.progress, sim, dtS);
  return { sim: next.state, lesson: { ...lesson, progress: next.progress } };
}

export function lessonScore(lesson: ActiveLesson, sim: SimState): Score {
  return scoreLesson(lesson.def, lesson.progress, sim);
}

/** `saved` with the lesson's result folded in, if it has just ended; otherwise unchanged. */
export function recordIfEnded(
  before: LessonProgress,
  lesson: ActiveLesson,
  sim: SimState,
  saved: Saved,
): Saved {
  if (before.status !== 'running' || lesson.progress.status === 'running') return saved;
  const score = lessonScore(lesson, sim);
  return recordResult(saved, lesson.scenarioId, lesson.applianceId, {
    passed: lesson.progress.status === 'passed',
    points: score.points,
    stars: score.stars,
  });
}
