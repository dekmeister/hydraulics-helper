import type { DeliveryGlyph } from './types';

/** Delivery identity glyphs in a 20 × 20 box (Design §2); shared by the panel tag and the scene. */
export const GLYPH_PATH: Readonly<Record<DeliveryGlyph, string>> = {
  circle: 'M10 4 a6 6 0 1 0 0.01 0 Z',
  square: 'M4.5 4.5 H15.5 V15.5 H4.5 Z',
  bar: 'M3 7.5 H17 V12.5 H3 Z',
  hexagon: 'M10 3.5 L15.6 6.75 V13.25 L10 16.5 L4.4 13.25 V6.75 Z',
};
