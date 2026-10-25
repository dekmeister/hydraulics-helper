// Every ladder scenario loads on every appliance that can play it, and a competent operator passes
// it there cleanly (PLAN M6: scripts must not be hand-timed to one truck).
import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../appliances/catalogue';
import { TEST_APPLIANCE } from '../appliances/testAppliance';
import { operate } from '../lesson/operator';
import { scoreLesson } from '../lesson/score';
import { expectSane } from '../testUtils';
import { SCENARIOS } from '.';
import { loadScenario } from './load';
import { supports, type Scenario, type SupportSpecs } from './types';

const POOL = [...APPLIANCES, TEST_APPLIANCE];
const LADDER = SCENARIOS.filter((s) => s.lesson !== undefined);

/** Every player appliance × support appliance combination that can play `scenario`. */
function casesFor(scenario: Scenario) {
  return POOL.flatMap((spec) =>
    (scenario.support === undefined ? [undefined] : POOL).flatMap((other) => {
      const support: SupportSpecs | undefined =
        other === undefined
          ? undefined
          : Object.fromEntries((scenario.support ?? []).map((r) => [r.id, other]));
      if (!supports(scenario, spec, support)) return [];
      const name = other === undefined ? spec.id : `${spec.id} + ${other.id}`;
      return [{ name, spec, support }];
    }),
  );
}

describe('the scenario ladder', () => {
  it('numbers its lessons 1…n in order, one each', () => {
    expect(LADDER.map((s) => s.lesson?.ladder)).toEqual(LADDER.map((_, i) => i + 1));
  });

  it('gives every lesson a solution', () => {
    expect(LADDER.filter((s) => s.solution === undefined).map((s) => s.id)).toEqual([]);
  });
});

describe.each(LADDER.map((s) => [s.id, s] as const))('%s', (_id, scenario) => {
  const cases = casesFor(scenario);
  it('can be played on at least the reference appliance', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases.map((c) => [c.name, c] as const))('passes cleanly on %s', (_name, c) => {
    const loaded = loadScenario(scenario, c.spec, c.support);
    const lesson = loaded.lesson;
    if (lesson === undefined) throw new Error('no lesson');
    const end = operate(
      lesson.def,
      { state: loaded.run.state, progress: lesson.progress },
      scenario.solution ?? [],
    );
    expectSane(end.state);
    expect(end.progress.failure).toBeUndefined();
    expect(end.progress.status).toBe('passed');
    const score = scoreLesson(lesson.def, end.progress, end.state);
    expect(score.lines.filter((l) => l.points < 0)).toEqual([]);
    expect(score.stars).toBe(3);
  });
});
