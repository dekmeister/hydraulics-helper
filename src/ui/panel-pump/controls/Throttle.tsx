import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { COLOR } from '../../theme/colors';
import { formatPercent } from '../../format';
import { clamp01, dragPosition, keyedPosition } from './controlMath';
import './controls.css';

export interface ThrottleProps {
  label: string;
  /** Throttle position, 0 idle … 1 full. */
  value: number;
  onChange: (position: number) => void;
  /** Fraction one − / + press moves (the vernier). */
  vernierStep: number;
}

// Drawing space (viewBox 0 0 240 64): housing at the left, the handle pulls out to the right.
const TRACK = { x0: 44, x1: 220, y: 32 };
const TRAVEL = TRACK.x1 - TRACK.x0;

interface Gesture {
  pointerId: number;
  startX: number;
  startValue: number;
  /** CSS px per drawing unit at gesture start. */
  pxPerUnit: number;
}

/**
 * Push-pull T-handle throttle (Design §5, sheet 03): drag the handle out for coarse travel, − / +
 * for vernier steps. Released, it stays put: a cable, not a spring. The drag is relative, so
 * grabbing anywhere on the control never makes the throttle jump.
 */
export function Throttle({ label, value, onChange, vernierStep }: ThrottleProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState(false);
  const handleX = TRACK.x0 + clamp01(value) * TRAVEL;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (gesture.current !== null) return;
    const box = svgRef.current?.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startValue: value,
      pxPerUnit: box === undefined ? 1 : box.width / 240,
    };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g?.pointerId !== e.pointerId) return;
    onChange(dragPosition(g.startValue, e.clientX - g.startX, TRAVEL * g.pxPerUnit));
  };

  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId !== e.pointerId) return;
    gesture.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = keyedPosition(e.key, value);
    if (next === null) return;
    e.preventDefault();
    onChange(next);
  };

  const graduations = Array.from({ length: 11 }, (_, i) => TRACK.x0 + (i * TRAVEL) / 10);

  return (
    <div className="throttle">
      <div
        className={`throttle__slider${dragging ? ' throttle__slider--dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={value <= 0 ? 'idle' : formatPercent(value)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
      >
        <svg ref={svgRef} className="throttle__art" viewBox="0 0 240 64" aria-hidden="true">
          <rect
            data-part="track"
            x={TRACK.x0}
            y={TRACK.y - 3}
            width={TRAVEL}
            height={6}
            rx={3}
            style={{ fill: COLOR.tankUnlit }}
          />
          {/* The shaft is revealed, with its graduations, as the handle is pulled out. */}
          <rect
            x={TRACK.x0}
            y={TRACK.y - 4}
            width={handleX - TRACK.x0}
            height={8}
            style={{ fill: COLOR.galvMid }}
          />
          {graduations
            .filter((x) => x < handleX - 1)
            .map((x) => (
              <line
                key={x}
                x1={x}
                x2={x}
                y1={TRACK.y - 4}
                y2={TRACK.y + 4}
                strokeWidth={1.2}
                style={{ stroke: COLOR.galvEdge }}
              />
            ))}
          <path d={`M6 18 H30 L42 26 V38 L30 46 H6 Z`} style={{ fill: COLOR.galvLight }} />
          <rect x={2} y={14} width={6} height={36} rx={1} style={{ fill: COLOR.galvDark }} />
          {value <= 0 && (
            <path
              d="M70 24 L78 32 L70 40 M84 24 L92 32 L84 40 M98 24 L106 32 L98 40"
              fill="none"
              strokeWidth={2}
              style={{ stroke: COLOR.steelDim }}
            />
          )}
          <g data-part="handle">
            <rect
              x={handleX - 11 + (dragging ? 5 : 2)}
              y={4 + (dragging ? 8 : 3)}
              width={22}
              height={56}
              rx={11}
              fill="#000"
              opacity={0.3}
            />
            <rect
              x={handleX - 11}
              y={4}
              width={22}
              height={56}
              rx={11}
              strokeWidth={1.5}
              style={{ fill: COLOR.galvLight, stroke: COLOR.galvEdge }}
            />
            {[14, 20, 44, 50].map((y) => (
              <line
                key={y}
                x1={handleX - 6}
                x2={handleX + 6}
                y1={y}
                y2={y}
                strokeWidth={1.2}
                style={{ stroke: COLOR.galvDark }}
              />
            ))}
            <circle cx={handleX} cy={32} r={4} style={{ fill: COLOR.ink }} />
          </g>
        </svg>
      </div>
      <div className="throttle__vernier">
        <button
          type="button"
          className="panel-button"
          aria-label={`${label} down`}
          onClick={() => {
            onChange(clamp01(value - vernierStep));
          }}
        >
          −
        </button>
        <output className="throttle__readout" aria-hidden="true">
          {formatPercent(value)}
        </output>
        <button
          type="button"
          className="panel-button"
          aria-label={`${label} up`}
          onClick={() => {
            onChange(clamp01(value + vernierStep));
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
