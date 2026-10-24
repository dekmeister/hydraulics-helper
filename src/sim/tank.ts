/**
 * Tank level after `dtS` of drawing `outflowLpm` (water leaving through the deliveries; relief
 * bypass flow returns to the tank, so it isn't counted). Never goes below empty.
 */
export function drainTankL(tankL: number, outflowLpm: number, dtS: number): number {
  return Math.max(0, tankL - (outflowLpm * dtS) / 60);
}

/**
 * Tank level after `dtS` of `drawLpm` out through the tank-to-pump feed and `returnLpm` back in
 * (relief dumped to the tank). Held between empty and full; a full tank overflows.
 */
export function stepTankL(
  tankL: number,
  capacityL: number,
  drawLpm: number,
  returnLpm: number,
  dtS: number,
): number {
  return Math.min(capacityL, Math.max(0, tankL + ((returnLpm - drawLpm) * dtS) / 60));
}
