import { STANDARD_LENGTH_M } from '../constants';
import { DEFAULT_TRUCK_ID } from '../engine';
import { hoseType } from '../hose';
import type { ApplianceSpec, DeliverySpec, HoseLine } from '../types';

/** Line plan before it's attached to a delivery. */
export interface PlannedLine {
  id: string;
  hose: string;
  lengths: number;
  tipMm: number;
}

/**
 * The free delivery closest in size to `hose` (adaptors assumed); takes it out of `free`. Throws
 * when every delivery is taken.
 */
export function takeDelivery(free: DeliverySpec[], hose: string): DeliverySpec {
  const sizeMm = hoseType(hose).sizeMm;
  const [first, ...rest] = free;
  if (first === undefined) throw new Error(`No free delivery for ${hose}`);
  const best = rest.reduce(
    (a, b) => (Math.abs(b.sizeMm - sizeMm) < Math.abs(a.sizeMm - sizeMm) ? b : a),
    first,
  );
  free.splice(free.indexOf(best), 1);
  return best;
}

/**
 * Attach each planned line to the unused delivery closest in size to its hose (adaptors assumed),
 * on truck `truckId`.
 */
export function attachLines(
  spec: ApplianceSpec,
  plans: readonly PlannedLine[],
  truckId = DEFAULT_TRUCK_ID,
): HoseLine[] {
  const free: DeliverySpec[] = [...spec.deliveries];
  return plans.map((plan) => {
    const best = takeDelivery(free, plan.hose);
    return {
      id: plan.id,
      truckId,
      deliveryId: best.id,
      segments: Array.from({ length: plan.lengths }, () => ({
        hose: plan.hose,
        lengthM: STANDARD_LENGTH_M,
      })),
      elevationM: 0,
      branch: { tipMm: plan.tipMm },
    };
  });
}

/** The two lines of a scenario, in plan order; throws if fewer were laid. */
export function twoLines(lines: readonly HoseLine[], scenario: string): [HoseLine, HoseLine] {
  const [a, b] = lines;
  if (a === undefined || b === undefined) throw new Error(`${scenario}: needs two deliveries`);
  return [a, b];
}
