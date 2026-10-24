import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import { activeTruck, selectWarnings } from '../../state/selectors';
import { LOW_TANK_FRACTION } from '../../state/tankLevel';
import { panelState, TANK_ATTACK_TARGET_KPA } from './panelStates';

describe.each([...APPLIANCES, TEST_APPLIANCE].map((s) => [s.id, s] as const))(
  'panel fixture states: %s',
  (_id, spec) => {
    const capacityL = spec.tank?.capacityL ?? 0;

    it('tank-attack-700 holds the target discharge (±1 %) with no warnings lit', () => {
      const s = panelState(spec, 'tank-attack-700');
      const t = activeTruck(s);
      expect(t.readings.dischargeKpa).toBeGreaterThan(TANK_ATTACK_TARGET_KPA * 0.99);
      expect(t.readings.dischargeKpa).toBeLessThan(TANK_ATTACK_TARGET_KPA * 1.01);
      const lit = selectWarnings(s, t.inputs).filter(
        (w) => w.level === 'caution' || w.level === 'alarm',
      );
      expect(lit).toEqual([]);
    });

    it('tank-low is under the low mark but not empty, and tank-empty reads dry', () => {
      const low = activeTruck(panelState(spec, 'tank-low'));
      expect(low.tankL).toBeGreaterThan(0);
      expect(low.tankL).toBeLessThanOrEqual(LOW_TANK_FRACTION * capacityL);
      const empty = activeTruck(panelState(spec, 'tank-empty'));
      expect(empty.tankL).toBe(0);
      expect(empty.readings.dischargeKpa).toBe(0);
    });
  },
);
