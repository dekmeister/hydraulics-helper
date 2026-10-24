import type { SceneArt } from '../types';

/**
 * Cat 1 tanker from above: a long tank body with a hatch, white cab, and the pump bay at the rear
 * with the three outlets of Layout A side by side, facing rearward (Design sheet 06).
 */
export const CAT1_SCENE_ART: SceneArt = {
  applianceId: 'cat1-generic',
  lengthU: 124,
  widthU: 46,
  cabU: 32,
  hatch: true,
  couplings: [
    { delivery: 'd1', x: -62, y: -14, facingDeg: 180 },
    { delivery: 'd2', x: -62, y: 0, facingDeg: 180 },
    { delivery: 'd3', x: -62, y: 14, facingDeg: 180 },
  ],
};
