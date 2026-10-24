// Shared physical and engine constants. Appliance-specific figures live in sim/appliances/<id>.ts.
// Sources: RFS Hydraulics Manual v4.0 (L = line in hydraulics-manual.txt), digested in
// Resources/hydraulics-manual-GAME-NOTES.md. Worked examples: docs/CALIBRATION.md.

/** Fixed sim timestep in seconds (10 Hz). Architecture choice, not a doctrine figure (ARCHITECTURE §4.1). */
export const TICK_S = 0.1;

/** Pressure per metre of head, kPa/m. Doctrine rounds 9.8 to 10 (L702–741). // doctrine-confirmed */
export const HEAD_KPA_PER_M = 10;

/** Standard length of delivery hose, m. Scenarios lay hose in multiples of this (L823). // doctrine-confirmed */
export const STANDARD_LENGTH_M = 30;

export interface HoseType {
  sizeMm: number;
  lined: boolean;
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
  '38U': { sizeMm: 38, lined: false, kPerM: 1.43e-4 }, // 500 L/min → 1000 kPa per length
  '38L': { sizeMm: 38, lined: true, kPerM: 5.1e-5 }, // 500 L/min → 400 kPa per length (L966)
  '50U': { sizeMm: 50, lined: false, kPerM: 3.47e-5 }, // 500 L/min → 260 kPa per length
  '50L': { sizeMm: 50, lined: true, kPerM: 1.21e-5 }, // 500 L/min → 90 kPa per length (L991)
  '65U': { sizeMm: 65, lined: false, kPerM: 1.14e-5 }, // 1000 L/min → 350 kPa per length (L1026)
  '65L': { sizeMm: 65, lined: true, kPerM: 4.07e-6 }, // 500 L/min → 30 kPa per length (L975)
  '70U': { sizeMm: 70, lined: false, kPerM: 7.0e-6 }, // 1000 L/min → 200 kPa per length
  '70L': { sizeMm: 70, lined: true, kPerM: 2.56e-6 }, // 1000 L/min → 75 kPa per length
  '90U': { sizeMm: 90, lined: false, kPerM: 2.17e-6 }, // 1000 L/min → 65 kPa per length (L1039)
};

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
