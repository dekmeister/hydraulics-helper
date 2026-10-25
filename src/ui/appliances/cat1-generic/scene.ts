import type { SceneArt } from '../types';

/**
 * Cat 1 tanker from above: a long tank body with a hatch, white cab, and the pump bay at the rear
 * with the three outlets of Layout A side by side, facing rearward (Design sheet 06), and the
 * 65 mm suction inlet low on the left-hand side towards the rear (Layout A B3). The hydrant-to-tank
 * coupling is on the same side, further forward (which side and where: PLACEHOLDER — needs Dek).
 */
export const CAT1_SCENE_ART: SceneArt = {
  applianceId: 'cat1-generic',
  lengthU: 124,
  widthU: 46,
  cabU: 32,
  hatch: true,
  couplings: [
    { control: 'd1', kind: 'delivery', x: -62, y: -14, facingDeg: 180 },
    { control: 'd2', kind: 'delivery', x: -62, y: 0, facingDeg: 180 },
    { control: 'd3', kind: 'delivery', x: -62, y: 14, facingDeg: 180 },
    { control: 'suction', kind: 'inlet', x: -40, y: -23, facingDeg: -90 },
    { control: 'hydrant-to-tank', kind: 'inlet', x: 0, y: -23, facingDeg: -90 },
  ],
};
