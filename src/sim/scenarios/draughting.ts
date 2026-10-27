import { START_UP, chargeLines, shutDown, startEngineSteps } from './engineSteps';
import { createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { inletOfKind, primerControlId } from '../appliances/controls';
import { PUMP_DAMAGE, shutdownObjective } from '../lesson/common';
import type { LessonDef } from '../lesson/types';
import { attachLines, BUSH_LINE, twoLines, type PlannedLine } from './lay';
import type { Scenario, ScriptStep } from './types';

/** Two bush lines, now fed from the dam. */
const LINES: readonly PlannedLine[] = [
  { id: 'line-1', ...BUSH_LINE },
  { id: 'line-2', ...BUSH_LINE },
];

/** 4 m of lift: the manual's worked example (C11, −40 kPa on the compound). */
const LIFT_M = 4;
/** A farm dam: far more than a scenario draws. */
const DAM_L = 200_000;

const LESSON: LessonDef = {
  ladder: 5,
  brief:
    'No hydrant here: you draught from a farm dam 4 m below the pump through hard suction. Prime ' +
    'with the deliveries shut, then supply two lines. The compound now reads vacuum: the lift ' +
    'and the suction hose cost you pressure before the pump adds any.',
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
          { kind: 'flow', line: 'line-1', min: 50 },
          { kind: 'flow', line: 'line-2', min: 50 },
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
          { kind: 'branch', line: 'line-1' },
          { kind: 'branch', line: 'line-2' },
          { kind: 'not', of: { kind: 'cavitating' } },
        ],
      },
      holdS: 30,
      after: ['water'],
    },
    shutdownObjective(['hold'], ['line-1', 'line-2']),
  ],
  failures: [...PUMP_DAMAGE],
};

export const DRAUGHTING: Scenario = {
  id: 'draughting',
  title: 'Draughting from the dam: prime, deliver, read the lift',
  setting: 'bush',
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
      engine: 'off',
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
        ...startEngineSteps(spec),
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
    ...START_UP,
    { open: { inlet: 'suction' } },
    { primer: true },
    { until: { kind: 'primed' }, maxS: 90 },
    { primer: false },
    ...chargeLines(['line-1', 'line-2']),
    { throttle: 0.6 },
    { trim: { branch: 'line-1' } },
    { gate: 'line-2' },
    { until: { kind: 'objective', objective: 'hold' }, maxS: 180 },
    ...shutDown(['line-1', 'line-2']),
  ],
};
