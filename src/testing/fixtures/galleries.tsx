import type { ReactNode } from 'react';
import type { GaugeScaleSpec } from '../../sim/types';
import type { PrimerState } from '../../state/supply';
import { PrimerControl } from '../../ui/panel-pump/controls/PrimerControl';
import { Throttle } from '../../ui/panel-pump/controls/Throttle';
import { ValveHandle } from '../../ui/panel-pump/controls/ValveHandle';
import { DIALS, type DialId } from '../../ui/panel-pump/gauge/dials';
import { Gauge } from '../../ui/panel-pump/gauge/Gauge';
import { TankLevel } from '../../ui/panel-pump/gauge/TankLevel';
import { computeWake, type WakePoint } from '../../ui/panel-pump/gauge/wake';
import './galleries.css';

const noop = () => undefined;

function Gallery({ children }: { children: ReactNode }) {
  return <main className="fixture-gallery">{children}</main>;
}

function Card({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="fixture-card">
      {children}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/** One dial face at several values, undamped. */
export function GaugeGallery({
  dial,
  scale,
  unit,
  label,
  values,
}: {
  dial: DialId;
  scale: GaugeScaleSpec;
  unit: string;
  label: string;
  values: readonly number[];
}) {
  return (
    <Gallery>
      {values.map((v) => (
        <Card key={v} caption={`${String(v)} ${unit}`}>
          <Gauge
            dial={DIALS[dial](scale)}
            value={v}
            label={`${label} at ${String(v)}`}
            unit={unit}
          />
        </Card>
      ))}
    </Gallery>
  );
}

/** Mixed dial faces, one value each: an appliance's fitted gauges side by side. */
export function DialsGallery({
  cards,
}: {
  cards: readonly {
    dial: DialId;
    scale: GaugeScaleSpec;
    value: number;
    unit: string;
    label: string;
  }[];
}) {
  return (
    <Gallery>
      {cards.map((c) => (
        <Card key={c.label} caption={`${c.label} ${String(c.value)} ${c.unit}`}>
          <Gauge
            dial={DIALS[c.dial](c.scale)}
            value={c.value}
            label={`${c.label} at ${String(c.value)}`}
            unit={c.unit}
          />
        </Card>
      ))}
    </Gallery>
  );
}

export function TankGallery({
  capacityL,
  values,
}: {
  capacityL: number;
  values: readonly number[];
}) {
  return (
    <Gallery>
      {values.map((v) => (
        <Card key={v} caption={`${String(v)} of ${String(capacityL)} L`}>
          <TankLevel valueL={v} capacityL={capacityL} label={`Tank at ${String(v)}`} />
        </Card>
      ))}
    </Gallery>
  );
}

export function ValveGallery() {
  const outlets: [string, number, boolean][] = [
    ['outlet closed', 0, false],
    ['outlet 50 %', 0.5, false],
    ['outlet open', 1, false],
    ['outlet closed, hose on', 0, true],
  ];
  const inlets: [string, number][] = [
    ['inlet closed', 0],
    ['inlet open', 1],
  ];
  return (
    <Gallery>
      {outlets.map(([caption, value, hose]) => (
        <Card key={caption} caption={caption}>
          <ValveHandle
            label={caption}
            value={value}
            onChange={noop}
            function="outlet"
            tap="none"
            hose={hose}
          />
        </Card>
      ))}
      {inlets.map(([caption, value]) => (
        <Card key={caption} caption={caption}>
          <ValveHandle
            label={caption}
            value={value}
            onChange={noop}
            function="inlet"
            tap="toggle"
          />
        </Card>
      ))}
    </Gallery>
  );
}

/** Every primer state, with the vacuum ring part-filled where it would be. */
const PRIMER_STATES: readonly { state: PrimerState; on: boolean; progress: number }[] = [
  { state: 'idle', on: false, progress: 0 },
  { state: 'running', on: true, progress: 0.4 },
  { state: 'check-suction', on: true, progress: 0.85 },
  { state: 'primed', on: false, progress: 1 },
  { state: 'cut-out', on: true, progress: 0.6 },
];

export function ThrottlePrimerGallery() {
  return (
    <Gallery>
      {[0, 0.6].map((v) => (
        <Card key={v} caption={`throttle ${String(v * 100)} %`}>
          <Throttle label={`Throttle ${String(v)}`} value={v} onChange={noop} vernierStep={0.01} />
        </Card>
      ))}
      {PRIMER_STATES.map(({ state, on, progress }) => (
        <Card key={state} caption={`primer ${state}`}>
          <PrimerControl
            label={`Primer ${state}`}
            on={on}
            state={state}
            progress={progress}
            onChange={noop}
          />
        </Card>
      ))}
    </Gallery>
  );
}

/** 3.1 s of samples at 10 Hz ending at `f(3.1)`. */
const history = (f: (tS: number) => number): WakePoint[] =>
  Array.from({ length: 32 }, (_, i) => ({ tS: i / 10, v: f(i / 10) }));

/** Seeded-looking hunting without randomness: incommensurate sines. */
const hunting = (centre: number, amp: number) => (t: number) =>
  centre + amp * (0.6 * Math.sin(15.1 * t) + 0.4 * Math.sin(23.7 * t + 1));

/** The Wake on a dial (Design §6): steady, a surge, and hunting with the alert needle. */
export function WakeGallery({
  scale,
}: {
  scale: { discharge: GaugeScaleSpec; compound: GaugeScaleSpec };
}) {
  const cards: {
    caption: string;
    dial: DialId;
    scale: GaugeScaleSpec;
    f: (t: number) => number;
    alert?: boolean;
  }[] = [
    { caption: 'steady 700 kPa', dial: 'discharge', scale: scale.discharge, f: () => 700 },
    {
      caption: 'surge 400 → 900 kPa',
      dial: 'discharge',
      scale: scale.discharge,
      f: (t) => Math.min(900, 400 + 250 * t),
    },
    {
      caption: 'hunting discharge',
      dial: 'discharge',
      scale: scale.discharge,
      f: hunting(760, 40),
    },
    {
      caption: 'hunting compound (cavitating)',
      dial: 'compound',
      scale: scale.compound,
      f: hunting(-82, 6),
      alert: true,
    },
  ];
  return (
    <Gallery>
      {cards.map((c) => {
        const samples = history(c.f);
        const value = samples.at(-1)?.v ?? 0;
        return (
          <Card key={c.caption} caption={c.caption}>
            <Gauge
              dial={DIALS[c.dial](c.scale)}
              value={value}
              label={c.caption}
              unit="kPa"
              wake={computeWake(samples)}
              alert={c.alert ?? false}
            />
          </Card>
        );
      })}
    </Gallery>
  );
}
