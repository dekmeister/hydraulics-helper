import { memo, useEffect, useId, useRef } from 'react';
import { activeTruck, instrumentValue } from '../../state/selectors';
import { useStore } from '../../state/store';
import { primerStatus } from '../../state/supply';
import { speedSwitchRates } from '../../state/throttleRamp';
import type { RealItem, RealPlate } from '../appliances/realistic';
import type { PanelItem } from '../appliances/types';
import { DeliveryTag } from '../panel-pump/DeliveryTag';
import { PanelItemView } from '../panel-pump/PanelItem';
import { useDelivery } from '../panel-pump/useDelivery';
import { useDampedValue } from '../panel-pump/useDampedValue';
import { COLOR } from '../theme/colors';
import { BayLever } from './BayLever';
import { boxStyle, couplingRadiusFrac, leverBox } from './geometry';
import { PullHandlePrimer } from './PullHandlePrimer';
import { RealEngineLamp, RealEngineSwitch } from './RealEngine';
import { SpeedSwitch } from './SpeedSwitch';
import { HandPumpPrimer } from './HandPumpPrimer';
import { VernierThrottle } from './VernierThrottle';
import { TankGauge } from './TankGauge';

// Realistic items take their accessible names, delivery tags and tap behaviour from the
// simplified layout (`simple`), so a control is called the same thing in both views.

type Of<K extends PanelItem['kind']> = Extract<PanelItem, { kind: K }>;

function simpleItem<K extends PanelItem['kind']>(
  simple: readonly PanelItem[],
  kind: K,
  match: (i: Of<K>) => boolean,
): Of<K> {
  const found = simple.find((i): i is Of<K> => i.kind === kind && match(i as Of<K>));
  if (found === undefined) throw new Error(`simplified layout has no ${kind} for this item`);
  return found;
}

/** Height of an outlet coupling's centre in its box, as a fraction: author the drop to end there. */
const COUPLING_Y = 0.43;
/** A coupling's bore, as a fraction of its outer radius. */
const BORE_FRAC = 0.69;

