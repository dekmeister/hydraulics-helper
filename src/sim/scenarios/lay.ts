import { STANDARD_LENGTH_M } from '../constants';
import { DEFAULT_TRUCK_ID } from '../engine';
import { hoseType } from '../hose';
import type { ApplianceSpec, DeliverySpec, HoseLine } from '../types';

/** What a crew runs out: a hose, how many standard lengths of it, and the branch tip. */
export interface LineKit {
  hose: string;
  lengths: number;
  tipMm: number;
}

/**
 * A line plan before it's attached to a delivery. `light`: what the crew runs instead from a truck
 * whose free outlets are all smaller than `hose` (a light tanker has no 65 mm outlet), so one lesson
 * plays on every appliance; without it the hose goes on the closest outlet through an adaptor.
 */
export interface PlannedLine extends LineKit {
  id: string;
  light?: LineKit;
}

/**
 * The crew's light line in place of a 65 mm one: two lengths of 25 mm with a 12 mm branch (Table 1:
 * 250 kPa, ~150 L/min; 25 mm loses ~250 kPa a length at that flow, L928), so it wants about the
 * same pump pressure as the 38 mm crew line. // PLACEHOLDER — needs Dek (what a Cat 7 crew runs)
 */
export const LIGHT_LINE: LineKit = { hose: '25L', lengths: 2, tipMm: 12 };

/** The kit to lay for `plan` from one of `free`: its light kit when every free outlet is smaller. */
export function kitFor(
  plan: LineKit & { light?: LineKit },
  free: readonly DeliverySpec[],
): LineKit {
  const largestMm = Math.max(0, ...free.map((d) => d.sizeMm));
  return plan.light !== undefined && largestMm < hoseType(plan.hose).sizeMm ? plan.light : plan;
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
 * Attach each planned line (or its light kit, see `PlannedLine`) to the unused delivery closest in
 * size to its hose (adaptors assumed), on truck `truckId`.
 */
export function attachLines(
  spec: ApplianceSpec,
  plans: readonly PlannedLine[],
  truckId = DEFAULT_TRUCK_ID,
): HoseLine[] {
  const free: DeliverySpec[] = [...spec.deliveries];
  return plans.map((plan) => {
    const kit = kitFor(plan, free);
    const best = takeDelivery(free, kit.hose);
    return {
      id: plan.id,
      truckId,
      deliveryId: best.id,
      segments: Array.from({ length: kit.lengths }, () => ({
        hose: kit.hose,
        lengthM: STANDARD_LENGTH_M,
      })),
      elevationM: 0,
      branch: { tipMm: kit.tipMm },
    };
  });
}

/** The two lines of a scenario, in plan order; throws if fewer were laid. */
export function twoLines(lines: readonly HoseLine[], scenario: string): [HoseLine, HoseLine] {
  const [a, b] = lines;
  if (a === undefined || b === undefined) throw new Error(`${scenario}: needs two deliveries`);
  return [a, b];
}
