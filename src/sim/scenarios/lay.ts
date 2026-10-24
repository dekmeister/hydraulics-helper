import { STANDARD_LENGTH_M } from '../constants';
import { DEFAULT_TRUCK_ID } from '../engine';
import { hoseType } from '../hose';
import type { ApplianceSpec, ControlId, DeliverySpec, HoseLine } from '../types';

/** Line plan before it's attached to a delivery. */
export interface PlannedLine {
  id: string;
  hose: string;
  lengths: number;
  tipMm: number;
}

/** Attach each planned line to the unused delivery closest in size to its hose (adaptors assumed). */
export function attachLines(spec: ApplianceSpec, plans: readonly PlannedLine[]): HoseLine[] {
  const free: DeliverySpec[] = [...spec.deliveries];
  return plans.map((plan) => {
    const sizeMm = hoseType(plan.hose).sizeMm;
    const best = free.reduce((a, b) =>
      Math.abs(b.sizeMm - sizeMm) < Math.abs(a.sizeMm - sizeMm) ? b : a,
    );
    free.splice(free.indexOf(best), 1);
    return {
      id: plan.id,
      truckId: DEFAULT_TRUCK_ID,
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

/** The spec's first inlet of `kind`; throws naming the scenario if it has none. */
export function inletOfKind(
  spec: ApplianceSpec,
  kind: 'tank' | 'suction',
  scenario: string,
): ControlId {
  const inlet = spec.inlets.find((i) => i.kind === kind);
  if (inlet === undefined) throw new Error(`${scenario}: ${spec.id} has no ${kind} inlet`);
  return inlet.id;
}

/** The two lines of a scenario, in plan order; throws if fewer were laid. */
export function twoLines(lines: readonly HoseLine[], scenario: string): [HoseLine, HoseLine] {
  const [a, b] = lines;
  if (a === undefined || b === undefined) throw new Error(`${scenario}: needs two deliveries`);
  return [a, b];
}
