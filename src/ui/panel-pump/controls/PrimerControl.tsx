import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { PrimerState } from '../../../state/supply';
import './controls.css';

export interface PrimerControlProps {
  label: string;
  /** Whether the primer is running (the switch input). */
  on: boolean;
  onChange: (on: boolean) => void;
  /** What the primer is doing (Design §5); defaults to running/idle from `on`. */
  state?: PrimerState;
  /** Vacuum as a fraction of the primer's best, 0–1: the ring round the button. */
  progress?: number;
}

const CAPTION: Readonly<Record<PrimerState, string>> = {
  idle: 'HOLD',
  running: 'RUNNING',
  'check-suction': 'CHECK SUCTION',
  primed: 'PRIMED',
  'cut-out': 'COOLING',
};

/** Ring geometry, in the 88 × 88 ring viewBox. */
const RING_R = 41;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Primer: press and hold to run it, release to stop (Design §5). Space or Enter held down works
 * too, and a screen reader's activate latches it on or off. A role="switch" whose state is the
 * running primer. A ring fills as vacuum builds; the caption says RUNNING, CHECK SUCTION (30 s
 * without catching), PRIMED (with a check mark) or COOLING (rotary vane duty cut-out).
 */
export function PrimerControl({
  label,
  on,
  onChange,
  state = on ? 'running' : 'idle',
  progress = 0,
}: PrimerControlProps) {
  const [pointerId, setPointerId] = useState<number | null>(null);
  const captionId = useId();

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
    <div className={`primer primer--${state}`} data-state={state}>
      <div className="primer__dial">
        <svg className="primer__ring" viewBox="0 0 88 88" aria-hidden="true">
          <circle className="primer__ring-track" cx={44} cy={44} r={RING_R} />
          <circle
            className="primer__ring-fill"
            cx={44}
            cy={44}
            r={RING_R}
            strokeDasharray={`${(RING_C * Math.min(1, Math.max(0, progress))).toFixed(1)} ${RING_C.toFixed(1)}`}
            transform="rotate(-90 44 44)"
          />
        </svg>
        <button
          type="button"
          className={`primer__button${on ? ' primer__button--on' : ''}`}
          role="switch"
          aria-checked={on}
          aria-label={label}
          aria-describedby={captionId}
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
      </div>
      <span className="panel-caption primer__caption" id={captionId}>
        {state === 'primed' && (
          <svg className="primer__check" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 7.5 L5.5 11 L12 3.5" />
          </svg>
        )}
        {CAPTION[state]}
      </span>
    </div>
  );
}
