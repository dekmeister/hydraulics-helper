import type { DeliveryGlyph } from '../appliances/types';

const GLYPH_PATH: Readonly<Record<DeliveryGlyph, string>> = {
  circle: 'M10 4 a6 6 0 1 0 0.01 0 Z',
  square: 'M4.5 4.5 H15.5 V15.5 H4.5 Z',
  bar: 'M3 7.5 H17 V12.5 H3 Z',
  hexagon: 'M10 3.5 L15.6 6.75 V13.25 L10 16.5 L4.4 13.25 V6.75 Z',
};

/** Delivery identity: glyph + numeral, never colour alone (Design §2, OPEN_DECISIONS #1 option B). */
export function DeliveryTag({ tag, glyph }: { tag: string; glyph: DeliveryGlyph }) {
  return (
    <span className="delivery-tag" aria-hidden="true">
      <svg viewBox="0 0 20 20" className="delivery-tag__glyph">
        <path d={GLYPH_PATH[glyph]} />
      </svg>
      {tag}
    </span>
  );
}
