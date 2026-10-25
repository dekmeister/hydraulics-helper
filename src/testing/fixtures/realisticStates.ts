// Realistic-view fixtures (docs/TESTING.md §3.2): the same sim states as the simplified panel's
// fixtures, shown on the realistic bay, for every appliance that has a realistic layout.
import { APPLIANCES } from '../../sim/appliances/catalogue';
import type { ApplianceSpec, SimState } from '../../sim/types';
import { getRealisticLayout } from '../../ui/appliances/registry';
import { panelState } from './panelStates';
import { SOURCE_STATE_SCENARIO, sourceState } from './sourceStates';

export type RealisticStateId =
  'idle' | 'tank-attack-700' | 'highlighted' | 'draught-priming' | 'refilling';

/** Scenario each state is built from, so the header picker shows it. */
export const REALISTIC_STATE_SCENARIO: Readonly<Record<RealisticStateId, string>> = {
  idle: 'tank-attack',
  'tank-attack-700': 'tank-attack',
  highlighted: 'tank-attack',
  'draught-priming': SOURCE_STATE_SCENARIO['draught-priming'],
  refilling: SOURCE_STATE_SCENARIO.refilling,
};

export function realisticState(spec: ApplianceSpec, id: RealisticStateId): SimState {
  switch (id) {
    case 'idle':
      return panelState(spec, 'idle');
    case 'tank-attack-700':
    case 'highlighted':
      return panelState(spec, 'tank-attack-700');
    case 'draught-priming':
    case 'refilling':
      return sourceState(spec, id);
  }
}

/** Catalogue appliances with a realistic layout: each gets every realistic fixture. */
export const REALISTIC_APPLIANCES: readonly ApplianceSpec[] = APPLIANCES.filter(
  (spec) => getRealisticLayout(spec.id) !== undefined,
);

export function realisticFixtureId(applianceId: string, state: RealisticStateId): string {
  return `real/${applianceId}/${state}`;
}
