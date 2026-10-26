import { STANDARD_LENGTH_M } from '../constants';
import { createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { inletOfKind } from '../appliances/controls';
import { HYDRANT_MAIN_LOSS, HYDRANT_STATIC_KPA } from './hydrantSupply';
import type { Scenario } from './types';

/** Tank water at the start, L: low after a job, so there is room to fill. */
const START_TANK_L = 500;

/**
 * Refilling the tank at a hydrant (free play; a lesson is parked): two lengths of 65 mm from the
 * hydrant to the hydrant-to-tank inlet, which fills the tank past the pump. Refilling through the
 * pump (suction and pump to tank) needs a supply on the suction inlet; that's in
 * `sim/tankFill.test.ts`, not this fireground.
 */
export const TANK_REFILL: Scenario = {
  id: 'tank-refill',
  title: 'Tank refill: hydrant to tank',
  requires: { tank: true, tankFill: true, minDeliveries: 0 },
  build(spec) {
    const fill = inletOfKind(spec, 'tankFill', 'tank-refill');
    const initial = createInitialState(spec, [], {
      engine: 'off',
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
          id: 'fill-line',
          truckId: DEFAULT_TRUCK_ID,
          inletId: fill,
          sourceId: 'hydrant',
          segments: [
            { hose: '65L', lengthM: STANDARD_LENGTH_M },
            { hose: '65L', lengthM: STANDARD_LENGTH_M },
          ],
        },
      ],
    });
    return {
      state: { ...initial, trucks: initial.trucks.map((t) => ({ ...t, tankL: START_TANK_L })) },
      // Half open, then fully: the fill rate follows the valve; the tank overflows near the end.
      script: [
        { tS: 0, valves: { [fill]: 0.5 } },
        { tS: 30, valves: { [fill]: 1 } },
      ],
      durationS: 180,
    };
  },
};
