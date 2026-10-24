import type { SceneArt } from '../../ui/appliances/types';

/**
 * Scene art for the test-only appliance: shorter, no hatch, and its two deliveries on opposite
 * sides rather than at the rear, so the scene can't assume rear-facing couplings.
 */
export const TEST_APPLIANCE_SCENE_ART: SceneArt = {
  applianceId: 'test-2d',
  lengthU: 96,
  widthU: 42,
  cabU: 28,
  hatch: false,
  couplings: [
    { delivery: 'left', x: -16, y: -21, facingDeg: -90 },
    { delivery: 'right', x: -16, y: 21, facingDeg: 90 },
  ],
};
