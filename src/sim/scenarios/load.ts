// The scenario loader (ARCHITECTURE §9.6): builds a scenario on the player's appliance and checks it
// can be played there, capabilities and lesson both.
import { startLesson, type LessonProgress } from '../lesson/progress';
import type { LessonDef } from '../lesson/types';
import { validateLesson } from '../lesson/validate';
import type { ApplianceSpec } from '../types';
import { supports, type Scenario, type ScriptedRun, type SupportSpecs } from './types';

export interface LoadedScenario {
  run: ScriptedRun;
  /** The lesson to play, started; absent for a sandbox-only scenario. */
  lesson?: { def: LessonDef; progress: LessonProgress };
}

/**
 * `scenario` built on `spec` (support roles on `support`, or the same), with its lesson started on
 * the player's truck. Throws if an appliance lacks a capability the scenario needs, or if anything
 * the lesson names (valves, lines, sources, relays, instruments, objectives, events) isn't there.
 */
export function loadScenario(
  scenario: Scenario,
  spec: ApplianceSpec,
  support?: SupportSpecs,
): LoadedScenario {
  if (!supports(scenario, spec, support)) throw new Error(`${spec.id} can’t play '${scenario.id}'`);
  const run = scenario.build(spec, support);
  const def = scenario.lesson;
  if (def === undefined) return { run };
  const player = run.state.activeTruckId;
  const problems = validateLesson(def, run.state, player);
  if (problems.length > 0)
    throw new Error(`Scenario '${scenario.id}' on ${spec.id}: ${problems.join('; ')}`);
  return { run, lesson: { def, progress: startLesson(def, player) } };
}
