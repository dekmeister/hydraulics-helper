import { STANDARD_LENGTH_M } from '../constants';
import { createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { inletOfKind } from '../appliances/controls';
import { PUMP_DAMAGE } from '../lesson/common';
import type { LessonDef } from '../lesson/types';
import { attachLines, LIGHT_LINE, twoLines, type PlannedLine } from './lay';
import type { Scenario } from './types';

/**
 * A 65 mm attack line with a 25 mm branch (700 kPa, ~1100 L/min, Table 1), then a 38 mm line: more
 * than the hydrant can give at full throttle, so it over-runs (Table 7). A truck with no 65 mm
 * outlet runs the light line; its targets are fractions of each line's working flow.
 */
const LINES: readonly PlannedLine[] = [
  { id: 'line-65', hose: '65L', lengths: 3, tipMm: 25, light: LIGHT_LINE },
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

/**
 * Flows the lesson asks for, as fractions of each line's working flow: on a Cat 1, 700 L/min on the
 * 65 mm line (of ~1100), then 500 on it with 200 on the 38 mm (of ~280). Lesson tuning.
 */
const RESERVE_OF_WORKING = 0.635;
const BOTH_65_OF_WORKING = 0.45;
const BOTH_38_OF_WORKING = 0.71;

const LESSON: LessonDef = {
  ladder: 3,
  brief:
    'A hydrant feeds your suction inlet through two lengths of 65 mm. On a hydrant the compound ' +
    'gauge reads positive: the higher it sits, the more water the hydrant has left. Take as much ' +
    'as the crews need without over-running it.',
  objectives: [
    {
      id: 'hydrant',
      text: 'Take water from the hydrant: open the suction inlet and charge the {line:line-65}.',
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
      text: `Push the {line:line-65} to {flow:line-65:${String(RESERVE_OF_WORKING)}} or more with the compound above ${String(RESERVE_KPA)} kPa, for 20 s.`,
      when: {
        kind: 'all',
        of: [
          { kind: 'flow', line: 'line-65', ofWorking: true, min: RESERVE_OF_WORKING },
          { kind: 'gauge', gauge: 'compound', min: RESERVE_KPA },
        ],
      },
      holdS: 20,
      after: ['hydrant'],
    },
    {
      id: 'both',
      text:
        'Charge the {line:line-38} as well without over-running the hydrant: both crews flowing ' +
        `({flow:line-38:${String(BOTH_38_OF_WORKING)}} or more on it) and the compound above ` +
        `${String(MARGIN_KPA)} kPa, for 20 s.`,
      when: {
        kind: 'all',
        of: [
          { kind: 'flow', line: 'line-38', ofWorking: true, min: BOTH_38_OF_WORKING },
          { kind: 'flow', line: 'line-65', ofWorking: true, min: BOTH_65_OF_WORKING },
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
