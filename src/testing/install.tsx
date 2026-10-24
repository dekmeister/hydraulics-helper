import { StrictMode } from 'react';
import type { Root } from 'react-dom/client';
import { useStore } from '../state/store';
import { AppShell } from '../ui/layout/AppShell';
import { createTestApi } from './api';
import { FixtureView } from './FixtureView';
import { FIXTURES } from './fixtures/catalog';

/** e2e build entry: expose window.__pumpops and render the app or the ?fixture= gallery entry. */
export function installTestHooks(root: Root): void {
  window.__pumpops = createTestApi();
  const fixtureId = new URLSearchParams(window.location.search).get('fixture');
  const steps = FIXTURES.find((f) => f.id === fixtureId)?.steps;
  if (steps !== undefined) useStore.getState().step(steps);
  root.render(
    <StrictMode>{fixtureId === null ? <AppShell /> : <FixtureView id={fixtureId} />}</StrictMode>,
  );
}
