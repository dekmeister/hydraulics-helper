// Shared set-up for the relay scenarios: the two trucks and the relay hose between them.
import { STANDARD_LENGTH_M } from '../constants';
import { takeDelivery } from './lay';
import type { ApplianceSpec, HoseSegment, RelayEnd, RelayLink } from '../types';

/** Truck ids in the relay scenarios: the player's attack pump and the base pump at the water. */
export const ATTACK_ID = 'attack';
export const BASE_ID = 'base';

/** `n` standard lengths of `hose`. */
export function lengths(hose: string, n: number): HoseSegment[] {
  return Array.from({ length: n }, () => ({ hose, lengthM: STANDARD_LENGTH_M }));
}

/** A relay of `n` lengths of `hose` from the base pump's delivery best sized for it. */
export function baseRelay(
  base: ApplianceSpec,
  hose: string,
  n: number,
  elevationM: number,
  to: RelayEnd,
): RelayLink {
  const delivery = takeDelivery([...base.deliveries], hose);
  return {
    id: 'relay',
    truckId: BASE_ID,
    deliveryId: delivery.id,
    segments: lengths(hose, n),
    elevationM,
    to,
  };
}
