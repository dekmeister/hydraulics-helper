import type { ReactNode } from 'react';
import type { GaugeScaleSpec } from '../../sim/types';
import { PrimerControl } from '../../ui/panel-pump/controls/PrimerControl';
import { Throttle } from '../../ui/panel-pump/controls/Throttle';
import { ValveHandle } from '../../ui/panel-pump/controls/ValveHandle';
import { DIALS, type DialId } from '../../ui/panel-pump/gauge/dials';
import { Gauge } from '../../ui/panel-pump/gauge/Gauge';
import { TankLevel } from '../../ui/panel-pump/gauge/TankLevel';
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
  const outlets: [string, number, string | undefined][] = [
    ['outlet closed', 0, undefined],
    ['outlet 50 %', 0.5, undefined],
    ['outlet open', 1, undefined],
    ['outlet disabled', 0, 'NO LINE'],
  ];
  const inlets: [string, number][] = [
    ['inlet closed', 0],
    ['inlet open', 1],
  ];
  return (
    <Gallery>
      {outlets.map(([caption, value, reason]) => (
        <Card key={caption} caption={caption}>
          <ValveHandle
            label={caption}
            value={value}
            onChange={noop}
            function="outlet"
            tap="none"
            {...(reason === undefined ? {} : { disabledReason: reason })}
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

export function ThrottlePrimerGallery() {
  return (
    <Gallery>
      {[0, 0.6].map((v) => (
        <Card key={v} caption={`throttle ${String(v * 100)} %`}>
          <Throttle label={`Throttle ${String(v)}`} value={v} onChange={noop} vernierStep={0.01} />
        </Card>
      ))}
      {[false, true].map((on) => (
        <Card key={String(on)} caption={on ? 'primer held' : 'primer released'}>
          <PrimerControl label={`Primer ${String(on)}`} on={on} onChange={noop} />
        </Card>
      ))}
    </Gallery>
  );
}
