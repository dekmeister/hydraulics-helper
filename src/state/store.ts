import { create } from 'zustand';
import { getAppliance } from '../sim/appliances/catalogue';
import { TICK_S } from '../sim/constants';
import { advance, createInitialState } from '../sim/engine';
import type { PlayerInputs, SimState } from '../sim/types';

/** Appliance loaded at start-up until scenario selection exists (M6). */
export const DEFAULT_APPLIANCE_ID = 'cat1-generic';

function defaultSim(): SimState {
  return createInitialState(getAppliance(DEFAULT_APPLIANCE_ID));
}

/** The player's current inputs are the active truck's last applied inputs. */
function activeInputs(sim: SimState): PlayerInputs {
  const truck = sim.trucks.find((t) => t.id === sim.activeTruckId);
  if (truck === undefined) throw new Error(`No active truck '${sim.activeTruckId}'`);
  return truck.inputs;
}

interface PumpOpsStore {
  sim: SimState;
  inputs: PlayerInputs;
  /** Run `ticks` fixed sim steps synchronously. The only way sim time moves. */
  step: (ticks: number) => void;
  /** Replace the sim state wholesale (scenario load, test fixtures). */
  reset: (sim?: SimState) => void;
}

const initialSim = defaultSim();

export const useStore = create<PumpOpsStore>()((set) => ({
  sim: initialSim,
  inputs: activeInputs(initialSim),
  step: (ticks) => {
    set(({ sim, inputs }) => {
      let next = sim;
      for (let i = 0; i < ticks; i++) next = advance(next, inputs, TICK_S);
      return { sim: next };
    });
  },
  reset: (sim = defaultSim()) => {
    set({ sim, inputs: activeInputs(sim) });
  },
}));
