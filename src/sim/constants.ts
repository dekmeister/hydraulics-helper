// Shared physical and engine constants. Appliance-specific figures live in sim/appliances/<id>.ts.
// Sources: RFS Hydraulics Manual v4.0 (L = line in hydraulics-manual.txt), digested in
// Resources/hydraulics-manual-GAME-NOTES.md. Worked examples: docs/CALIBRATION.md.

/** Fixed sim timestep in seconds (10 Hz). Architecture choice, not a doctrine figure (docs/decisions/001). */
export const TICK_S = 0.1;

/** Pressure per metre of head, kPa/m. Doctrine rounds 9.8 to 10 (L702–741). // doctrine-confirmed */
export const HEAD_KPA_PER_M = 10;

/**
 * Atmospheric pressure, kPa absolute (standard atmosphere). Physics, not doctrine: the air the
 * primer works on starts here. // doctrine-confirmed
 */
export const ATMOSPHERIC_KPA = 101.3;

/** Standard length of delivery hose, m. Scenarios lay hose in multiples of this (L823). // doctrine-confirmed */
export const STANDARD_LENGTH_M = 30;

export interface HoseType {
  sizeMm: number;
  lined: boolean;
  /** Hard (rigid) suction hose: holds a vacuum. Layflat collapses below `LAYFLAT_COLLAPSE_KPA`. */
  hardSuction?: true;
  /** Friction coefficient k_m in ΔP = k_m·L·Q², kPa per (L/min)² per metre. */
  kPerM: number;
}

/**
 * Hose catalogue: friction per metre, ΔP = k_m · L_m · Q².
 * Least-squares fits of manual Table 3 (kPa lost per 30 m length, PDF p32, checked against the
 * page image 2026-10-24) divided by 30; fit scatter ≤ ±10 %. // doctrine-confirmed
 */
export const HOSES: Readonly<Record<string, HoseType>> = {
  '25L': { sizeMm: 25, lined: true, kPerM: 3.6e-4 }, // 150 L/min → 250 kPa per length (L928)
  // Bush canvas (percolating): Table 3 has no 25 mm unlined column, so 25L × 2.8, the unlined:lined
  // ratio at 38 and 65 mm; 150 L/min → ~680 kPa per length. // PLACEHOLDER — needs Dek
  '25U': { sizeMm: 25, lined: false, kPerM: 1.0e-3 },
  '38U': { sizeMm: 38, lined: false, kPerM: 1.43e-4 }, // 500 L/min → 1000 kPa per length
  '38L': { sizeMm: 38, lined: true, kPerM: 5.1e-5 }, // 500 L/min → 400 kPa per length (L966)
  '50U': { sizeMm: 50, lined: false, kPerM: 3.47e-5 }, // 500 L/min → 260 kPa per length
  '50L': { sizeMm: 50, lined: true, kPerM: 1.21e-5 }, // 500 L/min → 90 kPa per length (L991)
  '65U': { sizeMm: 65, lined: false, kPerM: 1.14e-5 }, // 1000 L/min → 350 kPa per length (L1026)
  '65L': { sizeMm: 65, lined: true, kPerM: 4.07e-6 }, // 500 L/min → 30 kPa per length (L975)
  '70U': { sizeMm: 70, lined: false, kPerM: 7.0e-6 }, // 1000 L/min → 200 kPa per length
  '70L': { sizeMm: 70, lined: true, kPerM: 2.56e-6 }, // 1000 L/min → 75 kPa per length
  '90U': { sizeMm: 90, lined: false, kPerM: 2.17e-6 }, // 1000 L/min → 65 kPa per length (L1039)
  // Hard suction, smooth bore: taken as 65 mm lined (manual gives no figure). // PLACEHOLDER — needs Dek
  '65H': { sizeMm: 65, lined: true, hardSuction: true, kPerM: 4.07e-6 },
};

/**
 * Inlet gauge pressure below which layflat supply hose flattens, kPa: soft hose can't hold a
 * vacuum, so an over-run hydrant reads "inlet zero, supply hose soft" (Table 7). // doctrine-confirmed
 */
