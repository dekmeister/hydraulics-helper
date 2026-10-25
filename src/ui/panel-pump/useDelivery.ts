import { lineOnDelivery, relayOnDelivery } from '../../state/selectors';
import { relayTarget } from '../../state/relay';
import { useStore } from '../../state/store';
import type { ControlId } from '../../sim/types';
import { describeLine, describeRelay } from './lineText';

/**
 * What a delivery's control needs from the store, whichever view draws it: what's on it (a lay or
 * a relay, which makes its valve worth opening), its valve, and the scene↔panel highlight.
 */
export function useDelivery(control: ControlId) {
  const line = useStore((s) => lineOnDelivery(s.sim, control));
  const relayText = useStore((s) => {
    const relay = relayOnDelivery(s.sim, control);
    return relay === undefined ? undefined : describeRelay(relay, relayTarget(s.sim, relay));
  });
  const open = useStore((s) => s.inputs.valves[control] ?? 0);
  const setValve = useStore((s) => s.setValve);
  const highlight = useStore((s) =>
    s.highlight?.deliveryId === control ? s.highlight.from : null,
  );
  const toggleHighlight = useStore((s) => s.toggleHighlight);
  return {
    laid: line !== undefined || relayText !== undefined,
    /** What's on it, in words: the lay, the relay, or 'No line laid'. */
    lineText: line !== undefined ? describeLine(line) : (relayText ?? 'No line laid'),
    open,
    setOpen: (v: number) => {
      setValve(control, v);
    },
    /** Which side asked for the highlight, or null. */
    highlight,
    toggleHighlight: () => {
      toggleHighlight(control, 'panel');
    },
  };
}
