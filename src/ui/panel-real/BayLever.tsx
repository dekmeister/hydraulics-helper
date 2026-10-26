import { useRef, type CSSProperties, type PointerEvent } from 'react';
import type { LeverGeometry, RBox } from '../appliances/realistic';
import type { TapBehaviour } from '../appliances/types';
import { formatPercent } from '../format';
import { leverAngleDeg, leverOpeningAt } from '../panel-pump/controls/controlMath';
import { useLeverGesture } from '../panel-pump/controls/useLeverGesture';
import { COLOR } from '../theme/colors';
import { LEVER_ART as A, leverTip } from './geometry';

export interface BayLeverProps {
  /** Accessible name, e.g. 'Delivery 1'. */
  label: string;
  value: number;
  onChange: (open: number) => void;
  /** Handle colour by function (Design §2): inlets green, outlets blue. */
  function: 'inlet' | 'outlet';
  tap: TapBehaviour;
  geometry: LeverGeometry;
  /** Its hit box on the plate, plate units: the lever draws in plate coordinates inside it. */
  box: RBox;
  style: CSSProperties;
  /** When set, the lever can't be worked and this chip says why, e.g. 'NO LINE'. */
  disabledReason?: string;
}

function stateText(value: number): string {
  if (value <= 0) return 'closed';
  if (value >= 1) return 'open';
  return `${formatPercent(value)} open`;
}

/**
 * A quarter-turn lever on the realistic bay (part-task trainer): it swings in the drawing's
 * plane from across its pipe (shut) to along it (open), so the handle's line says the state at a
 * glance. Same gestures, keys and ARIA as the simplified panel's ValveHandle.
 */
export function BayLever(props: BayLeverProps) {
  const { label, value, onChange, tap, geometry: g, box, style, disabledReason } = props;
  const fn = props.function;
  const svgRef = useRef<SVGSVGElement>(null);
  const disabled = disabledReason !== undefined;

  const openingAt = (e: PointerEvent): number => {
    const r = svgRef.current?.getBoundingClientRect();
    if (r === undefined) return value;
    const px = r.left + ((g.pivot.x - box.x) / box.w) * r.width;
    const py = r.top + ((g.pivot.y - box.y) / box.h) * r.height;
    return leverOpeningAt(e.clientX - px, e.clientY - py, g.shutDeg, g.openDeg);
  };
  const { dragging, handlers } = useLeverGesture({ value, onChange, tap, disabled, openingAt });

  const angle = leverAngleDeg(value, g.shutDeg, g.openDeg);
  const handle = fn === 'inlet' ? COLOR.inlet : COLOR.outlet;
  const handleStroke = fn === 'inlet' ? COLOR.inletStroke : COLOR.outletStroke;
  const L = g.lengthU;
  const { x: px, y: py } = g.pivot;
  // Travel arc just inside the grip: dotted for the whole quarter, filled as far as it's open.
  const arcR = L * 0.82;
  const arcEnd = (deg: number) => leverTip({ ...g, lengthU: arcR }, deg);
  const a0 = arcEnd(g.shutDeg);
  const a1 = arcEnd(g.openDeg);
  const sweep = g.openDeg > g.shutDeg ? 1 : 0;
  const arc = `M${String(a0.x)} ${String(a0.y)} A${String(arcR)} ${String(arcR)} 0 0 ${String(sweep)} ${String(a1.x)} ${String(a1.y)}`;

  return (
    <div
      className={`bay-lever${dragging ? ' bay-lever--dragging' : ''}${disabled ? ' bay-lever--disabled' : ''}`}
      style={style}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={
        disabled ? `${stateText(value)}, ${disabledReason.toLowerCase()}` : stateText(value)
      }
      aria-disabled={disabled || undefined}
      data-function={fn}
      data-shut-deg={g.shutDeg}
      data-open-deg={g.openDeg}
      {...handlers}
    >
      <svg
        ref={svgRef}
        className="bay-lever__art"
        viewBox={`${String(box.x)} ${String(box.y)} ${String(box.w)} ${String(box.h)}`}
        aria-hidden="true"
      >
        {!disabled && (
          <>
            <path
              d={arc}
              fill="none"
              strokeWidth={3}
              strokeDasharray="3 8"
              style={{ stroke: COLOR.steelDim }}
            />
            <path
              d={arc}
              fill="none"
              strokeWidth={7}
              pathLength={100}
              strokeDasharray={`${String(value * 100)} 100`}
              style={{ stroke: fn === 'inlet' ? COLOR.steel : handle }}
            />
          </>
        )}
        <g transform={`rotate(${String(angle)} ${String(px)} ${String(py)})`}>
          <rect
            x={px - A.shadowHalfW + (dragging ? A.dragLift.x : A.restLift.x)}
            y={py - L + (dragging ? A.dragLift.y : A.restLift.y)}
            width={2 * A.shadowHalfW}
            height={L}
            rx={A.shadowHalfW}
            fill="#000"
            opacity={0.3}
          />
          <rect
            x={px - A.shankHalfW}
            y={py - L * 0.6}
            width={2 * A.shankHalfW}
            height={L * 0.6}
            rx={A.shankHalfW}
            strokeWidth={A.shankStrokeW}
            style={{ fill: COLOR.galvDark, stroke: COLOR.galvEdge }}
          />
          <rect
            x={px - A.gripHalfW}
            y={py - L}
            width={2 * A.gripHalfW}
            height={L * A.gripLengthFrac}
            rx={A.gripHalfW}
            strokeWidth={A.gripStrokeW}
            style={{ fill: disabled ? COLOR.galv : handle, stroke: handleStroke }}
          />
        </g>
        <circle data-part="pivot" cx={px} cy={py} r={A.pivotR} style={{ fill: COLOR.galvEdge }} />
        <circle cx={px} cy={py} r={A.hubR} style={{ fill: COLOR.ink }} />
      </svg>
      {disabled && <span className="bay-lever__chip">{disabledReason}</span>}
    </div>
  );
}
