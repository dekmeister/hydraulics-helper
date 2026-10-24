import { memo, useEffect, useMemo, useRef } from 'react';
import { vernierStep } from './controls/controlMath';
import {
  activeTruck,
  INSTRUMENT_UNIT,
  instrumentValue,
  lineOnDelivery,
  selectWarnings,
} from '../../state/selectors';
import { useStore } from '../../state/store';
import type { ApplianceSpec, InstrumentSpec } from '../../sim/types';
import type { PanelItem } from '../appliances/types';
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

// Each panel item subscribes to the narrowest slice of the store it needs, so a sim tick re-renders
// only the readings that changed rather than every control on the panel.

function findInstrument(spec: ApplianceSpec, id: string): InstrumentSpec {
  const instrument = spec.instruments.find((i) => i.id === id);
  if (instrument === undefined) throw new Error(`${spec.id} has no instrument '${id}'`);
  return instrument;
}

const useActiveSpec = () => useStore((s) => activeTruck(s.sim).spec);

/** The active truck's reading for an instrument, in its native unit. */
const useReading = (instrument: InstrumentSpec) =>
  useStore((s) => instrumentValue(activeTruck(s.sim), instrument.kind));

function DialInstrument({ item }: { item: Extract<PanelItem, { kind: 'gauge' }> }) {
  const instrument = findInstrument(useActiveSpec(), item.instrument);
  if (instrument.kind === 'tank') throw new Error(`'${item.instrument}' is not a dial instrument`);
  const { scale } = instrument;
  const dial = useMemo(() => DIALS[item.dial](scale), [item.dial, scale]);
  const [lo, hi] = range(dial);
  const value = useDampedValue(useReading(instrument), hi - lo);
  return (
    <Gauge
      dial={dial}
      value={value}
      label={item.label}
      unit={INSTRUMENT_UNIT[instrument.kind]}
      size={item.size}
      {...(item.plate === undefined ? {} : { plate: item.plate })}
    />
  );
}

function TankInstrument({ item }: { item: Extract<PanelItem, { kind: 'tank-level' }> }) {
  const spec = useActiveSpec();
  const capacityL = spec.tank?.capacityL ?? 0;
  const valueL = useDampedValue(useReading(findInstrument(spec, item.instrument)), capacityL);
  return <TankLevel valueL={valueL} capacityL={capacityL} label={item.label} />;
}

function DeliveryRow({ item }: { item: Extract<PanelItem, { kind: 'delivery' }> }) {
  const spec = useActiveSpec();
  const line = useStore((s) => lineOnDelivery(s.sim, item.control));
  const open = useStore((s) => s.inputs.valves[item.control] ?? 0);
  const setValve = useStore((s) => s.setValve);
  const highlight = useStore((s) =>
    s.highlight?.deliveryId === item.control ? s.highlight.from : null,
  );
  const toggleHighlight = useStore((s) => s.toggleHighlight);
  const rowRef = useRef<HTMLDivElement>(null);
  const delivery = spec.deliveries.find((d) => d.id === item.control);

  // Picked on the scene: bring this row into view (it's below the scene on a phone).
  useEffect(() => {
    if (highlight === 'scene') rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  return (
    <div
      ref={rowRef}
      className={highlight === null ? 'delivery-row' : 'delivery-row delivery-row--highlighted'}
      data-delivery={item.control}
      data-highlighted={highlight !== null}
    >
      <button
        type="button"
        className="delivery-row__text"
        aria-label={`Show ${item.label} on scene`}
        aria-pressed={highlight !== null}
        onClick={() => {
          toggleHighlight(item.control, 'panel');
        }}
      >
        <DeliveryTag tag={item.tag} glyph={item.glyph} />
        <span className="delivery-row__name">
          {item.label}
          {delivery === undefined ? '' : ` · ${String(delivery.sizeMm)} mm`}
        </span>
        <span className="delivery-row__line">
          {line === undefined ? 'No line laid' : describeLine(line)}
        </span>
      </button>
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

function ValveItem({ item }: { item: Extract<PanelItem, { kind: 'valve' }> }) {
  const open = useStore((s) => s.inputs.valves[item.control] ?? 0);
  const setValve = useStore((s) => s.setValve);
  return (
    <div className="panel-control">
      <span className="panel-caption">{item.label}</span>
      <ValveHandle
        label={item.label}
        value={open}
        onChange={(v) => {
          setValve(item.control, v);
        }}
        function={item.function}
        tap={item.tap}
      />
    </div>
  );
}

function ThrottleItem({ item }: { item: Extract<PanelItem, { kind: 'throttle' }> }) {
  const { engine } = useActiveSpec();
  const position = useStore((s) => s.inputs.throttle);
  const setThrottle = useStore((s) => s.setThrottle);
  return (
    <Throttle
      label={item.label}
      value={position}
      onChange={setThrottle}
      vernierStep={vernierStep(engine.idleRpm, engine.maxRpm)}
    />
  );
}

function PrimerItem({ item }: { item: Extract<PanelItem, { kind: 'primer' }> }) {
  const on = useStore((s) => s.inputs.switches[item.control] ?? false);
  const setSwitch = useStore((s) => s.setSwitch);
  return (
    <div className="panel-control">
      <span className="panel-caption">{item.label}</span>
      <PrimerControl
        label={item.label}
        on={on}
        onChange={(v) => {
          setSwitch(item.control, v);
        }}
      />
    </div>
  );
}

/** Warnings depend on the whole sim and inputs, so only the strip re-renders every tick. */
function WarningsItem() {
  const sim = useStore((s) => s.sim);
  const inputs = useStore((s) => s.inputs);
  return <WarningStrip warnings={selectWarnings(sim, inputs)} />;
}

/** One layout item, drawn with the generic component for its kind. */
export const PanelItemView = memo(function PanelItemView({ item }: { item: PanelItem }) {
  switch (item.kind) {
    case 'gauge':
      return <DialInstrument item={item} />;
    case 'tank-level':
      return <TankInstrument item={item} />;
    case 'valve':
      return <ValveItem item={item} />;
    case 'delivery':
      return <DeliveryRow item={item} />;
    case 'throttle':
      return <ThrottleItem item={item} />;
    case 'primer':
      return <PrimerItem item={item} />;
    case 'warnings':
      return <WarningsItem />;
  }
});
