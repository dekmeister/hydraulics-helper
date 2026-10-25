// What the pump sounds like right now (ARCHITECTURE §7: what an operator hears). Pure, so it can be
// tested without audio (docs/TESTING.md §9); engine.ts turns it into sound.
import { primerControlId } from '../sim/appliances/controls';
import type { PlayerInputs, TruckState } from '../sim/types';

/** Loudness of each sound, 0–1, and the engine note's pitch. */
export interface SoundParams {
  /** Engine firing frequency, Hz: rises with rpm. */
  engineHz: number;
  engineGain: number;
  /** Rotary vane or diaphragm primer working. */
  primerGain: number;
  /** "Clattering as if pebbles" (manual L3353–3355), by cavitation intensity. */
  rattleGain: number;
  /** Water through the deliveries. */
  sprayGain: number;
}

/** Flow at which spray noise is full, L/min. Sound design. */
const SPRAY_FULL_LPM = 1200;

export function soundParams(truck: TruckState, inputs: PlayerInputs): SoundParams {
  const { engine } = truck.spec;
  const load = Math.min(
    1,
    Math.max(0, (truck.rpm - engine.idleRpm) / (engine.maxRpm - engine.idleRpm)),
  );
  const primer = primerControlId(truck.spec);
  const priming =
    primer !== undefined &&
    inputs.switches[primer] === true &&
    !truck.pump.primed &&
    !truck.pump.primerCutOut;
  const flowLpm = Object.values(truck.readings.deliveryFlowLpm).reduce((a, b) => a + b, 0);
  return {
    // A four-stroke fires each cylinder every other revolution.
    engineHz: (truck.rpm / 60) * (engine.cylinders / 2),
    engineGain: 0.25 + 0.45 * load,
    primerGain: priming ? 0.35 : 0,
    rattleGain: 0.6 * Math.min(1, truck.readings.cavitation),
    sprayGain: 0.3 * Math.min(1, flowLpm / SPRAY_FULL_LPM),
  };
}
