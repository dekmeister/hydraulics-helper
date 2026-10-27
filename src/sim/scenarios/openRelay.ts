import { START_UP, chargeLines, shutDown, startEngineSteps } from './engineSteps';
import { inletOfKind, primerControlId } from '../appliances/controls';
import { createSiteState } from '../engine';
import { HYDRANT_MAIN_LOSS, HYDRANT_STATIC_KPA } from './hydrantSupply';
import { PUMP_DAMAGE, shutdownObjective } from '../lesson/common';
import type { LessonDef } from '../lesson/types';
import { attachLines, BUSH_LINE, twoLines, type PlannedLine } from './lay';
import { ATTACK_ID, BASE_ID, baseRelay, lengths } from './relayTrucks';
import { supportSpec, type Scenario, type ScriptStep, type SupportRole } from './types';

/** The attack pump's two bush lines. */
const LINES: readonly PlannedLine[] = [
  { id: 'line-1', ...BUSH_LINE },
  { id: 'line-2', ...BUSH_LINE },
];

/**
 * Portable dam beside the attack pump: holds 5000 L, starts with 2000 L, water 1 m below the pump
 * inlet. // PLACEHOLDER — needs Dek (what a Cat 1 carries, how it's pitched)
 */
const PORTABLE_DAM_L = 5000;
const PORTABLE_DAM_START_L = 2000;
const PORTABLE_DAM_LIFT_M = 1;

/** Relay from the hydrant to the dam: 4 lengths of 65 mm, 10 m up. */
const RELAY_LENGTHS = 4;
const RELAY_UPHILL_M = 10;

/**
 * Throttle the base pump's operator holds, pumping from its tank while the hydrant keeps the tank
 * topped up through hydrant to tank: on a Cat 1 the dam fills at ~650 L/min, more than one line
 * draws and less than two at full throttle, and well within the ~1000 L/min the hydrant puts
 * back. // PLACEHOLDER — needs Dek
 */
const BASE_THROTTLE = 0.45;

const BASE: SupportRole = {
  id: BASE_ID,
  label: 'Base pump',
  requires: { tank: true, tankFill: true, minDeliveries: 1 },
};

const LESSON: LessonDef = {
  ladder: 7,
  brief:
    'The base pump at the hydrant fills a portable dam beside you; you draught from it. The pumps ' +
    'aren’t coupled: what you can use is what’s in the dam, so watch the dam level as well as ' +
    'your gauges.',
  objectives: [
    {
      id: 'prime',
      text: 'Prime from the portable dam: suction inlet open, deliveries shut, primer on until it catches.',
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
      text: 'Hold both branches at working pressure for 60 s without running the dam dry.',
      when: {
        kind: 'all',
        of: [
          { kind: 'branch', line: 'line-1' },
          { kind: 'branch', line: 'line-2' },
        ],
      },
      holdS: 60,
      after: ['water'],
    },
    shutdownObjective(['hold'], ['line-1', 'line-2']),
  ],
  failures: [
    {
      id: 'dam-dry',
      text: 'The portable dam ran dry and the pump lost its prime.',
      when: { kind: 'source', source: 'portable-dam', max: 0 },
    },
    ...PUMP_DAMAGE,
  ],
};

/**
 * Open relay via a portable dam (ARCHITECTURE §5 ladder step 7): a base pump at the hydrant, its
 * tank topped up through hydrant to tank, fills a portable dam beside the attack pump, which
 * primes and draughts from it. The pumps are decoupled:
 * the lesson is the dam level, filled at one rate and drawn at another.
 */
export const OPEN_RELAY: Scenario = {
  id: 'open-relay',
  title: 'Open relay: draught from a portable dam the base pump fills',
  setting: 'bush',
  requires: { tank: false, suction: true, primer: true, minDeliveries: LINES.length },
  support: [BASE],
  build(spec, support) {
    const base = supportSpec(BASE, spec, support);
    const inlet = inletOfKind(spec, 'suction', 'open-relay');
    const lines = attachLines(spec, LINES, ATTACK_ID);
    const [a, b] = twoLines(lines, 'open-relay');
    const relay = baseRelay(base, '65L', RELAY_LENGTHS, RELAY_UPHILL_M, {
      kind: 'dam',
      sourceId: 'portable-dam',
    });
    const baseFill = inletOfKind(base, 'tankFill', 'open-relay base');
    const baseTank = inletOfKind(base, 'tank', 'open-relay base');
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
    const state = createSiteState(
      [
        { id: ATTACK_ID, label: 'Attack pump', spec, engine: 'off' },
        {
          id: BASE_ID,
          label: BASE.label,
          spec: base,
          inputs: {
            throttle: BASE_THROTTLE,
            valves: { [baseFill]: 1, [baseTank]: 1, [relay.deliveryId]: 1 },
            // Its crew started it: the engine is running with the ignition on.
            switches: { [base.engine.controls.ignition]: true },
          },
        },
      ],
      lines,
      {
        sources: [
          {
            id: 'hydrant',
            kind: 'hydrant',
            label: 'Hydrant',
            staticKpa: HYDRANT_STATIC_KPA,
            mainLossKpaPerLpm2: HYDRANT_MAIN_LOSS,
          },
          {
            id: 'portable-dam',
            kind: 'static',
            label: 'Portable dam',
            liftM: PORTABLE_DAM_LIFT_M,
            volumeL: PORTABLE_DAM_START_L,
            capacityL: PORTABLE_DAM_L,
          },
        ],
        supplies: [
          {
            id: 'base-hydrant-line',
            truckId: BASE_ID,
            inletId: baseFill,
            sourceId: 'hydrant',
            segments: lengths('65L', 2),
          },
          {
            id: 'attack-suction',
            truckId: ATTACK_ID,
            inletId: inlet,
            sourceId: 'portable-dam',
            // One 3 m length of hard suction over the dam wall. // PLACEHOLDER — needs Dek
            segments: [{ hose: '65H', lengthM: 3 }],
          },
        ],
        links: [relay],
      },
    );
    return {
      state,
      script: [
        ...startEngineSteps(spec),
        { tS: 0, valves: { [inlet]: 1 } },
        ...prime(true),
        ...prime(false),
        { tS: 22, valves: { [a.deliveryId]: 1 } },
        { tS: 25, throttle: 0.6 },
        { tS: 60, valves: { [b.deliveryId]: 1 } },
        { tS: 90, throttle: 1 },
        { tS: 150, throttle: 0.5 },
      ],
      durationS: 300,
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
