import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { TapBehaviour } from '../../appliances/types';
import { DRAG_THRESHOLD_PX, keyedPosition } from './controlMath';

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
}

export interface LeverGestureOptions {
  value: number;
  onChange: (open: number) => void;
  tap: TapBehaviour;
  disabled: boolean;
  /** Opening for a pointer position; the lever's own geometry. */
  openingAt: (e: PointerEvent) => number;
}

/**
 * Pointer and keyboard handling shared by the quarter-turn levers (Design §5): a press past
 * DRAG_THRESHOLD_PX drags the lever to the pointer; a tap toggles or does nothing per `tap`;
 * arrow, Page and Home/End keys step it (and Enter/Space toggle when taps do).
 */
export function useLeverGesture({
  value,
  onChange,
  tap,
  disabled,
  openingAt,
}: LeverGestureOptions) {
  const gesture = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (disabled || gesture.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (g?.pointerId !== e.pointerId) return;
    if (!g.dragging && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD_PX)
      return;
    if (!g.dragging) {
      g.dragging = true;
      setDragging(true);
    }
    onChange(openingAt(e));
  };

  const endGesture = (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (g?.pointerId !== e.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (!g.dragging && !cancelled && tap === 'toggle') onChange(value >= 0.5 ? 0 : 1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
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

  return {
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        endGesture(e, false);
      },
      onPointerCancel: (e: PointerEvent<HTMLElement>) => {
        endGesture(e, true);
      },
      onKeyDown,
    },
  };
}
