import { beforeEach, describe, expect, it } from 'vitest';
import { CAT1 } from '../sim/appliances/cat1';
import { operate } from '../sim/lesson/operator';
import { FIRST_LINE } from '../sim/scenarios/firstLine';
import { BASE_ID } from '../sim/scenarios/relayTrucks';
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
    const { ignition } = activeTruck(useStore.getState().sim).spec.engine.controls;
    useStore.getState().setSwitch(ignition, true);
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

  it('pauses the sim and the lesson off the play screen', () => {
    useStore.getState().startLesson('first-line');
    for (const open of [useStore.getState().openMenu, useStore.getState().openDebrief]) {
      open();
      const before = useStore.getState();
      useStore.getState().step(100);
      expect(useStore.getState().sim).toBe(before.sim);
      expect(useStore.getState().lesson).toBe(before.lesson);
    }
    useStore.getState().openPlay();
    useStore.getState().step(10);
    expect(useStore.getState().sim.timeS).toBeCloseTo(1, 9);
  });

  it('an event holding the truck the player has switched to moves its panel', () => {
    useStore.getState().startLesson('closed-relay');
    const { lesson } = useStore.getState();
    if (lesson === null) throw new Error('no lesson');
    const held = 0.9;
    useStore.setState({
      lesson: {
        ...lesson,
        def: {
          ...lesson.def,
          events: [
            {
              id: 'up',
              when: { kind: 'time', min: 0.15 },
              effects: [{ kind: 'holdSettings', truck: BASE_ID, throttle: held }],
            },
          ],
        },
      },
    });
    useStore.getState().setActiveTruck(BASE_ID);
    expect(useStore.getState().inputs.throttle).not.toBe(held);
    useStore.getState().step(5);
    const s = useStore.getState();
    expect(s.inputs.throttle).toBe(held);
    expect(activeTruck(s.sim).inputs.throttle).toBe(held);
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
