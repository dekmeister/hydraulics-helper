/**
 * Tank level after `dtS` of drawing `outflowLpm` (water leaving through the deliveries; relief
 * bypass flow returns to the tank, so it isn't counted). Never goes below empty.
 */
export function drainTankL(tankL: number, outflowLpm: number, dtS: number): number {
  return Math.max(0, tankL - (outflowLpm * dtS) / 60);
}