export const LAYFLAT_COLLAPSE_KPA = 0;

/** Loss through a suction strainer, kPa per (L/min)²: 15 kPa at 1000 L/min. // PLACEHOLDER — needs Dek */
export const STRAINER_LOSS_KPA_PER_LPM2 = 15 / 1000 ** 2;

/**
 * Time constant a primed-but-idle pump's vacuum decays with when nothing is leaking, s: a sound
 * pump "holds" the vacuum test. // PLACEHOLDER — needs Dek
 */
export const VACUUM_HOLD_TAU_S = 120;

/**
 * How far past the cavitation limit the pump must be pushed to count as fully cavitating, as a
 * fraction of the flow it can draw (sets the 0–1 intensity). Display/scoring scale, not doctrine.
 */
export const CAVITATION_FULL_EXCESS = 0.25;

/**
 * Discharge gauge flutter at full cavitation, ± kPa: about ±12° on a 0–1600 dial, so a third of
 * full cavitation already swings the needle the ±2–5° Design §6 asks for. // PLACEHOLDER — needs Dek
 */
export const CAVITATION_FLUTTER_DISCHARGE_KPA = 100;
/** Compound gauge flutter at full cavitation, ± kPa (±9° in the vacuum sector). // PLACEHOLDER — needs Dek */
export const CAVITATION_FLUTTER_COMPOUND_KPA = 15;

/** Heat to warm 1 L of water by 1 °C, kJ. Physics. */
export const WATER_KJ_PER_L_K = 4.186;

/** Temperature of source water and the pump at rest, °C. // PLACEHOLDER — needs Dek */
export const AMBIENT_C = 20;

/** Heat the pump casing sheds to the air, kW per °C above ambient. // PLACEHOLDER — needs Dek */
export const CASING_HEAT_LOSS_KW_PER_K = 0.02;

/** Pump water temperature that lights the temperature lamp amber / red, °C. // PLACEHOLDER — needs Dek */
export const PUMP_TEMP_CAUTION_C = 60;
export const PUMP_TEMP_ALARM_C = 80;

/**
 * Sustained abuse that damages the pump and fails a lesson (M4; docs/BACKLOG.md): seconds of
 * cavitation, and seconds above the temperature caution, over the whole scenario. Gentle on purpose:
 * a minute of either is well past a lesson learned. // PLACEHOLDER — needs Dek
 */
export const PUMP_DAMAGE_CAVITATION_S = 60;
export const PUMP_DAMAGE_OVERHEAT_S = 60;

/** Density of water, kg/m³. Physics. */
export const WATER_DENSITY_KG_M3 = 1000;

/**
 * Pressure wave speed in charged fire hose, m/s; far below steel pipe (~1200) because the wall
 * stretches. Sets the Joukowsky surge ρ·a·Δv. // PLACEHOLDER — needs Dek
 */
export const HOSE_WAVE_SPEED_M_S = 250;

/** Surge above which a valve closure counts as water hammer, kPa. // PLACEHOLDER — needs Dek */
export const WATER_HAMMER_SURGE_KPA = 500;

/**
 * Branch orifice law Q = BRANCH_FLOW_COEFF · d² · √(P / 100), Q in L/min, d in mm, P in kPa.
 * The manual's formula (L462) is printed without the square root; this form reproduces Table 1. // doctrine-confirmed
 */
export const BRANCH_FLOW_COEFF = 2 / 3;

/** Optimum straight-stream branch pressure by tip size, kPa (Table 1, L465–490). // doctrine-confirmed */
export const BRANCH_OPTIMUM_KPA: Readonly<Record<number, number>> = {
  12: 250,
  15: 350,
  20: 500,
  25: 700,
  30: 800,
  32: 800,
};

/**
 * How far a branch may sit from its Table 1 optimum and still count as "at working pressure" in a
 * lesson objective: ±10 %, so 315–385 kPa for a 15 mm tip. // PLACEHOLDER — needs Dek
 */
export const BRANCH_BAND_FRACTION = 0.1;

