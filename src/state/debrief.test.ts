import { describe, expect, it } from 'vitest';
import { DEFAULT_TRUCK_ID } from '../sim/engine';
import { startLesson, type LessonProgress } from '../sim/lesson/progress';
import type { Score } from '../sim/lesson/score';
import { DRAUGHTING } from '../sim/scenarios/draughting';
import { debrief } from './debrief';

const DEF = DRAUGHTING.lesson ?? { ladder: 0, brief: '', objectives: [] };

function score(amounts: Partial<Record<string, number>>): Score {
  const ids = [
    'objectives',
    'clean',
    'cavitation',
    'overheat',
    'hammer',
    'bursts',
    'crewDry',
  ] as const;
  return {
    points: 50,
    stars: 1,
    lines: ids.map((id) => ({ id, amount: amounts[id] ?? 0, points: 0 })),
  };
}

const progress = (over: Partial<LessonProgress> = {}): LessonProgress => ({
  ...startLesson(DEF, DEFAULT_TRUCK_ID),
  status: 'passed',
  ...over,
});

describe('debrief', () => {
  it('praises a clean run', () => {
    const d = debrief(DEF, progress(), score({}));
    expect(d.headline).toBe('Scenario complete');
    expect(d.findings.map((f) => f.id)).toEqual(['clean']);
  });

  it('explains cavitation by what was feeding the pump', () => {
    const p = progress({
      stats: { ...progress().stats, cavitationBy: { static: 38, hydrant: 2 } },
    });
    const [f] = debrief(DEF, p, score({ cavitation: 40 })).findings;
    expect(f?.title).toBe('You cavitated for 40 s');
    expect(f?.detail).toMatch(/lift/);
  });

  it('leads with the failure, then each fault', () => {
    const p = progress({
      status: 'failed',
      failure: 'cavitation-damage',
      stats: { ...progress().stats, crewDryS: 12.3, dryCauses: { prime: 12.3 } },
    });
    const d = debrief(DEF, p, score({ cavitation: 61, hammer: 2, overheat: 5 }));
    expect(d.headline).toBe('Scenario failed');
    expect(d.findings.map((f) => f.id)).toEqual([
      'failure',
      'cavitation',
      'crew-dry',
      'hammer',
      'overheat',
    ]);
    expect(d.findings[0]?.detail).toMatch(/cavitated for over 60 s/);
    expect(d.findings[2]?.detail).toMatch(/lost its prime/);
    expect(d.findings[3]?.title).toBe('Water hammer 2 times');
  });
});
