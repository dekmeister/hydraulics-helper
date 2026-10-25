import type { ReactElement } from 'react';
import type { ApplianceSpec, ControlId, GaugeScaleSpec, SimState } from '../../sim/types';
import { CAT1 } from '../../sim/appliances/cat1';
import { SceneView } from '../../ui/panel-scene/SceneView';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { getScenario } from '../../sim/scenarios';
import { supports } from '../../sim/scenarios/types';
import { useStore } from '../../state/store';
import { defaultSaved } from '../../state/persist';
import { AppRoot } from '../../ui/layout/AppRoot';
import { AppShell } from '../../ui/layout/AppShell';
import { lessonState, savedProgress, type LessonStateId } from './lessonStates';
import {
  PANEL_FIXTURE_SETS,
  panelFixtureId,
  SCENE_FIXTURE_SETS,
  sceneFixtureId,
  LESSON_FIXTURE_SETS,
  RELAY_FIXTURE_SETS,
  relayFixtureId,
  SOURCE_FIXTURE_SETS,
} from './catalog';
import { RELAY_STATE_SCENARIO, relayState } from './relayStates';
import {
  REALISTIC_APPLIANCES,
  REALISTIC_STATE_SCENARIO,
  realisticFixtureId,
  realisticState,
  type RealisticStateId,
} from './realisticStates';
import { SOURCE_STATE_SCENARIO, sourceState, type SourceStateId } from './sourceStates';
import {
  DialsGallery,
  GaugeGallery,
  TankGallery,
  ThrottlePrimerGallery,
  ValveGallery,
  WakeGallery,
} from './galleries';
import { panelState, sceneState, type PanelStateId, type SceneStateId } from './panelStates';

export interface FixtureRenderer {
  /** Sim state loaded into the store before rendering. */
  state?: () => SimState;
  /** Scenario the state comes from, so the header picker shows it. */
  scenario?: string;
  /** Store set-up after the state loads (lessons, screens, saved progress). */
  setup?: () => void;
  /** Delivery highlighted on the scene and panel after the state loads. */
  highlight?: (sim: SimState) => ControlId;
  render: () => ReactElement;
}

/** Component galleries show Design sheet 02's faces, independent of any appliance. */
/** The Cat 1's fitted faces (spec scales) at typical working readings and at their limits. */
function cat1FaceCards() {
  const scale = (id: string): GaugeScaleSpec => {
    const instrument = CAT1.instruments.find((i) => i.id === id);
    if (instrument === undefined || instrument.kind === 'tank') throw new Error(`no dial '${id}'`);
    return instrument.scale;
  };
  return [
    { dial: 'compound', scale: scale('compound'), value: -40, unit: 'kPa', label: 'Compound' },
    { dial: 'compound', scale: scale('compound'), value: 300, unit: 'kPa', label: 'Compound' },
    { dial: 'discharge', scale: scale('discharge'), value: 700, unit: 'kPa', label: 'Discharge' },
    { dial: 'tacho', scale: scale('tacho'), value: 2400, unit: 'rpm', label: 'Engine rpm' },
    { dial: 'tacho', scale: scale('tacho'), value: 3200, unit: 'rpm', label: 'Engine rpm' },
  ] as const;
}

const SHEET_02 = {
  discharge: {
    fullScale: 1600,
    zones: [
      { from: 1200, to: 1400, tone: 'caution' },
      { from: 1400, to: 1600, tone: 'alarm' },
    ],
  },
  compound: {
    fullScale: 1600,
    zones: [
      { from: -85, to: -70, tone: 'caution' },
      { from: -100, to: -85, tone: 'alarm' },
    ],
  },
  tacho: { fullScale: 4000, zones: [{ from: 3500, to: 4000, tone: 'alarm' }] },
} as const satisfies Record<string, GaugeScaleSpec>;

/** Generated panel renderers, one per catalogued panel fixture (same list as the catalog). */
function panelRenderers(): Record<string, FixtureRenderer> {
  const out: Record<string, FixtureRenderer> = {};
  for (const { spec, states } of PANEL_FIXTURE_SETS) {
    for (const state of states) {
      out[panelFixtureId(spec.id, state)] = {
        state: () => panelState(spec, state satisfies PanelStateId),
        scenario: 'tank-attack',
        render: () => <AppShell />,
      };
    }
  }
  return out;
}

/** The first laid line's delivery: what a highlighted fixture picks out. */
function firstLineDelivery(sim: SimState): ControlId {
  const first = sim.lines[0];
  if (first === undefined) throw new Error('no line laid');
  return first.deliveryId;
}

/** Show the realistic view, without saving the choice. */
function showRealistic(): void {
  useStore.setState((s) => ({
    saved: { ...s.saved, settings: { ...s.saved.settings, panelView: 'realistic' } },
  }));
}

/** Generated realistic-view renderers, one per catalogued realistic fixture. */
function realisticRenderers(): Record<string, FixtureRenderer> {
  const out: Record<string, FixtureRenderer> = {};
  for (const spec of REALISTIC_APPLIANCES) {
    for (const state of Object.keys(REALISTIC_STATE_SCENARIO) as RealisticStateId[]) {
      // As the catalogue: only the states whose fireground this appliance can play.
      if (!supports(getScenario(REALISTIC_STATE_SCENARIO[state]), spec)) continue;
      out[realisticFixtureId(spec.id, state)] = {
        state: () => realisticState(spec, state),
        scenario: REALISTIC_STATE_SCENARIO[state],
        setup: showRealistic,
        ...(state === 'highlighted' ? { highlight: firstLineDelivery } : {}),
        render: () => <AppShell />,
      };
    }
  }
  return out;
}

