// Gesture maths for the vernier throttle knob, kept pure so it can be tested without a browser.
import { DRAG_THRESHOLD_PX } from '../panel-pump/controls/controlMath';

/** What a drag on the knob is doing once it has moved past the drag threshold. */
export type VernierGesture = 'pull' | 'twist';

/**
 * Sideways along the shaft is a push or pull (the release button is held, so the cable runs
 * free); up or down across it rolls the knob, a twist. Null until the drag is past the threshold.
 */
export function classifyDrag(dxPx: number, dyPx: number): VernierGesture | null {
  if (Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD_PX) return null;
  return Math.abs(dxPx) >= Math.abs(dyPx) ? 'pull' : 'twist';
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Throttle after pulling the knob `dxPx` out (positive) or pushing it in, over `travelPx` of shaft. */
export function pulledThrottle(start: number, dxPx: number, travelPx: number): number {
  return clamp01(start + dxPx / Math.max(1, travelPx));
}

/**
 * Throttle after rolling the knob `dyPx` (up is a twist that opens it) when one turn is
 * `pxPerTurn` of thumb travel round its rim and moves the throttle `perTurn`.
 */
export function twistedThrottle(
  start: number,
  dyPx: number,
  pxPerTurn: number,
  perTurn: number,
): number {
  return clamp01(start - (dyPx / Math.max(1, pxPerTurn)) * perTurn);
}
