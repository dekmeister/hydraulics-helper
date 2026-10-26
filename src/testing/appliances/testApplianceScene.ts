import type { SceneArt } from '../../ui/appliances/types';

/**
 * Scene art for the test-only appliance: shorter, no hatch, and its two deliveries on opposite
 * sides rather than at the rear, so the scene can't assume rear-facing couplings; its intake is on
 * the right-hand side towards the cab, its tank fill on the left.
 */
export const TEST_APPLIANCE_SCENE_ART: SceneArt = {
  applianceId: 'test-2d',
  lengthU: 96,
  widthU: 42,
  cabU: 28,
  hatch: false,
  couplings: [
    { control: 'left', kind: 'delivery', x: -16, y: -21, facingDeg: -90 },
    { control: 'right', kind: 'delivery', x: -16, y: 21, facingDeg: 90 },
    { control: 'intake', kind: 'inlet', x: 14, y: 21, facingDeg: 90 },
    { control: 'fill', kind: 'inlet', x: 30, y: -21, facingDeg: -90 },
  ],
};
