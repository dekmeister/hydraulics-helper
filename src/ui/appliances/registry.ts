import type { PanelLayout, SceneArt } from './types';
import { CAT1_LAYOUT } from './cat1-generic/layout';
import { CAT1_REALISTIC } from './cat1-generic/realistic';
import type { RealisticLayout } from './realistic';
import { CAT1_SCENE_ART } from './cat1-generic/scene';
import { CAT7_LAYOUT } from './cat7-generic/layout';
import { CAT7_SCENE_ART } from './cat7-generic/scene';

/** Panel layout per catalogue appliance id. Every catalogue appliance must have one (tested). */
export const CATALOGUE_LAYOUTS: readonly PanelLayout[] = [CAT1_LAYOUT, CAT7_LAYOUT];

const LAYOUTS = new Map<string, PanelLayout>(CATALOGUE_LAYOUTS.map((l) => [l.applianceId, l]));

/** Add a layout outside the catalogue; the e2e build registers the test appliance's this way. */
export function registerPanelLayout(layout: PanelLayout): void {
  LAYOUTS.set(layout.applianceId, layout);
}

export function getPanelLayout(applianceId: string): PanelLayout {
  const layout = LAYOUTS.get(applianceId);
  if (layout === undefined) throw new Error(`No panel layout for appliance '${applianceId}'`);
  return layout;
}

/**
 * Realistic layouts by appliance id. Optional: an appliance without one shows only the simplified
 * panel. Every one must match its appliance's spec and simplified layout (tested).
 */
const REALISTIC = new Map<string, RealisticLayout>([[CAT1_REALISTIC.applianceId, CAT1_REALISTIC]]);

export const CATALOGUE_REALISTIC: readonly RealisticLayout[] = [CAT1_REALISTIC];

export function getRealisticLayout(applianceId: string): RealisticLayout | undefined {
  return REALISTIC.get(applianceId);
}

/** Scene art per catalogue appliance id. Every catalogue appliance must have it (tested). */
export const CATALOGUE_SCENE_ART: readonly SceneArt[] = [CAT1_SCENE_ART, CAT7_SCENE_ART];

const SCENE_ART = new Map<string, SceneArt>(CATALOGUE_SCENE_ART.map((a) => [a.applianceId, a]));

/** Add scene art outside the catalogue; the e2e build registers the test appliance's this way. */
export function registerSceneArt(art: SceneArt): void {
  SCENE_ART.set(art.applianceId, art);
}

export function getSceneArt(applianceId: string): SceneArt {
  const art = SCENE_ART.get(applianceId);
  if (art === undefined) throw new Error(`No scene art for appliance '${applianceId}'`);
  return art;
}
