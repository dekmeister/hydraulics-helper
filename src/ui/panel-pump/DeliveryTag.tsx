import { GLYPH_PATH } from '../appliances/glyphs';
import type { DeliveryGlyph } from '../appliances/types';

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
