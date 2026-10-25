import { useId, type CSSProperties } from 'react';
import type { PrimerState } from '../../state/supply';
import { PRIMER_CAPTION } from '../panel-pump/controls/PrimerControl';
import { useHoldSwitch } from '../panel-pump/controls/useHoldSwitch';
import { COLOR } from '../theme/colors';

// Drawing space (viewBox 0 0 150 240): the pump body low down, the handle's pivot on its top.
const PIVOT_X = 75;
const PIVOT_Y = 150;

export interface HandPumpPrimerProps {
  label: string;
  /** Whether the handle is being stroked (the primer's switch input). */
  on: boolean;
  onChange: (on: boolean) => void;
  state: PrimerState;
  /** Vacuum as a fraction of the primer's best, 0–1. */
  progress: number;
  style: CSSProperties;
}

/**
 * A hand diaphragm primer (Cat 7 bay): a red pump body with a long handle. Hold it to stroke it,
 * let go to stop; the sim takes the held switch as steady stroking. Same switch semantics as the
 * panel's PRIME button (press-and-hold by pointer or Space/Enter, an assistive "activate" latches
 * it). The handle works up and down while held (still under reduced motion); the vacuum fills a
 * bar on the body.
 */
export function HandPumpPrimer({
  label,
  on,
  onChange,
  state,
  progress,
  style,
}: HandPumpPrimerProps) {
  const hold = useHoldSwitch(on, onChange);
  const captionId = useId();
  return (
    <div className={`hand-primer hand-primer--${state}`} style={style} data-state={state}>
      <button
        type="button"
        className="hand-primer__handle"
        role="switch"
        aria-checked={on}
        aria-label={label}
        aria-describedby={captionId}
        {...hold}
      >
        <svg viewBox="0 0 150 240" aria-hidden="true">
          {/* The handle, pivoted on the body; it rocks while stroked. */}
          <g
            className={on ? 'hand-primer__arm hand-primer__arm--stroking' : 'hand-primer__arm'}
            style={{ transformOrigin: `${String(PIVOT_X)}px ${String(PIVOT_Y)}px` }}
          >
            <rect
              x={PIVOT_X - 7}
              y={20}
              width={14}
              height={PIVOT_Y - 20}
              style={{ fill: COLOR.alarm }}
            />
            <rect
              x={PIVOT_X - 12}
              y={8}
              width={24}
              height={64}
              rx={10}
              style={{ fill: COLOR.ink }}
            />
          </g>
          {/* Pump body: a red diaphragm housing on a bracket. */}
          <circle cx={PIVOT_X} cy={PIVOT_Y + 30} r={48} style={{ fill: COLOR.alarm }} />
          <circle
            cx={PIVOT_X}
            cy={PIVOT_Y + 30}
            r={30}
            style={{ fill: 'none', stroke: COLOR.ink }}
            strokeWidth={3}
          />
          <circle cx={PIVOT_X} cy={PIVOT_Y} r={9} style={{ fill: COLOR.galvMid }} />
          <rect x={35} y={228} width={80} height={6} rx={3} style={{ fill: COLOR.galvDark }} />
          {progress > 0 && (
            <rect
              className="hand-primer__vacuum"
              x={35}
              y={228}
              width={80 * Math.min(1, Math.max(0, progress))}
              height={6}
              rx={3}
            />
          )}
        </svg>
      </button>
      <span className="panel-caption hand-primer__caption" id={captionId}>
        {state === 'running' ? 'STROKING' : PRIMER_CAPTION[state]}
      </span>
    </div>
  );
}
