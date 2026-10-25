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
import { supportsLesson, type Scenario, type SupportSpecs } from './types';
import type { ApplianceSpec } from '../types';

const POOL = [...APPLIANCES, TEST_APPLIANCE];
const LADDER = SCENARIOS.filter((s) => s.lesson !== undefined);

/** Pump flow at 700 kPa and max rpm, L/min: how much a pump can give a relay. */
const ratedLpm = (spec: ApplianceSpec) =>
  Math.sqrt(Math.max(0, spec.pump.shutoffKpa - 700) / spec.pump.droopKpaPerLpm2);

/**
 * Every player appliance × support appliance combination that can play `scenario`. A support pump
 * much smaller than the player's (a Cat 7 base pump for a Cat 1's attack lines) can't keep up, and
 * that's physics, not a lesson fault: mixed pairs are played when the support pump is within 10 %
 * of the player's. The menu plays support roles on the player's own appliance.
 */
function casesFor(scenario: Scenario) {
  return POOL.flatMap((spec) =>
    (scenario.support === undefined ? [undefined] : POOL).flatMap((other) => {
      const support: SupportSpecs | undefined =
        other === undefined
          ? undefined
          : Object.fromEntries((scenario.support ?? []).map((r) => [r.id, other]));
      if (!supportsLesson(scenario, spec, support)) return [];
      if (other !== undefined && ratedLpm(other) < 0.9 * ratedLpm(spec)) return [];
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

// The first-line coach says "700 kPa at the pump is about 350 at the branch": hose and branch
// physics, the same on any pump. Hold it to that on every appliance that plays it.
describe('first-line coach figures', () => {
  const scenario = SCENARIOS.find((s) => s.id === 'first-line');
  it.each(
    POOL.filter((s) => scenario !== undefined && supportsLesson(scenario, s)).map(
      (s) => [s.id, s] as const,
    ),
  )('on %s the branch is at working pressure with ~700 kPa at the pump', (_id, spec) => {
    if (scenario === undefined) throw new Error('no first-line');
    const loaded = loadScenario(scenario, spec);
    const lesson = loaded.lesson;
    if (lesson === undefined) throw new Error('no lesson');
    const steps = (scenario.solution ?? []).slice(0, 5); // up to holding the branch in band
    const end = operate(lesson.def, { state: loaded.run.state, progress: lesson.progress }, steps);
    const truck = end.state.trucks[0];
    expect(truck?.readings.dischargeKpa).toBeGreaterThan(630); // 700 ± 10 %
    expect(truck?.readings.dischargeKpa).toBeLessThan(770);
    expect(truck?.readings.branchKpa['line-38']).toBeGreaterThan(315);
  });
});
