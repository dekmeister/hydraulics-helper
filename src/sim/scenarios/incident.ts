import { STANDARD_LENGTH_M } from '../constants';
import { createInitialState } from '../engine';
import { PUMP_DAMAGE, TANK_DRY } from '../lesson/common';
import type { LessonDef, LineDef } from '../lesson/types';
import { HYDRANT_MAIN_LOSS, HYDRANT_STATIC_KPA } from './hydrantSupply';
import { attachLines, LIGHT_LINE, type PlannedLine } from './lay';
import type { Scenario } from './types';

/** Crew 1: the first-line lay (Table 1 15 mm tip). */
const FIRST: PlannedLine = { id: 'line-1', hose: '38L', lengths: 3, tipMm: 15 };
/** Crew 2 runs out 65 mm with a 20 mm tip once the fire spreads (the light line on a light truck). */
const SECOND: LineDef = { id: 'line-2', hose: '65L', lengths: 3, tipMm: 20, light: LIGHT_LINE };
/** Crew 1 moves up the slope with another length. // PLACEHOLDER — needs Dek (a typical advance) */
const UPHILL_M = 10;

const LESSON: LessonDef = {
  ladder: 7,
  brief:
    'A full incident on the tank. Crew 1 starts on a 38 mm line, then moves up the slope; a ' +
    'second crew runs out {hose:line-2}; and when a hydrant is connected you change over before the tank ' +
    'runs dry. Listen to the radio and keep both crews in water.',
  objectives: [
    {
      id: 'attack',
      text: 'Get water to crew 1 and hold their branch at working pressure for 20 s.',
      when: { kind: 'branch', line: FIRST.id },
      holdS: 20,
    },
    {
      id: 'uphill',
      text: `Crew 1 has moved ${String(UPHILL_M)} m up the slope with another length: bring their branch back to working pressure for 20 s.`,
      when: {
        kind: 'all',
        of: [
          { kind: 'since', event: 'advance', s: 1 },
          { kind: 'branch', line: FIRST.id },
        ],
      },
      holdS: 20,
      after: ['attack'],
    },
    {
      id: 'second',
      text: 'Charge crew 2’s {line:line-2} and hold both branches at working pressure for 20 s.',
      when: {
        kind: 'all',
        of: [
          { kind: 'since', event: 'second-line', s: 1 },
          { kind: 'branch', line: FIRST.id },
          { kind: 'branch', line: SECOND.id },
        ],
      },
      holdS: 20,
      after: ['uphill'],
    },
    {
      id: 'changeover',
      text:
        'Change over to the hydrant before the tank runs dry: open the suction inlet, then shut ' +
        'tank-to-pump. Keep both crews in water for 20 s.',
      when: {
        kind: 'all',
        of: [
          { kind: 'since', event: 'hydrant', s: 1 },
          { kind: 'valve', valve: { inlet: 'suction' }, min: 0.9 },
          { kind: 'valve', valve: { inlet: 'tank' }, max: 0 },
          { kind: 'flow', line: FIRST.id, min: 50 },
          { kind: 'flow', line: SECOND.id, min: 50 },
        ],
      },
      holdS: 20,
      after: ['second'],
    },
  ],
  failures: [
    { ...TANK_DRY, text: 'The tank ran dry before the changeover: both crews lost water.' },
    ...PUMP_DAMAGE,
  ],
  events: [
    {
      id: 'advance',
      when: { kind: 'objective', objective: 'attack' },
      effects: [{ kind: 'moveBranch', line: FIRST.id, addLengths: 1, elevationM: UPHILL_M }],
      radio: {
        from: 'Branch 1',
        text: 'Moving up the slope after a spot fire. We need more pressure up here.',
      },
    },
    {
      id: 'second-line',
      when: { kind: 'objective', objective: 'uphill' },
      effects: [{ kind: 'layLine', line: SECOND }],
      radio: {
        from: 'OIC',
        text: 'Second crew has run out {hose:line-2}. Charge it, and keep crew 1 going.',
      },
    },
    {
      id: 'hydrant',
      when: { kind: 'objective', objective: 'second' },
      effects: [
        {
          kind: 'connectSupply',
          source: {
            id: 'hydrant',
            kind: 'hydrant',
            label: 'Hydrant',
            staticKpa: HYDRANT_STATIC_KPA,
            mainLossKpaPerLpm2: HYDRANT_MAIN_LOSS,
          },
          supply: {
            id: 'hydrant-line',
            sourceId: 'hydrant',
            segments: [
              { hose: '65L', lengthM: STANDARD_LENGTH_M },
              { hose: '65L', lengthM: STANDARD_LENGTH_M },
            ],
          },
        },
      ],
      radio: {
        from: 'OIC',
        text: 'Hydrant’s connected to your suction inlet. Change over before the tank runs dry.',
      },
    },
  ],
};

/** Ladder step 7: a full incident driven by events (ARCHITECTURE §5). */
export const INCIDENT: Scenario = {
  id: 'incident',
  title: 'Full incident: crews move, a line goes in, change over to a hydrant',
  requires: { tank: true, suction: true, minDeliveries: 2 },
  build(spec) {
    const lines = attachLines(spec, [FIRST]);
    return {
      state: createInitialState(spec, lines),
      // Traced from the solution: its events wait on the player reaching objectives.
      script: [],
      durationS: 0,
    };
  },
  lesson: LESSON,
  solution: [
    { open: { inlet: 'tank' } },
    { open: { line: FIRST.id } },
    { throttle: 0.5 },
    { trim: { branch: FIRST.id } },
    { until: { kind: 'objective', objective: 'uphill' }, maxS: 150 },
    { wait: 2 },
    { open: { line: SECOND.id } },
    { gate: SECOND.id },
    { until: { kind: 'objective', objective: 'second' }, maxS: 120 },
    { wait: 2 },
    { open: { inlet: 'suction' } },
    { wait: 2 },
    { ease: { inlet: 'tank' }, to: 0, overS: 3 },
    { until: { kind: 'objective', objective: 'changeover' }, maxS: 90 },
  ],
};
