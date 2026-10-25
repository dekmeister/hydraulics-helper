import { useMemo } from 'react';
import type { RealisticLayout, RealPlate } from '../appliances/realistic';
import { realItemKey } from '../appliances/itemKey';
import type { PanelLayout } from '../appliances/types';
import { CoachAnchor } from '../panel-pump/CoachAnchor';
import { PanelItemView } from '../panel-pump/PanelItem';
import { PlateBackdrop } from './PlateBackdrop';
import { RealItemView } from './RealItem';
import './realistic.css';

function Plate({ plate, simple }: { plate: RealPlate; simple: PanelLayout }) {
  // One array per layout, so the memoised items don't re-render with every plate render.
  const items = useMemo(() => simple.sections.flatMap((s) => s.items), [simple]);
  return (
    <figure
      className={`real-plate${plate.inset ? ' real-plate--inset' : ''}`}
      data-plate={plate.id}
    >
      {plate.caption !== null && <figcaption className="panel-caption">{plate.caption}</figcaption>}
      <div
        className="real-plate__canvas"
        style={{ aspectRatio: `${String(plate.viewBox.w)} / ${String(plate.viewBox.h)}` }}
      >
        <PlateBackdrop plate={plate} />
        {plate.items.map((item) => {
          const key = realItemKey(item);
          if (key === null) return null;
          return (
            <CoachAnchor key={key} itemKey={key}>
              <RealItemView item={item} plate={plate} simple={items} />
            </CoachAnchor>
          );
        })}
      </div>
    </figure>
  );
}

/**
 * The realistic pump bay (ARCHITECTURE §9.4): the truck's own arrangement, drawn from its
 * realistic layout, plate by plate as on the truck, with the insets side by side under them and
 * the warning strip last. Generic: nothing here knows which truck it is drawing.
 */
export function RealisticPanel({
  layout,
  simple,
}: {
  layout: RealisticLayout;
  simple: PanelLayout;
}) {
  const main = layout.plates.filter((p) => !p.inset);
  const insets = layout.plates.filter((p) => p.inset);
  const insetW = insets.reduce((w, p) => w + p.viewBox.w, 0);
  return (
    <div className="real-panel">
      {main.map((p) => (
        <Plate key={p.id} plate={p} simple={simple} />
      ))}
      {insets.length > 0 && (
        <div
          className="real-panel__insets"
          style={{
            gridTemplateColumns: insets.map((p) => `${String(p.viewBox.w / insetW)}fr`).join(' '),
          }}
        >
          {insets.map((p) => (
            <Plate key={p.id} plate={p} simple={simple} />
          ))}
        </div>
      )}
      <CoachAnchor itemKey="warnings">
        <PanelItemView item={{ kind: 'warnings' }} />
      </CoachAnchor>
    </div>
  );
}
