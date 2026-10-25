import { STANDARD_LENGTH_M } from '../constants';
import { createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { inletOfKind } from '../appliances/controls';
import { attachLines, twoLines, type PlannedLine } from './lay';
import type { Scenario } from './types';

/**
 * A 65 mm attack line with a 25 mm branch (700 kPa, ~1100 L/min, Table 1), then a 38 mm line: more
 * than the hydrant can give at full throttle, so it over-runs (Table 7).
 */
const LINES: readonly PlannedLine[] = [
  { id: 'line-65', hose: '65L', lengths: 3, tipMm: 25 },
  { id: 'line-38', hose: '38L', lengths: 3, tipMm: 15 },
];

/** Hydrant figures follow C14 (L3127): 400 kPa static, 300 kPa residual at 1100 L/min. */
export const HYDRANT_STATIC_KPA = 400;
export const HYDRANT_MAIN_LOSS = (HYDRANT_STATIC_KPA - 300) / 1100 ** 2;

export const HYDRANT_SUPPLY: Scenario = {
  id: 'hydrant-supply',
  title: 'Hydrant supply: two lengths of 65 mm to the suction inlet',
  requires: { tank: false, suction: true, minDeliveries: LINES.length },
  build(spec) {
    const lines = attachLines(spec, LINES);
    const suction = inletOfKind(spec, 'suction', 'hydrant-supply');
    const [a, b] = twoLines(lines, 'hydrant-supply');
    const state = createInitialState(spec, lines, {
      sources: [
        {
          id: 'hydrant',
          kind: 'hydrant',
          label: 'Hydrant',
          staticKpa: HYDRANT_STATIC_KPA,
          mainLossKpaPerLpm2: HYDRANT_MAIN_LOSS,
        },
      ],
      supplies: [
        {
          id: 'hydrant-line',
          truckId: DEFAULT_TRUCK_ID,
          inletId: suction,
          sourceId: 'hydrant',
          segments: [
            { hose: '65L', lengthM: STANDARD_LENGTH_M },
            { hose: '65L', lengthM: STANDARD_LENGTH_M },
          ],
        },
      ],
    });
    return {
      state,
      script: [
        { tS: 0, valves: { [suction]: 1 } },
        { tS: 2, valves: { [a.deliveryId]: 1 } },
        { tS: 5, throttle: 0.4 },
        { tS: 40, valves: { [b.deliveryId]: 1 } },
        { tS: 60, throttle: 1 },
        { tS: 100, throttle: 0.5 },
      ],
      durationS: 150,
    };
  },
};
