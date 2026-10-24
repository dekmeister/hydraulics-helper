import type { ControlId } from '../../sim/types';
import type { DeliveryGlyph, PanelLayout } from './types';

/** How a delivery is named and marked, on the panel and the scene alike. */
export interface DeliveryIdentity {
  label: string;
  tag: string;
  glyph: DeliveryGlyph;
}

/**
 * Each delivery's label, tag and glyph, taken from its panel layout row so the scene can never
 * disagree with the panel (the layout test places every delivery exactly once).
 */
export function deliveryIdentities(layout: PanelLayout): ReadonlyMap<ControlId, DeliveryIdentity> {
  const out = new Map<ControlId, DeliveryIdentity>();
  for (const item of layout.sections.flatMap((s) => s.items)) {
    if (item.kind === 'delivery') {
      out.set(item.control, { label: item.label, tag: item.tag, glyph: item.glyph });
    }
  }
  return out;
}

export function deliveryIdentity(layout: PanelLayout, deliveryId: ControlId): DeliveryIdentity {
  const identity = deliveryIdentities(layout).get(deliveryId);
  if (identity === undefined) {
    throw new Error(`${layout.applianceId} layout places no delivery '${deliveryId}'`);
  }
  return identity;
}
