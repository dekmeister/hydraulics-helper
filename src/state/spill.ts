// The pool of overflowed water round a truck or portable dam, for the scene (issue #18).

/**
 * Smallest pool the scene draws, L. The pool soaks away in seconds (`SPILL_SOAK_TAU_S`), so it
 * settles at overflow rate × τ: this is ~50 L/min overflowing. A trickle into a full tank (a
 * recirculation bleed returning ~25 L/min) isn't worth showing; a hydrant left open into a full
 * tank passes this within a second or two. Presentation, not hydraulics.
 */
export const SPILL_POOL_MIN_L = 4;

/**
 * Pool at which the scene's drawing stops spreading, L: ~1000 L/min overflowing, a hydrant
 * straight into a full tank with nothing drawn. Presentation, not hydraulics.
 */
export const SPILL_POOL_FULL_L = 80;

/**
 * How far the pool has spread, 0–1 of the largest drawn; undefined when there's too little to
 * show. Shallow water spreads to an area that goes with its volume, so the size goes as √volume.
 */
export function spillPoolSize(spilledL: number): number | undefined {
  if (!(spilledL >= SPILL_POOL_MIN_L)) return undefined;
  return Math.sqrt(Math.min(spilledL, SPILL_POOL_FULL_L) / SPILL_POOL_FULL_L);
}
