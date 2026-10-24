import type { ReactElement } from 'react';
import type { ControlId, GaugeScaleSpec, SimState } from '../../sim/types';
import { SceneView } from '../../ui/panel-scene/SceneView';
import { AppShell } from '../../ui/layout/AppShell';
import { PANEL_FIXTURE_SETS, panelFixtureId, SCENE_FIXTURE_SETS, sceneFixtureId } from './catalog';
import { GaugeGallery, TankGallery, ThrottlePrimerGallery, ValveGallery } from './galleries';
import { panelState, sceneState, type PanelStateId, type SceneStateId } from './panelStates';

export interface FixtureRenderer {
  /** Sim state loaded into the store before rendering. */
  state?: () => SimState;
  /** Delivery highlighted on the scene and panel after the state loads. */
  highlight?: (sim: SimState) => ControlId;
  render: () => ReactElement;
}

/** Component galleries show Design sheet 02's faces, independent of any appliance. */
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
        render: () => <AppShell />,
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
  'gauge/tank': { render: () => <TankGallery capacityL={3000} values={[3000, 2000, 600, 0]} /> },
  'controls/valves': { render: () => <ValveGallery /> },
  'controls/throttle-primer': { render: () => <ThrottlePrimerGallery /> },
  ...panelRenderers(),
  ...sceneRenderers(),
};
