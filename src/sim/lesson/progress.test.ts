import { describe, expect, it } from 'vitest';
import { CAT1 } from '../appliances/cat1';
import { TEST_APPLIANCE } from '../appliances/testAppliance';
import { TICK_S } from '../constants';
import { advance, chargeLines, createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { layLine, tankAttackInputs } from '../testUtils';
import type { ApplianceSpec, PlayerInputs, SimState } from '../types';
import { acknowledge, startLesson, stepLesson, type LessonProgress } from './progress';
import type { LessonDef } from './types';

const P = DEFAULT_TRUCK_ID;

function site(spec: ApplianceSpec, tankL?: number): SimState {
  const [d] = spec.deliveries;
  if (d === undefined) throw new Error('no delivery');
  const s = chargeLines(
    createInitialState(spec, [{ ...layLine(d.id, '38L', 3, 15), id: 'line-1' }]),
  );
  return tankL === undefined ? s : { ...s, trucks: s.trucks.map((t) => ({ ...t, tankL })) };
}

/** Play `ticks` ticks of `inputs` through the sim and the lesson. */
function play(
  def: LessonDef,
  start: { state: SimState; progress: LessonProgress },
  inputs: PlayerInputs,
  ticks: number,
) {
  let { state, progress } = start;
  for (let i = 0; i < ticks; i++) {
    ({ state, progress } = stepLesson(def, progress, advance(state, inputs, TICK_S), TICK_S));
  }
  return { state, progress };
}

const LESSON: LessonDef = {
  ladder: 1,
  brief: 'test',
  objectives: [
    { id: 'water', text: 'Get water to the crew', when: { kind: 'flow', line: 'line-1', min: 50 } },
    {
      id: 'hold',
      text: 'Hold 5 s',
      when: { kind: 'flow', line: 'line-1', min: 50 },
      holdS: 5,
      after: ['water'],
    },
  ],
  events: [
    {
      id: 'radio',
      when: { kind: 'objective', objective: 'water' },
      radio: { from: 'Branch 1', text: 'Water on, thanks.' },
    },
  ],
  coach: [
    { id: 'hello', text: 'Welcome.' },
    {
      id: 'open',
      text: 'Open {target}.',
      target: { valve: { line: 'line-1' } },
      done: { kind: 'valve', valve: { line: 'line-1' }, min: 0.9 },
    },
  ],
};

describe.each([CAT1, TEST_APPLIANCE])('lesson progress on $id', (spec) => {
  const d = spec.deliveries[0]?.id ?? '';
  const on = tankAttackInputs(spec, 0.6, [d]);

  it('starts running with nothing done', () => {
    const p = startLesson(LESSON, P);
    expect(p.status).toBe('running');
    expect(p.coachIndex).toBe(0);
    expect(p.objectives.water).toEqual({ heldS: 0 });
  });

  it('waits on an acknowledgement, then on the coach step’s condition', () => {
    const start = { state: site(spec), progress: startLesson(LESSON, P) };
    let r = play(LESSON, start, on, 5);
    expect(r.progress.coachIndex).toBe(0);
    r = { ...r, progress: acknowledge(LESSON, r.progress, 'hello') };
    r = play(LESSON, r, on, 1);
    expect(r.progress.coachIndex).toBe(2);
  });

  it('completes objectives in order, holding where asked, and passes', () => {
    const start = { state: site(spec), progress: startLesson(LESSON, P) };
    const r = play(LESSON, start, on, 100);
    const water = r.progress.objectives.water?.doneAtS ?? Infinity;
    const hold = r.progress.objectives.hold?.doneAtS ?? Infinity;
    expect(water).toBeLessThan(2);
    expect(hold - water).toBeGreaterThanOrEqual(5 - 1e-9);
    expect(r.progress.status).toBe('passed');
    expect(r.progress.endedAtS).toBeCloseTo(hold, 9);
    expect(r.progress.radio).toEqual([
      { atS: expect.any(Number) as number, from: 'Branch 1', text: 'Water on, thanks.' },
    ]);
  });

  it('resets a hold when the condition breaks', () => {
    const start = { state: site(spec), progress: startLesson(LESSON, P) };
    let r = play(LESSON, start, on, 30);
    expect(r.progress.objectives.hold?.heldS).toBeGreaterThan(1);
    r = play(LESSON, r, tankAttackInputs(spec, 0.6, []), 5);
    expect(r.progress.objectives.hold?.heldS).toBe(0);
  });

  it('fails on a failure condition and freezes', () => {
    const def: LessonDef = {
      ...LESSON,
      failures: [{ id: 'dry', text: 'The tank ran dry.', when: { kind: 'tank', max: 0 } }],
    };
    const start = { state: site(spec, 10), progress: startLesson(def, P) };
    const r = play(def, start, on, 50);
    expect(r.progress.status).toBe('failed');
    expect(r.progress.failure).toBe('dry');
    const later = play(def, r, on, 10);
    expect(later.progress).toEqual(r.progress);
  });

  it('counts a crew left without water: a watered line, valve open, no flow', () => {
    const endless: LessonDef = {
      ...LESSON,
      objectives: [{ id: 'never', text: 'Never', when: { kind: 'time', max: -1 } }],
    };
    const start = { state: site(spec, 100), progress: startLesson(endless, P) };
    const r = play(endless, start, on, 300);
    const t = r.state.trucks[0];
    expect(t?.tankL).toBe(0);
    expect(r.progress.stats.crewDryS).toBeGreaterThan(5);
    expect(r.progress.stats.dryCauses.tank).toBeCloseTo(r.progress.stats.crewDryS, 9);
    // Shutting the delivery on purpose isn't leaving the crew dry.
    const shut = play(endless, start, tankAttackInputs(spec, 0.6, []), 50);
    expect(shut.progress.stats.crewDryS).toBe(0);
  });

  it('applies event effects to the sim', () => {
    const def: LessonDef = {
      ...LESSON,
      events: [
        {
          id: 'uphill',
          when: { kind: 'time', min: 1 },
          effects: [{ kind: 'moveBranch', line: 'line-1', elevationM: 10 }],
        },
      ],
    };
    const r = play(def, { state: site(spec), progress: startLesson(def, P) }, on, 20);
    expect(r.state.lines[0]?.elevationM).toBe(10);
    expect(r.progress.firedAtS.uphill).toBeCloseTo(1, 9);
  });

  it('is deterministic', () => {
    const go = () => play(LESSON, { state: site(spec), progress: startLesson(LESSON, P) }, on, 120);
    expect(go()).toEqual(go());
  });
});
