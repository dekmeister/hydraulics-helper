import { START_UP, chargeLines, shutDown, startEngineSteps } from './engineSteps';
import { inletOfKind } from '../appliances/controls';
import { createSiteState } from '../engine';
import { RELAY_MIN_RESIDUAL_KPA } from '../constants';
import { PUMP_DAMAGE, shutdownObjective } from '../lesson/common';
import type { LessonDef } from '../lesson/types';
import { attachLines, BUSH_LINE, twoLines, type PlannedLine } from './lay';
import { ATTACK_ID, BASE_ID, baseRelay } from './relayTrucks';
import { supportSpec, type Scenario, type SupportRole } from './types';

/** The attack pump's two bush lines. */
const LINES: readonly PlannedLine[] = [
  { id: 'line-1', ...BUSH_LINE },
  { id: 'line-2', ...BUSH_LINE },
];

/** C12 (L3813–3820): 20 m up, 4 lengths of 65 mm between the pumps. */
const RELAY_UPHILL_M = 20;
const RELAY_LENGTHS = 4;

/** The base pump draws from the farm dam on 2 × 3 m of hard suction. // PLACEHOLDER — needs Dek */
const DAM_LIFT_M = 2;
const DAM_L = 200_000;

/**
 * Throttle the base pump's operator holds: about 700 kPa at its delivery on a Cat 1 once the attack
 * pump draws both bush lines (~300 L/min; the manual's relay delivery pressure). Fixed settings
 * until support trucks have AI. // PLACEHOLDER — needs Dek
 */
const BASE_THROTTLE = 0.65;

/**
 * Throttle the base pump's operator raises to once the attack pump has both lines on (the fill
 * sequence, L3850–3853: lower pressure until every pump has water, then working pressure): about
 * 800 kPa at its delivery on a Cat 1 with both lines drawn, enough for the climb and the extra flow.
 * // PLACEHOLDER — needs Dek
 */
const BASE_THROTTLE_RAISED = 0.7;

const BASE: SupportRole = {
  id: BASE_ID,
  label: 'Base pump',
  requires: { tank: false, suction: true, minDeliveries: 1 },
};

/** Seconds the crew takes to replace a burst relay length. // PLACEHOLDER — needs Dek */
const REPAIR_S = 30;

const RESIDUAL = { kind: 'gauge', gauge: 'compound', min: RELAY_MIN_RESIDUAL_KPA } as const;

const LESSON: LessonDef = {
  ladder: 6,
  brief:
    'A base pump at the farm dam pushes water 20 m up four lengths of 65 mm into your suction ' +
    'inlet. In a closed relay your compound shows the pressure left at the end of the relay hose: ' +
    `keep it above ${String(RELAY_MIN_RESIDUAL_KPA)} kPa. Ease the inlet; never slam it shut on a ` +
    'flowing relay.',
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
        of: [{ kind: 'branch', line: 'line-1' }, { kind: 'branch', line: 'line-2' }, RESIDUAL],
      },
      holdS: 30,
      after: ['relay'],
    },
    shutdownObjective(['hold'], ['line-1', 'line-2']),
  ],
  failures: [...PUMP_DAMAGE],
  events: [
    {
      id: 'pressure-up',
      when: {
        kind: 'all',
        of: [
          { kind: 'objective', objective: 'relay' },
          { kind: 'flow', line: 'line-1', min: 50 },
          { kind: 'flow', line: 'line-2', min: 50 },
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
 * Closed relay uphill (ARCHITECTURE §5 ladder step 6): a base pump already primed at the dam
 * pushes water 20 m up 4 lengths of 65 mm into the attack pump's suction inlet. The player opens
 * the relay inlet and two lines, keeps the compound above 100 kPa residual, over-runs the relay at
 * full throttle (inlet zero, hose soft) and recovers.
 */
export const CLOSED_RELAY: Scenario = {
  id: 'closed-relay',
  title: 'Closed relay: the base pump pushes water 20 m uphill to you',
  setting: 'bush',
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
        // Bush lines want ~950 kPa: the relay's pressure at the inlet leaves little to add.
        { tS: 60, throttle: 0.45 },
        { tS: 90, throttle: 1 },
        { tS: 120, throttle: 0.45 },
      ],
      durationS: 180,
    };
  },
  lesson: LESSON,
  solution: [
    ...START_UP,
    { open: { inlet: 'suction' } },
    { until: { kind: 'objective', objective: 'relay' }, maxS: 30 },
    ...chargeLines(['line-1', 'line-2']),
    { throttle: 0.4 },
    { trim: { branch: 'line-1' } },
    { gate: 'line-2' },
    { until: { kind: 'objective', objective: 'hold' }, maxS: 180 },
    ...shutDown(['line-1', 'line-2']),
  ],
};
