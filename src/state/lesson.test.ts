import { beforeEach, describe, expect, it } from 'vitest';
import { CAT1 } from '../sim/appliances/cat1';
import { operate } from '../sim/lesson/operator';
import { FIRST_LINE } from '../sim/scenarios/firstLine';
import { beginLesson, recordIfEnded } from './lesson';
import { defaultSaved } from './persist';
import { activeTruck } from './selectors';
import { useStore } from './store';

describe('lessons in the store', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('opens on the menu until something is loaded', () => {
    useStore.setState({ screen: 'menu' });
    expect(useStore.getState().screen).toBe('menu');
    useStore.getState().loadScenario('tank-attack');
    expect(useStore.getState().screen).toBe('play');
    expect(useStore.getState().lesson).toBeNull();
  });

  it('starts a lesson on the panels, and free play ends it', () => {
    const { startLesson } = useStore.getState();
    startLesson('first-line');
    const s = useStore.getState();
    expect(s.screen).toBe('play');
    expect(s.scenarioId).toBe('first-line');
    expect(s.lesson?.progress.status).toBe('running');
    expect(s.lesson?.applianceId).toBe(activeTruck(s.sim).spec.id);
    s.loadScenario('tank-attack');
    expect(useStore.getState().lesson).toBeNull();
  });

  it('walks the coach: Got it moves on at once, a control step on the next tick', () => {
    useStore.getState().startLesson('first-line');
    const index = () => useStore.getState().lesson?.progress.coachIndex;
    expect(index()).toBe(0);
    useStore.getState().acknowledgeCoach();
    expect(index()).toBe(1);
    // A step that waits on a control isn't acknowledged away.
    useStore.getState().acknowledgeCoach();
    expect(index()).toBe(1);
    const tank = activeTruck(useStore.getState().sim).spec.inlets.find((i) => i.kind === 'tank');
    useStore.getState().setValve(tank?.id ?? '', 1);
    useStore.getState().step(1);
    expect(index()).toBe(2);
  });

  it('shows the debrief only with a lesson', () => {
    useStore.getState().openDebrief();
    expect(useStore.getState().screen).toBe('play');
    useStore.getState().startLesson('first-line');
    useStore.getState().openDebrief();
    expect(useStore.getState().screen).toBe('debrief');
  });
});

describe('recording a result', () => {
  it('records once, when the lesson ends', () => {
    const { sim, lesson } = beginLesson('first-line', CAT1);
    const end = operate(
      lesson.def,
      { state: sim, progress: lesson.progress },
      FIRST_LINE.solution ?? [],
    );
    const ended = { ...lesson, progress: end.progress };
    const saved = recordIfEnded(lesson.progress, ended, end.state, defaultSaved());
    expect(saved.results['first-line']?.[CAT1.id]).toEqual({
      passed: true,
      bestPoints: 100,
      bestStars: 3,
    });
    // Already ended before this tick: nothing new to record.
    const again = recordIfEnded(end.progress, ended, end.state, defaultSaved());
    expect(again).toEqual(defaultSaved());
  });
});
