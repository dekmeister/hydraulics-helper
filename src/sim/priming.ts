// Priming for draughting (ARCHITECTURE §4.6): the primer pulls vacuum until it lifts water up the
// hard suction to the pump, which then "catches". Behaviour switches on `primer.kind`.
import { ATMOSPHERIC_KPA, HEAD_KPA_PER_M, VACUUM_HOLD_TAU_S, VALVE_CLOSED_EPS } from './constants';
import { hoseVolumeL, isRigid } from './hose';
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

/** Height of the column a vacuum holds up the suction, as a fraction of a hose rising evenly over the lift. */
function columnFraction(vacuumKpa: number, liftM: number): number {
  return liftM <= 0 ? 1 : Math.min(1, Math.max(0, vacuumKpa / (HEAD_KPA_PER_M * liftM)));
}

/** A hard suction to static water that has water in it to lift. */
function liftable(draught: ConnectedSupply | undefined): draught is ConnectedSupply & {
  source: { kind: 'static'; liftM: number };
} {
  return (
    draught?.source.kind === 'static' &&
    draught.source.volumeL > 0 &&
    isRigid(draught.supply.segments)
  );
}

/**
 * How far up the hard suction the water stands, as a fraction of the hose from the strainer. The
 * vacuum above it holds a column vacuum/10 m high (hydrostatics: the column's inertia settles well
 * inside a tick), and the hose is taken to rise evenly over the lift. Full once primed; empty
 * through layflat or from a dry source. Shutting the suction valve traps it where it stands.
 */
export function suctionWaterFraction(
  pump: PumpState,
  draught: ConnectedSupply | undefined,
): number {
  if (draught?.source.kind !== 'static') return 0;
  if (pump.primed) return 1;
  if (!liftable(draught)) return 0;
  return columnFraction(pump.suctionVacuumKpa, draught.source.liftM);
}

/**
 * Casing and suction joined by opening the suction valve: their air mixes, isothermally, by the
 * volumes as they stand (casing, and the hose above its column), so one shared vacuum results.
 */
function mixedVacuumKpa(
  spec: ApplianceSpec,
  draught: ConnectedSupply & { source: { kind: 'static'; liftM: number } },
  casingKpa: number,
  hoseKpa: number,
): number {
  const casingL = spec.pump.casingVolumeL;
  const hoseL =
    hoseVolumeL(draught.supply.segments) * (1 - columnFraction(hoseKpa, draught.source.liftM));
  if (casingL + hoseL <= 0) return casingKpa;
  const absKpa =
    ((ATMOSPHERIC_KPA - casingKpa) * casingL + (ATMOSPHERIC_KPA - hoseKpa) * hoseL) /
    (casingL + hoseL);
  return ATMOSPHERIC_KPA - absKpa;
}

/**
 * Air the primer must work on, L, at this vacuum: the casing, the suction above the water and,
 * while the column is still rising, the air the column squeezes. Isothermal air balance with the
 * hose filling as the vacuum grows: (V_air + p·dV_water/dp)·dp/dt = −p·D, where the water taken in
 * per kPa is V_hose/(10·lift). Without that term priming at 4 m on 6 m of 65 mm runs ~2× fast.
 */
function primedAirL(
  spec: ApplianceSpec,
  pump: PumpState,
  draught: ConnectedSupply | undefined,
  suctionOpen: boolean,
): number {
  if (draught === undefined || !suctionOpen) return spec.pump.casingVolumeL;
  const suctionL = hoseVolumeL(draught.supply.segments);
  const level = suctionWaterFraction(pump, draught);
  const liftM = draught.source.kind === 'static' ? draught.source.liftM : 0;
  const rising = level > 0 && level < 1 && liftM > 0;
  const columnL = rising
    ? ((ATMOSPHERIC_KPA - pump.vacuumKpa) * suctionL) / (HEAD_KPA_PER_M * liftM)
    : 0;
  return spec.pump.casingVolumeL + suctionL * (1 - level) + columnL;
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
 * constant is the air it works on (`primedAirL`: casing, plus the suction if its valve is open,
 * plus the column rising in it) over the primer's displacement. A sealed pump holds its vacuum slowly; an air leak or a flooded casing
 * drops it at once. The pump catches when vacuum ≥ 10 kPa per m of lift up hard suction (never
 * through layflat), and loses prime when its static source runs dry or is disconnected.
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
    return { ...pump, ...duty, primed, primerRunS, vacuumKpa: 0, suctionVacuumKpa: 0 };
  }
  // Layflat flattens under vacuum and a dry dam has nothing to lift: only hard suction holds water.
  const lifts = liftable(draught);
  let hoseKpa = lifts ? pump.suctionVacuumKpa : 0;
  let casingKpa = pump.vacuumKpa;
  if (lifts && suctionOpen && hoseKpa !== casingKpa) {
    // Just opened: the casing and the hose share one vacuum.
    casingKpa = mixedVacuumKpa(spec, draught, casingKpa, hoseKpa);
    hoseKpa = casingKpa;
  }
  const joined = { ...pump, vacuumKpa: casingKpa, suctionVacuumKpa: hoseKpa };
  let vacuumKpa: number;
  if (openToAir || flooded) {
    vacuumKpa = 0;
  } else if (running) {
    const tauS = primedAirL(spec, joined, draught, suctionOpen) / primer.displacementLps;
    vacuumKpa = primer.maxVacuumKpa + (casingKpa - primer.maxVacuumKpa) * Math.exp(-dtS / tauS);
  } else {
    vacuumKpa = casingKpa * Math.exp(-dtS / VACUUM_HOLD_TAU_S);
  }
  // Open, the hose shares the casing's vacuum; shut, its column is trapped and holds as a sound
  // pump's vacuum does.
  const suctionVacuumKpa = !lifts
    ? 0
    : suctionOpen
      ? vacuumKpa
      : hoseKpa * Math.exp(-dtS / VACUUM_HOLD_TAU_S);
  if (lifts && suctionOpen && vacuumKpa >= HEAD_KPA_PER_M * draught.source.liftM) {
    return { ...pump, ...duty, primed: true, primerRunS, vacuumKpa: 0, suctionVacuumKpa: 0 };
  }
  return { ...pump, ...duty, primed: false, primerRunS, vacuumKpa, suctionVacuumKpa };
}
