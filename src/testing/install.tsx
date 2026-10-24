import { StrictMode } from 'react';
import type { Root } from 'react-dom/client';
import { useStore } from '../state/store';
import { registerPanelLayout, registerSceneArt } from '../ui/appliances/registry';
import { AppShell } from '../ui/layout/AppShell';
import { createTestApi } from './api';
import { TEST_APPLIANCE_LAYOUT } from './appliances/testApplianceLayout';
import { TEST_APPLIANCE_SCENE_ART } from './appliances/testApplianceScene';
import { FixtureView } from './FixtureView';
import { FIXTURES } from './fixtures/catalog';
import { FIXTURE_RENDERERS } from './fixtures/renderers';

/** e2e build entry: expose window.__pumpops and render the app or the ?fixture= gallery entry. */
export function installTestHooks(root: Root): void {
  registerPanelLayout(TEST_APPLIANCE_LAYOUT);
  registerSceneArt(TEST_APPLIANCE_SCENE_ART);
  window.__pumpops = createTestApi();
  const fixtureId = new URLSearchParams(window.location.search).get('fixture');
  if (fixtureId !== null) {
    const renderer = FIXTURE_RENDERERS[fixtureId];
    if (renderer?.state !== undefined) useStore.getState().reset(renderer.state());
    if (renderer?.highlight !== undefined) {
      const { sim, toggleHighlight } = useStore.getState();
      toggleHighlight(renderer.highlight(sim), 'panel');
    }
    const steps = FIXTURES.find((f) => f.id === fixtureId)?.steps;
    if (steps !== undefined) useStore.getState().step(steps);
  }
  root.render(
    <StrictMode>{fixtureId === null ? <AppShell /> : <FixtureView id={fixtureId} />}</StrictMode>,
  );
}
