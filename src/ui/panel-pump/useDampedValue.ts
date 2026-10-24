import { useEffect, useRef, useState } from 'react';
import { isSettled, stepDamped, type Damped } from './damping';
import { onSnap } from './settle';

/** Longest frame gap integrated in one go, s; a hidden tab resumes without a jump. */
const MAX_FRAME_S = 0.1;

/**
 * Display value that chases `target` like a damped needle, on requestAnimationFrame.
 * Starts at the target (no swing on mount); `__pumpops.settle()` snaps it (docs/TESTING.md §3).
 * `span` is the dial's full range, used for the settled tolerance.
 */
export function useDampedValue(target: number, span: number): number {
  const [display, setDisplay] = useState(target);
  const state = useRef<Damped>({ value: target, velocity: 0 });
  const targetRef = useRef(target);
  // Last frame time survives a retarget (every sim tick), so the next frame integrates the real
  // gap instead of dt = 0; cleared when the needle settles and the loop stops.
  const lastMs = useRef<number | undefined>(undefined);

  useEffect(() => {
    targetRef.current = target;
    let handle = 0;
    const frame = (nowMs: number) => {
      const last = lastMs.current;
      const dtS = last === undefined ? 0 : Math.min((nowMs - last) / 1000, MAX_FRAME_S);
      lastMs.current = nowMs;
      const next = stepDamped(state.current, target, dtS);
      if (isSettled(next, target, span)) {
        lastMs.current = undefined;
        state.current = { value: target, velocity: 0 };
        setDisplay(target);
        return;
      }
      state.current = next;
      setDisplay(next.value);
      handle = requestAnimationFrame(frame);
    };
    handle = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(handle);
    };
  }, [target, span]);

  useEffect(
    () =>
      onSnap(() => {
        state.current = { value: targetRef.current, velocity: 0 };
        lastMs.current = undefined;
        setDisplay(targetRef.current);
      }),
    [],
  );

  return display;
}
