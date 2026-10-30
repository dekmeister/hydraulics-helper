import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import { activeTruck, engineStatus, selectWarnings } from '../../state/selectors';
import { LOW_TANK_FRACTION } from '../../state/tankLevel';
import { bareDeliveryIds } from '../../sim/hosed';
import { deliveryLines } from '../../state/selectors';
import { engineStates, hasBareDelivery, panelState, TANK_ATTACK_TARGET_KPA } from './panelStates';

describe.each([...APPLIANCES, TEST_APPLIANCE].map((s) => [s.id, s] as const))(
  'panel fixture states: %s',
  (_id, spec) => {
    const capacityL = spec.tank?.capacityL ?? 0;

    it('engine states show what their captions say', () => {
      const status = (id: Parameters<typeof panelState>[1]) => {
        const s = panelState(spec, id);
        return engineStatus(s, activeTruck(s).inputs);
      };
      expect(status('idle')).toMatchObject({ phase: 'running', ignition: true });
      expect(status('engine-cold')).toMatchObject({ phase: 'off', ignition: false });
      expect(status('ignition-on')).toMatchObject({ phase: 'off', lampsLit: true });
      expect(status('cranking').phase).toBe('cranking');
      expect(activeTruck(panelState(spec, 'cranking')).rpm).toBeGreaterThan(0);
      expect(status('stopping').phase).toBe('stopping');
      if (engineStates(spec).includes('stop-without-ignition'))
        expect(status('stop-without-ignition')).toMatchObject({
          phase: 'running',
          stopWithoutIgnition: true,
        });
    });

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

    it.runIf(hasBareDelivery(spec))(
      'empty-delivery-open dumps water at the truck and pulls the discharge down',
      () => {
        const s = panelState(spec, 'empty-delivery-open');
        const t = activeTruck(s);
        const [bare] = bareDeliveryIds(s, t.id);
        const d = deliveryLines(s).find((x) => x.deliveryId === bare);
        expect(d).toMatchObject({ state: 'none', moving: true });
        expect(t.readings.dischargeKpa).toBeLessThan(TANK_ATTACK_TARGET_KPA * 0.8);
        expect(t.tankL).toBeGreaterThan(0.5 * capacityL);
      },
    );

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
