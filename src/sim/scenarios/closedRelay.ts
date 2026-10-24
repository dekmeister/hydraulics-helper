import { inletOfKind } from '../appliances/controls';
import { createSiteState } from '../engine';
import { attachLines, twoLines, type PlannedLine } from './lay';
import { ATTACK_ID, BASE_ID, baseRelay } from './relayTrucks';
import { supportSpec, type Scenario, type SupportRole } from './types';

/** The attack pump's two lines: the tank-attack pair (Table 1 tips). */
const LINES: readonly PlannedLine[] = [
  { id: 'line-65', hose: '65L', lengths: 3, tipMm: 20 },
  { id: 'line-38', hose: '38L', lengths: 3, tipMm: 15 },
];

/** C12 (L3813–3820): 20 m up, 4 lengths of 65 mm between the pumps. */
const RELAY_UPHILL_M = 20;
const RELAY_LENGTHS = 4;

/** The base pump draws from the farm dam on 2 × 3 m of hard suction. // PLACEHOLDER — needs Dek */
const DAM_LIFT_M = 2;
const DAM_L = 200_000;

/**
 * Throttle the base pump's operator holds: about 700 kPa at its delivery once the attack pump
 * draws both lines (the manual's relay delivery pressure). Fixed settings until support trucks
 * have AI. // PLACEHOLDER — needs Dek
 */
const BASE_THROTTLE = 0.8;

const BASE: SupportRole = {
  id: BASE_ID,
  label: 'Base pump',
  requires: { tank: false, suction: true, minDeliveries: 1 },
};

/**
 * Closed relay uphill (ARCHITECTURE §5 ladder step 5): a base pump already primed at the dam
 * pushes water 20 m up 4 lengths of 65 mm into the attack pump's suction inlet. The player opens
 * the relay inlet and two lines, keeps the compound above 100 kPa residual, over-runs the relay at
 * full throttle (inlet zero, hose soft) and recovers.
 */
export const CLOSED_RELAY: Scenario = {
  id: 'closed-relay',
  title: 'Closed relay: the base pump pushes water 20 m uphill to you',
  requires: { tank: false, suction: true, minDeliveries: LINES.length },
  support: [BASE],
  build(spec, support) {
    const base = supportSpec(BASE, spec, support);
    const inlet = inletOfKind(spec, 'suction', 'closed-relay');
    const lines = attachLines(spec, LINES, ATTACK_ID);
    const [a, b] = twoLines(lines, 'closed-relay');
    const relay = baseRelay(base, '65L', RELAY_LENGTHS, RELAY_UPHILL_M, {
      kind: 'inlet',
      truckId: ATTACK_ID,
      inletId: inlet,
    });
    const baseSuction = inletOfKind(base, 'suction', 'closed-relay base');
    const state = createSiteState(
      [
        { id: ATTACK_ID, label: 'Attack pump', spec },
        {
          id: BASE_ID,
          label: BASE.label,
          spec: base,
          primed: true,
          inputs: {
            throttle: BASE_THROTTLE,
            valves: { [baseSuction]: 1, [relay.deliveryId]: 1 },
            switches: {},
          },
        },
      ],
      lines,
      {
        sources: [{ id: 'dam', kind: 'static', label: 'Dam', liftM: DAM_LIFT_M, volumeL: DAM_L }],
        supplies: [
          {
            id: 'base-suction',
            truckId: BASE_ID,
            inletId: baseSuction,
            sourceId: 'dam',
            segments: [
              { hose: '65H', lengthM: 3 },
              { hose: '65H', lengthM: 3 },
            ],
          },
        ],
        links: [relay],
      },
    );
    return {
      state,
      script: [
        { tS: 0, valves: { [inlet]: 1 } },
        { tS: 2, valves: { [a.deliveryId]: 1 } },
        { tS: 5, throttle: 0.4 },
        { tS: 40, valves: { [b.deliveryId]: 1 } },
        { tS: 60, throttle: 0.6 },
        { tS: 90, throttle: 1 },
        { tS: 120, throttle: 0.6 },
      ],
      durationS: 180,
    };
  },
};
