// A speed controller: a momentary switch that runs the governor up or down while held (Cat 1
// panel). It moves the same 0–1 throttle input as the T-handle; the store applies the ramp on
// each sim tick, so it follows sim time and replays exactly.
import type { EngineSpec, SpeedControllerSpec } from '../sim/types';

/** A held speed switch: which way it's pushed and how fast it moves the throttle. */
export interface ThrottleRamp {
  direction: 1 | -1;
  /** Throttle fraction per second while held. */
  perS: number;
}

/** Throttle after `dtS` of the switch held (or unchanged with nothing held), clamped to 0–1. */
export function rampedThrottle(throttle: number, ramp: ThrottleRamp | null, dtS: number): number {
  if (ramp === null) return throttle;
  return Math.min(1, Math.max(0, throttle + ramp.direction * ramp.perS * dtS));
}

/**
 * A speed controller's rpm figures as throttle fractions for `engine`: `perS` while held, `flick`
 * applied at once on a press, so a quick flick nudges the speed by about that much. Exact because
 * the sim's target rpm is linear in throttle (`targetRpm`).
 */
export function speedSwitchRates(
  engine: EngineSpec,
  controller: SpeedControllerSpec,
): { perS: number; flick: number } {
  const span = Math.max(1, engine.maxRpm - engine.idleRpm);
  return { perS: controller.rampRpmPerS / span, flick: controller.flickRpm / span };
}
