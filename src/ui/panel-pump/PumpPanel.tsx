import { activeTruck } from '../../state/selectors';
import { useStore } from '../../state/store';
import type { PanelView } from '../../state/persist';
import { getPanelLayout, getRealisticLayout } from '../appliances/registry';
import { RealisticPanel } from '../panel-real/RealisticPanel';
import { itemKey } from '../appliances/itemKey';
import type { PanelSection } from '../appliances/types';
import { CoachAnchor } from './CoachAnchor';
import { PanelItemView } from './PanelItem';
import './PumpPanel.css';

const VIEWS: readonly { id: PanelView; label: string }[] = [
  { id: 'simplified', label: 'Simplified' },
  { id: 'realistic', label: 'Realistic' },
];

function Section({ section }: { section: PanelSection }) {
  const titleId = `panel-section-${section.id}`;
  const items = (
    <div className="panel-section__items">
      {section.items.map((item) => (
        <CoachAnchor key={itemKey(item)} itemKey={itemKey(item)}>
          <PanelItemView item={item} />
        </CoachAnchor>
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
 * The pump panel, rendered from the active appliance's layout data (ARCHITECTURE §9.4): the
 * simplified panel, or the realistic bay where the appliance has one and the player chose it.
 * Generic: nothing here knows which truck it is drawing.
 */
export function PumpPanel() {
  const applianceId = useStore((s) => activeTruck(s.sim).spec.id);
  const name = useStore((s) => activeTruck(s.sim).spec.name);
  // With several trucks on the fireground, say which one this panel is.
  const truckLabel = useStore((s) => (s.sim.trucks.length > 1 ? activeTruck(s.sim).label : null));
  const chosen = useStore((s) => s.saved.settings.panelView);
  const setPanelView = useStore((s) => s.setPanelView);
  const layout = getPanelLayout(applianceId);
  const realistic = getRealisticLayout(applianceId);
  // An appliance without a realistic layout always shows the simplified panel.
  const view: PanelView = realistic === undefined ? 'simplified' : chosen;
  return (
    <div className="pump-panel" data-appliance={applianceId} data-view={view}>
      <div className="pump-panel__header">
        <p className="pump-panel__appliance">
          {truckLabel === null ? name : `${truckLabel} · ${name}`}
        </p>
        {realistic !== undefined && (
          <div className="pump-panel__views" role="group" aria-label="Panel view">
            {VIEWS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className="panel-button pump-panel__view"
                aria-pressed={view === id}
                onClick={() => {
                  setPanelView(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {realistic !== undefined && view === 'realistic' ? (
        <RealisticPanel layout={realistic} simple={layout} />
      ) : (
        layout.sections.map((s) => <Section key={s.id} section={s} />)
      )}
    </div>
  );
}
