import { APPLIANCES } from '../appliances/catalogue';
import type { ApplianceSpec } from '../types';
import { runScript } from './run';
import { CLOSED_RELAY } from './closedRelay';
import { DRAUGHTING } from './draughting';
import { HYDRANT_SUPPLY } from './hydrantSupply';
import { OPEN_RELAY } from './openRelay';
import { TANK_ATTACK } from './tankAttack';
import { traceCsv } from './trace';
import { supports, type Scenario, type SupportSpecs } from './types';

export { APPLIANCES };

/** Every scripted scenario. Grows into the full scenario ladder in M6. */
export const SCENARIOS: readonly Scenario[] = [
  TANK_ATTACK,
  HYDRANT_SUPPLY,
  DRAUGHTING,
  CLOSED_RELAY,
  OPEN_RELAY,
];

export function getScenario(id: string): Scenario {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (scenario === undefined) throw new Error(`Unknown scenario '${id}'`);
  return scenario;
}

/** Appliances from `pool` that can play `scenario`. */
export function eligibleAppliances(
  scenario: Scenario,
  pool: readonly ApplianceSpec[] = APPLIANCES,
): ApplianceSpec[] {
  return pool.filter((spec) => supports(scenario, spec));
}

/** Run `scenario` on `spec` (support roles on `support`, or the same) and return its golden-trace CSV. */
export function scenarioTraceCsv(
  scenario: Scenario,
  spec: ApplianceSpec,
  support?: SupportSpecs,
): string {
  const run = scenario.build(spec, support);
  return traceCsv(runScript(run), run.state.lines);
}
