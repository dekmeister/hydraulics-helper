import { startEngineSteps } from './engineSteps';
import { inletOfKind } from '../appliances/controls';
import { createSiteState } from '../engine';
import { HYDRANT_MAIN_LOSS, HYDRANT_STATIC_KPA } from './hydrantSupply';
import { attachLines, BUSH_LINE, MONITOR_LINE, VILLAGE_LINE, type PlannedLine } from './lay';
import { ATTACK_ID, BASE_ID, baseRelay, lengths } from './relayTrucks';
import { supportSpec, type Scenario, type ScriptStep, type SupportRole } from './types';
import { hoseType } from '../hose';
import type { ApplianceSpec } from '../types';

/**
 * Crews' heights above the attack pump: one up the slope, one down it, so one pump pressure can't
 * suit both. // PLACEHOLDER — needs Dek (typical slopes)
 */
const UPHILL_M = 10;
const DOWNHILL_M = -10;

/**
 * The attack pump's lays, most wanted first, laid while it has deliveries: a monitor (only on a
 * delivery big enough for its hose), a crew up the slope on 38 mm and a bush crew down it.
 */
const ATTACK_LINES: readonly PlannedLine[] = [
  { id: 'monitor', ...MONITOR_LINE },
  { id: 'line-uphill', ...VILLAGE_LINE, elevationM: UPHILL_M },
  { id: 'line-downhill', ...BUSH_LINE, elevationM: DOWNHILL_M },
];

/** A bush crew working off the base pump at the dam. */
const BASE_LINE: PlannedLine = { id: 'line-base', ...BUSH_LINE };

/** The relay up to the attack pump: 4 lengths of 65 mm, 20 m up (as the closed relay, C12). */
const RELAY_LENGTHS = 4;
const RELAY_UPHILL_M = 20;

/** The farm dam the base pump draughts from. // PLACEHOLDER — needs Dek */
const DAM_LIFT_M = 2;
const DAM_L = 200_000;

const BASE: SupportRole = {
  id: BASE_ID,
  label: 'Base pump',
  requires: { tank: true, suction: true, tankFill: true, primer: true, minDeliveries: 2 },
};

/**
 * The attack pump's lays that fit `spec`: in order, one per delivery, and the monitor only where a
 * delivery is as big as its hose (no adaptor down to 38 mm).
 */
function attackLines(spec: ApplianceSpec): PlannedLine[] {
  const fits = (plan: PlannedLine) =>
    plan.monitor !== true || spec.deliveries.some((d) => d.sizeMm >= hoseType(plan.hose).sizeMm);
  return ATTACK_LINES.filter(fits).slice(0, spec.deliveries.length);
}

/**
 * Free play (the sandbox): two trucks, both cold, every control the player's. The base pump sits
 * at a dam it must prime and draught from, with a hydrant on hydrant to tank, a bush crew, and a
 * closed relay 20 m up to the attack pump; the attack pump has its own tank, crews up and down the
 * slope and, where it has a big enough delivery, a monitor heavy enough to over-run the relay.
 */
export const FREE_PLAY: Scenario = {
  id: 'free-play',
  title: 'Free play',
  setting: 'bush',
  requires: { tank: true, suction: true, minDeliveries: 2 },
  support: [BASE],
  build(spec, support) {
    const base = supportSpec(BASE, spec, support);
    const attackInlet = inletOfKind(spec, 'suction', 'free-play');
    const tankInlet = inletOfKind(spec, 'tank', 'free-play');
    const relay = baseRelay(base, '65L', RELAY_LENGTHS, RELAY_UPHILL_M, {
      kind: 'inlet',
      truckId: ATTACK_ID,
      inletId: attackInlet,
    });
    const free = base.deliveries.filter((d) => d.id !== relay.deliveryId);
    const lines = [
      ...attachLines(spec, attackLines(spec), ATTACK_ID),
      ...attachLines({ ...base, deliveries: free }, [BASE_LINE], BASE_ID),
    ];
    const state = createSiteState(
      [
        { id: ATTACK_ID, label: 'Attack pump', spec, engine: 'off' },
        { id: BASE_ID, label: BASE.label, spec: base, engine: 'off' },
      ],
      lines,
      {
        sources: [
          { id: 'dam', kind: 'static', label: 'Dam', liftM: DAM_LIFT_M, volumeL: DAM_L },
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
            id: 'base-suction',
            truckId: BASE_ID,
            inletId: inletOfKind(base, 'suction', 'free-play base'),
            sourceId: 'dam',
            segments: [
              { hose: '65H', lengthM: 3 },
              { hose: '65H', lengthM: 3 },
            ],
          },
          {
            id: 'base-hydrant-line',
            truckId: BASE_ID,
            inletId: inletOfKind(base, 'tankFill', 'free-play base'),
            sourceId: 'hydrant',
            segments: lengths('65L', 2),
          },
        ],
        links: [relay],
      },
    );
    // The trace works the attack pump off its tank, opening its lines one at a time.
    const open: ScriptStep[] = lines
      .filter((l) => l.truckId === ATTACK_ID)
      .map((l, i) => ({ tS: 2 + 30 * i, valves: { [l.deliveryId]: 1 } }));
    return {
      state,
      // Steps fire in order, so in time order.
      script: [
        ...startEngineSteps(spec),
        { tS: 0, valves: { [tankInlet]: 1 } },
        ...open,
        { tS: 5, throttle: 0.6 },
        { tS: 90, throttle: 0.8 },
      ].sort((a, b) => a.tS - b.tS),
      durationS: 180,
    };
  },
};
