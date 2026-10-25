import { describe, expect, it } from 'vitest';
import { CAT1 } from '../sim/appliances/cat1';
import { TEST_APPLIANCE } from '../sim/appliances/testAppliance';
import { beginLesson } from './lesson';
import { coachView, objectiveRows } from './lessonView';

describe.each([CAT1, TEST_APPLIANCE])('lesson view on $id', (spec) => {
  it('lists objectives: the first active with its readings, the rest waiting', () => {
    const { sim, lesson } = beginLesson('tank-attack', spec);
    const rows = objectiveRows(lesson, sim);
    expect(rows.map((r) => r.state)).toEqual(['active', 'active', 'waiting']);
    expect(rows[0]?.metrics).toEqual([{ kind: 'flow', line: 'line-38', lpm: 0, min: 50 }]);
    expect(rows[2]?.metrics).toEqual([]);
    expect(rows[2]?.holdS).toBe(30);
  });

  it('shows branch readings against their band once an objective is active', () => {
    const { sim, lesson } = beginLesson('tank-attack', spec);
    const done = { heldS: 0, doneAtS: 1 };
    const later = {
      ...lesson,
      progress: {
        ...lesson.progress,
        objectives: { first: done, second: done, both: { heldS: 4 } },
      },
    };
    const both = objectiveRows(later, sim)[2];
    expect(both?.state).toBe('active');
    expect(both?.heldS).toBe(4);
    expect(both?.metrics.map((m) => m.kind)).toEqual(['branch', 'branch']);
    expect(both?.metrics[0]).toMatchObject({ kind: 'branch', line: 'line-38', kpa: 0 });
  });

  it('reads a fraction-of-working-flow target in L/min', () => {
    const { sim, lesson } = beginLesson('hydrant-supply', CAT1);
    const done = { heldS: 0, doneAtS: 1 };
    const later = { ...lesson, progress: { ...lesson.progress, objectives: { hydrant: done } } };
    const flow = objectiveRows(later, sim)[1]?.metrics.find((m) => m.kind === 'flow');
    // 0.635 of a 25 mm tip's ~1100 L/min at 700 kPa: the lesson's "700 L/min".
    expect(flow?.kind === 'flow' ? flow.min : undefined).toBeCloseTo(700, -1);
  });

  it('points the coach at the panel item for its target', () => {
    const { sim, lesson } = beginLesson('first-line', spec);
    expect(coachView(lesson, sim)).toMatchObject({ number: 1, count: 8 });
    expect(coachView(lesson, sim)?.targetKey).toBeUndefined();
    const at = (i: number) =>
      coachView({ ...lesson, progress: { ...lesson.progress, coachIndex: i } }, sim)?.targetKey;
    const tank = spec.inlets.find((i) => i.kind === 'tank')?.id ?? '';
    const line = sim.lines[0]?.deliveryId ?? '';
    const discharge = spec.instruments.find((i) => i.kind === 'discharge')?.id ?? '';
    expect([at(1), at(2), at(3), at(4), at(5)]).toEqual([
      `c:${tank}`,
      `c:${line}`,
      'throttle',
      `i:${discharge}`,
      'warnings',
    ]);
  });
});
