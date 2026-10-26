// Derived supply-side state for the UI: primer status and the supply hoses on the scene.
import { VALVE_CLOSED_EPS } from '../sim/constants';
import { connectedSupplies } from '../sim/engine';
import { suctionWaterFraction } from '../sim/priming';
import type {
  ControlId,
  PlayerInputs,
  SimState,
  SupplyLine,
  TruckState,
  WaterSource,
} from '../sim/types';
import { activeTruck } from './activeTruck';
import { FLOWING_MIN_LPM } from './plumbing';

/**
 * Seconds of running unprimed before the primer shows CHECK SUCTION (Design §5). A coaching cue,
 * not doctrine: the rotary vane's own limit is the 60 s duty.
 */
export const CHECK_SUCTION_S = 30;

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
  /**
   * How full the hose is, 0–1 from the source end: water rising up a hard suction while priming
   * (`suctionWaterFraction`); a hydrant's layflat is charged before the job starts (0 when soft).
   */
  level: number;
  /**
   * Water moving through it towards the pump: drawn by the pump, or a suction's column climbing
   * while the primer pulls.
   */
  flowing: boolean;
}

function supplyState(truck: TruckState, supply: SupplyLine, source: WaterSource): SupplyState {
  switch (source.kind) {
    case 'static':
      return truck.pump.primed ? 'primed' : 'dry';
    case 'hydrant':
      return truck.readings.inletCollapsed[supply.inletId] === true ? 'soft' : 'charged';
  }
}

/**
 * Every supply hose on a truck (default: the active one) with its state. `inputs` are the ones the
 * player holds on the active truck; any other truck's come from the sim, where they're held.
 */
export function supplyLays(
  sim: SimState,
  inputs: PlayerInputs,
  truckId = sim.activeTruckId,
): SupplyLay[] {
  const truck = sim.trucks.find((t) => t.id === truckId);
  if (truck === undefined) throw new Error(`No truck '${truckId}'`);
  const held = truckId === sim.activeTruckId ? inputs : truck.inputs;
  return connectedSupplies(sim, truck.id).map(({ supply, source }) => {
    const state = supplyState(truck, supply, source);
    const flowLpm = truck.readings.inletFlowLpm[supply.inletId] ?? 0;
    const level =
      source.kind === 'static'
        ? suctionWaterFraction(truck.pump, { supply, source })
        : state === 'soft'
          ? 0
          : 1;
    const open = (held.valves[supply.inletId] ?? 0) >= VALVE_CLOSED_EPS;
    // The primer ran this tick with the suction open, so the column below the pump climbed.
    const climbing = open && level > 0 && level < 1 && truck.pump.primerRunS > 0;
    return {
      supply,
      source,
      state,
      flowLpm,
      open,
      level,
      flowing: flowLpm >= FLOWING_MIN_LPM || climbing,
    };
  });
}
