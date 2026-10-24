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

  useEffect(() => {
    targetRef.current = target;
    let handle = 0;
    let last: number | undefined;
    const frame = (nowMs: number) => {
      const dtS = last === undefined ? 0 : Math.min((nowMs - last) / 1000, MAX_FRAME_S);
      last = nowMs;
      const next = stepDamped(state.current, target, dtS);
      if (isSettled(next, target, span)) {
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
        setDisplay(targetRef.current);
      }),
    [],
  );

  return display;
}
