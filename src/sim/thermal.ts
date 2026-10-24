import { AMBIENT_C, CASING_HEAT_LOSS_KW_PER_K, WATER_KJ_PER_L_K } from './constants';
import type { ApplianceSpec } from './types';

export interface ThermalContext {
  spec: ApplianceSpec;
  rpm: number;
  /** Water is reaching the pump; a dry pump churns nothing. */
  wet: boolean;
  /** Water leaving the pump's loop (deliveries, relief to tank), carrying heat away, L/min. */
  throughLpm: number;
}

/**
 * Casing water temperature after `dtS` (manual: churning with every outlet shut heats the pump,
 * L2077–2083). Churn heat `churnKw·(rpm/max)³` warms the casing water; water flowing through takes
 * heat away at Q·c·ΔT and the casing sheds a little to the air. Linear in T, so the exact
 * exponential step is used.
 */
export function stepTempC(tempC: number, ctx: ThermalContext, dtS: number): number {
  const { spec, rpm, wet, throughLpm } = ctx;
  const ratio = rpm / spec.engine.maxRpm;
  const heatKw = wet ? spec.pump.churnKw * ratio * ratio * ratio : 0;
  const massKjPerK = spec.pump.casingVolumeL * WATER_KJ_PER_L_K;
  const coolKwPerK = (wet ? (throughLpm / 60) * WATER_KJ_PER_L_K : 0) + CASING_HEAT_LOSS_KW_PER_K;
  const rate = coolKwPerK / massKjPerK;
  const settledC = AMBIENT_C + heatKw / coolKwPerK;
  return settledC + (tempC - settledC) * Math.exp(-rate * dtS);
}
