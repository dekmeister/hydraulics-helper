import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { formatPercent } from '../format';
import { DRAG_THRESHOLD_PX } from '../panel-pump/controls/controlMath';
import { COLOR } from '../theme/colors';

// Drawing space (viewBox 0 0 150 280): the bezel's centre, and how far the bat's tip shows past it.
const CENTRE_Y = 130;
const BAT_TRAVEL = 46;

export interface SpeedSwitchProps {
  label: string;
  /** Throttle position, 0–1. */
  value: number;
  /** Push the switch: +1 up (faster), −1 down. The store flicks, then ramps while held. */
  onPress: (direction: 1 | -1) => void;
  onRelease: () => void;
  /** One flick by keyboard: the throttle moved by this fraction. */
  onFlick: (direction: 1 | -1) => void;
  style: CSSProperties;
}

/**
 * The speed controller (Cat 1 panel): a spring-centred toggle, seen face on. Hold it up to run
 * the engine up, down to run it down; flick it for a small step; the speed stays where it's left.
 * The whole control is a role="slider" on the throttle. A press on the upper or lower half pushes
 * it that way, and a swipe up or down while held pushes it the way of the swipe. Up and Down
 * arrows flick.
 */
export function SpeedSwitch({
  label,
  value,
  onPress,
  onRelease,
  onFlick,
  style,
}: SpeedSwitchProps) {
  const held = useRef<{ pointerId: number; direction: 1 | -1; startY: number } | null>(null);
  const [tilt, setTilt] = useState<1 | -1 | 0>(0);
  // A switch that goes away while held lets go, or the store would ramp on with nothing held.
  const release = useRef(onRelease);
  useEffect(() => {
    release.current = onRelease;
  });
  useEffect(
    () => () => {
      if (held.current !== null) release.current();
    },
    [],
  );
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (held.current !== null) return;
    const r = e.currentTarget.getBoundingClientRect();
    const direction = e.clientY < r.top + r.height / 2 ? 1 : -1;
    e.currentTarget.setPointerCapture(e.pointerId);
    held.current = { pointerId: e.pointerId, direction, startY: e.clientY };
    setTilt(direction);
    onPress(direction);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const h = held.current;
    if (h?.pointerId !== e.pointerId) return;
    const dy = e.clientY - h.startY;
    if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    const direction = dy < 0 ? 1 : -1;
    if (direction === h.direction) return;
    // Swiped the other way: let go and push it that way instead.
    onRelease();
    held.current = { ...h, direction };
    setTilt(direction);
    onPress(direction);
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (held.current?.pointerId !== e.pointerId) return;
    held.current = null;
    setTilt(0);
    onRelease();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const direction = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : null;
    if (direction === null) return;
    e.preventDefault();
    onFlick(direction);
  };

  const tipY = CENTRE_Y - tilt * BAT_TRAVEL;
  return (
    <div
      className="speed-switch"
      style={style}
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
      onLostPointerCapture={end}
      onKeyDown={onKeyDown}
    >
      <svg viewBox="0 0 150 280" aria-hidden="true">
        <rect x={6} y={6} width={138} height={268} rx={12} style={{ fill: COLOR.alarm }} />
        <path d="M75 16 l-16 24 h32 Z" style={{ fill: COLOR.dial }} />
        <path d="M75 264 l-16 -24 h32 Z" style={{ fill: COLOR.dial }} />
        <circle cx={75} cy={CENTRE_Y} r={32} style={{ fill: COLOR.ink }} />
        <circle cx={75} cy={CENTRE_Y} r={22} style={{ fill: COLOR.galvDark }} />
        {/* The bat, face on: end-on at rest, foreshortened up or down while pushed. */}
        <rect
          x={75 - 10}
          y={Math.min(CENTRE_Y, tipY)}
          width={20}
          height={Math.abs(tipY - CENTRE_Y)}
          style={{ fill: COLOR.galvMid }}
        />
        <circle cx={75} cy={tipY} r={15} style={{ fill: COLOR.ink }} />
        <circle cx={71} cy={tipY - 4} r={5} style={{ fill: COLOR.galvMid }} />
        <text x={75} y={222} textAnchor="middle" className="speed-switch__label">
          SPEED
        </text>
      </svg>
    </div>
  );
}
