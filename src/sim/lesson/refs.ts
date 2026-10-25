// Resolving a lesson's symbolic names (a line, an inlet kind, the player's truck) against a state.
import { primerControlId } from '../appliances/controls';
import { BRANCH_BAND_FRACTION, BRANCH_OPTIMUM_KPA } from '../constants';
import type { ControlId, HoseLine, RelayLink, SimState, TruckState } from '../types';
import type { ValveRef } from './types';

/** A truck by id, or the player's truck when `id` is undefined. */
export function truckOf(
  state: SimState,
  playerTruckId: string,
  id: string | undefined,
): TruckState | undefined {
  const want = id ?? playerTruckId;
  return state.trucks.find((t) => t.id === want);
}

/** A hose lay or relay hose by id: both leave a delivery. */
export function hoseById(state: SimState, id: string): HoseLine | RelayLink | undefined {
  return state.lines.find((l) => l.id === id) ?? state.links.find((l) => l.id === id);
}

/** The truck and control id a valve ref names, or undefined if it names nothing on this state. */
export function resolveValve(
  state: SimState,
  playerTruckId: string,
  ref: ValveRef,
): { truck: TruckState; control: ControlId } | undefined {
  if ('line' in ref) {
    const hose = hoseById(state, ref.line);
    const truck = hose === undefined ? undefined : truckOf(state, playerTruckId, hose.truckId);
    return hose === undefined || truck === undefined
      ? undefined
      : { truck, control: hose.deliveryId };
  }
  const truck = truckOf(state, playerTruckId, ref.truck);
  const inlet = truck?.spec.inlets.find((i) => i.kind === ref.inlet);
  return truck === undefined || inlet === undefined ? undefined : { truck, control: inlet.id };
}

/** The player's primer control, if the pump has one to operate (not self-priming). */
export function resolvePrimer(state: SimState, playerTruckId: string): ControlId | undefined {
  const truck = truckOf(state, playerTruckId, undefined);
  return truck === undefined ? undefined : primerControlId(truck.spec);
}

/** A branch's working band, kPa: its tip's Table 1 optimum ± `BRANCH_BAND_FRACTION`. */
export interface BranchBand {
  targetKpa: number;
  minKpa: number;
  maxKpa: number;
}

/** The working band for the branch on `line`; undefined for an unknown line or an unlisted tip. */
export function branchBand(state: SimState, line: string): BranchBand | undefined {
  const lay = state.lines.find((l) => l.id === line);
  const targetKpa = lay === undefined ? undefined : BRANCH_OPTIMUM_KPA[lay.branch.tipMm];
  if (targetKpa === undefined) return undefined;
  return {
    targetKpa,
    minKpa: targetKpa * (1 - BRANCH_BAND_FRACTION),
    maxKpa: targetKpa * (1 + BRANCH_BAND_FRACTION),
  };
}

/** Pressure at the branch on `line` now, kPa (0 for an unknown line). */
export function branchKpa(state: SimState, line: string): number {
  const lay = state.lines.find((l) => l.id === line);
  const truck = lay === undefined ? undefined : state.trucks.find((t) => t.id === lay.truckId);
  return lay === undefined ? 0 : (truck?.readings.branchKpa[lay.id] ?? 0);
}
