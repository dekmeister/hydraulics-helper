import { TICK_S } from '../sim/constants';
import { useStore } from './store';

/** Longest frame gap we catch up on; beyond this (tab hidden) the sim just pauses. */
const MAX_CATCHUP_S = 0.5;

/**
 * Real-time driver: a requestAnimationFrame accumulator that runs fixed 10 Hz ticks.
 * Not started in the e2e build, where only __pumpops.step() moves time.
 */
export function startRealTimeLoop(): () => void {
  let last: number | undefined;
  let accS = 0;
  let handle = 0;
  const frame = (nowMs: number) => {
    if (last !== undefined) accS += Math.min((nowMs - last) / 1000, MAX_CATCHUP_S);
    last = nowMs;
    const ticks = Math.floor(accS / TICK_S);
    if (ticks > 0) {
      accS -= ticks * TICK_S;
      useStore.getState().step(ticks);
    }
    handle = requestAnimationFrame(frame);
  };
  handle = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(handle);
  };
}
