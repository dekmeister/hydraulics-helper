import { START_UP, shutDown, startEngineSteps } from './engineSteps';
import { createInitialState } from '../engine';
import { inletOfKind } from '../appliances/controls';
import { PUMP_DAMAGE, TANK_DRY, shutdownObjective } from '../lesson/common';
import type { LessonDef } from '../lesson/types';
import { attachLines, LIGHT_LINE, twoLines, type PlannedLine } from './lay';
import type { Scenario } from './types';

/**
 * The 38 mm line first, then a 65 mm line: the friction contrast and the pump-droop sag when the
 * second line opens. Tips from Table 1: 15 mm (350 kPa, ~280 L/min) and 20 mm (500 kPa, ~600 L/min).
 * A truck with no 65 mm outlet gets the light line instead (`LIGHT_LINE`): the sag and gating stay.
 */
const LINES: readonly PlannedLine[] = [
  { id: 'line-38', hose: '38L', lengths: 3, tipMm: 15 },
  { id: 'line-65', hose: '65L', lengths: 3, tipMm: 20, light: LIGHT_LINE },
];

const LESSON: LessonDef = {
  ladder: 2,
  brief:
    'Two crews on the tank: a {line:line-38} with a {tip:line-38} branch and a {line:line-65} ' +
    'with a {tip:line-65} branch. One pump pressure serves both, but they need different ' +
    'pressures at the pump. Set the pump for the harder line and gate the other back until both ' +
    'branches are right.',
  objectives: [
    {
      id: 'first',
      text: 'Charge the {line:line-38}.',
      when: { kind: 'flow', line: 'line-38', min: 50 },
    },
    {
      id: 'second',
      text: 'Charge the {line:line-65} as well.',
      when: { kind: 'flow', line: 'line-65', min: 50 },
    },
    {
      id: 'both',
      text:
        'Hold both branches at working pressure together for 30 s: about {kpa:line-38} on the ' +
        '{tip:line-38} branch, {kpa:line-65} on the {tip:line-65}. Gate back a delivery that runs ' +
        'high.',
      when: {
        kind: 'all',
        of: [
          { kind: 'branch', line: 'line-38' },
          { kind: 'branch', line: 'line-65' },
        ],
      },
      holdS: 30,
      after: ['first', 'second'],
    },
    shutdownObjective(['both'], ['line-38', 'line-65']),
  ],
  failures: [TANK_DRY, ...PUMP_DAMAGE],
};

export const TANK_ATTACK: Scenario = {
  id: 'tank-attack',
  title: 'Tank attack: two lines on the tank',
  requires: { tank: true, minDeliveries: LINES.length },
  build(spec) {
    const lines = attachLines(spec, LINES);
    const tankInlet = inletOfKind(spec, 'tank', 'tank-attack');
    const [a, b] = twoLines(lines, 'tank-attack');
    return {
      state: createInitialState(spec, lines, { engine: 'off' }),
      script: [
        ...startEngineSteps(spec),
        { tS: 0, valves: { [tankInlet]: 1 } },
        { tS: 2, valves: { [a.deliveryId]: 1 } },
        { tS: 5, throttle: 0.6 },
        { tS: 60, valves: { [b.deliveryId]: 1 } },
        { tS: 90, throttle: 0.8 },
      ],
      durationS: 300,
    };
  },
  lesson: LESSON,
  solution: [
    ...START_UP,
    { open: { inlet: 'tank' } },
    { open: { line: 'line-38' } },
    { open: { line: 'line-65' } },
    { throttle: 0.7 },
    { trim: { branch: 'line-38' } },
    { gate: 'line-65' },
    { until: { kind: 'objective', objective: 'both' }, maxS: 150 },
    ...shutDown(['line-38', 'line-65']),
  ],
};
