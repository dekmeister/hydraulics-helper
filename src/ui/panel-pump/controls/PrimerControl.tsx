import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import './controls.css';

export interface PrimerControlProps {
  label: string;
  /** Whether the primer is running (the switch input). */
  on: boolean;
  onChange: (on: boolean) => void;
}

/**
 * Primer: press and hold to run it, release to stop (Design §5). Space or Enter held down works
 * too, and a screen reader's activate latches it on or off. A role="switch" whose state is the
 * running primer. Vacuum, catching and the duty cycle arrive with draughting in M4; until then it
 * only drives the switch input.
 */
export function PrimerControl({ label, on, onChange }: PrimerControlProps) {
  const [pointerId, setPointerId] = useState<number | null>(null);

  const start = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setPointerId(e.pointerId);
    onChange(true);
  };
  const stop = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== pointerId) return;
    setPointerId(null);
    onChange(false);
  };
  const isHoldKey = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';

  return (
    <div className="primer">
      <button
        type="button"
        className={`primer__button${on ? ' primer__button--on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => {
          if (!isHoldKey(e)) return;
          e.preventDefault();
          if (!e.repeat) onChange(true);
        }}
        onKeyUp={(e) => {
          if (!isHoldKey(e)) return;
          e.preventDefault();
          onChange(false);
        }}
        onClick={(e) => {
          // Pointer and keyboard presses are handled as holds above (keys preventDefault their
          // click). A click with detail 0 is an assistive-technology "activate", which can't hold,
          // so it latches the primer instead; the next activate or leaving the control stops it.
          if (e.detail === 0) onChange(!on);
        }}
        onBlur={() => {
          if (on) onChange(false);
        }}
      >
        PRIME
      </button>
      <span className="panel-caption">{on ? 'RUNNING' : 'HOLD'}</span>
    </div>
  );
}
