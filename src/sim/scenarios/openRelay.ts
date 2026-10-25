import { inletOfKind, primerControlId } from '../appliances/controls';
import { createSiteState } from '../engine';
import { HYDRANT_MAIN_LOSS, HYDRANT_STATIC_KPA } from './hydrantSupply';
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
    const prime = (on: boolean): ScriptStep[] =>
      primerId === undefined ? [] : [{ tS: on ? 1 : 20, switches: { [primerId]: on } }];
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
};
