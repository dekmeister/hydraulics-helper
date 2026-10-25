import { STANDARD_LENGTH_M } from '../constants';
import { createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { inletOfKind } from '../appliances/controls';
import { PUMP_DAMAGE } from '../lesson/common';
import type { LessonDef } from '../lesson/types';
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

/**
 * Compound readings the lesson asks for, kPa: a healthy reserve on one line, and still positive with
 * margin on two ("the greater the positive reading, the more water available", L3613–3614; over-run
 * reads inlet zero, Table 7). // PLACEHOLDER — needs Dek
 */
const RESERVE_KPA = 100;
const MARGIN_KPA = 50;

const LESSON: LessonDef = {
  ladder: 3,
  brief:
    'A hydrant feeds your suction inlet through two lengths of 65 mm. On a hydrant the compound ' +
    'gauge reads positive: the higher it sits, the more water the hydrant has left. Take as much ' +
    'as the crews need without over-running it.',
  objectives: [
    {
      id: 'hydrant',
      text: 'Take water from the hydrant: open the suction inlet and charge the 65 mm line.',
      when: {
        kind: 'all',
        of: [
          { kind: 'valve', valve: { inlet: 'suction' }, min: 0.9 },
          { kind: 'flow', line: 'line-65', min: 50 },
        ],
      },
    },
    {
      id: 'reserve',
      text: `Push the 65 mm line to 700 L/min or more with the compound above ${String(RESERVE_KPA)} kPa, for 20 s.`,
      when: {
        kind: 'all',
        of: [
          { kind: 'flow', line: 'line-65', min: 700 },
          { kind: 'gauge', gauge: 'compound', min: RESERVE_KPA },
        ],
      },
      holdS: 20,
      after: ['hydrant'],
    },
    {
      id: 'both',
      text:
        'Charge the 38 mm line as well without over-running the hydrant: both crews flowing ' +
        `(38 mm 200 L/min or more) and the compound above ${String(MARGIN_KPA)} kPa, for 20 s.`,
      when: {
        kind: 'all',
        of: [
          { kind: 'flow', line: 'line-38', min: 200 },
          { kind: 'flow', line: 'line-65', min: 500 },
          { kind: 'gauge', gauge: 'compound', min: MARGIN_KPA },
        ],
      },
      holdS: 20,
      after: ['reserve'],
    },
  ],
  failures: [...PUMP_DAMAGE],
};

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
  lesson: LESSON,
  solution: [
    { open: { inlet: 'suction' } },
    { open: { line: 'line-65' } },
    { throttle: 0.3 },
    { trim: { compoundKpa: RESERVE_KPA + 50 } },
    { until: { kind: 'objective', objective: 'reserve' }, maxS: 120 },
    { open: { line: 'line-38' } },
    { trim: { compoundKpa: MARGIN_KPA + 40 } },
    { until: { kind: 'objective', objective: 'both' }, maxS: 120 },
  ],
};
