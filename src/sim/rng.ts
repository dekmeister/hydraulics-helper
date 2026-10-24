/**
 * One step of mulberry32, a small seeded PRNG: returns a value in [0, 1) and the next state.
 * The sim keeps the state in `SimState.rngState`, so noisy behaviour replays exactly.
 */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Default seed when a scenario doesn't set one. */
export const DEFAULT_SEED = 1;
