import { STANDARD_LENGTH_M } from '../constants';
import { DEFAULT_TRUCK_ID } from '../engine';
import { hoseType } from '../hose';
import type { ApplianceSpec, Branch, BranchModel, DeliverySpec, HoseLine } from '../types';

/** What a crew runs out: a hose, how many standard lengths of it, and the branch tip. */
export interface LineKit {
  hose: string;
  lengths: number;
  /** The tip bore, or for a Dial-A-Jet the jet setting, mm. */
  tipMm: number;
  /** Default 'smoothBore'. */
  model?: BranchModel;
  /** A monitor on the end instead of a crew's branch. */
  monitor?: boolean;
}

/** The branch a kit puts on the end of its line. */
export function branchOf(kit: LineKit): Branch {
  return {
    tipMm: kit.tipMm,
    ...(kit.model === undefined ? {} : { model: kit.model }),
    ...(kit.monitor === true ? { kind: 'monitor' as const } : {}),
  };
}

/** A line plan before it's attached to a delivery; `elevationM` is the branch above the pump. */
export interface PlannedLine extends LineKit {
  id: string;
  elevationM?: number;
}

/** The shortest line a crew runs: RFS doctrine is never less than two lengths. // doctrine-confirmed (Dek) */
export const MIN_CREW_LENGTHS = 2;

/**
 * A bush crew's line: two lengths of 25 mm canvas on a 38→25 adaptor with a Dial-A-Jet on its 8 mm
 * jet (77 L/min at 700 kPa), about 1060 kPa at the pump: ~180 kPa a length of friction at that flow.
 * Two is the doctrinal minimum; crews run more. // doctrine-confirmed (Dek, 2026-11-01)
 */
export const BUSH_LINE: LineKit = { hose: '25U', lengths: 2, tipMm: 8, model: 'dialAJet' };

/**
 * A long bush lay: five lengths of 25 mm canvas, the crew dialled down to the 5 mm jet (45 L/min at
 * 700 kPa), about 1010 kPa at the pump. On the 8 mm jet five lengths would need 1600 kPa for 700,
 * so at ~1000 kPa it would get ~435 kPa: workable, but the 5 mm jet holds the full pressure.
 */
export const BUSH_LINE_LONG: LineKit = { hose: '25U', lengths: 5, tipMm: 5, model: 'dialAJet' };

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
      branch: branchOf(plan),
    };
  });
}

/** The two lines of a scenario, in plan order; throws if fewer were laid. */
export function twoLines(lines: readonly HoseLine[], scenario: string): [HoseLine, HoseLine] {
  const [a, b] = lines;
  if (a === undefined || b === undefined) throw new Error(`${scenario}: needs two deliveries`);
  return [a, b];
}
