import { STANDARD_LENGTH_M } from '../constants';
import { createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { hoseType } from '../hose';
import type { ApplianceSpec, DeliverySpec, HoseLine } from '../types';
import type { Scenario } from './types';

/** Line plan before it's attached to a delivery. */
interface PlannedLine {
  id: string;
  hose: string;
  lengths: number;
  tipMm: number;
}

/**
 * The 38 mm line first, then a 65 mm line: the friction contrast and the pump-droop sag when the
 * second line opens. Tips from Table 1: 15 mm (350 kPa, ~280 L/min) and 20 mm (500 kPa, ~600 L/min).
 */
const LINES: readonly PlannedLine[] = [
  { id: 'line-38', hose: '38L', lengths: 3, tipMm: 15 },
  { id: 'line-65', hose: '65L', lengths: 3, tipMm: 20 },
];

/** Attach each planned line to the unused delivery closest in size to its hose (adaptors assumed). */
function attach(spec: ApplianceSpec): HoseLine[] {
  const free: DeliverySpec[] = [...spec.deliveries];
  return LINES.map((plan) => {
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

export const TANK_ATTACK: Scenario = {
  id: 'tank-attack',
  title: 'Tank attack: 38 mm line, then a 65 mm line',
  requires: { tank: true, minDeliveries: LINES.length },
  build(spec) {
    const lines = attach(spec);
    const tankInlet = spec.inlets.find((i) => i.kind === 'tank');
    const [a, b] = lines;
    if (tankInlet === undefined || a === undefined || b === undefined) {
      throw new Error(`tank-attack: ${spec.id} lacks a tank inlet or two deliveries`);
    }
    return {
      state: createInitialState(spec, lines),
      script: [
        { tS: 0, valves: { [tankInlet.id]: 1 } },
        { tS: 2, valves: { [a.deliveryId]: 1 } },
        { tS: 5, throttle: 0.6 },
        { tS: 60, valves: { [b.deliveryId]: 1 } },
        { tS: 90, throttle: 0.8 },
      ],
      durationS: 300,
    };
  },
};
