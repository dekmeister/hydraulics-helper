// Needle damping: display values chase their target as a critically damped
// spring, which reads as a real gauge's mechanical lag and never overshoots.

/**
 * Needle natural frequency, rad/s: settles to within 1 % in about 0.66 s ((1 + ωt)·e^(−ωt) = 0.01 at ωt ≈ 6.6). A feel figure, not a
 * gauge specification. // PLACEHOLDER — needs Dek (real needle response, if it matters)
 */
export const NEEDLE_OMEGA = 10;

export interface Damped {
  value: number;
  /** Rate of change, value units per second. */
  velocity: number;
}

/**
 * Advance a critically damped spring by `dtS` toward `target` using the exact solution
 * e(t) = (e₀ + (v₀ + ωe₀)t)·e^(−ωt), so any frame time is stable.
 */
export function stepDamped(d: Damped, target: number, dtS: number, omega = NEEDLE_OMEGA): Damped {
  if (!Number.isFinite(target)) return d;
  const e0 = d.value - target;
  const c = d.velocity + omega * e0;
  const decay = Math.exp(-omega * Math.max(0, dtS));
  const t = Math.max(0, dtS);
  return {
    value: target + (e0 + c * t) * decay,
    velocity: (d.velocity - omega * c * t) * decay,
  };
}

/** True once the needle is indistinguishable from its target (well under a pixel of sweep). */
export function isSettled(d: Damped, target: number, span: number): boolean {
  const tol = span * 1e-4;
  return Math.abs(d.value - target) <= tol && Math.abs(d.velocity) <= tol;
}
