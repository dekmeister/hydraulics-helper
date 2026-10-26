// Fireground data checks (ARCHITECTURE §9.6): a scenario's sources, supply hoses and relays must
// fit the trucks they're plugged into. Data errors throw at state creation instead of being ignored.
import { relayOrder } from './relay';
import type { ApplianceSpec, HoseLine, RelayLink, SupplyLine, WaterSource } from './types';

export interface SiteTruck {
  id: string;
  spec: ApplianceSpec;
}

/**
 * Throw on the first data error in a site: duplicate truck, source or supply ids, a supply to a
 * missing truck, source or inlet, a supply on the tank feed or on an inlet that already has one,
 * a tank-fill supply from anything but a hydrant of its own, more than one static source per truck (priming is tracked per pump, so a second dam would
 * prime for free), or a relay that doesn't fit (`validateLinks`).
 */
export function validateSite(
  trucks: readonly SiteTruck[],
  sources: readonly WaterSource[],
  supplies: readonly SupplyLine[],
  links: readonly RelayLink[] = [],
  lines: readonly HoseLine[] = [],
): void {
  const truckIds = new Set<string>();
  for (const t of trucks) {
    if (truckIds.has(t.id)) throw new Error(`Site has a duplicate truck id '${t.id}'`);
    truckIds.add(t.id);
  }
  const sourceIds = new Set<string>();
  for (const s of sources) {
    if (sourceIds.has(s.id)) throw new Error(`Site has a duplicate source id '${s.id}'`);
    sourceIds.add(s.id);
  }
  const supplyIds = new Set<string>();
  const usedInlets = new Set<string>();
  const draughts = new Set<string>();
  for (const supply of supplies) {
    if (supplyIds.has(supply.id)) throw new Error(`Site has a duplicate supply id '${supply.id}'`);
    supplyIds.add(supply.id);
    const truck = trucks.find((t) => t.id === supply.truckId);
    if (truck === undefined)
      throw new Error(`Supply '${supply.id}' goes to no truck '${supply.truckId}'`);
    const source = sources.find((x) => x.id === supply.sourceId);
    if (source === undefined)
      throw new Error(`Supply '${supply.id}' has no source '${supply.sourceId}'`);
    const inlet = truck.spec.inlets.find((i) => i.id === supply.inletId);
    if (inlet === undefined)
      throw new Error(`Supply '${supply.id}': ${truck.spec.id} has no inlet '${supply.inletId}'`);
    if (inlet.kind === 'tank')
      throw new Error(`Supply '${supply.id}': '${inlet.id}' is not an external inlet`);
    if (inlet.kind === 'tankFill') {
      if (source.kind !== 'hydrant')
        throw new Error(`Supply '${supply.id}': '${inlet.id}' fills the tank only from a hydrant`);
      // One hose per hydrant while it fills a tank: two draws on one main would share its loss,
      // which the solver doesn't couple (docs/BACKLOG.md).
      const other = supplies.find((x) => x.id !== supply.id && x.sourceId === source.id);
      if (other !== undefined)
        throw new Error(`Supply '${supply.id}': hydrant '${source.id}' also feeds '${other.id}'`);
    }
    const inletKey = `${truck.id}/${inlet.id}`;
    if (usedInlets.has(inletKey))
      throw new Error(`Supply '${supply.id}': '${inlet.id}' already has a supply`);
    usedInlets.add(inletKey);
    if (source.kind === 'static') {
      if (draughts.has(truck.id))
        throw new Error(`Truck '${truck.id}' can draught from only one static source`);
      draughts.add(truck.id);
    }
  }
  validateLinks(trucks, sources, links, lines, usedInlets);
}

/**
 * Relay checks: unique ids; each relay leaves a delivery its truck has, that carries no hose line
 * or other relay; it ends at another truck's free suction inlet, another truck's tank, or a static
 * source; and closed relays don't loop. `usedInlets` holds the inlets supplies already take.
 */
function validateLinks(
  trucks: readonly SiteTruck[],
  sources: readonly WaterSource[],
  links: readonly RelayLink[],
  lines: readonly HoseLine[],
  usedInlets: Set<string>,
): void {
  const ids = new Set<string>();
  const usedDeliveries = new Set(lines.map((l) => `${l.truckId}/${l.deliveryId}`));
  const truckOf = (link: RelayLink, id: string) => {
    const truck = trucks.find((t) => t.id === id);
    if (truck === undefined) throw new Error(`Relay '${link.id}' goes to no truck '${id}'`);
    if (id === link.truckId) throw new Error(`Relay '${link.id}' goes back to its own truck`);
    return truck;
  };
  for (const link of links) {
    if (ids.has(link.id)) throw new Error(`Site has a duplicate relay id '${link.id}'`);
    ids.add(link.id);
    const from = trucks.find((t) => t.id === link.truckId);
    if (from === undefined) throw new Error(`Relay '${link.id}' leaves no truck '${link.truckId}'`);
    if (!from.spec.deliveries.some((d) => d.id === link.deliveryId))
      throw new Error(`Relay '${link.id}': ${from.spec.id} has no delivery '${link.deliveryId}'`);
    const deliveryKey = `${link.truckId}/${link.deliveryId}`;
    if (usedDeliveries.has(deliveryKey))
      throw new Error(`Relay '${link.id}': '${link.deliveryId}' already has a hose on it`);
    usedDeliveries.add(deliveryKey);
    const to = link.to;
    switch (to.kind) {
      case 'inlet': {
        const truck = truckOf(link, to.truckId);
        const inlet = truck.spec.inlets.find((i) => i.id === to.inletId);
        if (inlet?.kind !== 'suction')
          throw new Error(
            `Relay '${link.id}': ${truck.spec.id} has no suction inlet '${to.inletId}'`,
          );
        const key = `${truck.id}/${inlet.id}`;
        if (usedInlets.has(key))
          throw new Error(`Relay '${link.id}': '${inlet.id}' already has a supply`);
        usedInlets.add(key);
        break;
      }
      case 'tank': {
        const truck = truckOf(link, to.truckId);
        if (truck.spec.tank === undefined)
          throw new Error(`Relay '${link.id}': ${truck.spec.id} has no tank`);
        break;
      }
      case 'dam':
        if (sources.find((s) => s.id === to.sourceId)?.kind !== 'static')
          throw new Error(`Relay '${link.id}' ends at no static source '${to.sourceId}'`);
        break;
    }
  }
  relayOrder(
    trucks.map((t) => t.id),
    links,
  );
}
