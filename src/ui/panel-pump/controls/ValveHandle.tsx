import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { COLOR } from '../../theme/colors';
import { formatPercent } from '../../format';
import type { TapBehaviour } from '../../appliances/types';
import { DRAG_THRESHOLD_PX, keyedPosition, valveAngleDeg, valveOpeningAt } from './controlMath';
import './controls.css';

export interface ValveHandleProps {
  /** Accessible name, e.g. 'Delivery 1'. */
  label: string;
  /** Opening, 0 closed … 1 open. */
  value: number;
  onChange: (open: number) => void;
  /** Handle colour by function (Design §2). */
  function: 'inlet' | 'outlet';
  tap: TapBehaviour;
  /** When set, the valve can't be worked and this chip says why, e.g. 'NO LINE'. */
  disabledReason?: string;
}

// Drawing space (viewBox 0 0 200 120): pipe along y = 84, lever pivot at (70, 84).
const PIVOT = { x: 70, y: 84 };
const VIEW = { w: 200, h: 120 };
const TRAVEL_R = 62;
const TRAVEL_PATH = `M${String(PIVOT.x)} ${String(PIVOT.y - TRAVEL_R)} A${String(TRAVEL_R)} ${String(TRAVEL_R)} 0 0 1 ${String(PIVOT.x + TRAVEL_R)} ${String(PIVOT.y)}`;

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
}

function stateText(value: number): string {
  if (value <= 0) return 'closed';
  if (value >= 1) return 'open';
  return `${formatPercent(value)} open`;
}

/**
 * Quarter-turn lever valve (Design §5, sheet 03): drag the lever through 90° (closed across the pipe,
 * open along it), with detents at both ends. Taps toggle or do nothing per `tap`. Pointer Events
 * only; a role="slider" with arrow, Page, Home/End keys (and Enter/Space when tap toggles).
 */
export function ValveHandle(props: ValveHandleProps) {
  const { label, value, onChange, tap, disabledReason } = props;
  const fn = props.function;
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState(false);
  const disabled = disabledReason !== undefined;

  const openingAtPointer = (e: PointerEvent): number => {
    const box = svgRef.current?.getBoundingClientRect();
    if (box === undefined) return value;
    const px = box.left + (PIVOT.x / VIEW.w) * box.width;
    const py = box.top + (PIVOT.y / VIEW.h) * box.height;
    return valveOpeningAt(e.clientX - px, e.clientY - py);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || gesture.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g?.pointerId !== e.pointerId) return;
    if (!g.dragging && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD_PX)
      return;
    if (!g.dragging) {
      g.dragging = true;
      setDragging(true);
    }
    onChange(openingAtPointer(e));
  };

  const endGesture = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (g?.pointerId !== e.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (!g.dragging && !cancelled && tap === 'toggle') onChange(value >= 0.5 ? 0 : 1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const next =
      tap === 'toggle' && (e.key === 'Enter' || e.key === ' ')
        ? value >= 0.5
          ? 0
          : 1
        : keyedPosition(e.key, value);
    if (next === null) return;
    e.preventDefault();
    onChange(next);
  };

  const angle = valveAngleDeg(value);
  const handle = fn === 'inlet' ? COLOR.inlet : COLOR.outlet;
  const handleStroke = fn === 'inlet' ? COLOR.inletStroke : COLOR.outletStroke;
  const leverStyle = {
    transform: `rotate(${String(angle)}deg)`,
    transformOrigin: `${String(PIVOT.x)}px ${String(PIVOT.y)}px`,
  };

  return (
    <div
      className={`valve${dragging ? ' valve--dragging' : ''}${disabled ? ' valve--disabled' : ''}`}
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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => {
        endGesture(e, false);
      }}
      onPointerCancel={(e) => {
        endGesture(e, true);
      }}
      onKeyDown={onKeyDown}
    >
      <svg
        ref={svgRef}
        className="valve__art"
        viewBox={`0 0 ${String(VIEW.w)} ${String(VIEW.h)}`}
        aria-hidden="true"
      >
        <text x={PIVOT.x} y={12} textAnchor="middle" className="valve__end-label">
          CLOSED
        </text>
        <text x={VIEW.w - 6} y={72} textAnchor="end" className="valve__end-label">
          OPEN
        </text>
        {!disabled && value > 0 && (
          <text x={VIEW.w - 6} y={30} textAnchor="end" className="valve__percent">
            {formatPercent(value)}
          </text>
        )}

        {/* Travel path: dotted when closed; fills in the handle colour as it opens. */}
        {!disabled && (
          <>
            <path
              d={TRAVEL_PATH}
              fill="none"
              strokeWidth={1.5}
              strokeDasharray="2 5"
              style={{ stroke: COLOR.steelDim }}
            />
            <path
              d={TRAVEL_PATH}
              fill="none"
              strokeWidth={4}
              pathLength={100}
              strokeDasharray={`${String(value * 100)} 100`}
              style={{ stroke: fn === 'inlet' ? COLOR.steel : handle }}
            />
          </>
        )}

        {/* Pipe and valve body, lit from the upper left. */}
        <rect
          x={4}
          y={PIVOT.y - 8}
          width={VIEW.w - 8}
          height={16}
          rx={2}
          style={{ fill: COLOR.galvMid }}
        />
        <rect
          x={4}
          y={PIVOT.y + 4}
          width={VIEW.w - 8}
          height={4}
          style={{ fill: COLOR.galvDark }}
        />
        <rect x={38} y={PIVOT.y - 12} width={6} height={24} rx={1} style={{ fill: COLOR.galv }} />
        <rect x={96} y={PIVOT.y - 12} width={6} height={24} rx={1} style={{ fill: COLOR.galv }} />
        <rect
          x={46}
          y={PIVOT.y - 18}
          width={48}
          height={36}
          rx={6}
          style={{ fill: COLOR.galvLight }}
        />
        <rect x={46} y={PIVOT.y + 6} width={48} height={12} rx={6} style={{ fill: COLOR.galv }} />

        <g className="valve__lever" style={leverStyle}>
          <rect
            x={PIVOT.x - 4 + (dragging ? 5 : 2)}
            y={PIVOT.y - 60 + (dragging ? 8 : 3)}
            width={8}
            height={60}
            rx={4}
            fill="#000"
            opacity={0.3}
          />
          <rect
            x={PIVOT.x - 4}
            y={PIVOT.y - 58}
            width={8}
            height={58}
            rx={3}
            style={{ fill: COLOR.galvMid }}
          />
          {fn === 'outlet' ? (
            <rect
              x={PIVOT.x - 9}
              y={PIVOT.y - 62}
              width={18}
              height={36}
              rx={9}
              strokeWidth={1.5}
              style={{ fill: disabled ? COLOR.galvDark : handle, stroke: handleStroke }}
            />
          ) : (
            <>
              <circle
                cx={PIVOT.x}
                cy={PIVOT.y - 58}
                r={11}
                strokeWidth={1.5}
                style={{ fill: disabled ? COLOR.galvDark : handle, stroke: handleStroke }}
              />
              <circle cx={PIVOT.x} cy={PIVOT.y - 58} r={4.5} style={{ fill: COLOR.galvLight }} />
            </>
          )}
        </g>
        <circle
          data-part="pivot"
          cx={PIVOT.x}
          cy={PIVOT.y}
          r={8}
          style={{ fill: COLOR.galvEdge }}
        />
        <circle cx={PIVOT.x} cy={PIVOT.y} r={3} style={{ fill: COLOR.ink }} />
      </svg>
      {disabled && <span className="valve__chip">{disabledReason}</span>}
    </div>
  );
}
