// Resolving a lesson's symbolic names (a line, an inlet kind, the player's truck) against a state.
import { primerControlId } from '../appliances/controls';
import { branchFlowLpm, branchWorkingBand, type BranchBand } from '../branch';
import type { ControlId, HoseLine, RelayLink, SimState, TruckState } from '../types';
import type { EngineSwitch, ValveRef } from './types';

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

/** Control id of one of the player's engine switches. */
export function resolveEngineSwitch(
  state: SimState,
  playerTruckId: string,
  which: EngineSwitch,
): ControlId | undefined {
  const controls = truckOf(state, playerTruckId, undefined)?.spec.engine.controls;
  if (controls === undefined) return undefined;
  return which === 'stop' ? controls.stop.id : controls[which];
}

/** The working band for the branch on `line`; undefined for an unknown line or an unlisted tip. */
export function branchBand(state: SimState, line: string): BranchBand | undefined {
  const lay = state.lines.find((l) => l.id === line);
  return lay === undefined ? undefined : branchWorkingBand(lay.branch);
}

/** Flow through the branch on `line` at its target pressure, L/min; undefined if it has none. */
export function workingFlowLpm(state: SimState, line: string): number | undefined {
  const lay = state.lines.find((l) => l.id === line);
  const band = branchBand(state, line);
  return lay === undefined || band === undefined
    ? undefined
    : branchFlowLpm(lay.branch, band.targetKpa);
}

/**
 * Water a hose delivers now, L/min: a lay's branch flow (nothing until it has charged), or what a
 * relay's delivery sends down it. 0 for an unknown hose.
 */
export function hoseFlowLpm(state: SimState, hose: HoseLine | RelayLink): number {
  const truck = state.trucks.find((t) => t.id === hose.truckId);
  const isLay = state.lines.some((l) => l.id === hose.id);
  return isLay
    ? (truck?.readings.branchFlowLpm[hose.id] ?? 0)
    : (truck?.readings.deliveryFlowLpm[hose.deliveryId] ?? 0);
}

/** Pressure at the branch on `line` now, kPa (0 for an unknown line). */
export function branchKpa(state: SimState, line: string): number {
  const lay = state.lines.find((l) => l.id === line);
  const truck = lay === undefined ? undefined : state.trucks.find((t) => t.id === lay.truckId);
  return lay === undefined ? 0 : (truck?.readings.branchKpa[lay.id] ?? 0);
}
