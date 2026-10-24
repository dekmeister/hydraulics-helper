import { create } from 'zustand';
import { getAppliance } from '../sim/appliances/catalogue';
import { switchControlIds, valveControlIds } from '../sim/appliances/controls';
import { TICK_S } from '../sim/constants';
import { advance, switchTruck } from '../sim/engine';
import { getScenario } from '../sim/scenarios';
import { supports } from '../sim/scenarios/types';
import { TANK_ATTACK } from '../sim/scenarios/tankAttack';
import type { ControlId, InstrumentKind, PlayerInputs, SimState } from '../sim/types';
import { activeTruck, instrumentValue } from './selectors';

/** Appliance loaded at start-up until scenario selection exists (M6). */
export const DEFAULT_APPLIANCE_ID = 'cat1-generic';

/** Start-up state: the tank-attack lines laid on the default appliance, every control shut. */
export function defaultSim(): SimState {
  return TANK_ATTACK.build(getAppliance(DEFAULT_APPLIANCE_ID)).state;
}

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}

/** Sim seconds of readings kept for the gauges' Wake (Design §6: the last 3 s, plus a tick). */
export const WAKE_HISTORY_S = 3.1;

const WAKE_KINDS: readonly InstrumentKind[] = ['compound', 'discharge', 'tacho'];

/** One tick's displayed readings, for the Wake. */
export interface WakeSample {
  tS: number;
  values: Readonly<Partial<Record<InstrumentKind, number>>>;
}

function wakeSample(sim: SimState): WakeSample {
  const truck = activeTruck(sim);
  return {
    tS: sim.timeS,
    values: Object.fromEntries(WAKE_KINDS.map((k) => [k, instrumentValue(truck, k)])),
  };
}

/** Which side of the scene↔panel correspondence asked for a highlight. */
export type HighlightSource = 'scene' | 'panel';

/** A delivery picked out on both panels (UI state only, never sim state). */
export interface Highlight {
  /** The truck the delivery is on: always the active one (a switch clears the highlight). */
  truckId: string;
  deliveryId: ControlId;
  from: HighlightSource;
}

interface PumpOpsStore {
  sim: SimState;
  /**
   * What the player has set on the panel; applied to the active truck on every tick. Every other
   * truck's controls live in the sim (`TruckState.inputs`), where they're held.
   */
  inputs: PlayerInputs;
  /** Run `ticks` fixed sim steps synchronously. The only way sim time moves. */
  step: (ticks: number) => void;
  /** Replace the sim state wholesale (test fixtures); clears the scenario id unless given. */
  reset: (sim?: SimState, scenarioId?: string | null) => void;
  /** Scenario the sim was loaded from, if any (the header picker shows it). */
  scenarioId: string | null;
  /** Load a scenario's initial state on the active appliance; throws if it can't play it. */
  loadScenario: (id: string) => void;
  /** Displayed readings for the last `WAKE_HISTORY_S` of sim time, oldest first. */
  wake: readonly WakeSample[];
  setThrottle: (position: number) => void;
  /** Set a valve-type control (0 shut – 1 open) by spec control id. */
  setValve: (id: ControlId, open: number) => void;
  /** Set an on/off control (primer) by spec control id. */
  setSwitch: (id: ControlId, on: boolean) => void;
  /**
   * Operate another truck: the controls set on this one stay held on it, the panel takes the
   * other's. Clears the highlight and the Wake (both belong to the truck left).
   */
  setActiveTruck: (truckId: string) => void;
  highlight: Highlight | null;
  /** Highlight a delivery on the scene and panel, or clear it if it's already highlighted. */
  toggleHighlight: (deliveryId: ControlId, from: HighlightSource) => void;
}

const initialSim = defaultSim();

export const useStore = create<PumpOpsStore>()((set, get) => ({
  sim: initialSim,
  inputs: activeTruck(initialSim).inputs,
  highlight: null,
  scenarioId: TANK_ATTACK.id,
  wake: [],
  step: (ticks) => {
    set(({ sim, inputs, wake }) => {
      let next = sim;
      const samples = [...wake];
      for (let i = 0; i < ticks; i++) {
        next = advance(next, inputs, TICK_S);
        samples.push(wakeSample(next));
      }
      const cutoff = next.timeS - WAKE_HISTORY_S;
      return { sim: next, wake: samples.filter((w) => w.tS >= cutoff) };
    });
  },
  reset: (sim, scenarioId) => {
    const next = sim ?? defaultSim();
    set({
      sim: next,
      inputs: activeTruck(next).inputs,
      highlight: null,
      wake: [],
      scenarioId: scenarioId !== undefined ? scenarioId : sim === undefined ? TANK_ATTACK.id : null,
    });
  },
  loadScenario: (id) => {
    const spec = activeTruck(get().sim).spec;
    const scenario = getScenario(id);
    if (!supports(scenario, spec)) throw new Error(`${spec.id} can’t play '${id}'`);
    get().reset(scenario.build(spec).state, id);
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
  setActiveTruck: (truckId) => {
    set(({ sim, inputs }) => {
      const next = switchTruck(sim, truckId, inputs);
      return { sim: next, inputs: activeTruck(next).inputs, highlight: null, wake: [] };
    });
  },
  toggleHighlight: (deliveryId, from) => {
    const truck = activeTruck(get().sim);
    if (!truck.spec.deliveries.some((d) => d.id === deliveryId)) {
      throw new Error(`toggleHighlight: '${deliveryId}' is not a delivery on the active appliance`);
    }
    set(({ highlight }) => ({
      highlight:
        highlight?.truckId === truck.id && highlight.deliveryId === deliveryId
          ? null
          : { truckId: truck.id, deliveryId, from },
    }));
  },
}));
