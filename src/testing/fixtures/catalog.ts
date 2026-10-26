// Fixture metadata as plain data, so Playwright specs can enumerate fixtures without importing React.
// Renderers live in renderers.tsx, keyed by the same ids (docs/TESTING.md §3.2).
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { primerControlId } from '../../sim/appliances/controls';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import { getScenario } from '../../sim/scenarios';
import { supports } from '../../sim/scenarios/types';
import type { ApplianceSpec } from '../../sim/types';
import { RELAY_STATE_SCENARIO, relayState, type RelayStateId } from './relayStates';
import {
  REALISTIC_APPLIANCES,
  REALISTIC_STATE_SCENARIO,
  realisticFixtureId,
  type RealisticStateId,
} from './realisticStates';
import { SOURCE_STATE_SCENARIO, sourceState, type SourceStateId } from './sourceStates';

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
  /**
   * 'viewport' captures what the player sees, at the scroll position the app chose (a lesson's
   * fixed dock and coach scrolling); default the full page from the top.
   */
  capture?: 'viewport';
  /** What a generated fixture renders: the whole app shell, or the scene panel alone. */
  surface?: 'shell' | 'scene';
}

const PANEL_CAPTIONS = {
  idle:
    'Pump panel at rest with the tank-attack lines laid: every needle at its zero stop except ' +
    'engine rpm at idle; tank full (all segments lit). Every valve closed; deliveries with no ' +
    'line read NO LINE and are dimmed. Throttle at idle with chevrons. Supply section: tank to pump ' +
    'and suction inlet (green knobs, closed) and the primer (HOLD). Every lamp unlit, HAMMER ' +
    'last. "No warnings." Deliveries (Cat 1) as cards side by side, text over the valve, at 768 ' +
    'and 1280 px; stacked rows, valve on the right, at 375 px. Engine section: status "Running", ' +
    'IGN pressed in with ON under it, START and STOP up with HOLD under them.',
  'engine-cold':
    'As idle, but the engine is cold: Engine status "Stopped · ignition off", IGN up with OFF, ' +
    'START and STOP up (HOLD); the tacho (where fitted) and every pressure needle on its zero stop.',
  'ignition-on':
    'As engine-cold with the ignition on: IGN pressed in with a lit rim and ON under it; status ' +
    '"Stopped · ignition on"; needles still at zero.',
  cranking:
    'Ignition on and START held (pressed in, lit rim): status "Cranking: hold until it fires"; ' +
    'the tacho (where fitted) a little off its stop at the starter’s speed, a few hundred rpm.',
  stopping:
    'Engine at idle with IGN on and STOP held (pressed in, red rim): status "Stopping: hold until ' +
    'it stops"; the tacho (where fitted) just under idle.',
  'stop-without-ignition':
    'The ignition trap (a solenoid stop, Cat 1): engine running at idle, IGN up with OFF, STOP ' +
    'held (red rim) but doing nothing: status in amber "Running · STOP needs the ignition on"; ' +
    'the tacho still at idle.',
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
  ...APPLIANCES.map((spec) => ({
    spec,
    // The ignition trap only where STOP needs the ignition.
    states: ALL_PANEL_STATES.filter(
      (s) => s !== 'stop-without-ignition' || spec.engine.controls.stop.needsIgnition,
    ),
  })),
  { spec: TEST_APPLIANCE, states: ['idle', 'tank-attack-700', 'cranking'] },
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
    'As all-charged, but the tank is empty: every hose still holds its water (ink casing, blue ' +
    'core, no white streaks), no sprays, the tank bar is dark with a red outline; legend says ' +
    '"Holding water" on every line and the tank status is red with a diamond, "0 L of … · empty".',
  'line-filling':
    'Tank attack, only the first line’s delivery open, charging from dry: that hose is ink casing ' +
    'and blue core with white streaks from its coupling a little over half way along, ending in ' +
    'a rounded front; beyond the front it is thin dashed canvas to a crew with no spray. Other ' +
    'lines dashed canvas. Legend: first line "Filling · 5N %", others "Laid, dry".',
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

const SOURCE_CAPTIONS: Readonly<Record<SourceStateId, string>> = {
  'draught-priming':
    'Draughting scenario, primer held for 8 s with the suction inlet valve open: compound needle ' +
    'pulled into the grey vacuum sector (~−25 kPa), discharge and flow zero, rpm idle. Primer ' +
    'RUNNING with its ring about a third lit. Scene: hard suction (ink and galvanised) from the ' +
    'green suction coupling to a strainer in the dam, with a green water core rising from the ' +
    'strainer part way up it, white streaks running up it towards the pump; lines dry; legend "Suction · Dam  Priming · water N of ' +
    '4 m". No lamps lit.',
  'draught-working':
    'Draughting, primed: primer PRIMED with a green check and full green ring; suction inlet ' +
    'open; the first line’s delivery open at ~700 kPa discharge, compound ~−60 kPa (vacuum ' +
    'sector). Scene: hard suction with a green water core into the dam and white streaks along ' +
    'it, first line charged and spraying; legend "Primed · ~630 L/min". No lamps lit.',
  cavitating:
    'Draughting at full throttle with both lines open, run 3 s so the Wake fills: compound needle ' +
    'amber near −85 kPa (readout red: alarm band) with a small Wake fan; discharge ~760 kPa with a band either side; rpm at ' +
    'max. CAVITATION lamp amber with a triangle, message about the lift and easing the throttle. ' +
    'Scene: charged hoses broken into gaps; legend lines "· cavitating".',
  hydrant:
    'Hydrant supply: suction inlet open, the first line open at ~700 kPa discharge; compound ' +
    'positive (~+150 kPa, right of the 0 break tick). Scene: red hydrant on the track below the ' +
    'truck, green layflat with white streaks from it to the suction coupling; legend "Hydrant  ' +
    'Charged · ~860 L/min". ' +
    'Tank stays full. No lamps lit.',
  faults:
    'Tank attack, every delivery just slammed shut with the throttle still up: discharge ~700 kPa ' +
    'with no flow (churning), TEMP lamp red with a diamond (steady with a ring: reduced motion), ' +
    'HAMMER lamp amber with a triangle; messages "Pump hot…" and "Water hammer: Delivery 2 was ' +
    'shut too fast…". Scene: the first line holds its water (blue core, no streaks, no spray), ' +
    'legend "Holding water"; the other line dry.',
  refilling:
    'Tank refill: hydrant to tank open (green handle, 100 %), every other valve shut, engine at ' +
    'idle; discharge and compound 0, tank ~840 L of 3 000 and rising. Supply lamp off. Scene: red ' +
    'hydrant on the track, green charged layflat with white streaks from it to the hydrant-to-tank coupling on the ' +
    'truck’s left side (forward of the suction coupling, which is capped); legend "Hydrant  ' +
    'Charged · ~1 030 L/min".',
} as const;

export type SourceState = SourceStateId;

/**
 * Appliances that get generated source fixtures: every catalogue appliance in each state its
 * scenario allows (a primer it can hold, for 'draught-priming'; a pump that can out-draw the lift,
 * for 'cavitating'), plus the self-priming test
 * appliance draughting, to prove the panel and scene are generic.
 */
export const SOURCE_FIXTURE_SETS: readonly {
  spec: ApplianceSpec;
  states: readonly SourceState[];
}[] = [
  ...APPLIANCES.map((spec) => ({
    spec,
    states: (Object.keys(SOURCE_CAPTIONS) as SourceState[]).filter(
      (state) =>
        supports(getScenario(SOURCE_STATE_SCENARIO[state]), spec) &&
        (state !== 'draught-priming' || primerControlId(spec) !== undefined) &&
        // A pump too small to out-draw the lift at full throttle has no cavitating state to show.
        (state !== 'cavitating' ||
          (sourceState(spec, state).trucks[0]?.readings.cavitation ?? 0) > 0),
    ),
  })),
  { spec: TEST_APPLIANCE, states: ['draught-working'] },
];

/** Sim ticks a source fixture runs in the store before capture, so the Wake has history. */
const SOURCE_STEPS: Partial<Record<SourceState, number>> = { cavitating: 30 };

const SOURCE_FIXTURES: FixtureMeta[] = SOURCE_FIXTURE_SETS.flatMap(({ spec, states }) =>
  states.map((state) => {
    const steps = SOURCE_STEPS[state];
    return {
      id: panelFixtureId(spec.id, state),
      expect: SOURCE_CAPTIONS[state],
      applianceId: spec.id,
      surface: 'shell' as const,
      ...(steps === undefined ? {} : { steps }),
    };
  }),
);

const RELAY_CAPTIONS: Readonly<Record<RelayStateId, string>> = {
  'closed-working':
    'Closed relay, attack pump operated. Scene: BASE PUMP by the dam (hard suction with a green ' +
    'core), a charged blue relay hose labelled +20 m up the track to the ATTACK PUMP (label ' +
    'inverted: the one operated), whose two lines spray towards the fire. Legend: both lines ' +
    'charged, "Relay · Base pump → Attack pump  ~820 L/min · ~150 kPa at the inlet". Pump panel ' +
    'header: two truck buttons, ATTACK PUMP pressed; panel reads "Attack pump · …"; compound ' +
    'positive (~+150 kPa), discharge ~600 kPa. No lamps lit.',
  'closed-over-run':
    'As closed-working at full throttle: the attack pump over-runs the relay. Relay hose drawn ' +
    'thin and dashed (soft), legend "Soft: over-running the relay"; compound at 0 with an amber ' +
    'needle; SUPPLY lamp amber ("Relay residual low … 100 kPa … base pump"), CAVITATION lamp lit; ' +
    'charged lines broken into gaps.',
  burst:
    'The relay inlet was slammed shut and opened again: a red burst marker with white jets on the ' +
    'relay hose near the base pump, the hose dashed (dry) beyond; attack lines dry. SUPPLY lamp red ' +
    'with a diamond, "Relay hose burst: no water from the base pump…". Legend "Burst: length 1".',
  'open-dam':
    'Open relay: the base pump stands by the hydrant (green layflat into its hydrant-to-tank ' +
    'coupling), its blue relay hose ' +
    'runs +10 m to a round portable dam by the attack pump, its level ring ~half lit; hard ' +
    'suction (green core) from the attack pump into the dam; both lines spraying. Legend: relay ' +
    '"~660 L/min in", "Portable dam  ~2 000 L of 5 000 L". Primer PRIMED, compound slightly ' +
    'negative. No lamps lit.',
  'base-panel':
    'As closed-working, switched to the base pump: header BASE PUMP pressed, panel "Base pump · ' +
    '…" with its throttle part out, suction valve open, primer PRIMED, compound in vacuum (~−50 ' +
    'kPa: 2 m lift plus suction loss), discharge ~690 kPa; its relay delivery open and described "Relay · 4 × 30 m ' +
    '65 mm lined · to Attack pump · 20 m uphill"; other deliveries NO LINE. Scene: BASE PUMP label ' +
    'inverted; legend rows are the base pump’s deliveries (relay one "Relay · ~820 L/min").',
};

/** A relay fixture set: the player's appliance, and the base pump's when it differs. */
export interface RelayFixtureSet {
  spec: ApplianceSpec;
  base?: ApplianceSpec;
  states: readonly RelayStateId[];
}

/**
 * Whether `spec`'s relay state shows what its caption says: a pump too small to out-draw the relay
 * or to burst it with a slam has no over-run or burst to show.
 */
function shows(spec: ApplianceSpec, state: RelayStateId): boolean {
  if (state !== 'closed-over-run' && state !== 'burst') return true;
  const s = relayState(spec, state);
  return state === 'burst'
    ? s.links.some((l) => l.burst !== undefined)
    : (s.trucks.find((t) => t.id === s.activeTruckId)?.readings.cavitation ?? 0) > 0;
}

/**
 * Appliances that get generated relay fixtures: every catalogue appliance in each state its
 * scenario allows and shows, plus a closed relay mixing appliances (the test appliance as base pump), to
 * prove the scene and panel handle two specs at once.
 */
export const RELAY_FIXTURE_SETS: readonly RelayFixtureSet[] = [
  ...APPLIANCES.map((spec) => ({
    spec,
    states: (Object.keys(RELAY_CAPTIONS) as RelayStateId[]).filter(
      (state) => supports(getScenario(RELAY_STATE_SCENARIO[state]), spec) && shows(spec, state),
    ),
  })),
  ...APPLIANCES.map((spec) => ({
    spec,
    base: TEST_APPLIANCE,
    states: ['closed-working'] as const,
  })),
];

/** 'relay/cat1-generic/burst', or 'relay/cat1-generic/with-test-2d/…' with another base pump. */
export function relayFixtureId(set: RelayFixtureSet, state: string): string {
  const pair = set.base === undefined ? set.spec.id : `${set.spec.id}/with-${set.base.id}`;
  return `relay/${pair}/${state}`;
}

/** Sim ticks a relay fixture runs in the store before capture, so the Wake has history. */
const RELAY_STEPS: Partial<Record<RelayStateId, number>> = { 'closed-over-run': 30 };

const RELAY_FIXTURES: FixtureMeta[] = RELAY_FIXTURE_SETS.flatMap((set) =>
  set.states.map((state) => {
    const steps = RELAY_STEPS[state];
    return {
      id: relayFixtureId(set, state),
      expect:
        RELAY_CAPTIONS[state] +
        (set.base === undefined ? '' : ` The base pump is the ${set.base.name}.`),
      applianceId: set.spec.id,
      surface: 'shell' as const,
      ...(steps === undefined ? {} : { steps }),
    };
  }),
);

const LESSON_CAPTIONS = {
  guided:
    'Whole app in a lesson: app bar (PUMPOPS, SCENARIOS, SOUND ON). Scene header reads ' +
    '"LESSON 1 First line…" instead of the picker. The tank-to-pump control has the focus double ' +
    'ring (white inside ink) and is scrolled into view. A paper dock at the foot of the screen ' +
    '(right half from 900 px): "STEP 2 OF 8", "Water comes from the truck’s tank first. Open Tank ' +
    'to pump: tap its green handle, or drag it a quarter turn to open it part way." (each truck ' +
    'names its own valve; the hint comes from its layout), and OBJECTIVES 0/3 ' +
    'and END buttons. Nothing hidden under the dock once scrolled.',
  incident:
    'Whole app in the incident lesson: one 38 mm line charged, the crew has just moved uphill. ' +
    'Dock: the active objective "Crew 1 has moved 10 m up the slope…", a mono line "Branch on ' +
    'Delivery …: ~2xx kPa · target 315 kPa–385 kPa" in pencil (not yet met), the radio call in ' +
    'italics "Branch 1: Moving up the slope after a spot fire. We need more pressure up here.", ' +
    'and the objective list expanded: ✓ first objective, ▸ the uphill one, ○ the rest in pencil.',
} as const;

export type LessonFixtureStateId = keyof typeof LESSON_CAPTIONS;

/** Lesson fixtures: every catalogue appliance; the guided one on the test appliance too. */
export const LESSON_FIXTURE_SETS: readonly {
  spec: ApplianceSpec;
  states: readonly LessonFixtureStateId[];
}[] = [
  ...APPLIANCES.map((spec) => ({
    spec,
    states: (Object.keys(LESSON_CAPTIONS) as LessonFixtureStateId[]).filter((state) =>
      supports(getScenario(state === 'guided' ? 'first-line' : 'incident'), spec),
    ),
  })),
  { spec: TEST_APPLIANCE, states: ['guided'] },
];

const LESSON_FIXTURES: FixtureMeta[] = LESSON_FIXTURE_SETS.flatMap(({ spec, states }) =>
  states.map((state) => ({
    id: `lesson/${spec.id}/${state}`,
    expect: LESSON_CAPTIONS[state],
    applianceId: spec.id,
    surface: 'shell' as const,
    capture: 'viewport' as const,
  })),
);

const DEBRIEF_CAPTIONS = {
  passed:
    'Debrief on dark ironbark: "SCENARIO COMPLETE", "1. First line… · <appliance>". Paper cards in ' +
    'ink: ★★★ and "100 points"; WHAT HAPPENED with one green-edged finding "Clean running"; ' +
    'OBJECTIVES with three ✓; SCORE table (Objectives +60, Clean running +40, each penalty 0, ' +
    'Total 100). Buttons: ' +
    'NEXT SCENARIO (ink, filled), TRY AGAIN, BACK TO THE PANEL, ALL SCENARIOS.',
  failed:
    'Debrief: "SCENARIO FAILED", "2. Tank attack…". ☆☆☆ and 40 points; WHAT HAPPENED leads with ' +
    'an amber-edged "Scenario failed / The tank ran dry with crews on the branches."; OBJECTIVES ' +
    '✓ ✓ ○; SCORE Objectives +40, Clean running 0 (a failed run earns its objectives only), ' +
    'each penalty 0, Total 40: the lines add up. No NEXT SCENARIO button.',
} as const;

const DEBRIEF_FIXTURES: FixtureMeta[] = APPLIANCES.flatMap((spec) =>
  (Object.keys(DEBRIEF_CAPTIONS) as (keyof typeof DEBRIEF_CAPTIONS)[]).map((state) => ({
    id: `debrief/${spec.id}/${state}`,
    expect: DEBRIEF_CAPTIONS[state],
  })),
);

const REALISTIC_CAPTIONS: Readonly<Record<RealisticStateId, string>> = {
  idle:
    'Realistic bay at rest (header button REALISTIC pressed). Instrument panel: dark box with ' +
    'compound and pressure dials (no readouts) on one centreline over red COMPOUND / PRESSURE ' +
    'plates on one line, the tacho at idle, small oil temp / oil pressure dials, placards (idle, ' +
    'limits, stopping) with their lines evenly spaced, fuses, STOP (red cap) and IGN (black boss, ' +
    'bar pointing right: on) side by side under the stopping placard, the ALT lamp (dark glass) ' +
    'and START (dark green cap) below them, each under an equal plate; foam knobs and the ' +
    'air-cleaner indicator drawn plainly; the red SPEED switch ' +
    'under the pressure gauge, toggle bat end-on in its bezel (centred), ▲ / ▼ above and below. ' +
    'Bay: galvanised pipes with square ends on collars, couplings or flanges, none overrunning a ' +
    'joint; tank feed and suction join into the red pump’s eye (centre); the discharge leaves ' +
    'tangentially off the volute’s top edge at a flange, tees up (pump to tank, over the pump) ' +
    'and down to the manifold; each outlet drop ends on its coupling’s centre. Green tank-to-' +
    'pump lever far left pointing right (across its pipe, shut), blue pump-to-tank lever pointing ' +
    'up (shut), green suction lever up (shut) by the big coupling low left, PRIME T-handle home; ' +
    'three blue outlet levers pointing right (shut), D1 and D2 couplings open (laid), D3 capped ' +
    'and its lever dimmed with NO LINE. Right of the instrument panel, level with it and as tall, ' +
    'a narrow column with a TANK plate over the sight tube (full, float at the top); the ' +
    'Side of truck inset (hydrant-to-tank lever up, shut) alone under the bay. Warning strip below, no lamps lit. Water ' +
    '(x-ray, drawn like a charged hose): only the tank feed above the tank-to-pump lever shows a ' +
    'still blue core (no streaks); every other pipe and the pump are plain metal (empty).',
  'engine-cold':
    'As idle, but the engine is cold: the tacho (Cat 1) at 0, the ignition switch’s bar pointing ' +
    'up (off), START and STOP caps unpressed, the ALT lamp (and on the Cat 7 the oil lamp) dark ' +
    'glass. Cat 7: IGN, the lamps and START in a row under their plates, the red STOP T-handle ' +
    'beside the throttle knob.',
  'ignition-on':
    'As engine-cold with the ignition on: its bar turned to point right; the ALT lamp (and on ' +
    'the Cat 7 the oil lamp) lit red with a glow. Nothing else moves.',
  'tank-attack-700':
    'As idle, but tank to pump open (green lever up along its pipe), the first line’s outlet ' +
    'lever up along its drop (open, travel arc filled blue), pressure needle at ~700 kPa (low on ' +
    'the 0–4000 face), tacho above idle, sight tube nearly full. No warnings. Water: blue cores ' +
    'with white streaks (flowing) down the tank feed, along into the pump’s eye, out of the ' +
    'volute, down to the manifold, right to the open line’s drop (D2 on the Cat 1) and through ' +
    'its lever to the coupling; the pump’s pool shows a dashed swirl. Still cores (no streaks) ' +
    'in the manifold toward the other drops, those drops down to their shut levers, the reel ' +
    'riser and the pump-to-tank stub up to its lever; below the shut levers, the suction and the ' +
    'return over the pump: plain metal.',
  'after-tank-attack':
    'As tank-attack-700 but every lever shut again (tank to pump pointing right, the outlet ' +
    'lever pointing right), throttle back at idle, pressure ~0. Water: the casing kept its ' +
    'water, so the pump’s pool (no swirl), the eye run, the discharge, manifold, the drops down ' +
    'to every lever, the reel riser and the pump-to-tank stub all show still cores, no streaks; ' +
    'the tank feed is still above and below its lever. Below the outlet levers, the suction and ' +
    'the return over the pump: plain metal.',
  highlighted:
    'As tank-attack-700, with the first line’s delivery picked out: its coupling has a double ' +
    'focus ring and the number plate button is pressed; on the scene its hose and legend row are ' +
    'highlighted.',
  'draught-priming':
    'Draughting fireground, primer held 8 s: the PRIME T-handle pulled out of its bezel, a ' +
    'green vacuum bar part-filled under it, caption RUNNING; suction lever along its pipe ' +
    '(open), compound needle into the vacuum sector. Scene: hard suction to the dam. Water: not ' +
    'primed, so the suction and pump are plain metal; only the tank feed above its lever is ' +
    'still blue.',
  'draught-working':
    'Draughting, primed and working: suction lever and the first line’s outlet lever open, ' +
    'PRIME handle home, pressure needle near 700 kPa, compound in vacuum. Water: streaked ' +
    '(flowing) cores from the suction coupling through its lever, up into the eye, round the ' +
    'pump (swirl), out to the manifold and through the first drop to its coupling; tank-to-pump ' +
    'shut, so the run below it is still and the feed above it still.',
  refilling:
    'Tank refill: the Side of truck inset’s hydrant-to-tank lever along its pipe (open); sight ' +
    'tube about a quarter full and the float at the water line; every bay lever shut, engine at ' +
    'idle, pressure 0. Scene: green layflat from the hydrant to the coupling on the truck’s ' +
    'side. Water: the Side of truck inset’s pipe streaked (flowing) from the coupling through ' +
    'the lever into the tank; the bay’s pump and pipes are plain metal except the tank feed ' +
    'above its lever (still).',
};

const REALISTIC_FIXTURES: FixtureMeta[] = REALISTIC_APPLIANCES.flatMap((spec) =>
  (Object.keys(REALISTIC_CAPTIONS) as RealisticStateId[])
    .filter((state) => supports(getScenario(REALISTIC_STATE_SCENARIO[state]), spec))
    .map((state) => ({
      id: realisticFixtureId(spec.id, state),
      expect: REALISTIC_CAPTIONS[state],
      applianceId: spec.id,
      surface: 'shell' as const,
    })),
);

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
    id: 'gauge/cat1-faces',
    expect:
      'The Cat 1 fitted faces (spec scales, no psi). Two compounds −100…25 (×100) with the vacuum ' +
      'sector, labels every 5 (500 kPa), amber −80…−70, red −100…−80: needles at −40 (in the ' +
      'vacuum sector) and 300. A discharge 0–40 (×100) labelled every 5, amber 11–14 and no red band: ' +
      'needle at 700, low on the face. Two tachos 0–4 (×1000), red 3–4: needles at 2 400 and ' +
      '3 200 (in the red, red readout).',
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
  {
    id: 'menu/fresh',
    expect:
      'Scenario menu: app bar (PUMPOPS, SOUND ON; no SCENARIOS button here), "SCENARIOS", "Pick ' +
      'the truck you’re training on, then a scenario." A YOUR APPLIANCE card: one row per ' +
      'catalogue truck (radio dot, name, fitout line such as "3 deliveries (65, 38, 38 mm) · 3000 L ' +
      'tank · electric primer · tacho"), Category 1 tanker checked with an ink border. Eight paper cards numbered 1–8 in ink discs, each with title, ' +
      'brief and "Not tried yet"; card 1 has an ink border, GUIDED and NEXT UP tags and a filled ' +
      'START button; the rest have outlined START buttons. A FREE PLAY card last.',
  },
  {
    id: 'menu/progress',
    expect:
      'As menu/fresh, but card 1 reads "Passed ★★★ best 100" and card 2 "Passed ★★☆ best 82" ' +
      '(PLAY AGAIN buttons), card 3 "Not passed yet" with NEXT UP and the ink border.',
  },
  {
    id: 'menu/resume',
    expect:
      'As menu/fresh, with a lesson in progress: the YOUR APPLIANCE card ends with "Changing ' +
      'truck ends the lesson in progress." under the truck rows, and a filled RESUME LESSON ' +
      'button sits between that card and the ladder.',
  },
  ...LESSON_FIXTURES,
  ...DEBRIEF_FIXTURES,
  ...PANEL_FIXTURES,
  ...REALISTIC_FIXTURES,
  ...SOURCE_FIXTURES,
  ...SCENE_FIXTURES,
  ...RELAY_FIXTURES,
];

/** File-safe name for screenshots and contact sheets: 'shell/default' → 'shell-default'. */
export function fixtureFileName(id: string): string {
  return id.replaceAll('/', '-');
}
