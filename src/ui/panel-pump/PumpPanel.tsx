import { activeTruck } from '../../state/selectors';
import { useStore } from '../../state/store';
import { getPanelLayout } from '../appliances/registry';
import type { PanelItem, PanelSection } from '../appliances/types';
import { PanelItemView } from './PanelItem';
import './PumpPanel.css';

function itemKey(item: PanelItem): string {
  switch (item.kind) {
    case 'gauge':
    case 'tank-level':
      return `i:${item.instrument}`;
    case 'valve':
    case 'delivery':
    case 'primer':
      return `c:${item.control}`;
    case 'throttle':
    case 'warnings':
      return item.kind;
  }
}

function Section({ section }: { section: PanelSection }) {
  const titleId = `panel-section-${section.id}`;
  const items = (
    <div className="panel-section__items">
      {section.items.map((item) => (
        <PanelItemView key={itemKey(item)} item={item} />
      ))}
    </div>
  );
  const className = `panel-section panel-section--${section.arrangement}`;
  if (section.title === null) return <div className={className}>{items}</div>;
  return (
    <section className={className} aria-labelledby={titleId}>
      <h3 id={titleId} className="panel-section__title">
        {section.title}
      </h3>
      {items}
    </section>
  );
}

/**
 * The pump panel, rendered from the active appliance's layout data (ARCHITECTURE §9.4). Generic:
 * nothing here knows which truck it is drawing.
 */
export function PumpPanel() {
  const applianceId = useStore((s) => activeTruck(s.sim).spec.id);
  const name = useStore((s) => activeTruck(s.sim).spec.name);
  // With several trucks on the fireground, say which one this panel is.
  const truckLabel = useStore((s) => (s.sim.trucks.length > 1 ? activeTruck(s.sim).label : null));
  const layout = getPanelLayout(applianceId);
  return (
    <div className="pump-panel" data-appliance={applianceId}>
      <p className="pump-panel__appliance">
        {truckLabel === null ? name : `${truckLabel} · ${name}`}
      </p>
      {layout.sections.map((s) => (
        <Section key={s.id} section={s} />
      ))}
    </div>
  );
}
