// Which of a truck's deliveries have a hose on them, and which stand bare.
import type { ControlId, SimState } from './types';

/** Deliveries with a hose on them, lay or relay: what an open valve leaks air from, or hammers. */
export function hosesOn(state: SimState, truckId: string) {
  return [...state.lines, ...state.links].filter((h) => h.truckId === truckId);
}

/**
 * Deliveries with nothing connected. Opened, one discharges to air at the truck through its valve
 * alone: the blank cap is ignored, since a real one often carries a bleeder (issue #16).
 */
export function bareDeliveryIds(state: SimState, truckId: string): ControlId[] {
  const truck = state.trucks.find((t) => t.id === truckId);
  if (truck === undefined) throw new Error(`No truck '${truckId}'`);
  const hosed = new Set(hosesOn(state, truckId).map((h) => h.deliveryId));
  return truck.spec.deliveries.map((d) => d.id).filter((id) => !hosed.has(id));
}
