import { START_UP, chargeLines, shutDown, startEngineSteps } from './engineSteps';
import { inletOfKind } from '../appliances/controls';
import { createSiteState } from '../engine';
import { RELAY_MIN_RESIDUAL_KPA } from '../constants';
import { PUMP_DAMAGE, shutdownObjective } from '../lesson/common';
import type { LessonDef } from '../lesson/types';
import { attachLines, LIGHT_LINE, twoLines, type PlannedLine } from './lay';
import { ATTACK_ID, BASE_ID, baseRelay } from './relayTrucks';
import { supportSpec, type Scenario, type SupportRole } from './types';

/** The attack pump's two lines: the tank-attack pair (Table 1 tips). */
const LINES: readonly PlannedLine[] = [
  { id: 'line-65', hose: '65L', lengths: 3, tipMm: 20, light: LIGHT_LINE },
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

/**
 * Throttle the base pump's operator raises to once the attack pump has both lines on (the fill
 * sequence, L3850–3853: lower pressure until every pump has water, then working pressure): about
 * 800 kPa at its delivery with both lines drawn, enough for the climb and the extra flow.
 * // PLACEHOLDER — needs Dek
 */
const BASE_THROTTLE_RAISED = 0.9;

const BASE: SupportRole = {
  id: BASE_ID,
  label: 'Base pump',
  requires: { tank: false, suction: true, minDeliveries: 1 },
};

/** Seconds the crew takes to replace a burst relay length. // PLACEHOLDER — needs Dek */
const REPAIR_S = 30;

const RESIDUAL = { kind: 'gauge', gauge: 'compound', min: RELAY_MIN_RESIDUAL_KPA } as const;

const LESSON: LessonDef = {
  ladder: 5,
  brief:
    'A base pump at the farm dam pushes water 20 m up four lengths of 65 mm into your suction ' +
    'inlet. In a closed relay your compound shows the pressure left at the end of the relay hose: ' +
    `keep it above ${String(RELAY_MIN_RESIDUAL_KPA)} kPa. Over-run the relay and the hose goes ` +
    'soft; slam the inlet shut and the surge can burst a length.',
  objectives: [
    {
      id: 'relay',
      text: 'Open the suction inlet to take the base pump’s water: the compound shows the relay’s residual pressure.',
      when: {
        kind: 'all',
        of: [{ kind: 'valve', valve: { inlet: 'suction' }, min: 0.9 }, RESIDUAL],
      },
    },
    {
      id: 'hold',
      text: `Hold both branches at working pressure with at least ${String(RELAY_MIN_RESIDUAL_KPA)} kPa residual on the compound, for 30 s.`,
      when: {
        kind: 'all',
        of: [{ kind: 'branch', line: 'line-65' }, { kind: 'branch', line: 'line-38' }, RESIDUAL],
      },
      holdS: 30,
      after: ['relay'],
    },
    shutdownObjective(['hold'], ['line-65', 'line-38']),
  ],
  failures: [...PUMP_DAMAGE],
  events: [
    {
      id: 'pressure-up',
      when: {
        kind: 'all',
        of: [
          { kind: 'objective', objective: 'relay' },
          { kind: 'flow', line: 'line-65', min: 50 },
          { kind: 'flow', line: 'line-38', min: 50 },
        ],
      },
      effects: [{ kind: 'holdSettings', truck: BASE_ID, throttle: BASE_THROTTLE_RAISED }],
      radio: {
        from: 'Base pump',
        text: 'Both your lines are on. Bringing my pressure up to cover the climb.',
      },
    },
    {
      id: 'burst',
      when: { kind: 'burst', link: 'relay' },
      radio: {
        from: 'Base pump',
        text: 'Burst length on the relay! Shut your lines down; we’re replacing it.',
      },
    },
    {
      id: 'repaired',
      when: { kind: 'since', event: 'burst', s: REPAIR_S },
      effects: [{ kind: 'repairRelay', link: 'relay' }],
      radio: { from: 'Base pump', text: 'Length replaced. Water’s on its way back up to you.' },
    },
  ],
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
        { id: ATTACK_ID, label: 'Attack pump', spec, engine: 'off' },
        {
          id: BASE_ID,
          label: BASE.label,
          spec: base,
          primed: true,
          inputs: {
            throttle: BASE_THROTTLE,
            valves: { [baseSuction]: 1, [relay.deliveryId]: 1 },
            // Its crew started it: the engine is running with the ignition on.
            switches: { [base.engine.controls.ignition]: true },
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
        ...startEngineSteps(spec),
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
  lesson: LESSON,
  solution: [
    ...START_UP,
    { open: { inlet: 'suction' } },
    { until: { kind: 'objective', objective: 'relay' }, maxS: 30 },
    ...chargeLines(['line-65', 'line-38']),
    { throttle: 0.4 },
    { trim: { branch: 'line-38' } },
    { gate: 'line-65' },
    { until: { kind: 'objective', objective: 'hold' }, maxS: 180 },
    ...shutDown(['line-65', 'line-38']),
  ],
};
