import { inletOfKind, primerControlId } from '../appliances/controls';
import { createSiteState } from '../engine';
import { HYDRANT_MAIN_LOSS, HYDRANT_STATIC_KPA } from './hydrantSupply';
import { PUMP_DAMAGE } from '../lesson/common';
import type { LessonDef } from '../lesson/types';
import { attachLines, twoLines, type PlannedLine } from './lay';
import { ATTACK_ID, BASE_ID, baseRelay, lengths } from './relayTrucks';
import { supportSpec, type Scenario, type ScriptStep, type SupportRole } from './types';

/** The attack pump's two lines: the tank-attack pair (Table 1 tips). */
const LINES: readonly PlannedLine[] = [
  { id: 'line-65', hose: '65L', lengths: 3, tipMm: 20 },
  { id: 'line-38', hose: '38L', lengths: 3, tipMm: 15 },
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
 * Throttle the base pump's operator holds: the hydrant does most of the work, so the dam fills at
 * ~650 L/min, more than one line draws and less than two at full throttle. // PLACEHOLDER — needs Dek
 */
const BASE_THROTTLE = 0.2;

const BASE: SupportRole = {
  id: BASE_ID,
  label: 'Base pump',
  requires: { tank: false, suction: true, minDeliveries: 1 },
};

const LESSON: LessonDef = {
  ladder: 6,
  brief:
    'The base pump on the hydrant fills a portable dam beside you; you draught from it. The pumps ' +
    'aren’t coupled: what you can use is what’s in the dam. Two lines draw more than the relay ' +
    'brings, so watch the dam level as well as your gauges.',
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
          { kind: 'flow', line: 'line-65', min: 50 },
          { kind: 'flow', line: 'line-38', min: 50 },
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
          { kind: 'branch', line: 'line-65' },
          { kind: 'branch', line: 'line-38' },
        ],
      },
      holdS: 60,
      after: ['water'],
    },
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
 * Open relay via a portable dam (ARCHITECTURE §5 ladder step 6): a base pump on the hydrant fills a
 * portable dam beside the attack pump, which primes and draughts from it. The pumps are decoupled:
 * the lesson is the dam level, filled at one rate and drawn at another.
 */
export const OPEN_RELAY: Scenario = {
  id: 'open-relay',
  title: 'Open relay: draught from a portable dam the base pump fills',
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
    const baseSuction = inletOfKind(base, 'suction', 'open-relay base');
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
        { id: ATTACK_ID, label: 'Attack pump', spec },
        {
          id: BASE_ID,
          label: BASE.label,
          spec: base,
          inputs: {
            throttle: BASE_THROTTLE,
            valves: { [baseSuction]: 1, [relay.deliveryId]: 1 },
            switches: {},
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
            inletId: baseSuction,
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
    { open: { inlet: 'suction' } },
    { primer: true },
    { until: { kind: 'primed' }, maxS: 90 },
    { primer: false },
    { open: { line: 'line-65' } },
    { open: { line: 'line-38' } },
    { throttle: 0.6 },
    { trim: { branch: 'line-38' } },
    { gate: 'line-65' },
    { until: { kind: 'objective', objective: 'hold' }, maxS: 180 },
  ],
};
