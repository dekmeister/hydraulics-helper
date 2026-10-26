import type { EngineSwitch as EngineSwitchRole } from '../../../sim/lesson/types';
import { useHoldSwitch } from './useHoldSwitch';
import './controls.css';

export interface EngineSwitchProps {
  label: string;
  role: EngineSwitchRole;
  on: boolean;
  onChange: (on: boolean) => void;
}

const FACE: Readonly<Record<EngineSwitchRole, string>> = {
  ignition: 'IGN',
  start: 'START',
  stop: 'STOP',
};

/** What's printed on the button: its name, and under it its state or how to work it. */
function Face({ role, sub }: { role: EngineSwitchRole; sub: string }) {
  return (
    <>
      <span>{FACE[role]}</span>
      <span className="engine-switch__sub">{sub}</span>
    </>
  );
}

/** The ignition: a switch that stays where it's put. Tap to turn it on or off. */
function IgnitionSwitch({ label, on, onChange }: Omit<EngineSwitchProps, 'role'>) {
  return (
    <button
      type="button"
      className={`engine-switch__button engine-switch__button--ignition${on ? ' engine-switch__button--on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        onChange(!on);
      }}
    >
      <Face role="ignition" sub={on ? 'ON' : 'OFF'} />
    </button>
  );
}

/** START or STOP: works only while held, as on the truck (pointer, Space or Enter). */
function HeldSwitch({ label, role, on, onChange }: EngineSwitchProps) {
  const hold = useHoldSwitch(on, onChange);
  return (
    <button
      type="button"
      className={`engine-switch__button engine-switch__button--${role}${on ? ' engine-switch__button--on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      {...hold}
    >
      <Face role={role} sub="HOLD" />
    </button>
  );
}

/**
 * One engine switch on the simplified panel: the ignition toggles, START and STOP are pressed and
 * held. A role="switch" whose state is the input; its face says how to work it.
 */
export function EngineSwitch(props: EngineSwitchProps) {
  return (
    <div className="engine-switch" data-role={props.role}>
      {props.role === 'ignition' ? <IgnitionSwitch {...props} /> : <HeldSwitch {...props} />}
    </div>
  );
}
