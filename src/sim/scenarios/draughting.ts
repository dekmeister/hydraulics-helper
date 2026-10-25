import { createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { inletOfKind, primerControlId } from '../appliances/controls';
import { PUMP_DAMAGE } from '../lesson/common';
import type { LessonDef } from '../lesson/types';
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

const LESSON: LessonDef = {
  ladder: 4,
  brief:
    'No hydrant here: you draught from a farm dam 4 m below the pump through hard suction. Prime ' +
    'with the deliveries shut, then supply two lines. The compound now reads vacuum, and the lift ' +
    'limits how much water you can draw: push too hard and the pump cavitates.',
  objectives: [
    {
      id: 'prime',
      text: 'Prime the pump: open the suction inlet, keep the deliveries shut and run the primer until it catches.',
      when: { kind: 'primed' },
    },
    {
      id: 'water',
      text: 'Charge both lines.',
      when: {
        kind: 'all',
        of: [
          { kind: 'flow', line: 'line-65', min: 50 },
          { kind: 'flow', line: 'line-38', min: 50 },
        ],
      },
      after: ['prime'],
    },
    {
      id: 'hold',
      text: 'Hold both branches at working pressure for 30 s without cavitating.',
      when: {
        kind: 'all',
        of: [
          { kind: 'branch', line: 'line-65' },
          { kind: 'branch', line: 'line-38' },
          { kind: 'not', of: { kind: 'cavitating' } },
        ],
      },
      holdS: 30,
      after: ['water'],
    },
  ],
  failures: [...PUMP_DAMAGE],
};

export const DRAUGHTING: Scenario = {
  id: 'draughting',
  title: 'Draughting from the dam: prime, deliver, don’t cavitate',
  requires: { tank: false, suction: true, primer: true, minDeliveries: LINES.length },
  build(spec) {
    const lines = attachLines(spec, LINES);
    const suction = inletOfKind(spec, 'suction', 'draughting');
    const [a, b] = twoLines(lines, 'draughting');
    const primerId = primerControlId(spec);
    // The primer runs until the pump catches, whatever the appliance takes to prime.
    const prime = (on: boolean): ScriptStep[] =>
      primerId === undefined
        ? []
        : [
            on
              ? { tS: 1, switches: { [primerId]: true } }
              : { tS: 1, when: { kind: 'primed' }, switches: { [primerId]: false } },
          ];
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
  lesson: LESSON,
  solution: [
    { open: { inlet: 'suction' } },
    { primer: true },
    { until: { kind: 'primed' }, maxS: 90 },
    { primer: false },
    { open: { line: 'line-65' } },
    { open: { line: 'line-38' } },
    { throttle: 0.6 },
    { trim: { branch: 'line-38' } },
    { gate: 'line-65' },
    { until: { kind: 'objective', objective: 'hold' }, maxS: 180 },
  ],
};
