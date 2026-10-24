import { describe, expect, it } from 'vitest';
import { TICK_S } from './constants';
import { advance, createIdleInputs, createInitialState } from './engine';

describe('advance', () => {
  it('moves sim time by dt', () => {
    const next = advance(createInitialState(), createIdleInputs(), TICK_S);
    expect(next.timeS).toBeCloseTo(TICK_S, 12);
  });

  it('does not mutate its input state', () => {
    const state = createInitialState();
    const before = structuredClone(state);
    advance(state, createIdleInputs(), TICK_S);
    expect(state).toEqual(before);
  });

  it('is deterministic: same inputs give identical state after N ticks', () => {
    const run = () => {
      let s = createInitialState();
      for (let i = 0; i < 600; i++) s = advance(s, createIdleInputs(), TICK_S);
      return s;
    };
    expect(run()).toStrictEqual(run());
  });
});
