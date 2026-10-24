import type { ReactElement } from 'react';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import type { ApplianceSpec, SimState } from '../../sim/types';
import { AppShell } from '../../ui/layout/AppShell';
import { FIXTURES, panelFixtureId } from './catalog';
import { GaugeGallery, TankGallery, ThrottlePrimerGallery, ValveGallery } from './galleries';
import { panelState, type PanelStateId } from './panelStates';

export interface FixtureRenderer {
  /** Sim state loaded into the store before rendering. */
  state?: () => SimState;
  render: () => ReactElement;
}

const PANEL_SPECS: readonly ApplianceSpec[] = [...APPLIANCES, TEST_APPLIANCE];

/** Generated panel renderers, one per catalogued panel fixture id. */
function panelRenderers(): Record<string, FixtureRenderer> {
  const out: Record<string, FixtureRenderer> = {};
  for (const spec of PANEL_SPECS) {
    for (const state of ['idle', 'tank-attack-700', 'tank-low', 'tank-empty'] as const) {
      const id = panelFixtureId(spec.id, state);
      if (!FIXTURES.some((f) => f.id === id)) continue;
      out[id] = {
        state: () => panelState(spec, state satisfies PanelStateId),
        render: () => <AppShell />,
      };
    }
  }
  return out;
}

export const FIXTURE_RENDERERS: Record<string, FixtureRenderer> = {
  'shell/default': { render: () => <AppShell /> },
  'gauge/discharge': {
    render: () => (
      <GaugeGallery dial="discharge" unit="kPa" label="Discharge" values={[0, 700, 1450]} />
    ),
  },
  'gauge/compound': {
    render: () => (
      <GaugeGallery dial="compound" unit="kPa" label="Compound" values={[-60, -90, 0, 350]} />
    ),
  },
  'gauge/tacho': {
    render: () => (
      <GaugeGallery dial="tacho" unit="rpm" label="Engine rpm" values={[800, 2400, 3700]} />
    ),
  },
  'gauge/tank': { render: () => <TankGallery capacityL={3000} values={[3000, 2000, 600, 0]} /> },
  'controls/valves': { render: () => <ValveGallery /> },
  'controls/throttle-primer': { render: () => <ThrottlePrimerGallery /> },
  ...panelRenderers(),
};
