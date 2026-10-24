import type { PanelLayout, SceneArt } from './types';
import { CAT1_LAYOUT } from './cat1-generic/layout';
import { CAT1_SCENE_ART } from './cat1-generic/scene';

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

/** Scene art per catalogue appliance id. Every catalogue appliance must have it (tested). */
const SCENE_ART = new Map<string, SceneArt>([[CAT1_SCENE_ART.applianceId, CAT1_SCENE_ART]]);

export const CATALOGUE_SCENE_ART: readonly SceneArt[] = [CAT1_SCENE_ART];

/** Add scene art outside the catalogue; the e2e build registers the test appliance's this way. */
export function registerSceneArt(art: SceneArt): void {
  SCENE_ART.set(art.applianceId, art);
}

export function getSceneArt(applianceId: string): SceneArt {
  const art = SCENE_ART.get(applianceId);
  if (art === undefined) throw new Error(`No scene art for appliance '${applianceId}'`);
  return art;
}