/** Generated source and fault renderers, one per catalogued source fixture. */
function sourceRenderers(): Record<string, FixtureRenderer> {
  const out: Record<string, FixtureRenderer> = {};
  for (const { spec, states } of SOURCE_FIXTURE_SETS) {
    for (const state of states) {
      out[panelFixtureId(spec.id, state)] = {
        state: () => sourceState(spec, state satisfies SourceStateId),
        scenario: SOURCE_STATE_SCENARIO[state],
        render: () => <AppShell />,
      };
    }
  }
  return out;
}

/** Generated relay renderers, one per catalogued relay fixture. */
function relayRenderers(): Record<string, FixtureRenderer> {
  const out: Record<string, FixtureRenderer> = {};
  for (const set of RELAY_FIXTURE_SETS) {
    const support = set.base === undefined ? undefined : { base: set.base };
    for (const state of set.states) {
      out[relayFixtureId(set, state)] = {
        state: () => relayState(set.spec, state, support),
        scenario: RELAY_STATE_SCENARIO[state],
        render: () => <AppShell />,
      };
    }
  }
  return out;
}

/** Put a lesson state in the store, on `screen`. */
function loadLesson(spec: ApplianceSpec, id: LessonStateId, screen: 'play' | 'debrief'): void {
  const { sim, lesson, inputs } = lessonState(spec, id);
  useStore.getState().reset(sim, lesson.scenarioId);
  useStore.setState({ lesson, inputs, screen, saved: defaultSaved() });
}

/** Generated menu, lesson and debrief renderers. */
function lessonRenderers(): Record<string, FixtureRenderer> {
  const out: Record<string, FixtureRenderer> = {};
  const menu = (saved: () => ReturnType<typeof defaultSaved>) => () => {
    useStore.setState({ screen: 'menu', saved: saved() });
  };
  out['menu/fresh'] = { setup: menu(defaultSaved), render: () => <AppRoot /> };
  out['menu/progress'] = {
    setup: menu(() => savedProgress(useStore.getState().playerSpec)),
    render: () => <AppRoot />,
  };
  out['menu/resume'] = {
    setup: () => {
      loadLesson(useStore.getState().playerSpec, 'guided', 'play');
      useStore.setState({ screen: 'menu' });
    },
    render: () => <AppRoot />,
  };
  for (const { spec, states } of LESSON_FIXTURE_SETS) {
    for (const state of states) {
      out[`lesson/${spec.id}/${state}`] = {
        setup: () => {
          loadLesson(spec, state, 'play');
          if (state === 'incident') useStore.setState({ lessonListOpen: true });
        },
        render: () => <AppRoot />,
      };
    }
  }
  for (const spec of APPLIANCES) {
    for (const state of ['passed', 'failed'] as const) {
      out[`debrief/${spec.id}/${state}`] = {
        setup: () => {
          loadLesson(spec, state, 'debrief');
        },
        render: () => <AppRoot />,
      };
    }
  }
  return out;
}

/** The scene panel on its own, framed as in the app shell. */
function SceneAlone() {
  return (
    <main className="fixture-scene">
      <section className="app-panel" aria-labelledby="scene-title">
        <h2 id="scene-title" className="app-panel__title">
          Scene
        </h2>
        <SceneView />
      </section>
    </main>
  );
}

/** Generated scene renderers, one per catalogued scene fixture, plus the highlighted shell. */
function sceneRenderers(): Record<string, FixtureRenderer> {
  const out: Record<string, FixtureRenderer> = {};
  for (const { spec, states } of SCENE_FIXTURE_SETS) {
    for (const state of states) {
      out[sceneFixtureId(spec.id, state)] = {
        state: () => sceneState(spec, state satisfies SceneStateId),
        render: () => <SceneAlone />,
      };
    }
    out[sceneFixtureId(spec.id, 'highlighted')] = {
      state: () => sceneState(spec, 'all-charged'),
      scenario: 'tank-attack',
      highlight: (sim) => {
        const first = sim.lines[0];
        if (first === undefined) throw new Error(`no line laid on ${spec.id}`);
        return first.deliveryId;
      },
      render: () => <AppShell />,
    };
  }
  return out;
}

export const FIXTURE_RENDERERS: Record<string, FixtureRenderer> = {
  'shell/default': { render: () => <AppShell /> },
  'gauge/discharge': {
    render: () => (
      <GaugeGallery
        dial="discharge"
        scale={SHEET_02.discharge}
        unit="kPa"
        label="Discharge"
        values={[0, 700, 1450]}
      />
    ),
  },
  'gauge/compound': {
    render: () => (
      <GaugeGallery
        dial="compound"
        scale={SHEET_02.compound}
        unit="kPa"
        label="Compound"
        values={[-60, -90, 0, 350]}
      />
    ),
  },
  'gauge/tacho': {
    render: () => (
      <GaugeGallery
        dial="tacho"
        scale={SHEET_02.tacho}
        unit="rpm"
        label="Engine rpm"
        values={[800, 2400, 3700]}
      />
    ),
  },
  'gauge/cat1-faces': { render: () => <DialsGallery cards={cat1FaceCards()} /> },
  'gauge/wake': { render: () => <WakeGallery scale={SHEET_02} /> },
  'gauge/tank': { render: () => <TankGallery capacityL={3000} values={[3000, 2000, 600, 0]} /> },
  'controls/valves': { render: () => <ValveGallery /> },
  'controls/throttle-primer': { render: () => <ThrottlePrimerGallery /> },
  ...panelRenderers(),
  ...realisticRenderers(),
  ...sourceRenderers(),
  ...sceneRenderers(),
  ...relayRenderers(),
  ...lessonRenderers(),
};
