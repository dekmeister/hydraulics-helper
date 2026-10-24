import { describe, expect, it } from 'vitest';
import { TEST_APPLIANCE } from '../appliances/testAppliance';
import { eligibleAppliances, scenarioTraceCsv, SCENARIOS } from './index';

// Golden traces (docs/TESTING.md §2, layer 3). If one changes, explain the numeric diff before
// updating it; never update a trace to make a calibration test pass.
describe.each(SCENARIOS.map((s) => [s.id, s] as const))('scenario %s', (_id, scenario) => {
  const specs = eligibleAppliances(scenario, [...eligibleAppliances(scenario), TEST_APPLIANCE]);

  it('is playable on at least one registered appliance', () => {
    expect(eligibleAppliances(scenario).length).toBeGreaterThan(0);
  });

  it.each(specs.map((spec) => [spec.id, spec] as const))('golden trace on %s', async (id, spec) => {
    await expect(scenarioTraceCsv(scenario, spec)).toMatchFileSnapshot(
      `__traces__/${scenario.id}.${id}.csv`,
    );
  });
});
