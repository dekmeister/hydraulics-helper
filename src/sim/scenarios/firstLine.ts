import { inletOfKind } from '../appliances/controls';
import { createInitialState } from '../engine';
import { PUMP_DAMAGE, TANK_DRY } from '../lesson/common';
import type { LessonDef, ValveRef } from '../lesson/types';
import { attachLines, type PlannedLine } from './lay';
import type { Scenario } from './types';

/** Three lengths of 38 mm with a 15 mm tip: 350 kPa at the branch (Table 1), ~700 at the pump. */
const LINE: PlannedLine = { id: 'line-38', hose: '38L', lengths: 3, tipMm: 15 };
const ON_LINE: ValveRef = { line: LINE.id };
const TANK: ValveRef = { inlet: 'tank' };

const LESSON: LessonDef = {
  ladder: 1,
  brief:
    'One crew has run out three lengths of 38 mm hose with a 15 mm branch. Get them water from ' +
    'the tank at the right pressure, then shut down cleanly. The coach walks you through it.',
  objectives: [
    {
      id: 'water',
      text: 'Get water to the crew: charge the 38 mm line.',
      when: { kind: 'flow', line: LINE.id, min: 50 },
    },
    {
      id: 'pressure',
      text: 'Hold the branch at working pressure (about 350 kPa) for 20 s.',
      when: { kind: 'branch', line: LINE.id },
      holdS: 20,
      after: ['water'],
    },
    {
      id: 'shutdown',
      text: 'Shut down: throttle back to idle, then ease the delivery shut.',
      when: {
        kind: 'all',
        of: [
          { kind: 'throttle', max: 0.02 },
          { kind: 'valve', valve: ON_LINE, max: 0 },
        ],
      },
      after: ['pressure'],
    },
  ],
  failures: [TANK_DRY, ...PUMP_DAMAGE],
  coach: [
    {
      id: 'welcome',
      text:
        'This is your pump panel. A crew is waiting on the end of three lengths of 38 mm hose. ' +
        'You’ll open the tank to the pump, open their delivery, then bring the pressure up.',
    },
    {
      id: 'tank',
      text: 'Water comes from the truck’s tank first. Open {target}: {gesture}.',
      target: { valve: TANK },
      done: { kind: 'valve', valve: TANK, min: 0.9 },
    },
    {
      id: 'delivery',
      text: 'Now open {target}, the delivery the crew’s hose is on: {gesture}.',
      target: { valve: ON_LINE },
      done: { kind: 'valve', valve: ON_LINE, min: 0.9 },
    },
    {
      id: 'throttle',
      text: 'Bring the throttle up and watch the discharge gauge climb. Aim for about 700 kPa.',
      target: { throttle: true },
      done: { kind: 'gauge', gauge: 'discharge', min: 600 },
    },
    {
      id: 'friction',
      text:
        'The discharge gauge shows pressure at the pump, not at the branch. Three lengths of ' +
        '38 mm lose about 350 kPa to friction at this flow, so 700 at the pump is about 350 at ' +
        'the branch: what a 15 mm tip wants.',
      target: { gauge: 'discharge' },
    },
    {
      id: 'lamps',
      text:
        'These lamps warn you about the tank, the supply, the relief valve, pump temperature, ' +
        'cavitation and water hammer. All dark is good.',
      target: { lamps: true },
    },
    {
      id: 'hold',
      text:
        'Hold the branch at working pressure for 20 s. The objective shows the branch pressure ' +
        'against its target: trim with {gesture}.',
      target: { throttle: true },
      done: { kind: 'objective', objective: 'pressure' },
    },
    {
      id: 'shutdown',
      text:
        'Good work. Shut down as you would at the end of a job: throttle to idle first, then ease ' +
        'the delivery shut. Slamming a valve sends a water hammer surge down the hose.',
      target: { throttle: true },
      done: { kind: 'objective', objective: 'shutdown' },
    },
  ],
};

/** Ladder step 1, fully guided: one 38 mm line on tank (ARCHITECTURE §5). */
export const FIRST_LINE: Scenario = {
  id: 'first-line',
  title: 'First line: one 38 mm line from the tank',
  requires: { tank: true, minDeliveries: 1 },
  build(spec) {
    const lines = attachLines(spec, [LINE]);
    const tankInlet = inletOfKind(spec, 'tank', 'first-line');
    const delivery = lines[0]?.deliveryId ?? '';
    return {
      state: createInitialState(spec, lines),
      script: [
        { tS: 0, valves: { [tankInlet]: 1 } },
        { tS: 2, valves: { [delivery]: 1 } },
        { tS: 5, throttle: 0.6 },
        { tS: 40, throttle: 0 },
        ...[0.75, 0.5, 0.25, 0].map((open, i) => ({ tS: 45 + i, valves: { [delivery]: open } })),
      ],
      durationS: 60,
    };
  },
  lesson: LESSON,
  solution: [
    { open: TANK },
    { open: ON_LINE },
    { throttle: 0.5 },
    { trim: { branch: LINE.id } },
    { until: { kind: 'objective', objective: 'pressure' }, maxS: 120 },
    { trim: null },
    { throttle: 0 },
    { wait: 3 },
    { ease: ON_LINE, to: 0, overS: 5 },
    { wait: 1 },
  ],
};
