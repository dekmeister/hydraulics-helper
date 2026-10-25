import { describe, expect, it } from 'vitest';
import { classifyDrag, pulledThrottle, twistedThrottle } from './vernierMath';

describe('vernier throttle gestures', () => {
  it('tells a pull along the shaft from a twist across it, once past the threshold', () => {
    expect(classifyDrag(2, 2)).toBeNull();
    expect(classifyDrag(20, 5)).toBe('pull');
    expect(classifyDrag(-20, 5)).toBe('pull');
    expect(classifyDrag(4, -20)).toBe('twist');
  });

  it('pulls the throttle open over the shaft’s travel, and pushes it shut', () => {
    expect(pulledThrottle(0.2, 50, 100)).toBeCloseTo(0.7);
    expect(pulledThrottle(0.2, -50, 100)).toBe(0);
    expect(pulledThrottle(0.9, 50, 100)).toBe(1);
  });

  it('twists by a fraction of a turn: fine travel, up opens', () => {
    // One full turn (100 px of rim) is 4 % of travel.
    expect(twistedThrottle(0.5, -100, 100, 0.04)).toBeCloseTo(0.54);
    expect(twistedThrottle(0.5, 25, 100, 0.04)).toBeCloseTo(0.49);
    expect(twistedThrottle(0, 25, 100, 0.04)).toBe(0);
  });
});
