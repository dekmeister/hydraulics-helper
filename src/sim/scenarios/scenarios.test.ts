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

  // The UI draws one lay per delivery (selectors `lineOnDelivery`, scene and panel rows), so a
  // scenario may not put two lines on one delivery, nor a line on a delivery the truck lacks.
  it.each(specs.map((spec) => [spec.id, spec] as const))(
    'lays at most one line per delivery, each on a spec delivery, on %s',
    (_specId, spec) => {
      const { lines } = scenario.build(spec).state;
      const used = lines.map((l) => `${l.truckId}/${l.deliveryId}`);
      expect(new Set(used).size).toBe(used.length);
      const deliveryIds = spec.deliveries.map((d) => d.id);
      for (const l of lines) expect(deliveryIds).toContain(l.deliveryId);
    },
  );

  it.each(specs.map((spec) => [spec.id, spec] as const))('golden trace on %s', async (id, spec) => {
    await expect(scenarioTraceCsv(scenario, spec)).toMatchFileSnapshot(
      `__traces__/${scenario.id}.${id}.csv`,
    );
  });
});
