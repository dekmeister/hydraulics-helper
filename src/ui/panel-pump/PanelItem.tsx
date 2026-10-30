import { memo, useEffect, useId, useMemo, useRef } from 'react';
import { vernierStep } from './controls/controlMath';
import {
  activeTruck,
  burstRelayInto,
  engineStatus,
  INSTRUMENT_UNIT,
  instrumentValue,
  selectWarnings,
} from '../../state/selectors';
import { useStore } from '../../state/store';
import { primerStatus } from '../../state/supply';
import { speedControllerDead } from '../../sim/engineControl';
import type { ApplianceSpec, InstrumentSpec } from '../../sim/types';
import type { PanelItem } from '../appliances/types';
import { EngineSwitch } from './controls/EngineSwitch';
import { PrimerControl } from './controls/PrimerControl';
import { Throttle } from './controls/Throttle';
import { ValveHandle } from './controls/ValveHandle';
import { DeliveryTag } from './DeliveryTag';
import { DIALS } from './gauge/dials';
import { Gauge } from './gauge/Gauge';
import { range } from './gauge/gaugeScale';
import { computeWake } from './gauge/wake';
import { TankLevel } from './gauge/TankLevel';
import { useDelivery } from './useDelivery';
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

const ignore = () => undefined;

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
  const samples = useStore((s) => s.wake);
  const wake = useMemo(
    () =>
      computeWake(
        samples.flatMap((w) => {
          const v = w.values[instrument.kind];
          return v === undefined ? [] : [{ tS: w.tS, v }];
        }),
      ),
    [samples, instrument.kind],
  );
  const alert = useStore(
    (s) => instrument.kind === 'compound' && activeTruck(s.sim).readings.cavitation > 0,
  );
  return (
    <Gauge
      dial={dial}
      value={value}
      label={item.label}
      unit={INSTRUMENT_UNIT[instrument.kind]}
      size={item.size}
      wake={wake}
      alert={alert}
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
  const { laid, lineText, open, setOpen, highlight, toggleHighlight } = useDelivery(item.control);
  const rowRef = useRef<HTMLDivElement>(null);
  const textId = useId();
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
        // The label names the action; the size and lay stay readable as its description.
        aria-describedby={`${textId}-name ${textId}-line`}
        aria-pressed={highlight !== null}
        onClick={toggleHighlight}
      >
        <DeliveryTag tag={item.tag} glyph={item.glyph} />
        <span className="delivery-row__name" id={`${textId}-name`}>
          {item.label}
          {delivery === undefined ? '' : ` · ${String(delivery.sizeMm)} mm`}
        </span>
        <span className="delivery-row__line" id={`${textId}-line`}>
          {lineText}
        </span>
      </button>
      <ValveHandle
        label={item.label}
        value={open}
        onChange={setOpen}
        function="outlet"
        tap={item.tap}
        hose={laid}
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
  // An electronic speed controller does nothing with the engine stopped (issue #29).
  const dead = useStore((s) => speedControllerDead(activeTruck(s.sim)));
  return (
    <Throttle
      label={item.label}
      value={position}
      onChange={dead ? ignore : setThrottle}
      vernierStep={vernierStep(engine.idleRpm, engine.maxRpm)}
    />
  );
}

function PrimerItem({ item }: { item: Extract<PanelItem, { kind: 'primer' }> }) {
  const on = useStore((s) => s.inputs.switches[item.control] ?? false);
  const setSwitch = useStore((s) => s.setSwitch);
  const state = useStore((s) => primerStatus(s.sim, s.inputs, item.control).state);
  const progress = useStore((s) => primerStatus(s.sim, s.inputs, item.control).progress);
  const hand = useStore((s) => activeTruck(s.sim).spec.primer?.kind === 'diaphragm');
  return (
    <div className="panel-control">
      <span className="panel-caption">{item.label}</span>
      <PrimerControl
        label={item.label}
        on={on}
        state={state}
        progress={progress}
        kind={hand ? 'handle' : 'switch'}
        onChange={(v) => {
          setSwitch(item.control, v);
        }}
      />
    </div>
  );
}

function EngineSwitchItem({ item }: { item: Extract<PanelItem, { kind: 'engine-switch' }> }) {
  const on = useStore((s) => s.inputs.switches[item.control] ?? false);
  const setSwitch = useStore((s) => s.setSwitch);
  // The button's face names it (IGN, START, STOP), so no caption over it; its label is its name.
  return (
    <div className="panel-control">
      <EngineSwitch
        label={item.label}
        role={item.role}
        on={on}
        onChange={(v) => {
          setSwitch(item.control, v);
        }}
      />
    </div>
  );
}

/** The engine's state in words: a live region, so a held START or STOP is heard to work. */
function EngineStatusItem() {
  const text = useStore((s) => engineStatus(s.sim, s.inputs).text);
  const phase = useStore((s) => engineStatus(s.sim, s.inputs).phase);
  const trap = useStore((s) => engineStatus(s.sim, s.inputs).stopWithoutIgnition);
  return (
    <p
      className={`engine-status${trap ? ' engine-status--trap' : ''}`}
      data-phase={phase}
      role="status"
      aria-label="Engine"
    >
      {text}
    </p>
  );
}

/**
 * Warnings depend on the whole sim and inputs, so only the strip re-renders every tick. In free play
 * a burst relay into this pump can be repaired from under its alarm; a lesson repairs its own.
 */
function WarningsItem() {
  const sim = useStore((s) => s.sim);
  const inputs = useStore((s) => s.inputs);
  const freePlay = useStore((s) => s.lesson === null);
  const replaceBurstLength = useStore((s) => s.replaceBurstLength);
  const burst = freePlay ? burstRelayInto(sim) : undefined;
  return (
    <WarningStrip
      warnings={selectWarnings(sim, inputs)}
      {...(burst === undefined
        ? {}
        : {
            onReplaceBurst: () => {
              replaceBurstLength(burst.id);
            },
          })}
    />
  );
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
    case 'engine-switch':
      return <EngineSwitchItem item={item} />;
    case 'engine-status':
      return <EngineStatusItem />;
    case 'warnings':
      return <WarningsItem />;
  }
});
