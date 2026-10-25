import { describe, expect, it } from 'vitest';
import { rampedThrottle, speedSwitchRates } from './throttleRamp';

const ENGINE = { idleRpm: 800, maxRpm: 3000, rpmLagS: 0.5, cylinders: 6 };

describe('speed controller (momentary switch) on the throttle', () => {
  it('converts the switch’s rpm figures into throttle fractions for the engine', () => {
    const r = speedSwitchRates(ENGINE, { rampRpmPerS: 440, flickRpm: 55 });
    expect(r.perS).toBeCloseTo(440 / 2200, 12);
    expect(r.flick).toBeCloseTo(55 / 2200, 12);
  });

  it('ramps while held, either way, and stops at the ends', () => {
    const up = { direction: 1, perS: 0.2 } as const;
    expect(rampedThrottle(0.5, up, 0.1)).toBeCloseTo(0.52, 12);
    expect(rampedThrottle(0.5, { direction: -1, perS: 0.2 }, 0.1)).toBeCloseTo(0.48, 12);
    expect(rampedThrottle(0.99, up, 1)).toBe(1);
    expect(rampedThrottle(0.01, { direction: -1, perS: 0.2 }, 1)).toBe(0);
  });

  it('holds when released', () => {
    expect(rampedThrottle(0.37, null, 0.1)).toBe(0.37);
  });

  it('copes with an engine with no governed range', () => {
    const r = speedSwitchRates(
      { idleRpm: 1000, maxRpm: 1000, rpmLagS: 1, cylinders: 4 },
      { rampRpmPerS: 400, flickRpm: 50 },
    );
    expect(Number.isFinite(r.perS) && Number.isFinite(r.flick)).toBe(true);
  });
});
