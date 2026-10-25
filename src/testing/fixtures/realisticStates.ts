// Realistic-view fixtures (docs/TESTING.md §3.2): the same sim states as the simplified panel's
// fixtures, shown on the realistic bay, for every appliance that has a realistic layout.
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { createIdleInputs } from '../../sim/engine';
import type { ApplianceSpec, SimState } from '../../sim/types';
import { getRealisticLayout } from '../../ui/appliances/registry';
import { panelState, settle } from './panelStates';
import { SOURCE_STATE_SCENARIO, sourceState } from './sourceStates';

export type RealisticStateId =
  | 'idle'
  | 'tank-attack-700'
  | 'after-tank-attack'
  | 'highlighted'
  | 'draught-priming'
  | 'draught-working'
  | 'refilling';

/** Scenario each state is built from, so the header picker shows it. */
export const REALISTIC_STATE_SCENARIO: Readonly<Record<RealisticStateId, string>> = {
  idle: 'tank-attack',
  'tank-attack-700': 'tank-attack',
  'after-tank-attack': 'tank-attack',
  highlighted: 'tank-attack',
  'draught-priming': SOURCE_STATE_SCENARIO['draught-priming'],
  'draught-working': SOURCE_STATE_SCENARIO['draught-working'],
  refilling: SOURCE_STATE_SCENARIO.refilling,
};

/**
 * Sim state for a realistic fixture. 'after-tank-attack': the tank attack run, then every control
 * shut for 2 s, so the casing keeps its water with nothing moving.
 */
export function realisticState(spec: ApplianceSpec, id: RealisticStateId): SimState {
  switch (id) {
    case 'idle':
      return panelState(spec, 'idle');
    case 'tank-attack-700':
    case 'highlighted':
      return panelState(spec, 'tank-attack-700');
    case 'after-tank-attack':
      return settle(panelState(spec, 'tank-attack-700'), createIdleInputs(spec), 2);
    case 'draught-priming':
    case 'draught-working':
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
