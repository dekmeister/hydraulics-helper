import type { SimState, TruckState } from '../sim/types';

/** The truck the player is operating. */
export function activeTruck(sim: SimState): TruckState {
  const truck = sim.trucks.find((t) => t.id === sim.activeTruckId);
  if (truck === undefined) throw new Error(`No active truck '${sim.activeTruckId}'`);
  return truck;
}