/**
 * Loss through a fully open 38 mm delivery valve, kPa per (L/min)²: ~10 kPa at 300 L/min.
 * Scales with (38/d)⁴ for other sizes (loss ∝ velocity², velocity ∝ 1/d²). // PLACEHOLDER — needs Dek
 */
export const VALVE_LOSS_REF_KPA_PER_LPM2 = 1.1e-4;
/** Bore the valve loss reference figure is quoted at, mm. // PLACEHOLDER — needs Dek */
export const VALVE_LOSS_REF_MM = 38;

/** A valve opened less than this is treated as shut (avoids ∞ loss at 0). Numerical, not doctrine. */
export const VALVE_CLOSED_EPS = 0.01;

/** Bisection iterations for the network solve: fixed, so results are deterministic. Numerical, not doctrine. */
export const SOLVER_ITERATIONS = 60;

/**
 * How steeply the inlet pressure is taken to fall past the cavitation cap, kPa per L/min. Large, so
 * the solve settles on the capped flow. Numerical, not doctrine.
 */
export const CAVITATION_STIFFNESS = 1e4;

/**
 * Inlet pressure within this of a layflat's collapse pressure counts as collapsed, kPa: the
 * bisection lands a hair under it. Numerical, not doctrine.
 */
export const COLLAPSE_TOLERANCE_KPA = 1e-6;

/**
 * Gauge flutter is a smoothed random walk: each tick keeps this share of the last value and adds
 * this much of a fresh uniform draw in −1…1. Display texture, not doctrine.
 */
export const FLUTTER_MEMORY = 0.5;
export const FLUTTER_KICK = 0.87;

/**
 * Relay design pressures (manual L3794–3796): a pump in a relay delivers 700 kPa and the next pump
 * keeps at least 100 kPa residual at its inlet, so 600 kPa is spent on friction and head between
 * them (C12, C13). // doctrine-confirmed
 */
export const RELAY_DELIVERY_KPA = 700;
export const RELAY_MIN_RESIDUAL_KPA = 100;

/**
 * Most a charged delivery or relay hose should run at, kPa: a quarter of the ~4000 kPa rated burst
 * of new short lengths (L945–948). The receiving pump is warned above it. // doctrine-confirmed
 */
export const HOSE_WORKING_KPA = 1000;

/**
 * Pressure at which a length of charged layflat in service bursts, kPa: well under the rated
 * figure for new hose (L945–948), since hose in service is worn. A relay inlet slammed shut sends a
 * Joukowsky surge (~1000 kPa for 800 L/min in 65 mm) back up the hose on top of the ~700 kPa at
 * the pump: the manual's shutdown burst (L3865–3873). Throttled down and eased shut, or held
 * dead-headed (~900–1120 kPa, Cat 1 through its relief), it survives. // PLACEHOLDER — needs Dek
 */
export const HOSE_BURST_KPA = 1300;

/**
 * Smallest relay flow the supplying pump's equivalent source is fitted at, L/min, when the relay
 * was dry last tick. Numerical, not doctrine: any flow inside the pump's range gives a fit that
 * the next tick refines at the real flow.
 */
export const RELAY_FIT_PROBE_LPM = 100;

/**
 * Smallest internal resistance the equivalent source is given, kPa per (L/min)²: keeps the fit
 * finite when the supplying pump's discharge doesn't fall with flow. Numerical, not doctrine.
 */
export const RELAY_FIT_MIN_R = 1e-9;

/**
 * A diesel running down with its fuel cut stops abruptly once compression beats its inertia: below
 * this fraction of its idle speed it's at rest. // PLACEHOLDER — needs Dek
 */
export const ENGINE_AT_REST_FRACTION_OF_IDLE = 0.1;

/**
 * Time constant for spilled water soaking into the ground around an overflowing tank or dam, s.
 * Infiltration goes with the wetted area, and a shallow pool's area goes with its volume, so the
 * pool decays exponentially: about 37 % left after this long once nothing is spilling. Far quicker
 * than real ground on purpose, so the pool shows the overflow as it happens and clears soon after
 * it's shut. // doctrine-confirmed (Dek, 2026-10-27: a game-feel choice, not a measured soak rate)
 */
export const SPILL_SOAK_TAU_S = 5;
