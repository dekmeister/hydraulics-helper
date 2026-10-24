// Fixture metadata as plain data, so Playwright specs can enumerate fixtures without importing React.
// Renderers live in renderers.tsx, keyed by the same ids (docs/TESTING.md §3.2).
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import type { ApplianceSpec } from '../../sim/types';

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
  /** Generated fixtures: the appliance shown, so layout specs can check its controls. */
  applianceId?: string;
  /** What a generated fixture renders: the whole app shell, or the scene panel alone. */
  surface?: 'shell' | 'scene';
}

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
    'amber tank readout, TANK lamp amber with a triangle, message "Tank low: watch the tank gauge."',
  'tank-empty':
    'As tank-attack-700, but the tank is empty: no segments lit, red outline, every pressure ' +
    'needle on its zero stop, TANK lamp red with a diamond (steady with a ring: reduced motion), ' +
    'message "Tank empty: the pump has no water."',
} as const;

export type PanelState = keyof typeof PANEL_CAPTIONS;

export interface PanelFixtureSet {
  spec: ApplianceSpec;
  states: readonly PanelState[];
}

const ALL_PANEL_STATES = Object.keys(PANEL_CAPTIONS) as PanelState[];

/**
 * Appliances that get generated panel fixtures, and the states each is shown in: every catalogue
 * appliance in every state, plus the test-only appliance in a smaller set (it proves the panel is
 * generic; its tank states would only repeat the reference appliance's).
 */
export const PANEL_FIXTURE_SETS: readonly PanelFixtureSet[] = [
  ...APPLIANCES.map((spec) => ({ spec, states: ALL_PANEL_STATES })),
  { spec: TEST_APPLIANCE, states: ['idle', 'tank-attack-700'] },
];

export function panelFixtureId(applianceId: string, state: string): string {
  return `panel/${applianceId}/${state}`;
}

const PANEL_FIXTURES: FixtureMeta[] = PANEL_FIXTURE_SETS.flatMap(({ spec, states }) =>
  states.map((state) => ({
    id: panelFixtureId(spec.id, state),
    expect: PANEL_CAPTIONS[state],
    applianceId: spec.id,
    surface: 'shell' as const,
  })),
);

const SCENE_CAPTIONS = {
  'all-charged':
    'Scene panel alone. Plan view: red truck with white cab near the dam (lower left), every ' +
    'laid line charged (ink casing, blue core) from a coupling on the truck to a crew figure ' +
    'whose branch sprays a pale fan towards the fire glow (upper right); each branch has its ' +
    'delivery glyph and tag on a paper disc. A delivery with no line shows a dark blank cap. ' +
    'North arrow, scale bar. Legend: laid deliveries "Charged · N L/min", others "No line"; ' +
    'tank water just under full.',
  'one-line-off':
    'As all-charged, but the first line’s delivery is shut: that hose is thin dashed canvas ' +
    'and its crew has no spray; every other line is still charged and spraying. Legend: first ' +
    'line "Laid, dry".',
  'tank-low':
    'As all-charged, with the tank under a quarter: the tank bar on the truck has a short ' +
    'amber fill and an amber triangle; legend "Tank water" status amber with a triangle, ' +
    'ending "· low".',
  'tank-empty':
    'As all-charged, but the tank is empty: every hose is dashed canvas (dry), no sprays, the ' +
    'tank bar is dark with a red outline; legend says "Laid, dry" on every line and the tank ' +
    'status is red with a diamond, "0 L of … · empty".',
} as const;

export type SceneState = keyof typeof SCENE_CAPTIONS;

const HIGHLIGHT_CAPTION =
  'Whole app, every laid line charged, the first line highlighted on both panels: on the scene ' +
  'that hose has a white band edged in ink and its legend row a white ring (pressed); on the ' +
  'pump panel its delivery row has an inset ink-and-white ring. No amber anywhere.';

/** Appliances that get generated scene fixtures, as for the panel. */
export const SCENE_FIXTURE_SETS: readonly { spec: ApplianceSpec; states: readonly SceneState[] }[] =
  [
    ...APPLIANCES.map((spec) => ({ spec, states: Object.keys(SCENE_CAPTIONS) as SceneState[] })),
    { spec: TEST_APPLIANCE, states: ['all-charged', 'one-line-off'] },
  ];

export function sceneFixtureId(applianceId: string, state: string): string {
  return `scene/${applianceId}/${state}`;
}

const SCENE_FIXTURES: FixtureMeta[] = SCENE_FIXTURE_SETS.flatMap(({ spec, states }) => [
  ...states.map((state) => ({
    id: sceneFixtureId(spec.id, state),
    expect: SCENE_CAPTIONS[state],
    applianceId: spec.id,
    surface: 'scene' as const,
  })),
  {
    id: sceneFixtureId(spec.id, 'highlighted'),
    expect: HIGHLIGHT_CAPTION,
    applianceId: spec.id,
    surface: 'shell' as const,
  },
]);

export const FIXTURES: readonly FixtureMeta[] = [
  {
    id: 'shell/default',
    expect:
      'App shell: SCENE (plan view, tank-attack lines laid dry, legend) and PUMP PANEL with the ' +
      'default appliance at rest. ' +
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
    id: 'gauge/wake',
    expect:
      'The Wake (Design §6) on four dials, never coloured: steady 700 kPa (a thin ink sliver at ' +
      'the needle, ghosts stacked under it); a surge from 400 to 900 kPa (band trailing on the ' +
      'low side, five ghosts fanned back towards 400, fading); hunting discharge (band fanned both ' +
      'sides of ~760); hunting compound near −82 with an amber needle, band across the vacuum ' +
      'caution/alarm zones.',
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
      '(handle pulled out over a graduated shaft, "60 %"), each with − and + buttons. Five ' +
      'primer buttons, each in a thin ring that fills with vacuum: HOLD (raised, empty ring), ' +
      'RUNNING (cap sunk, ring 40 % lit), CHECK SUCTION (amber ring and caption), PRIMED (green ' +
      'full ring, green check mark), COOLING (duty cut-out, ring 60 %).',
  },
  ...PANEL_FIXTURES,
  ...SCENE_FIXTURES,
];

/** File-safe name for screenshots and contact sheets: 'shell/default' → 'shell-default'. */
export function fixtureFileName(id: string): string {
  return id.replaceAll('/', '-');
}
