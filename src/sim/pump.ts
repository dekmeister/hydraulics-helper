import type { EngineSpec, PumpSpec } from './types';

/**
 * Pressure rise across the pump: affinity-law shutoff scaled by (rpm/max)², minus quadratic droop.
 * Can go negative at flows beyond the curve's run-out; callers clamp the gauge reading.
 */
export function pumpRiseKpa(
  pump: PumpSpec,
  engine: EngineSpec,
  rpm: number,
  flowLpm: number,
): number {
  const ratio = rpm / engine.maxRpm;
  return pump.shutoffKpa * ratio * ratio - pump.droopKpaPerLpm2 * flowLpm * flowLpm;
}

/** Engine speed the governor aims for at a throttle position (0 idle … 1 full). */
export function targetRpm(engine: EngineSpec, throttle: number): number {
  return engine.idleRpm + throttle * (engine.maxRpm - engine.idleRpm);
}

/**
 * Engine rpm after `dtS` chasing the throttle with a first-order lag. Uses the exact exponential
 * step, so the response doesn't depend on tick size.
 */
export function lagRpm(engine: EngineSpec, rpm: number, throttle: number, dtS: number): number {
  const target = targetRpm(engine, throttle);
  return target + (rpm - target) * Math.exp(-dtS / engine.rpmLagS);
}
