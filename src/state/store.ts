import { create } from 'zustand';
import { getAppliance } from '../sim/appliances/catalogue';
import { switchControlIds, valveControlIds } from '../sim/appliances/controls';
import { TICK_S } from '../sim/constants';
import { advance } from '../sim/engine';
import { TANK_ATTACK } from '../sim/scenarios/tankAttack';
import type { ControlId, PlayerInputs, SimState } from '../sim/types';
import { activeTruck } from './selectors';

/** Appliance loaded at start-up until scenario selection exists (M6). */
export const DEFAULT_APPLIANCE_ID = 'cat1-generic';

/** Start-up state: the tank-attack lines laid on the default appliance, every control shut. */
export function defaultSim(): SimState {
  return TANK_ATTACK.build(getAppliance(DEFAULT_APPLIANCE_ID)).state;
}

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}

interface PumpOpsStore {
  sim: SimState;
  /** What the player has set on the panel; applied to the active truck on every tick. */
  inputs: PlayerInputs;
  /** Run `ticks` fixed sim steps synchronously. The only way sim time moves. */
  step: (ticks: number) => void;
  /** Replace the sim state wholesale (scenario load, test fixtures). */
  reset: (sim?: SimState) => void;
  setThrottle: (position: number) => void;
  /** Set a valve-type control (0 shut – 1 open) by spec control id. */
  setValve: (id: ControlId, open: number) => void;
  /** Set an on/off control (primer) by spec control id. */
  setSwitch: (id: ControlId, on: boolean) => void;
}

const initialSim = defaultSim();

export const useStore = create<PumpOpsStore>()((set, get) => ({
  sim: initialSim,
  inputs: activeTruck(initialSim).inputs,
  step: (ticks) => {
    set(({ sim, inputs }) => {
      let next = sim;
      for (let i = 0; i < ticks; i++) next = advance(next, inputs, TICK_S);
      return { sim: next };
    });
  },
  reset: (sim = defaultSim()) => {
    set({ sim, inputs: activeTruck(sim).inputs });
  },
  setThrottle: (position) => {
    set(({ inputs }) => ({ inputs: { ...inputs, throttle: clamp01(position) } }));
  },
  setValve: (id, open) => {
    if (!valveControlIds(activeTruck(get().sim).spec).includes(id)) {
      throw new Error(`setValve: '${id}' is not a valve on the active appliance`);
    }
    set(({ inputs }) => ({
      inputs: { ...inputs, valves: { ...inputs.valves, [id]: clamp01(open) } },
    }));
  },
  setSwitch: (id, on) => {
    if (!switchControlIds(activeTruck(get().sim).spec).includes(id)) {
      throw new Error(`setSwitch: '${id}' is not a switch on the active appliance`);
    }
    set(({ inputs }) => ({ inputs: { ...inputs, switches: { ...inputs.switches, [id]: on } } }));
  },
}));
