/**
 * Tank fraction at or below which the tank gauge and lamp show caution (Design §4: "≤ ¼").
 * A UI threshold, not a crew-protection reserve figure. // PLACEHOLDER — needs Dek
 */
export const LOW_TANK_FRACTION = 0.25;

export type TankLevelState = 'ok' | 'low' | 'empty';

/** Volume below this counts as empty, L. Avoids flicker from floating-point residue. */
const EMPTY_L = 0.5;

export function tankLevelState(valueL: number, capacityL: number): TankLevelState {
  if (!(capacityL > 0) || !(valueL > EMPTY_L)) return 'empty';
  return valueL <= LOW_TANK_FRACTION * capacityL ? 'low' : 'ok';
}

/** Lit segment count (0–5, rounded up so any water lights the bottom one) and level state. */
export function tankSegments(
  valueL: number,
  capacityL: number,
): { lit: number; level: TankLevelState } {
  const level = tankLevelState(valueL, capacityL);
  if (level === 'empty') return { lit: 0, level };
  const fraction = Math.min(1, valueL / capacityL);
  return { lit: Math.max(1, Math.ceil(fraction * 5 - 1e-9)), level };
}
