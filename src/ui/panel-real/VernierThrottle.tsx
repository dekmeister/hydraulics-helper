import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { formatPercent } from '../format';
import { COLOR } from '../theme/colors';
import { classifyDrag, pulledThrottle, twistedThrottle, type VernierGesture } from './vernierMath';

// Drawing space (viewBox 0 0 300 170), the knob seen side on: the panel face at the left, the
// shaft coming out of it, the knurled knob and its red release cap on the end.
const VIEW_W = 300;
const VIEW_H = 170;
const AXIS_Y = 74;
/** Where the knob's face sits pushed fully in, and how far it pulls out, drawing units. */
const KNOB_IN_X = 62;
const TRAVEL_U = 130;
const KNOB_W = 64;
const KNOB_H = 104;
/** Keyboard: an arrow is a quarter turn; Page Up / Down a coarse push or pull. */
const PAGE_STEP = 0.1;

export interface VernierThrottleProps {
  label: string;
  /** Throttle position, 0–1: how far the knob is pulled out. */
  value: number;
  onChange: (value: number) => void;
  /** Throttle travel per full twist (`EngineSpec.vernier`). */
  perTurn: number;
  style: CSSProperties;
}

/**
 * A vernier throttle (Cat 7 pump panel): pull the knob out for more, push it in for less, with its
 * red RELEASE button held; let go and it HOLDs, and twisting it fine-tunes. Seen side on, so a
 * drag along the shaft is a push or pull and a drag up or down rolls the knob (a twist: up opens).
 * A role="slider" on the throttle: arrows twist a quarter turn, Page Up / Down push or pull 10 %,
 * Home / End all the way.
 */
export function VernierThrottle({ label, value, onChange, perTurn, style }: VernierThrottleProps) {
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    start: number;
    gesture: VernierGesture | null;
  } | null>(null);
  const [gesture, setGesture] = useState<VernierGesture | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      start: value,
      gesture: null,
    };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d?.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const g = d.gesture ?? classifyDrag(dx, dy);
    if (g === null) return;
    if (d.gesture === null) {
      drag.current = { ...d, gesture: g };
      setGesture(g);
    }
    const r = e.currentTarget.getBoundingClientRect();
    if (g === 'pull') onChange(pulledThrottle(d.start, dx, (r.width * TRAVEL_U) / VIEW_W));
    else onChange(twistedThrottle(d.start, dy, Math.PI * ((r.height * KNOB_H) / VIEW_H), perTurn));
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    setGesture(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowUp: perTurn / 4,
      ArrowRight: perTurn / 4,
      ArrowDown: -perTurn / 4,
      ArrowLeft: -perTurn / 4,
      PageUp: PAGE_STEP,
      PageDown: -PAGE_STEP,
      Home: -1,
      End: 1,
    };
    const by = step[e.key];
    if (by === undefined) return;
    e.preventDefault();
    onChange(Math.min(1, Math.max(0, value + by)));
  };

  const knobX = KNOB_IN_X + value * TRAVEL_U;
  const top = AXIS_Y - KNOB_H / 2;
  const released = gesture === 'pull';
  return (
    <div
      className="vernier"
      style={style}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={value <= 0 ? 'idle' : formatPercent(value)}
      data-gesture={gesture ?? 'none'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={onKeyDown}
    >
      <svg viewBox={`0 0 ${String(VIEW_W)} ${String(VIEW_H)}`} aria-hidden="true">
        {/* Panel face and the threaded bush the cable comes through. */}
        <rect x={0} y={8} width={18} height={132} style={{ fill: COLOR.galvDark }} />
        <rect
          x={18}
          y={AXIS_Y - 22}
          width={30}
          height={44}
          rx={4}
          style={{ fill: COLOR.galvMid }}
        />
        {/* Shaft: shows as the knob comes out, graduated so the setting can be read. */}
        <rect
          x={48}
          y={AXIS_Y - 7}
          width={Math.max(0, knobX - 48)}
          height={14}
          style={{ fill: COLOR.galvLight }}
        />
        {[0.25, 0.5, 0.75].map((f) => {
          const x = KNOB_IN_X + f * TRAVEL_U - (KNOB_IN_X - 48);
          return x < knobX ? (
            <line key={f} x1={x} y1={AXIS_Y - 7} x2={x} y2={AXIS_Y + 7} className="vernier__tick" />
          ) : null;
        })}
        {/* Knurled knob. */}
        <rect
          x={knobX}
          y={top}
          width={KNOB_W}
          height={KNOB_H}
          rx={10}
          style={{ fill: COLOR.ink }}
        />
        {Array.from({ length: 7 }, (_, i) => (
          <line
            key={i}
            x1={knobX + 8 + i * 8}
            y1={top + 6}
            x2={knobX + 8 + i * 8}
            y2={top + KNOB_H - 6}
            className="vernier__knurl"
          />
        ))}
        {/* Red release cap: pressed in while the knob is being pushed or pulled. */}
        <rect
          x={knobX + KNOB_W - (released ? 4 : 0)}
          y={AXIS_Y - 26}
          width={22}
          height={52}
          rx={8}
          style={{ fill: COLOR.alarm }}
        />
        <text x={VIEW_W / 2} y={VIEW_H - 8} textAnchor="middle" className="vernier__label">
          {released ? 'RELEASE' : 'HOLD'}
        </text>
      </svg>
    </div>
  );
}
