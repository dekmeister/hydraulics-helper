import type { SimState } from '../sim/types';

interface HasSim {
  sim: SimState;
}

export const selectSimTimeS = (s: HasSim): number => s.sim.timeS;
