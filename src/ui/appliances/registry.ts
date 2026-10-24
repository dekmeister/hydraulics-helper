import type { PanelLayout } from './types';
import { CAT1_LAYOUT } from './cat1-generic/layout';

/** Panel layout per catalogue appliance id. Every catalogue appliance must have one (tested). */
const LAYOUTS = new Map<string, PanelLayout>([[CAT1_LAYOUT.applianceId, CAT1_LAYOUT]]);

export const CATALOGUE_LAYOUTS: readonly PanelLayout[] = [CAT1_LAYOUT];

/** Add a layout outside the catalogue; the e2e build registers the test appliance's this way. */
export function registerPanelLayout(layout: PanelLayout): void {
  LAYOUTS.set(layout.applianceId, layout);
}

export function getPanelLayout(applianceId: string): PanelLayout {
  const layout = LAYOUTS.get(applianceId);
  if (layout === undefined) throw new Error(`No panel layout for appliance '${applianceId}'`);
  return layout;
}
