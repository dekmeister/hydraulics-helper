import { useId, type CSSProperties } from 'react';
import type { EngineSwitch } from '../../sim/lesson/types';
import { engineStatus } from '../../state/selectors';
import { useStore } from '../../state/store';
import type { RealItem } from '../appliances/realistic';
import { useHoldSwitch } from '../panel-pump/controls/useHoldSwitch';

type Look = Extract<RealItem, { kind: 'engine-switch' }>['look'];

interface SwitchProps {
  label: string;
  role: EngineSwitch;
  look: Look;
  on: boolean;
  onChange: (on: boolean) => void;
  style: CSSProperties;
}

/** START or STOP as on the truck: it works only while held (pointer, Space or Enter). */
function HeldEngineSwitch({ label, role, look, on, onChange, style }: SwitchProps) {
  const hold = useHoldSwitch(on, onChange);
  return (
    <button
      type="button"
      className={`real-engine real-engine--${look} real-engine--${role}${on ? ' real-engine--on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      style={style}
      {...hold}
    >
      <span className="real-engine__cap" aria-hidden="true" />
    </button>
  );
}

/**
 * The ignition switch: tap to turn it on or off. It carries the engine's state as a live
 * description, so a tacho-less panel still says whether the engine is running.
 */
function IgnitionSwitch({ label, look, on, onChange, style }: SwitchProps) {
  const statusId = useId();
  const text = useStore((s) => engineStatus(s.sim, s.inputs).text);
  return (
    <>
      <button
        type="button"
        className={`real-engine real-engine--${look} real-engine--ignition${on ? ' real-engine--on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={label}
        aria-describedby={statusId}
        style={style}
        onClick={() => {
          onChange(!on);
        }}
      >
        <span className="real-engine__cap" aria-hidden="true" />
      </button>
      <span className="visually-hidden" id={statusId} role="status" aria-label="Engine">
        {text}
      </span>
    </>
  );
}

/** One engine switch on the realistic panel, working the spec switch `control`. */
export function RealEngineSwitch({
  control,
  ...props
}: Omit<SwitchProps, 'on' | 'onChange'> & { control: string }) {
  const on = useStore((s) => s.inputs.switches[control] ?? false);
  const setSwitch = useStore((s) => s.setSwitch);
  const onChange = (v: boolean) => {
    setSwitch(control, v);
  };
  return props.role === 'ignition' ? (
    <IgnitionSwitch {...props} on={on} onChange={onChange} />
  ) : (
    <HeldEngineSwitch {...props} on={on} onChange={onChange} />
  );
}

/** A charge or oil lamp: lit while the ignition is on and the engine isn't running. */
export function RealEngineLamp({ label, style }: { label: string; style: CSSProperties }) {
  const lit = useStore((s) => engineStatus(s.sim, s.inputs).lampsLit);
  return (
    <span
      className={`real-lamp${lit ? ' real-lamp--lit' : ''}`}
      role="img"
      aria-label={`${label}: ${lit ? 'lit' : 'off'}`}
      data-lit={lit}
      style={style}
    />
  );
}
