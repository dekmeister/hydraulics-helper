import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

const isHoldKey = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';

/**
 * Press-and-hold handling shared by the primer controls (Design §5): on while a pointer or
 * Space/Enter is held, off on release. A click with detail 0 is an assistive-technology
 * "activate", which can't hold, so it latches instead; leaving the control (blur or unmount) stops it.
 * Returns props for the switch's button.
 */
export function useHoldSwitch(on: boolean, onChange: (on: boolean) => void) {
  const [pointerId, setPointerId] = useState<number | null>(null);
  // Read on unmount, when the render's own `on` and `onChange` are stale.
  const latest = useRef({ on, onChange });
  useEffect(() => {
    latest.current = { on, onChange };
  });
  useEffect(
    () => () => {
      if (latest.current.on) latest.current.onChange(false);
    },
    [],
  );

  const stop = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== pointerId) return;
    setPointerId(null);
    onChange(false);
  };
  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setPointerId(e.pointerId);
      onChange(true);
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!isHoldKey(e)) return;
      e.preventDefault();
      if (!e.repeat) onChange(true);
    },
    onKeyUp: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!isHoldKey(e)) return;
      e.preventDefault();
      onChange(false);
    },
    onClick: (e: { detail: number }) => {
      // Pointer and keyboard presses are handled as holds above (keys preventDefault their click).
      if (e.detail === 0) onChange(!on);
    },
    onBlur: () => {
      if (on) onChange(false);
    },
  };
}
