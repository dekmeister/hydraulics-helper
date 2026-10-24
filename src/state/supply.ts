// Derived supply-side state for the UI: primer status and the supply hoses on the scene.
import { VALVE_CLOSED_EPS } from '../sim/constants';
import { connectedSupplies } from '../sim/engine';
import type { ControlId, PlayerInputs, SimState, SupplyLine, WaterSource } from '../sim/types';
import { activeTruck } from './activeTruck';

/**
 * Seconds of running unprimed before the primer shows CHECK SUCTION (Design §5). A coaching cue,
 * not doctrine: the rotary vane's own limit is the 60 s duty.
 */
export const CHECK_SUCTION_S = 30;

/** Inlet reading under which an over-run layflat is drawn soft, kPa: "inlet zero" (Table 7). */
const SOFT_INLET_KPA = 1;

export type PrimerState = 'idle' | 'running' | 'check-suction' | 'primed' | 'cut-out';

export interface PrimerStatus {
  state: PrimerState;
  /** Vacuum pulled as a fraction of the primer's best, 0–1 (the ring round the button). */
  progress: number;
}

/** What the primer control shows for the active truck, given the switch the player holds. */
export function primerStatus(
  sim: SimState,
  inputs: PlayerInputs,
  control: ControlId,
): PrimerStatus {
  const { spec, pump } = activeTruck(sim);
  const maxKpa = spec.primer?.maxVacuumKpa ?? 0;
  const progress = maxKpa > 0 ? Math.min(1, pump.vacuumKpa / maxKpa) : 0;
  if (pump.primed) return { state: 'primed', progress: 1 };
  if (pump.primerCutOut) return { state: 'cut-out', progress };
  if (inputs.switches[control] !== true) return { state: 'idle', progress };
  return { state: pump.primerRunS >= CHECK_SUCTION_S ? 'check-suction' : 'running', progress };
}

/**
 * How the scene draws a supply hose. Hard suction: 'primed' (full of water) or 'dry'. Layflat from
 * a hydrant: 'charged' (pressurised) or 'soft' (over-run, flattened).
 */
export type SupplyState = 'primed' | 'dry' | 'charged' | 'soft';

export interface SupplyLay {
  supply: SupplyLine;
  source: WaterSource;
  state: SupplyState;
  /** Flow in through the supply's inlet, L/min. */
  flowLpm: number;
  /** Whether the inlet valve it feeds is open. */
  open: boolean;
}

/** Every supply hose on the active truck, with its state. */
export function supplyLays(sim: SimState): SupplyLay[] {
  const truck = activeTruck(sim);
  return connectedSupplies(sim, truck.id).map(({ supply, source }) => {
    const flowLpm = truck.readings.inletFlowLpm[supply.inletId] ?? 0;
    const open = (truck.inputs.valves[supply.inletId] ?? 0) >= VALVE_CLOSED_EPS;
    let state: SupplyState;
    if (source.kind === 'static') state = truck.pump.primed ? 'primed' : 'dry';
    else
      state =
        open && truck.readings.cavitation > 0 && truck.readings.compoundKpa < SOFT_INLET_KPA
          ? 'soft'
          : 'charged';
    return { supply, source, state, flowLpm, open };
  });
}
