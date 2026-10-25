import type { SceneArt } from '../types';

/**
 * Cat 7 tanker from above: a light truck, shorter and narrower than the Cat 1, with a tank hatch,
 * and the pump bay at the rear (Resources/Photos/Cat7_Overview.jpg): the two outlets side by side
 * facing rearward, and the 65 mm suction coupling at the rear corner on the right as the operator
 * faces the bay, which is the truck's left. Which side of the truck the bay's suction sits:
 * PLACEHOLDER — needs Dek.
 */
export const CAT7_SCENE_ART: SceneArt = {
  applianceId: 'cat7-generic',
  lengthU: 96,
  widthU: 38,
  cabU: 28,
  hatch: true,
  couplings: [
    { control: 'd1', kind: 'delivery', x: -48, y: 9, facingDeg: 180 },
    { control: 'd2', kind: 'delivery', x: -48, y: -1, facingDeg: 180 },
    { control: 'suction', kind: 'inlet', x: -40, y: -19, facingDeg: -90 },
  ],
};
