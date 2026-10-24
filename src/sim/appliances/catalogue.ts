import type { ApplianceSpec } from '../types';
import { CAT1 } from './cat1';

/** Every appliance a player can choose. Tests also run the contract suite over a test-only spec. */
export const APPLIANCES: readonly ApplianceSpec[] = [CAT1];

export function getAppliance(id: string): ApplianceSpec {
  const spec = APPLIANCES.find((a) => a.id === id);
  if (spec === undefined) throw new Error(`Unknown appliance '${id}'`);
  return spec;
}
