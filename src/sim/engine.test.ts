import { describe, expect, it } from 'vitest';
import { CAT1 } from './appliances/cat1';
import { TICK_S } from './constants';
import { advance, createIdleInputs, createInitialState } from './engine';
import { lineOnEveryDelivery, run, tankAttackInputs, truckOf } from './testUtils';

describe('createInitialState', () => {
  it('starts one truck at idle, tank full, every control shut, readings consistent', () => {
    const t = truckOf(createInitialState(CAT1));
    expect(t.rpm).toBe(CAT1.engine.idleRpm);
    expect(t.tankL).toBe(CAT1.tank?.capacityL);
    expect(t.inputs).toEqual(createIdleInputs(CAT1));
    expect(t.readings.dischargeKpa).toBe(0);
  });

  it('copies the spec so the state is self-contained', () => {
    const t = truckOf(createInitialState(CAT1));
    expect(t.spec).toEqual(CAT1);
    expect(t.spec).not.toBe(CAT1);
  });
});

describe('advance', () => {
  it('moves sim time by dt', () => {
    const next = advance(createInitialState(CAT1), createIdleInputs(CAT1), TICK_S);
    expect(next.timeS).toBeCloseTo(TICK_S, 12);
  });

  it('does not mutate its input state', () => {
    const state = createInitialState(CAT1, lineOnEveryDelivery(CAT1));
    const before = structuredClone(state);
    advance(state, tankAttackInputs(CAT1, 1, ['d1']), TICK_S);
    expect(state).toEqual(before);
  });

  it('drains the tank by the delivered flow', () => {
    const s0 = run(
      createInitialState(CAT1, lineOnEveryDelivery(CAT1)),
      tankAttackInputs(CAT1, 0.5, ['d2']),
      50,
    );
    const s1 = run(s0, tankAttackInputs(CAT1, 0.5, ['d2']), 10);
    const q = truckOf(s1).readings.deliveryFlowLpm.d2 ?? 0;
    expect(q).toBeGreaterThan(0);
    expect(truckOf(s0).tankL - truckOf(s1).tankL).toBeCloseTo(q / 60, 1);
  });

  it('opening the throttle raises discharge and pulls the compound gauge lower (L3504)', () => {
    const s = createInitialState(CAT1, lineOnEveryDelivery(CAT1));
    const low = truckOf(run(s, tankAttackInputs(CAT1, 0.2, ['d2']), 50)).readings;
    const high = truckOf(run(s, tankAttackInputs(CAT1, 0.8, ['d2']), 50)).readings;
    expect(high.dischargeKpa).toBeGreaterThan(low.dischargeKpa);
    expect(high.compoundKpa).toBeLessThan(low.compoundKpa);
  });

  it('records the sanitised inputs it applied', () => {
    const s = advance(
      createInitialState(CAT1),
      { throttle: 2, valves: { d1: -1, bogus: 1 }, switches: {} },
      TICK_S,
    );
    expect(truckOf(s).inputs.throttle).toBe(1);
    expect(truckOf(s).inputs.valves).not.toHaveProperty('bogus');
    expect(truckOf(s).inputs.valves.d1).toBe(0);
  });
});
