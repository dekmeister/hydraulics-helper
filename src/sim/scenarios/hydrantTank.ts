import { START_UP, shutDown, startEngineSteps } from './engineSteps';
import { STANDARD_LENGTH_M } from '../constants';
import { createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { inletOfKind } from '../appliances/controls';
import { PUMP_DAMAGE, TANK_DRY, shutdownObjective } from '../lesson/common';
import type { LessonDef } from '../lesson/types';
import { HYDRANT_MAIN_LOSS, HYDRANT_STATIC_KPA } from './hydrantSupply';
import { attachLines, twoLines, VILLAGE_LINE, type PlannedLine } from './lay';
import type { Scenario } from './types';

/**
 * Two village crews on 38 mm rubber (Table 1 15 mm tips, ~280 L/min each): less than the hydrant
 * pushes into the tank (~1000 L/min on two lengths of 65 mm), so the tank holds while both work.
 */
const LINES: readonly PlannedLine[] = [
  { id: 'line-1', ...VILLAGE_LINE },
  { id: 'line-2', ...VILLAGE_LINE },
];

/** Tank at the start, as a fraction of capacity: low after the last job. Lesson tuning. */
const START_TANK_OF_CAPACITY = 0.3;

const LESSON: LessonDef = {
  ladder: 3,
  brief:
    'A house fire in the village. Two crews run 38 mm rubber hose to the building. A hydrant is ' +
    'on your hydrant-to-tank inlet through two lengths of 65 mm, and the tank is low ' +
    'after the last job. Hydrant pressure pushes water straight into the tank; the pump still ' +
    'works off tank to pump, so the compound reads as it does on the tank. Watch the tank gauge: ' +
    'while it holds, the hydrant is keeping up with the crews.',
  objectives: [
    {
      id: 'fill',
      text: 'Open hydrant to tank: the hydrant fills the tank whether the pump is running or not.',
      when: { kind: 'valve', valve: { inlet: 'tankFill' }, min: 0.9 },
    },
    {
      id: 'attack',
      text: 'Open tank to pump and charge both crews’ {line:line-1}s.',
      when: {
        kind: 'all',
        of: [
          { kind: 'valve', valve: { inlet: 'tank' }, min: 0.9 },
          { kind: 'flow', line: 'line-1', min: 50 },
          { kind: 'flow', line: 'line-2', min: 50 },
        ],
      },
      after: ['fill'],
    },
    {
      id: 'both',
      text:
        'Hold both branches at working pressure for 30 s, hydrant to tank still open: about ' +
        '{kpa:line-1} on each {tip:line-1} branch.',
      when: {
        kind: 'all',
        of: [
          { kind: 'valve', valve: { inlet: 'tankFill' }, min: 0.9 },
          { kind: 'branch', line: 'line-1' },
          { kind: 'branch', line: 'line-2' },
        ],
      },
      holdS: 30,
      after: ['attack'],
    },
    shutdownObjective(['both'], ['line-1', 'line-2']),
  ],
  failures: [TANK_DRY, ...PUMP_DAMAGE],
};

/** Hydrant to tank (ladder step 3): the usual way to take a hydrant. */
export const HYDRANT_TANK: Scenario = {
  id: 'hydrant-tank',
  title: 'House fire: hydrant to tank',
  setting: 'village',
  requires: { tank: true, tankFill: true, minDeliveries: LINES.length },
  build(spec) {
    const lines = attachLines(spec, LINES);
    const fill = inletOfKind(spec, 'tankFill', 'hydrant-tank');
    const tankInlet = inletOfKind(spec, 'tank', 'hydrant-tank');
    const [a, b] = twoLines(lines, 'hydrant-tank');
    const initial = createInitialState(spec, lines, {
      engine: 'off',
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
          inletId: fill,
          sourceId: 'hydrant',
          segments: [
            { hose: '65L', lengthM: STANDARD_LENGTH_M },
            { hose: '65L', lengthM: STANDARD_LENGTH_M },
          ],
        },
      ],
    });
    const tankL = START_TANK_OF_CAPACITY * (spec.tank?.capacityL ?? 0);
    return {
      state: { ...initial, trucks: initial.trucks.map((t) => ({ ...t, tankL })) },
      script: [
        { tS: 0, valves: { [fill]: 1 } },
        ...startEngineSteps(spec),
        { tS: 0, valves: { [tankInlet]: 1 } },
        { tS: 2, valves: { [a.deliveryId]: 1 } },
        { tS: 5, throttle: 0.6 },
        { tS: 60, valves: { [b.deliveryId]: 1 } },
        { tS: 90, throttle: 0.8 },
        // Shut hydrant to tank: the tank level turns from rising or holding to falling.
        { tS: 200, valves: { [fill]: 0 } },
      ],
      durationS: 300,
    };
  },
  lesson: LESSON,
  solution: [
    { open: { inlet: 'tankFill' } },
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
