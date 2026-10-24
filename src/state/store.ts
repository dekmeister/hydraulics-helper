import { create } from 'zustand';
import { TICK_S } from '../sim/constants';
import { advance, createIdleInputs, createInitialState } from '../sim/engine';
import type { PlayerInputs, SimState } from '../sim/types';

interface PumpOpsStore {
  sim: SimState;
  inputs: PlayerInputs;
  /** Run `ticks` fixed sim steps synchronously. The only way sim time moves. */
  step: (ticks: number) => void;
  /** Replace the sim state wholesale (scenario load, test fixtures). */
  reset: (sim?: SimState) => void;
}

export const useStore = create<PumpOpsStore>()((set) => ({
  sim: createInitialState(),
  inputs: createIdleInputs(),
  step: (ticks) => {
    set(({ sim, inputs }) => {
      let next = sim;
      for (let i = 0; i < ticks; i++) next = advance(next, inputs, TICK_S);
      return { sim: next };
    });
  },
  reset: (sim = createInitialState()) => {
    set({ sim, inputs: createIdleInputs() });
  },
}));
