import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import { lessonState } from './lessonStates';

// Each lesson fixture's caption depends on these.
describe.each([...APPLIANCES, TEST_APPLIANCE])('lesson fixture states on $id', (spec) => {
  it('guided: the coach is on its second step, nothing done', () => {
    const { lesson } = lessonState(spec, 'guided');
    expect(lesson.progress.coachIndex).toBe(1);
    expect(lesson.progress.status).toBe('running');
  });

  it('incident: crew 1 has moved uphill and called for pressure', () => {
    const { lesson, sim } = lessonState(spec, 'incident');
    expect(lesson.progress.objectives.attack?.doneAtS).toBeDefined();
    expect(lesson.progress.radio.map((r) => r.from)).toEqual(['Branch 1']);
    expect(sim.lines.find((l) => l.id === 'line-1')?.elevationM).toBe(10);
    const kpa = sim.trucks[0]?.readings.branchKpa['line-1'] ?? 0;
    expect(kpa).toBeLessThan(315);
  });

  it('passed: first line, clean', () => {
    expect(lessonState(spec, 'passed').lesson.progress.status).toBe('passed');
  });

  it('failed: the tank ran dry with crews on the branches', () => {
    const { lesson } = lessonState(spec, 'failed');
    expect(lesson.progress.status).toBe('failed');
    expect(lesson.progress.failure).toBe('tank-dry');
    expect(lesson.progress.stats.crewDryS).toBe(0);
  });
});
