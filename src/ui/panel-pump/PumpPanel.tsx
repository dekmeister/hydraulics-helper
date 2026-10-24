import { useMemo } from 'react';
import { vernierStep } from './controls/controlMath';
import {
  activeTruck,
  INSTRUMENT_UNIT,
  instrumentValue,
  lineOnDelivery,
  selectWarnings,
} from '../../state/selectors';
import { useStore } from '../../state/store';
import type { ApplianceSpec, TruckState } from '../../sim/types';
import { getPanelLayout } from '../appliances/registry';
import type { PanelItem, PanelSection } from '../appliances/types';
import { PrimerControl } from './controls/PrimerControl';
import { Throttle } from './controls/Throttle';
import { ValveHandle } from './controls/ValveHandle';
import { DeliveryTag } from './DeliveryTag';
import { DIALS } from './gauge/dials';
import { Gauge } from './gauge/Gauge';
import { range } from './gauge/gaugeScale';
import { TankLevel } from './gauge/TankLevel';
import { describeLine } from './lineText';
import { useDampedValue } from './useDampedValue';
import { WarningStrip } from './WarningStrip';
import './PumpPanel.css';

function instrumentKind(spec: ApplianceSpec, id: string) {
  const instrument = spec.instruments.find((i) => i.id === id);
  if (instrument === undefined) throw new Error(`${spec.id} has no instrument '${id}'`);
  return instrument.kind;
}

function DialInstrument({
  truck,
  item,
}: {
  truck: TruckState;
  item: Extract<PanelItem, { kind: 'gauge' }>;
}) {
  const dial = DIALS[item.dial];
  const [lo, hi] = range(dial);
  const kind = instrumentKind(truck.spec, item.instrument);
  const value = useDampedValue(instrumentValue(truck, kind), hi - lo);
  return (
    <Gauge
      dial={dial}
      value={value}
      label={item.label}
      unit={INSTRUMENT_UNIT[kind]}
      size={item.size}
      {...(item.plate === undefined ? {} : { plate: item.plate })}
    />
  );
}

function TankInstrument({
  truck,
  item,
}: {
  truck: TruckState;
  item: Extract<PanelItem, { kind: 'tank-level' }>;
}) {
  const capacityL = truck.spec.tank?.capacityL ?? 0;
  const kind = instrumentKind(truck.spec, item.instrument);
  const valueL = useDampedValue(instrumentValue(truck, kind), capacityL);
  return <TankLevel valueL={valueL} capacityL={capacityL} label={item.label} />;
}

function DeliveryRow({ item }: { item: Extract<PanelItem, { kind: 'delivery' }> }) {
  const sim = useStore((s) => s.sim);
  const open = useStore((s) => s.inputs.valves[item.control] ?? 0);
  const setValve = useStore((s) => s.setValve);
  const spec = activeTruck(sim).spec;
  const delivery = spec.deliveries.find((d) => d.id === item.control);
  const line = lineOnDelivery(sim, item.control);
  return (
    <div className="delivery-row">
      <div className="delivery-row__text">
        <DeliveryTag tag={item.tag} glyph={item.glyph} />
        <span className="delivery-row__name">
          {item.label}
          {delivery === undefined ? '' : ` · ${String(delivery.sizeMm)} mm`}
        </span>
        <span className="delivery-row__line">
          {line === undefined ? 'No line laid' : describeLine(line)}
        </span>
      </div>
      <ValveHandle
        label={item.label}
        value={open}
        onChange={(v) => {
          setValve(item.control, v);
        }}
        function="outlet"
        tap={item.tap}
        {...(line === undefined ? { disabledReason: 'NO LINE' } : {})}
      />
    </div>
  );
}

function Item({ item }: { item: PanelItem }) {
  const sim = useStore((s) => s.sim);
  const inputs = useStore((s) => s.inputs);
  const { setValve, setThrottle, setSwitch } = useStore.getState();
  const truck = activeTruck(sim);
  const warnings = useMemo(() => selectWarnings(sim, inputs), [sim, inputs]);
  switch (item.kind) {
    case 'gauge':
      return <DialInstrument truck={truck} item={item} />;
    case 'tank-level':
      return <TankInstrument truck={truck} item={item} />;
    case 'valve':
      return (
        <div className="panel-control">
          <span className="panel-caption">{item.label}</span>
          <ValveHandle
            label={item.label}
            value={inputs.valves[item.control] ?? 0}
            onChange={(v) => {
              setValve(item.control, v);
            }}
            function={item.function}
            tap={item.tap}
          />
        </div>
      );
    case 'delivery':
      return <DeliveryRow item={item} />;
    case 'throttle':
      return (
        <Throttle
          label={item.label}
          value={inputs.throttle}
          onChange={setThrottle}
          vernierStep={vernierStep(truck.spec.engine.idleRpm, truck.spec.engine.maxRpm)}
        />
      );
    case 'primer':
      return (
        <div className="panel-control">
          <span className="panel-caption">{item.label}</span>
          <PrimerControl
            label={item.label}
            on={inputs.switches[item.control] ?? false}
            onChange={(on) => {
              setSwitch(item.control, on);
            }}
          />
        </div>
      );
    case 'warnings':
      return <WarningStrip warnings={warnings} />;
  }
}

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
        <Item key={itemKey(item)} item={item} />
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
  const layout = getPanelLayout(applianceId);
  return (
    <div className="pump-panel" data-appliance={applianceId}>
      <p className="pump-panel__appliance">{name}</p>
      {layout.sections.map((s) => (
        <Section key={s.id} section={s} />
      ))}
    </div>
  );
}
