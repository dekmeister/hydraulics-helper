import { BRANCH_FLOW_COEFF } from './constants';
import type { Branch } from './types';

/** Orifice constant k in Q = k·√P (L/min, kPa): k = (2/3)·d²/10 for a tip of d mm. */
export function branchK(branch: Branch): number {
  return (BRANCH_FLOW_COEFF * branch.tipMm * branch.tipMm) / 10;
}

/** Flow out of a branch at nozzle pressure `pressureKpa`: orifice law Q = k·√P, L/min. */
export function branchFlowLpm(branch: Branch, pressureKpa: number): number {
  return branchK(branch) * Math.sqrt(Math.max(0, pressureKpa));
}

/** Nozzle pressure needed for `flowLpm` through a branch: P = (Q/k)², kPa. */
export function branchPressureKpa(branch: Branch, flowLpm: number): number {
  const q = flowLpm / branchK(branch);
  return q * q;
}
