// Priming for draughting (ARCHITECTURE §4.6): the primer pulls vacuum until it lifts water up the
// hard suction to the pump, which then "catches". Behaviour switches on `primer.kind`.
import { HEAD_KPA_PER_M, VACUUM_HOLD_TAU_S, VALVE_CLOSED_EPS } from './constants';
import { hoseVolumeL } from './hose';
import type { ConnectedSupply } from './inlets';
import type { ApplianceSpec, PlayerInputs, PrimerSpec, PumpState } from './types';

/** The draught connection: a suction inlet with hard suction to static water, if any. */
export function draughtSupply(
  supplies: readonly ConnectedSupply[],
): (ConnectedSupply & { source: { kind: 'static' } }) | undefined {
  return supplies.find(
    (s): s is ConnectedSupply & { source: { kind: 'static' } } => s.source.kind === 'static',
  );
}

export interface PrimeContext {
  spec: ApplianceSpec;
  /** Sanitised inputs for this tick. */
  inputs: PlayerInputs;
  supplies: readonly ConnectedSupply[];
  /** Another source is filling the casing (tank or hydrant open): there's no air to pull. */
  flooded: boolean;
  /** A delivery with a line laid is open: an air leak the primer can't beat (L3265–3276). */
  openToAir: boolean;
}

/** Whether the primer is asked to run: its switch (or handle), or always for a self-priming pump. */
function primerAsked(primer: PrimerSpec | undefined, inputs: PlayerInputs, wanted: boolean) {
  if (primer === undefined) return false;
  switch (primer.kind) {
    case 'rotaryVane':
    case 'diaphragm':
      return inputs.switches[primer.id] === true;
    case 'selfPriming':
      return wanted;
  }
}

/**
 * Rotary vane duty (manual L1890: max 1 min on in 3): run time accumulates while it runs and
 * drains at maxOn/(period − maxOn) while it rests. Reaching maxOn trips a cut-out that clears once
 * the duty has fully recovered. Other kinds have no duty limit.
 */
function stepDuty(primer: PrimerSpec | undefined, pump: PumpState, running: boolean, dtS: number) {
  if (primer?.kind !== 'rotaryVane') return { primerDutyS: 0, primerCutOut: false };
  const restRate = primer.maxOnS / (primer.periodS - primer.maxOnS);
  const duty = running ? pump.primerDutyS + dtS : Math.max(0, pump.primerDutyS - restRate * dtS);
  const cutOut = duty >= primer.maxOnS || (pump.primerCutOut && duty > 0);
  return { primerDutyS: Math.min(duty, primer.maxOnS), primerCutOut: cutOut };
}

/**
 * Advance priming by `dtS`. Vacuum approaches the primer's best along an exponential whose time
 * constant is the air volume (casing, plus the suction hose if its valve is open) over the
 * primer's displacement. A sealed pump holds its vacuum slowly; an air leak or a flooded casing
 * drops it at once. The pump catches when vacuum ≥ 10 kPa per m of lift, and loses prime when its
 * static source runs dry or is disconnected.
 */
export function stepPrime(pump: PumpState, ctx: PrimeContext, dtS: number): PumpState {
  const { spec, inputs, supplies, flooded, openToAir } = ctx;
  const primer = spec.primer;
  const draught = draughtSupply(supplies);
  const suctionOpen =
    draught !== undefined && (inputs.valves[draught.supply.inletId] ?? 0) >= VALVE_CLOSED_EPS;
  const sourceHasWater = draught !== undefined && draught.source.volumeL > 0;

  const primed = pump.primed && sourceHasWater;
  const asked = primerAsked(primer, inputs, !primed && suctionOpen);
  const running = asked && !pump.primerCutOut;
  const duty = stepDuty(primer, pump, running, dtS);
  const primerRunS = running ? pump.primerRunS + dtS : 0;

  if (primed || primer === undefined) {
    return { ...pump, ...duty, primed, primerRunS, vacuumKpa: 0 };
  }
  let vacuumKpa: number;
  if (openToAir || flooded) {
    vacuumKpa = 0;
  } else if (running) {
    const suctionL =
      draught !== undefined && suctionOpen ? hoseVolumeL(draught.supply.segments) : 0;
    const airL = spec.pump.casingVolumeL + suctionL;
    const tauS = airL / primer.displacementLps;
    vacuumKpa =
      primer.maxVacuumKpa + (pump.vacuumKpa - primer.maxVacuumKpa) * Math.exp(-dtS / tauS);
  } else {
    vacuumKpa = pump.vacuumKpa * Math.exp(-dtS / VACUUM_HOLD_TAU_S);
  }
  if (
    draught !== undefined &&
    suctionOpen &&
    sourceHasWater &&
    vacuumKpa >= HEAD_KPA_PER_M * draught.source.liftM
  ) {
    return { ...pump, ...duty, primed: true, primerRunS, vacuumKpa: 0 };
  }
  return { ...pump, ...duty, primed: false, primerRunS, vacuumKpa };
}
