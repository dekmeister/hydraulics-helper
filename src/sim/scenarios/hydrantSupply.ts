import { START_UP, chargeLines, shutDown, startEngineSteps } from './engineSteps';
import { STANDARD_LENGTH_M } from '../constants';
import { createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { inletOfKind } from '../appliances/controls';
import { PUMP_DAMAGE, shutdownObjective } from '../lesson/common';
import type { LessonDef } from '../lesson/types';
import { attachLines, twoLines, VILLAGE_LINE, type PlannedLine } from './lay';
import type { Scenario } from './types';

/**
 * Two village crews on 38 mm rubber (Table 1 15 mm tips, ~280 L/min each): ~560 L/min at working
 * pressure, ~800 at full throttle, more than this village main gives, so pushing it over-runs the
 * hydrant (Table 7).
 */
const LINES: readonly PlannedLine[] = [
  { id: 'line-1', ...VILLAGE_LINE },
  { id: 'line-2', ...VILLAGE_LINE },
];

/** Hydrant figures follow C14 (L3127): 400 kPa static, 300 kPa residual at 1100 L/min. */
export const HYDRANT_STATIC_KPA = 400;
export const HYDRANT_MAIN_LOSS = (HYDRANT_STATIC_KPA - 300) / 1100 ** 2;

/**
 * A weaker village main for pumping direct (issue #10): 300 kPa static, 200 kPa residual at
 * 600 L/min. Through two lengths of 65 mm the compound reads ~135 kPa with both crews at working
 * pressure and zero at ~760 L/min, so full throttle on both lines over-runs it; on the C14 main two
 * 38 mm lines never could. // PLACEHOLDER — needs Dek (a typical village main)
 */
const VILLAGE_STATIC_KPA = 300;
const VILLAGE_MAIN_LOSS = (VILLAGE_STATIC_KPA - 200) / 600 ** 2;

/**
 * Compound readings the lesson asks for, kPa: a healthy reserve on one line, and still positive with
 * margin on two ("the greater the positive reading, the more water available", L3613–3614; over-run
 * reads inlet zero, Table 7). // PLACEHOLDER — needs Dek
 */
const RESERVE_KPA = 100;
const MARGIN_KPA = 50;

const LESSON: LessonDef = {
  ladder: 4,
  brief:
    'A house fire in the village. Usually a hydrant fills the tank; here it goes straight into ' +
    'the pump instead, feeding your suction inlet through two lengths of 65 mm. Two crews run ' +
    '38 mm rubber hose to the building. Pumping direct from a hydrant the compound ' +
    'gauge reads positive: the higher it sits, the more water the hydrant has left. Take as much ' +
    'as the crews need without over-running it.',
  objectives: [
    {
      id: 'hydrant',
      text: 'Take water from the hydrant: open the suction inlet and charge crew 1’s {line:line-1}.',
      when: {
        kind: 'all',
        of: [
          { kind: 'valve', valve: { inlet: 'suction' }, min: 0.9 },
          { kind: 'flow', line: 'line-1', min: 50 },
        ],
      },
    },
    {
      id: 'reserve',
      text: `Bring crew 1’s branch to working pressure (about {kpa:line-1}) and read the compound: hold it above ${String(RESERVE_KPA)} kPa for 20 s.`,
      when: {
        kind: 'all',
        of: [
          { kind: 'branch', line: 'line-1' },
          { kind: 'gauge', gauge: 'compound', min: RESERVE_KPA },
        ],
      },
      holdS: 20,
      after: ['hydrant'],
    },
    {
      id: 'both',
      text:
        'Charge crew 2’s {line:line-2} as well without over-running the hydrant: both branches at ' +
        `working pressure and the compound above ${String(MARGIN_KPA)} kPa, for 20 s.`,
      when: {
        kind: 'all',
        of: [
          { kind: 'branch', line: 'line-1' },
          { kind: 'branch', line: 'line-2' },
          { kind: 'gauge', gauge: 'compound', min: MARGIN_KPA },
        ],
      },
      holdS: 20,
      after: ['reserve'],
    },
    shutdownObjective(['both'], ['line-1', 'line-2']),
  ],
  failures: [...PUMP_DAMAGE],
};

export const HYDRANT_SUPPLY: Scenario = {
  id: 'hydrant-supply',
  title: 'House fire: pumping direct from the hydrant',
  setting: 'village',
  requires: { tank: false, suction: true, minDeliveries: LINES.length },
  build(spec) {
    const lines = attachLines(spec, LINES);
    const suction = inletOfKind(spec, 'suction', 'hydrant-supply');
    const [a, b] = twoLines(lines, 'hydrant-supply');
    const state = createInitialState(spec, lines, {
      engine: 'off',
      sources: [
        {
          id: 'hydrant',
          kind: 'hydrant',
          label: 'Hydrant',
          staticKpa: VILLAGE_STATIC_KPA,
          mainLossKpaPerLpm2: VILLAGE_MAIN_LOSS,
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
        ...startEngineSteps(spec),
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
    ...START_UP,
    { open: { inlet: 'suction' } },
    ...chargeLines(['line-1']),
    { throttle: 0.3 },
    { trim: { branch: 'line-1' } },
    { until: { kind: 'objective', objective: 'reserve' }, maxS: 120 },
    { ease: { line: 'line-2' }, to: 1, overS: 10 },
    { trim: { branch: 'line-1' } },
    { gate: 'line-2' },
    { until: { kind: 'objective', objective: 'both' }, maxS: 120 },
    ...shutDown(['line-1', 'line-2']),
  ],
};
