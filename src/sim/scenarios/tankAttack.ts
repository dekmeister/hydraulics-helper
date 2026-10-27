import { START_UP, shutDown, startEngineSteps } from './engineSteps';
import { createInitialState } from '../engine';
import { inletOfKind } from '../appliances/controls';
import { PUMP_DAMAGE, TANK_DRY, shutdownObjective } from '../lesson/common';
import type { LessonDef } from '../lesson/types';
import { attachLines, BUSH_LINE, twoLines, type PlannedLine } from './lay';
import type { Scenario } from './types';

/** Crew 2's branch below the pump, m. // PLACEHOLDER — needs Dek (a typical bush slope) */
const DOWNHILL_M = -10;

/**
 * Two bush lines, the second crew working downhill: it wants ~100 kPa less at the pump, so the
 * pump is set for the first and the second gated back, and the pump droops when it opens.
 */
const LINES: readonly PlannedLine[] = [
  { id: 'line-1', ...BUSH_LINE },
  { id: 'line-2', ...BUSH_LINE, elevationM: DOWNHILL_M },
];

const LESSON: LessonDef = {
  ladder: 2,
  brief:
    'Two bush crews on the tank, each on a {line:line-1} with a {tip:line-1} branch. Crew 2 ' +
    'is working 10 m down the slope, so its branch gains pressure from the fall. One pump ' +
    'pressure serves both: set the pump for crew 1 and gate crew 2 back until both branches ' +
    'are right.',
  objectives: [
    {
      id: 'first',
      text: 'Charge crew 1’s {line:line-1}.',
      when: { kind: 'flow', line: 'line-1', min: 50 },
    },
    {
      id: 'second',
      text: 'Charge crew 2’s {line:line-2} as well.',
      when: { kind: 'flow', line: 'line-2', min: 50 },
    },
    {
      id: 'both',
      text:
        'Hold both branches at working pressure together for 30 s: about {kpa:line-1} on each. ' +
        'Gate back the delivery that runs high.',
      when: {
        kind: 'all',
        of: [
          { kind: 'branch', line: 'line-1' },
          { kind: 'branch', line: 'line-2' },
        ],
      },
      holdS: 30,
      after: ['first', 'second'],
    },
    shutdownObjective(['both'], ['line-1', 'line-2']),
  ],
  failures: [TANK_DRY, ...PUMP_DAMAGE],
};

export const TANK_ATTACK: Scenario = {
  id: 'tank-attack',
  title: 'Tank attack: two lines on the tank',
  setting: 'bush',
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
        { tS: 5, throttle: 0.75 },
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
    { open: { line: 'line-1' } },
    { open: { line: 'line-2' } },
    { throttle: 0.7 },
    { trim: { branch: 'line-1' } },
    { gate: 'line-2' },
    { until: { kind: 'objective', objective: 'both' }, maxS: 150 },
    ...shutDown(['line-1', 'line-2']),
  ],
};
