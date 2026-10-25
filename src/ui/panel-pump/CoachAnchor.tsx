import { useEffect, useRef, type ReactNode } from 'react';
import { coachView } from '../../state/lessonView';
import { useStore } from '../../state/store';

/**
 * Wraps a panel item so the lesson coach can point at it: the item gets the focus double ring and
 * is scrolled into view when it becomes the target. `display: contents`, so layout is untouched.
 */
export function CoachAnchor({ itemKey, children }: { itemKey: string; children: ReactNode }) {
  const isTarget = useStore(
    (s) => s.lesson !== null && coachView(s.lesson, s.sim)?.targetKey === itemKey,
  );
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isTarget) return;
    const el = ref.current?.firstElementChild;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
  }, [isTarget]);
  return (
    <div ref={ref} className="coach-anchor" data-coach-target={isTarget ? 'true' : undefined}>
      {children}
    </div>
  );
}
