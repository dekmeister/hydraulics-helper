// A branch's flow and working pressure. Two models share the orifice law Q = k·√P, which is all the
// network solver needs (a square-law resistance in series with the hose):
// - smooth bore: k from the tip bore (Table 1), working pressure the table's optimum;
// - Dial-A-Jet: k from the maker's flow at 690 kPa for the selected jet, working pressure 700 kPa
//   within the maker's 350–1034 kPa band. The square law runs high away from the rated point: ~22 %
//   over at 350 kPa on the 8 mm jet, ~10 % over at 1034 kPa on the 5 and 3.2 mm jets.
import {
  BRANCH_BAND_FRACTION,
  BRANCH_FLOW_COEFF,
  BRANCH_OPTIMUM_KPA,
  DIAL_A_JET_FLOW_LPM,
  DIAL_A_JET_MAX_KPA,
  DIAL_A_JET_MIN_KPA,
  DIAL_A_JET_RATED_KPA,
  DIAL_A_JET_WORKING_KPA,
} from './constants';
import type { Branch } from './types';

/** The pressures a branch is meant to work at, kPa. */
export interface BranchBand {
  targetKpa: number;
  minKpa: number;
  maxKpa: number;
}

/** The maker's flow at its test pressure for a Dial-A-Jet's selected jet; throws for an unlisted jet. */
function dialAJetRatedFlowLpm(branch: Branch): number {
  const flow = DIAL_A_JET_FLOW_LPM[branch.tipMm];
  if (flow === undefined) throw new Error(`Dial-A-Jet has no ${String(branch.tipMm)} mm setting`);
  return flow;
}

/** Orifice constant k in Q = k·√P (L/min, kPa): Table 1's (2/3)·d²/10 for a tip, or the maker's flow. */
export function branchK(branch: Branch): number {
  if (branch.model === 'dialAJet') {
    return dialAJetRatedFlowLpm(branch) / Math.sqrt(DIAL_A_JET_RATED_KPA);
  }
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

/**
 * The pressures a lesson aims a branch at: Table 1's optimum ± `BRANCH_BAND_FRACTION` for a tip, or
 * 700 kPa within the maker's 350–1034 kPa for a Dial-A-Jet. Undefined for a tip Table 1 doesn't list.
 */
export function branchWorkingBand(branch: Branch): BranchBand | undefined {
  if (branch.model === 'dialAJet') {
    dialAJetRatedFlowLpm(branch); // reject an unlisted jet here too
    return {
      targetKpa: DIAL_A_JET_WORKING_KPA,
      minKpa: DIAL_A_JET_MIN_KPA,
      maxKpa: DIAL_A_JET_MAX_KPA,
    };
  }
  const targetKpa = BRANCH_OPTIMUM_KPA[branch.tipMm];
  if (targetKpa === undefined) return undefined;
  return {
    targetKpa,
    minKpa: targetKpa * (1 - BRANCH_BAND_FRACTION),
    maxKpa: targetKpa * (1 + BRANCH_BAND_FRACTION),
  };
}
