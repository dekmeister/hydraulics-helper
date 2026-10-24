import { HOSE_WAVE_SPEED_M_S, WATER_DENSITY_KG_M3, WATER_HAMMER_SURGE_KPA } from './constants';
import { hoseType } from './hose';
import type { ControlId, HammerEvent, HoseLine } from './types';

/**
 * Joukowsky surge for a sudden drop in flow through a hose of `boreMm`: ΔP = ρ·a·Δv, kPa. The
 * whole drop is taken to happen within one tick, which is shorter than the hose's wave period.
 */
export function surgeKpa(dropLpm: number, boreMm: number): number {
  const areaM2 = (Math.PI / 4) * (boreMm / 1000) ** 2;
  const dvMS = dropLpm / 60000 / areaM2;
  return (WATER_DENSITY_KG_M3 * HOSE_WAVE_SPEED_M_S * dvMS) / 1000;
}

export interface HammerContext {
  lines: readonly HoseLine[];
  /** Delivery valve openings last tick and this tick. */
  valvesBefore: Record<ControlId, number>;
  valvesNow: Record<ControlId, number>;
  flowBefore: Record<ControlId, number>;
  flowNow: Record<ControlId, number>;
  timeS: number;
}

/**
 * The worst water hammer this tick, if any: a delivery valve closed further and its flow dropped
 * hard enough that the surge passes the threshold. Only valve closures count, so a tank running
 * dry or cavitation onset (flow falling with the valve unmoved) is not hammer.
 */
export function detectHammer(ctx: HammerContext): HammerEvent | undefined {
  let worst: HammerEvent | undefined;
  for (const line of ctx.lines) {
    const id = line.deliveryId;
    const closed = (ctx.valvesNow[id] ?? 0) < (ctx.valvesBefore[id] ?? 0);
    const dropLpm = (ctx.flowBefore[id] ?? 0) - (ctx.flowNow[id] ?? 0);
    const first = line.segments[0];
    if (!closed || dropLpm <= 0 || first === undefined) continue;
    const surge = surgeKpa(dropLpm, hoseType(first.hose).sizeMm);
    if (surge >= WATER_HAMMER_SURGE_KPA && surge > (worst?.surgeKpa ?? 0)) {
      worst = { atS: ctx.timeS, deliveryId: id, surgeKpa: surge };
    }
  }
  return worst;
}
