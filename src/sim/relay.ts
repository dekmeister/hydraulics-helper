// Relay pumping (ARCHITECTURE §4.7): hoses from one truck's delivery to another truck or a dam.
import type { RelayLink } from './types';

/** The receiving truck of a closed relay (one that ends at another truck's inlet), if it is one. */
export function closedTo(link: RelayLink): string | undefined {
  return link.burst === undefined && link.to.kind === 'inlet' ? link.to.truckId : undefined;
}

/**
 * Truck ids ordered so every supplying pump of a closed relay comes before the pump it feeds
 * (Kahn's topological sort, ties kept in `truckIds` order). Closed relays couple the pumps' solves;
 * open relays and burst hoses don't. Throws if closed relays form a loop.
 */
export function relayOrder(truckIds: readonly string[], links: readonly RelayLink[]): string[] {
  const feeds = links.flatMap((l) => {
    const to = closedTo(l);
    return to === undefined ? [] : [{ from: l.truckId, to }];
  });
  const order: string[] = [];
  const left = [...truckIds];
  while (left.length > 0) {
    const next = left.find((id) => !feeds.some((f) => f.to === id && left.includes(f.from)));
    if (next === undefined)
      throw new Error(`Closed relays form a loop through '${left.join("', '")}'`);
    order.push(next);
    left.splice(left.indexOf(next), 1);
  }
  return order;
}
