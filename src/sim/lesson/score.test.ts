import { describe, expect, it } from 'vitest';
import { CAT1 } from '../appliances/cat1';
import { createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { layLine } from '../testUtils';
import type { FaultTally, SimState } from '../types';
import { startLesson, type LessonProgress } from './progress';
import { scoreLesson } from './score';
import type { LessonDef } from './types';
import { validateLesson } from './validate';

const P = DEFAULT_TRUCK_ID;
const D = CAT1.deliveries[0]?.id ?? '';
const STATE: SimState = createInitialState(CAT1, [{ ...layLine(D, '38L', 3, 15), id: 'line-1' }]);

const DEF: LessonDef = {
  ladder: 1,
  brief: 'test',
  objectives: [
    { id: 'a', text: 'A', when: { kind: 'time', min: 0 } },
    { id: 'b', text: 'B', when: { kind: 'time', min: 0 } },
  ],
};

const CLEAN: FaultTally = {
  cavitationS: 0,
  overheatS: 0,
  waterHammer: 0,
  worstSurgeKpa: 0,
  hoseBursts: 0,
};

function ended(
  tally: Partial<FaultTally> = {},
  crewDryS = 0,
  doneIds = ['a', 'b'],
): LessonProgress {
  const p = startLesson(DEF, P);
  return {
    ...p,
    status: doneIds.length === 2 ? 'passed' : 'failed',
    final: { tally: { ...CLEAN, ...tally }, bursts: tally.hoseBursts ?? 0 },
    objectives: Object.fromEntries(
      DEF.objectives.map((o) => [
        o.id,
        doneIds.includes(o.id) ? { heldS: 0, doneAtS: 1 } : { heldS: 0 },
      ]),
    ),
    stats: { ...p.stats, crewDryS },
  };
}

describe('scoreLesson', () => {
  it('gives a clean pass 100 points and three stars', () => {
    expect(scoreLesson(DEF, ended(), STATE)).toMatchObject({ points: 100, stars: 3 });
  });

  it('takes capped points off for each kind of fault', () => {
    const s = scoreLesson(DEF, ended({ cavitationS: 40, waterHammer: 1 }), STATE);
    expect(s.lines.find((l) => l.id === 'cavitation')?.points).toBe(-15);
    expect(s.lines.find((l) => l.id === 'hammer')?.points).toBe(-5);
    expect(s).toMatchObject({ points: 80, stars: 2 });
    const worst = scoreLesson(
      DEF,
      ended({ cavitationS: 999, overheatS: 999, waterHammer: 9, hoseBursts: 3 }, 999),
      STATE,
    );
    expect(worst).toMatchObject({ points: 60, stars: 1 });
  });

  it('a failed lesson earns no stars but keeps its objective points', () => {
    const s = scoreLesson(DEF, ended({}, 0, ['a']), STATE);
    expect(s).toMatchObject({ points: 70, stars: 0 });
  });
});

describe('validateLesson', () => {
  it('accepts a sound lesson', () => {
    expect(validateLesson(DEF, STATE, P)).toEqual([]);
  });

  it('lets later objectives name a line an event lays', () => {
    const def: LessonDef = {
      ...DEF,
      events: [
        {
          id: 'second',
          when: { kind: 'time', min: 5 },
          effects: [
            { kind: 'layLine', line: { id: 'line-2', hose: '65L', lengths: 2, tipMm: 20 } },
          ],
        },
      ],
      objectives: [{ id: 'both', text: 'Both', when: { kind: 'branch', line: 'line-2' } }],
    };
    expect(validateLesson(def, STATE, P)).toEqual([]);
  });

  it('lists duplicate ids, bad ordering, failing effects and unknown targets', () => {
    const def: LessonDef = {
      ...DEF,
      objectives: [
        { id: 'a', text: 'A', when: { kind: 'time', min: 0 }, after: ['b'] },
        { id: 'b', text: 'B', when: { kind: 'flow', line: 'ghost' } },
        { id: 'b', text: 'B again', when: { kind: 'time', min: 0 } },
      ],
      events: [
        { id: 'e', when: { kind: 'time', min: 1 }, effects: [{ kind: 'repairRelay', link: 'r' }] },
      ],
      coach: [
        { id: 'c', text: 'Look', target: { gauge: 'tacho' } },
        { id: 'p', text: 'Prime', target: { primer: true } },
      ],
    };
    const problems = validateLesson(def, STATE, P);
    expect(problems).toContain("duplicate objective 'b'");
    expect(problems).toContain("objective 'a': 'b' is not an earlier objective");
    expect(problems.some((p) => p.includes("no relay 'r'"))).toBe(true);
    expect(problems.some((p) => p.includes("no line 'ghost'"))).toBe(true);
    // Cat 1 fits a tacho and a primer: both targets resolve.
    expect(problems.filter((p) => p.startsWith('coach'))).toEqual([]);
  });
});
