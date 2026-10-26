import { useId, type CSSProperties } from 'react';
import type { PrimerState } from '../../state/supply';
import { PRIMER_CAPTION } from '../panel-pump/controls/PrimerControl';
import { useHoldSwitch } from '../panel-pump/controls/useHoldSwitch';
import { COLOR } from '../theme/colors';

export interface PullHandlePrimerProps {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  state: PrimerState;
  style: CSSProperties;
}

/**
 * A T-handle primer on the bumper (Cat 1): pull and hold to prime, let go to stop. Same switch
 * semantics as the panel's PRIME button (press-and-hold by pointer or Space/Enter, an assistive
 * "activate" latches it); drawn as a handle that comes out of its bezel while held. No vacuum
 * readout: as on the truck, the compound gauge shows it.
 */
export function PullHandlePrimer({ label, on, onChange, state, style }: PullHandlePrimerProps) {
  const hold = useHoldSwitch(on, onChange);
  const captionId = useId();
  const pull = on ? 34 : 0;

  return (
    <div className={`pull-primer pull-primer--${state}`} style={style} data-state={state}>
      <button
        type="button"
        className="pull-primer__handle"
        role="switch"
        aria-checked={on}
        aria-label={label}
        aria-describedby={captionId}
        {...hold}
      >
        <svg viewBox="0 0 150 150" aria-hidden="true">
          {/* Bezel on the bumper, engraved PRIME. */}
          <rect x={20} y={14} width={110} height={44} rx={6} style={{ fill: COLOR.galvLight }} />
          <rect x={20} y={48} width={110} height={10} rx={4} style={{ fill: COLOR.galv }} />
          <text x={75} y={42} textAnchor="middle" className="pull-primer__engraving">
            PRIME
          </text>
          {/* Shaft and T-grip: out by `pull` while held. */}
          <rect x={68} y={56} width={14} height={14 + pull} style={{ fill: COLOR.galvMid }} />
          <rect
            x={28}
            y={68 + pull}
            width={94}
            height={22}
            rx={11}
            style={{ fill: COLOR.galvLight, stroke: COLOR.galvEdge }}
            strokeWidth={2}
          />
        </svg>
      </button>
      <span className="panel-caption pull-primer__caption" id={captionId}>
        {PRIMER_CAPTION[state]}
      </span>
    </div>
  );
}
