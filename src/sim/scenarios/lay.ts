import { STANDARD_LENGTH_M } from '../constants';
import { DEFAULT_TRUCK_ID } from '../engine';
import { hoseType } from '../hose';
import type { ApplianceSpec, DeliverySpec, HoseLine } from '../types';

/** What a crew runs out: a hose, how many standard lengths of it, and the branch tip. */
export interface LineKit {
  hose: string;
  lengths: number;
  tipMm: number;
  /** A monitor on the end instead of a crew's branch. */
  monitor?: boolean;
}

/** A line plan before it's attached to a delivery; `elevationM` is the branch above the pump. */
export interface PlannedLine extends LineKit {
  id: string;
  elevationM?: number;
}

/**
 * A bush crew's line (issue #10): one length of 25 mm canvas on a 38→25 adaptor with a 12 mm
 * branch (Table 1: 250 kPa, ~150 L/min), about 930 kPa at the pump. One length because percolating
 * hose loses ~680 kPa a length at that flow (`25U`). // PLACEHOLDER — needs Dek (the usual lay)
 */
export const BUSH_LINE: LineKit = { hose: '25U', lengths: 1, tipMm: 12 };

/**
 * A village crew's line (issue #10): three lengths of 38 mm rubber hose, taken as lined, with a
 * 15 mm branch (Table 1: 350 kPa, ~280 L/min), about 700 kPa at the pump.
 */
export const VILLAGE_LINE: LineKit = { hose: '38L', lengths: 3, tipMm: 15 };

/**
 * A monitor on 65 mm: two lengths of 65 mm rubber to a monitor with a 25 mm tip (Table 1: 700 kPa,
 * ~1100 L/min), more than a relay or a draught keeps up with. // PLACEHOLDER — needs Dek (the usual
 * monitor tip and lay)
 */
export const MONITOR_LINE: LineKit = { hose: '65L', lengths: 2, tipMm: 25, monitor: true };

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
      elevationM: plan.elevationM ?? 0,
      branch:
        plan.monitor === true ? { tipMm: plan.tipMm, kind: 'monitor' } : { tipMm: plan.tipMm },
    };
  });
}

/** The two lines of a scenario, in plan order; throws if fewer were laid. */
export function twoLines(lines: readonly HoseLine[], scenario: string): [HoseLine, HoseLine] {
  const [a, b] = lines;
  if (a === undefined || b === undefined) throw new Error(`${scenario}: needs two deliveries`);
  return [a, b];
}
