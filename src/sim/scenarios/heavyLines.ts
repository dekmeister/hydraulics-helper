// Test sites only, never laid by a scenario. Bush crews' 25 mm lines draw too little to over-run a
// relay, burst one or cavitate a draught (issue #10), so tests and fixtures of those faults swap
// the player's lines for a heavy pair on the scenario's fireground.
import type { SimState } from '../types';
import { attachLines, type PlannedLine } from './lay';

/** 65 mm with a 20 mm tip (~600 L/min) and 38 mm with a 15 mm tip (~280 L/min), Table 1. */
export const HEAVY_LINES: readonly PlannedLine[] = [
  { id: 'line-1', hose: '65L', lengths: 3, tipMm: 20 },
  { id: 'line-2', hose: '38L', lengths: 3, tipMm: 15 },
];

/** `state` with the active truck's lines replaced by `HEAVY_LINES`, dry. */
export function withHeavyLines(state: SimState): SimState {
  const truck = state.trucks.find((t) => t.id === state.activeTruckId);
  if (truck === undefined) throw new Error(`No active truck '${state.activeTruckId}'`);
  const others = state.lines.filter((l) => l.truckId !== truck.id);
  return {
    ...state,
    lines: [...others, ...attachLines(truck.spec, HEAVY_LINES, truck.id)],
    lineWaterL: Object.fromEntries(
      Object.entries(state.lineWaterL).filter(([id]) => others.some((l) => l.id === id)),
    ),
  };
}
