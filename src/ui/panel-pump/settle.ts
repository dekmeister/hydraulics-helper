import { flushSync } from 'react-dom';

// Registry of damped displays, so the e2e test API can snap every needle to its target before a
// screenshot or assertion (docs/TESTING.md §3.1 settle()). Harmless in the production build.

const snappers = new Set<() => void>();

/** Register a snap callback; returns the unregister function. */
export function onSnap(snap: () => void): () => void {
  snappers.add(snap);
  return () => {
    snappers.delete(snap);
  };
}

/** Snap every damped display to its target and commit the render synchronously. */
export function snapAll(): void {
  flushSync(() => {
    for (const snap of snappers) snap();
  });
}
