import { SPILL_SOAK_TAU_S } from './constants';

/**
 * Tank level after `dtS` of drawing `outflowLpm` (water leaving through the deliveries; relief
 * bypass flow returns to the tank, so it isn't counted). Never goes below empty.
 */
export function drainTankL(tankL: number, outflowLpm: number, dtS: number): number {
  return Math.max(0, tankL - (outflowLpm * dtS) / 60);
}

export interface StoreStep {
  /** Water held, L, between empty and capacity. */
  levelL: number;
  /** Water in the pool spilled around it, L. */
  spilledL: number;
  /** Water out the overflow, averaged over the step, L/min. */
  overflowLpm: number;
}

/**
 * A tank or dam after `dtS` of `drawLpm` out and `inLpm` in. It's held between empty and full.
 * What a full store can't hold goes out the overflow onto the ground (`spilledL`), and that pool
 * soaks away exponentially with `SPILL_SOAK_TAU_S`, because infiltration goes with the wetted area.
 * Open water (`capacityL` infinite) never spills.
 */
export function stepStore(
  levelL: number,
  capacityL: number,
  drawLpm: number,
  inLpm: number,
  spilledL: number,
  dtS: number,
): StoreStep {
  const unheldL = levelL + ((inLpm - drawLpm) * dtS) / 60;
  const overflowL = Math.max(0, unheldL - capacityL);
  return {
    levelL: Math.min(capacityL, Math.max(0, unheldL)),
    spilledL: spilledL * Math.exp(-dtS / SPILL_SOAK_TAU_S) + overflowL,
    overflowLpm: dtS > 0 ? (overflowL * 60) / dtS : 0,
  };
}
