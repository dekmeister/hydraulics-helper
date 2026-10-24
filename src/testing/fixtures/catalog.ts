// Fixture metadata as plain data, so Playwright specs can enumerate fixtures without importing React.
// Renderers live in renderers.tsx, keyed by the same ids (docs/TESTING.md §3.2).
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';

export type ViewportName = 'phone' | 'tablet' | 'desktop';

export interface FixtureMeta {
  /** Path-like id, e.g. 'gauge/compound'. Served at /?fixture=<id>. */
  id: string;
  /** What a reviewer should see; copied into review/report.md. */
  expect: string;
  /** Sim ticks to run before capture. */
  steps?: number;
  /** Default: all three. */
  viewports?: ViewportName[];
  /** Panel fixtures: the appliance shown, so layout specs can check its controls. */
  applianceId?: string;
}

/** Appliances that get generated panel fixtures: the catalogue plus the test-only appliance. */
export const PANEL_APPLIANCE_IDS: readonly string[] = [
  ...APPLIANCES.map((a) => a.id),
  TEST_APPLIANCE.id,
];

const PANEL_CAPTIONS = {
  idle:
    'Pump panel at rest with the tank-attack lines laid: every needle at its zero stop except ' +
    'engine rpm at idle; tank full (all segments lit). Every valve closed; deliveries with no ' +
    'line read NO LINE and are dimmed. Throttle at idle with chevrons. All lamps unlit except ' +
    'the "not simulated" ones (dashed). "No warnings."',
  'tank-attack-700':
    'Tank to pump open, the first line’s delivery fully open (lever along the pipe, travel arc ' +
    'filled), throttle part-way out. Discharge needle at ~700 kPa (a little under half sweep), ' +
    'compound just below 0, rpm above idle, tank still nearly full. No warnings.',
  'tank-low':
    'As tank-attack-700, but the tank is under a quarter: one amber segment with a triangle, ' +
    'amber tank readout, TANK lamp amber with a triangle, message "Tank low: … L left."',
  'tank-empty':
    'As tank-attack-700, but the tank is empty: no segments lit, red outline, every pressure ' +
    'needle on its zero stop, TANK lamp red with a diamond (steady with a ring: reduced motion), ' +
    'message "Tank empty: the pump has no water."',
} as const;

type PanelState = keyof typeof PANEL_CAPTIONS;

/** Panel states generated for each appliance; the test appliance gets a smaller set. */
function panelStatesFor(applianceId: string): PanelState[] {
  return applianceId === TEST_APPLIANCE.id
    ? ['idle', 'tank-attack-700']
    : ['idle', 'tank-attack-700', 'tank-low', 'tank-empty'];
}

export function panelFixtureId(applianceId: string, state: string): string {
  return `panel/${applianceId}/${state}`;
}

const PANEL_FIXTURES: FixtureMeta[] = PANEL_APPLIANCE_IDS.flatMap((applianceId) =>
  panelStatesFor(applianceId).map((state) => ({
    id: panelFixtureId(applianceId, state),
    expect: PANEL_CAPTIONS[state],
    applianceId,
  })),
);

export const FIXTURES: readonly FixtureMeta[] = [
  {
    id: 'shell/default',
    expect:
      'App shell: SCENE placeholder (empty) and PUMP PANEL with the default appliance at rest. ' +
      'At 375 and 768 px stacked, Scene above. At 1280 px side by side, Scene left, the pump ' +
      'panel scrolling inside its card. No horizontal scroll.',
  },
  {
    id: 'gauge/discharge',
    expect:
      'Three discharge gauges 0–16 (kPa ×100), amber 12–14, red 14–16, plate DISCHARGE. ' +
      'Needles at 0 (bottom-left stop), 700 (just left of top) and 1450 (in the red). Readouts ' +
      '"0 kPa", "700 kPa", "1 450 kPa" (the last in red).',
  },
  {
    id: 'gauge/compound',
    expect:
      'Four compound gauges: grey-tinted vacuum sector −100…0 on the left with VAC kPa, heavy ' +
      'break tick at 0, pressure 0–16 (×100). Needles at −60 (in the vacuum sector), −90 (in the ' +
      'red), 0 (on the break tick) and 350 kPa. The −90 readout is red.',
  },
  {
    id: 'gauge/tacho',
    expect:
      'Three engine rpm gauges 0–4 (×1000), red 3.5–4, plate ENGINE. Needles at 800, 2 400 and ' +
      '3 700 rpm (in the red, red readout).',
  },
  {
    id: 'gauge/tank',
    expect:
      'Four tank columns of five segments for a 3 000 L tank: full (5 lit), 2 000 L (4 lit), ' +
      '600 L (1 amber segment with a triangle, amber readout), empty (none lit, red outline, ' +
      'red readout).',
  },
  {
    id: 'controls/valves',
    expect:
      'Lever valves on pipes. Outlets (blue grip): closed (lever up, dotted arc), 50 % (lever at ' +
      '45°, half the arc filled blue, "50 %"), open (lever along the pipe, "100 %"), and ' +
      'disabled (dimmed, dark grip, dashed NO LINE chip). Inlets (green ball knob): closed and ' +
      'open (arc filled steel white).',
  },
  {
    id: 'controls/throttle-primer',
    expect:
      'Two T-handle throttles: idle (handle against the housing, chevrons, "0 %") and 60 % ' +
      '(handle pulled out over a graduated shaft, "60 %"), each with − and + buttons. Two ' +
      'primer buttons: HOLD (raised) and RUNNING (cap sunk, light ring).',
  },
  ...PANEL_FIXTURES,
];

/** File-safe name for screenshots and contact sheets: 'shell/default' → 'shell-default'. */
export function fixtureFileName(id: string): string {
  return id.replaceAll('/', '-');
}
