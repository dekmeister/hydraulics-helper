// Fireground data checks (ARCHITECTURE §9.6): a scenario's sources and supply hoses must fit the
// trucks they're plugged into. Data errors throw at state creation instead of being ignored.
import type { ApplianceSpec, SupplyLine, WaterSource } from './types';

export interface SiteTruck {
  id: string;
  spec: ApplianceSpec;
}

/**
 * Throw on the first data error in a site: duplicate ids, a supply to a missing truck, source or
 * inlet, a supply on a non-suction inlet or on an inlet that already has one, or more than one
 * static source per truck (priming is tracked per pump, so a second dam would prime for free).
 */
export function validateSite(
  trucks: readonly SiteTruck[],
  sources: readonly WaterSource[],
  supplies: readonly SupplyLine[],
): void {
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
    if (inlet.kind !== 'suction')
      throw new Error(`Supply '${supply.id}': '${inlet.id}' is not a suction inlet`);
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
}