function Outlet({
  item,
  plate,
  simple,
}: {
  item: Extract<RealItem, { kind: 'outlet' }>;
  plate: RealPlate;
  simple: Of<'delivery'>;
}) {
  const { laid, lineText, open, setOpen, highlight, toggleHighlight } = useDelivery(item.control);
  const sizeMm = useStore(
    (s) => activeTruck(s.sim).spec.deliveries.find((d) => d.id === item.control)?.sizeMm ?? 0,
  );
  const ref = useRef<HTMLButtonElement>(null);
  const textId = useId();
  useEffect(() => {
    if (highlight === 'scene') ref.current?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);
  const c = item.coupling;
  const cy = c.h * COUPLING_Y;
  const r = c.w * couplingRadiusFrac(sizeMm);
  return (
    <>
      <BayLever
        label={simple.label}
        value={open}
        onChange={setOpen}
        function="outlet"
        tap={simple.tap}
        geometry={item}
        box={leverBox(item)}
        style={boxStyle(leverBox(item), plate)}
        {...(laid ? {} : { disabledReason: 'NO LINE' })}
      />
      <button
        ref={ref}
        type="button"
        className="real-outlet"
        style={boxStyle(c, plate)}
        aria-label={`Show ${simple.label} on scene`}
        aria-describedby={textId}
        aria-pressed={highlight !== null}
        data-delivery={item.control}
        data-highlighted={highlight !== null}
        onClick={toggleHighlight}
      >
        <svg viewBox={`0 0 ${String(c.w)} ${String(c.h)}`} aria-hidden="true">
          {/* Centred across the box, on its drop's end, sized to its fitting with the size
              stamped in the bore; the number plate goes under it. */}
          <circle cx={c.w / 2} cy={cy} r={r} style={{ fill: COLOR.galvLight }} />
          <circle
            cx={c.w / 2}
            cy={cy}
            r={r * BORE_FRAC}
            style={{ fill: laid ? COLOR.galvDark : COLOR.galv }}
          />
          <text x={c.w / 2} y={cy} className="real-outlet__size">
            {sizeMm}
          </text>
          {highlight !== null && (
            <circle cx={c.w / 2} cy={cy} r={c.w * 0.38} className="real-outlet__ring" />
          )}
        </svg>
        <span className="real-outlet__tag">
          <DeliveryTag tag={simple.tag} glyph={simple.glyph} />
        </span>
        <span className="visually-hidden" id={textId}>
          {lineText}
        </span>
      </button>
    </>
  );
}

function Lever({
  item,
  plate,
  simple,
}: {
  item: Extract<RealItem, { kind: 'lever' }>;
  plate: RealPlate;
  simple: Of<'valve'>;
}) {
  const open = useStore((s) => s.inputs.valves[item.control] ?? 0);
  const setValve = useStore((s) => s.setValve);
  return (
    <BayLever
      label={simple.label}
      value={open}
      onChange={(v) => {
        setValve(item.control, v);
      }}
      function={simple.function}
      tap={simple.tap}
      geometry={item}
      box={leverBox(item)}
      style={boxStyle(leverBox(item), plate)}
    />
  );
}

function Primer({
  item,
  plate,
  label,
}: {
  item: Extract<RealItem, { kind: 'primer' }>;
  plate: RealPlate;
  label: string;
}) {
  const on = useStore((s) => s.inputs.switches[item.control] ?? false);
  const setSwitch = useStore((s) => s.setSwitch);
  const state = useStore((s) => primerStatus(s.sim, s.inputs, item.control).state);
  const props = {
    label,
    on,
    onChange: (v: boolean) => {
      setSwitch(item.control, v);
    },
    state,
    style: boxStyle(item.box, plate),
  };
  switch (item.variant) {
    case 'pull-handle':
      return <PullHandlePrimer {...props} />;
    case 'hand-pump':
      return <HandPumpPrimer {...props} />;
  }
}

function Throttle({
  item,
  plate,
  label,
}: {
  item: Extract<RealItem, { kind: 'throttle' }>;
  plate: RealPlate;
  label: string;
}) {
  const engine = useStore((s) => activeTruck(s.sim).spec.engine);
  const value = useStore((s) => s.inputs.throttle);
  const press = useStore((s) => s.pressSpeedSwitch);
  const release = useStore((s) => s.releaseSpeedSwitch);
  const setThrottle = useStore((s) => s.setThrottle);
  if (item.variant === 'vernier') {
    if (engine.vernier === undefined) throw new Error('a vernier knob needs EngineSpec.vernier');
    return (
      <VernierThrottle
        label={label}
        value={value}
        onChange={setThrottle}
        perTurn={engine.vernier.throttlePerTurn}
        style={boxStyle(item.box, plate)}
      />
    );
  }
  const controller = engine.speedController;
  if (controller === undefined) throw new Error('a speed switch needs EngineSpec.speedController');
  const rates = speedSwitchRates(engine, controller);
  return (
    <SpeedSwitch
      label={label}
      value={value}
      onPress={(d) => {
        press(d, rates);
      }}
      onRelease={release}
      onFlick={(d) => {
        setThrottle(value + d * rates.flick);
      }}
      style={boxStyle(item.box, plate)}
    />
  );
}

function Tank({
  item,
  plate,
  label,
}: {
  item: Extract<RealItem, { kind: 'tank-gauge' }>;
  plate: RealPlate;
  label: string;
}) {
  const spec = useStore((s) => activeTruck(s.sim).spec);
  const instrument = spec.instruments.find((i) => i.id === item.instrument);
  if (instrument?.kind !== 'tank') throw new Error(`'${item.instrument}' is not a tank instrument`);
  const capacityL = spec.tank?.capacityL ?? 0;
  const valueL = useDampedValue(
    useStore((s) => instrumentValue(activeTruck(s.sim), 'tank')),
    capacityL,
  );
  return (
    <TankGauge
      display={instrument.display}
      label={label}
      valueL={valueL}
      capacityL={capacityL}
      style={boxStyle(item.box, plate)}
    />
  );
}

/** One realistic item, drawn with the generic component for its kind; inert items are backdrop. */
export const RealItemView = memo(function RealItemView({
  item,
  plate,
  simple,
}: {
  item: RealItem;
  plate: RealPlate;
  simple: readonly PanelItem[];
}) {
  switch (item.kind) {
    case 'gauge': {
      const s = simpleItem(simple, 'gauge', (i) => i.instrument === item.instrument);
      return (
        <div className="real-item real-item--gauge" style={boxStyle(item.box, plate)}>
          <PanelItemView item={{ ...s, dial: item.dial, size: 'large' }} />
        </div>
      );
    }
    case 'tank-gauge': {
      const s = simpleItem(simple, 'tank-level', (i) => i.instrument === item.instrument);
      return <Tank item={item} plate={plate} label={s.label} />;
    }
    case 'lever':
      return (
        <Lever
          item={item}
          plate={plate}
          simple={simpleItem(simple, 'valve', (i) => i.control === item.control)}
        />
      );
    case 'outlet':
      return (
        <Outlet
          item={item}
          plate={plate}
          simple={simpleItem(simple, 'delivery', (i) => i.control === item.control)}
        />
      );
    case 'primer':
      return (
        <Primer
          item={item}
          plate={plate}
          label={simpleItem(simple, 'primer', (i) => i.control === item.control).label}
        />
      );
    case 'throttle':
      return (
        <Throttle
          item={item}
          plate={plate}
          label={simpleItem(simple, 'throttle', () => true).label}
        />
      );
    case 'engine-switch': {
      const s = simpleItem(simple, 'engine-switch', (i) => i.control === item.control);
      return (
        <RealEngineSwitch
          control={item.control}
          label={s.label}
          role={s.role}
          look={item.look}
          style={boxStyle(item.box, plate)}
        />
      );
    }
    case 'engine-lamp':
      return <RealEngineLamp label={item.label} style={boxStyle(item.box, plate)} />;
    case 'inert':
      return null;
  }
});
