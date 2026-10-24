// Pure gesture maths for the panel controls (Design §5). No DOM, so it is tested in Vitest.

/** A lever this close to either end, in degrees, clicks into the detent. */
export const VALVE_DETENT_DEG = 4;

/** Pointer travel, CSS px, before a press becomes a drag; below it, it's a tap. */
export const DRAG_THRESHOLD_PX = 6;

/** Keyboard step for drag controls: 10 % per arrow press (Design §5). */
export const KEY_STEP = 0.1;

/** Throttle vernier: one − / + press moves the governor this many rpm (Design sheet 03). */
export const THROTTLE_VERNIER_RPM = 25;

/**
 * Valve opening (0 shut … 1 open) for a pointer at (dx, dy) CSS px from the lever pivot.
 * Shut is the lever straight up across the pipe; open is 90° clockwise, along the pipe. Angles
 * beyond either end clamp to it, and within VALVE_DETENT_DEG of an end snap to the detent.
 */
export function valveOpeningAt(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // clockwise from 12 o'clock, −180…180
  const clamped = deg < 0 ? (deg < -90 ? 90 : 0) : Math.min(90, deg);
  if (clamped <= VALVE_DETENT_DEG) return 0;
  if (clamped >= 90 - VALVE_DETENT_DEG) return 1;
  return clamped / 90;
}

/** Lever angle, degrees clockwise from shut, for an opening. */
export function valveAngleDeg(opening: number): number {
  return clamp01(opening) * 90;
}

/** New 0–1 position after dragging `dxPx` along a track `travelPx` long, from `start`. */
export function dragPosition(start: number, dxPx: number, travelPx: number): number {
  if (!(travelPx > 0)) return clamp01(start);
  return clamp01(start + dxPx / travelPx);
}

/** Throttle fraction for one vernier press, given the engine's governed rpm range. */
export function vernierStep(idleRpm: number, maxRpm: number): number {
  const span = maxRpm - idleRpm;
  return span > 0 ? THROTTLE_VERNIER_RPM / span : KEY_STEP;
}

/** Keyboard handling shared by the slider controls; null for keys it doesn't use. */
export function keyedPosition(key: string, current: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp01(roundStep(current + KEY_STEP));
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp01(roundStep(current - KEY_STEP));
    case 'PageUp':
      return clamp01(roundStep(current + 2.5 * KEY_STEP));
    case 'PageDown':
      return clamp01(roundStep(current - 2.5 * KEY_STEP));
    case 'Home':
      return 0;
    case 'End':
      return 1;
    default:
      return null;
  }
}

export function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}

/** Strip floating-point residue from repeated 0.1 steps (0.30000000000000004 → 0.3). */
function roundStep(x: number): number {
  return Math.round(x * 1000) / 1000;
}
