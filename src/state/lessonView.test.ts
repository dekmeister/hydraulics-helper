import { describe, expect, it } from 'vitest';
import { CAT1 } from '../sim/appliances/cat1';
import { TEST_APPLIANCE } from '../sim/appliances/testAppliance';
import { beginLesson } from './lesson';
import { coachView, objectiveRows } from './lessonView';

describe.each([CAT1, TEST_APPLIANCE])('lesson view on $id', (spec) => {
  it('lists objectives: the first active with its readings, the rest waiting', () => {
    const { sim, lesson } = beginLesson('tank-attack', spec);
    const rows = objectiveRows(lesson, sim);
    expect(rows.map((r) => r.state)).toEqual(['active', 'active', 'waiting', 'waiting']);
    expect(rows[0]?.metrics).toEqual([{ kind: 'flow', line: 'line-1', lpm: 0, min: 50 }]);
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
    expect(both?.metrics[0]).toMatchObject({ kind: 'branch', line: 'line-1', kpa: 0 });
  });

  it('reads a fraction-of-working-flow target in L/min', () => {
    const { sim, lesson } = beginLesson('hydrant-tank', CAT1);
    const fraction = {
      ...lesson,
      def: {
        ...lesson.def,
        objectives: [
          {
            id: 'half',
            text: 'Half flow.',
            when: { kind: 'flow', line: 'line-1', ofWorking: true, min: 0.5 },
          } as const,
        ],
      },
    };
    const flow = objectiveRows(fraction, sim)[0]?.metrics.find((m) => m.kind === 'flow');
    // Half a 15 mm tip's ~281 L/min at 350 kPa.
    expect(flow?.kind === 'flow' ? flow.min : undefined).toBeCloseTo(140, -1);
  });

  it('points the coach at the panel item for its target', () => {
    const { sim, lesson } = beginLesson('first-line', spec);
    expect(coachView(lesson, sim)).toMatchObject({ number: 1, count: 12 });
    expect(coachView(lesson, sim)?.targetKey).toBeUndefined();
    const at = (i: number) =>
      coachView({ ...lesson, progress: { ...lesson.progress, coachIndex: i } }, sim)?.targetKey;
    const tank = spec.inlets.find((i) => i.kind === 'tank')?.id ?? '';
    const line = sim.lines[0]?.deliveryId ?? '';
    const discharge = spec.instruments.find((i) => i.kind === 'discharge')?.id ?? '';
    const { ignition, start, stop } = spec.engine.controls;
    expect([at(1), at(2), at(3), at(4), at(5), at(6), at(7)]).toEqual([
      `c:${ignition}`,
      `c:${start}`,
      `c:${tank}`,
      `c:${line}`,
      'throttle',
      `i:${discharge}`,
      'warnings',
    ]);
    expect([at(10), at(11)]).toEqual([`c:${stop.id}`, `c:${ignition}`]);
  });
});
