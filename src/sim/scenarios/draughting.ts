import { createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { inletOfKind, primerControlId } from '../appliances/controls';
import { attachLines, twoLines, type PlannedLine } from './lay';
import type { Scenario, ScriptStep } from './types';

/** The tank-attack pair (38 mm then 65 mm, Table 1 tips), now fed from the dam. */
const LINES: readonly PlannedLine[] = [
  { id: 'line-65', hose: '65L', lengths: 3, tipMm: 20 },
  { id: 'line-38', hose: '38L', lengths: 3, tipMm: 15 },
];

/** 4 m of lift: the manual's worked example (C11, −40 kPa on the compound). */
const LIFT_M = 4;
/** A farm dam: far more than a scenario draws. */
const DAM_L = 200_000;

export const DRAUGHTING: Scenario = {
  id: 'draughting',
  title: 'Draughting from the dam: prime, deliver, then push it into cavitation',
  requires: { tank: false, suction: true, primer: true, minDeliveries: LINES.length },
  build(spec) {
    const lines = attachLines(spec, LINES);
    const suction = inletOfKind(spec, 'suction', 'draughting');
    const [a, b] = twoLines(lines, 'draughting');
    const primerId = primerControlId(spec);
    const prime = (on: boolean): ScriptStep[] =>
      primerId === undefined ? [] : [{ tS: on ? 1 : 25, switches: { [primerId]: on } }];
    const state = createInitialState(spec, lines, {
      sources: [{ id: 'dam', kind: 'static', label: 'Dam', liftM: LIFT_M, volumeL: DAM_L }],
      supplies: [
        {
          id: 'suction-hose',
          truckId: DEFAULT_TRUCK_ID,
          inletId: suction,
          sourceId: 'dam',
          // Two 3 m lengths of hard suction. // PLACEHOLDER — needs Dek (what a Cat 1 carries)
          segments: [
            { hose: '65H', lengthM: 3 },
            { hose: '65H', lengthM: 3 },
          ],
        },
      ],
    });
    return {
      state,
      script: [
        { tS: 0, valves: { [suction]: 1 } },
        ...prime(true),
        ...prime(false),
        { tS: 27, valves: { [a.deliveryId]: 1 } },
        { tS: 30, throttle: 0.6 },
        { tS: 60, valves: { [b.deliveryId]: 1 } },
        { tS: 90, throttle: 1 },
        { tS: 120, throttle: 0.6 },
      ],
      durationS: 180,
    };
  },
};
