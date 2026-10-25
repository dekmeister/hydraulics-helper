// Store states for the menu, lesson and debrief fixtures (docs/TESTING.md §3.2), built by playing
// lessons with the scripted operator: pure sim calls, the same on every run.
import { operate } from '../../sim/lesson/operator';
import { getScenario } from '../../sim/scenarios';
import type { ApplianceSpec, PlayerInputs, SimState } from '../../sim/types';
import { advanceCoach, acknowledge } from '../../sim/lesson/progress';
import { beginLesson, type ActiveLesson } from '../../state/lesson';
import { defaultSaved, recordResult, type Saved } from '../../state/persist';

export interface LessonFixtureState {
  sim: SimState;
  lesson: ActiveLesson;
  inputs: PlayerInputs;
}

export type LessonStateId = 'guided' | 'incident' | 'passed' | 'failed';

function played(
  scenarioId: string,
  spec: ApplianceSpec,
  play: (
    start: { state: SimState; progress: ActiveLesson['progress'] },
    lesson: ActiveLesson,
  ) => {
    state: SimState;
    progress: ActiveLesson['progress'];
    inputs: PlayerInputs;
  },
): LessonFixtureState {
  const { sim, lesson } = beginLesson(scenarioId, spec);
  const end = play({ state: sim, progress: lesson.progress }, lesson);
  return { sim: end.state, lesson: { ...lesson, progress: end.progress }, inputs: end.inputs };
}

/** A lesson in a known state, as the store would hold it. */
export function lessonState(spec: ApplianceSpec, id: LessonStateId): LessonFixtureState {
  switch (id) {
    case 'guided': {
      // First line, past the welcome: the coach points at tank-to-pump.
      const { sim, lesson } = beginLesson('first-line', spec);
      const acked = acknowledge(lesson.def, lesson.progress, 'welcome');
      const progress = advanceCoach(lesson.def, acked, sim);
      return {
        sim,
        lesson: { ...lesson, progress },
        inputs: sim.trucks[0]?.inputs ?? { throttle: 0, valves: {}, switches: {} },
      };
    }
    case 'incident':
      // Crew 1 has just moved uphill: the radio call is in and their branch is below its band.
      return played('incident', spec, (start, lesson) =>
        operate(lesson.def, start, [
          ...(getScenario('incident').solution ?? []).slice(0, 4),
          { until: { kind: 'objective', objective: 'attack' }, maxS: 120 },
          { trim: null },
          { wait: 3 },
        ]),
      );
    case 'passed':
      return played('first-line', spec, (start, lesson) =>
        operate(lesson.def, start, getScenario('first-line').solution ?? []),
      );
    case 'failed':
      // Two lines on a nearly empty tank: both crews charged, then it runs dry.
      return played('tank-attack', spec, (start, lesson) =>
        operate(
          lesson.def,
          {
            ...start,
            state: {
              ...start.state,
              trucks: start.state.trucks.map((t) => ({ ...t, tankL: 400 })),
            },
          },
          [
            { open: { inlet: 'tank' } },
            { open: { line: 'line-38' } },
            { open: { line: 'line-65' } },
            { throttle: 0.7 },
            { wait: 60 },
            // A light tanker draws less: let it run on until the tank is dry.
            { until: { kind: 'tank', max: 0 }, maxS: 240 },
          ],
        ),
      );
  }
}

/** Saved progress part-way up the ladder on `spec`: two passed, one tried. */
export function savedProgress(spec: ApplianceSpec): Saved {
  let saved = defaultSaved();
  saved = recordResult(saved, 'first-line', spec.id, { passed: true, points: 100, stars: 3 });
  saved = recordResult(saved, 'tank-attack', spec.id, { passed: true, points: 82, stars: 2 });
  saved = recordResult(saved, 'hydrant-supply', spec.id, { passed: false, points: 40, stars: 0 });
  return saved;
}
