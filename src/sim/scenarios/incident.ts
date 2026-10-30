import { START_UP, shutDown } from './engineSteps';
import { STANDARD_LENGTH_M } from '../constants';
import { createInitialState } from '../engine';
import { PUMP_DAMAGE, TANK_DRY, shutdownObjective } from '../lesson/common';
import type { LessonDef, LineDef } from '../lesson/types';
import { HYDRANT_MAIN_LOSS, HYDRANT_STATIC_KPA } from './hydrantSupply';
import { attachLines, BUSH_LINE, VILLAGE_LINE, type PlannedLine } from './lay';
import type { Scenario } from './types';

/**
 * Crew 1 protects the houses on 38 mm rubber; moved up the slope with a fourth length it wants
 * ~930 kPa at the pump. (25 mm canvas couldn't take the extra length: two lengths lose ~1400 kPa.)
 */
const FIRST: PlannedLine = { id: 'line-1', ...VILLAGE_LINE };
/** Crew 2 runs 25 mm canvas onto spot fires in the yards once the fire spreads. */
const SECOND: LineDef = { id: 'line-2', ...BUSH_LINE };
/** Crew 1 moves up the slope with another length. // PLACEHOLDER — needs Dek (a typical advance) */
const UPHILL_M = 10;

const LESSON: LessonDef = {
  ladder: 8,
  brief:
    'A bush fire reaching the edge of town. Crew 1 protects the houses on a {line:line-1}, then ' +
    'moves up the slope behind them; a second crew runs {hose:line-2} canvas onto spot fires in ' +
    'the yards; and ' +
    'when the street hydrant is connected you open it into the tank before the tank runs dry. ' +
    'Listen to the radio and keep both crews in water.',
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
        'Open hydrant to tank before the tank runs dry; leave tank to pump open. Keep both crews ' +
        'in water for 20 s.',
      when: {
        kind: 'all',
        of: [
          { kind: 'since', event: 'hydrant', s: 1 },
          { kind: 'valve', valve: { inlet: 'tankFill' }, min: 0.9 },
          { kind: 'flow', line: FIRST.id, min: 50 },
          { kind: 'flow', line: SECOND.id, min: 50 },
        ],
      },
      holdS: 20,
      after: ['second'],
    },
    shutdownObjective(['changeover'], [FIRST.id, SECOND.id]),
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
            inlet: 'tankFill',
            segments: [
              { hose: '65L', lengthM: STANDARD_LENGTH_M },
              { hose: '65L', lengthM: STANDARD_LENGTH_M },
            ],
          },
        },
      ],
      radio: {
        from: 'OIC',
        text: 'Hydrant’s connected to your hydrant-to-tank inlet. Open it before the tank runs dry.',
      },
    },
  ],
};

/** Ladder step 8: a full incident driven by events. */
export const INCIDENT: Scenario = {
  id: 'incident',
  title: 'Interface fire: crews move, a line goes in, a hydrant tops up the tank',
  setting: 'interface',
  requires: { tank: true, tankFill: true, minDeliveries: 2 },
  build(spec) {
    const lines = attachLines(spec, [FIRST]);
    return {
      state: createInitialState(spec, lines, { engine: 'off' }),
      // Traced from the solution: its events wait on the player reaching objectives.
      script: [],
      durationS: 0,
    };
  },
  lesson: LESSON,
  solution: [
    ...START_UP,
    { open: { inlet: 'tank' } },
    { open: { line: FIRST.id } },
    { throttle: 0.5 },
    { trim: { branch: FIRST.id } },
    { until: { kind: 'objective', objective: 'uphill' }, maxS: 150 },
    { wait: 2 },
    // Ease the second line on: an empty hose takes all the pump gives and the uphill line would stop.
    { ease: { line: SECOND.id }, to: 1, overS: 15 },
    { gate: SECOND.id },
    { until: { kind: 'objective', objective: 'second' }, maxS: 120 },
    { wait: 2 },
    { open: { inlet: 'tankFill' } },
    { until: { kind: 'objective', objective: 'changeover' }, maxS: 90 },
    ...shutDown([FIRST.id, SECOND.id]),
  ],
};
