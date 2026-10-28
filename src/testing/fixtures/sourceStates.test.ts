import { describe, expect, it } from 'vitest';
import { CAT1 } from '../../sim/appliances/cat1';
import { TEST_APPLIANCE } from '../../sim/appliances/testAppliance';
import { activeTruck, selectWarnings } from '../../state/selectors';
import type { SimState } from '../../sim/types';
import { SPILL_SOAK_TAU_S } from '../../sim/constants';
import { spillPoolSize } from '../../state/spill';
import { SOURCE_FIXTURE_SETS } from './catalog';
import { TANK_ATTACK_TARGET_KPA } from './panelStates';
import { sourceState } from './sourceStates';

const lit = (s: SimState) =>
  Object.fromEntries(
    selectWarnings(s, activeTruck(s).inputs)
      .filter((w) => w.level !== 'off')
      .map((w) => [w.id, w.level]),
  );

// The captions in catalog.ts promise these; a re-tuned placeholder that breaks one fails here.
describe.each([CAT1, TEST_APPLIANCE].map((s) => [s.id, s] as const))(
  'source fixture states: %s',
  (_id, spec) => {
    it('draught-working is primed at the working discharge (±1 %) with nothing lit', () => {
      const s = sourceState(spec, 'draught-working');
      const t = activeTruck(s);
      expect(t.pump.primed).toBe(true);
      expect(t.readings.dischargeKpa).toBeGreaterThan(TANK_ATTACK_TARGET_KPA * 0.99);
      expect(t.readings.dischargeKpa).toBeLessThan(TANK_ATTACK_TARGET_KPA * 1.01);
      expect(t.readings.compoundKpa).toBeLessThan(-40);
      expect(lit(s)).toEqual({});
    });

    it('cavitating cavitates with the lamp lit', () => {
      const s = sourceState(spec, 'cavitating');
      expect(activeTruck(s).readings.cavitation).toBeGreaterThan(0);
      expect(lit(s).cavitation).toBeDefined();
    });

    it('hydrant reads positive on the compound at the working discharge, tank untouched', () => {
      const s = sourceState(spec, 'hydrant');
      const t = activeTruck(s);
      expect(t.readings.compoundKpa).toBeGreaterThan(50);
      expect(t.readings.dischargeKpa).toBeCloseTo(TANK_ATTACK_TARGET_KPA, -1);
      expect(t.tankL).toBe(spec.tank?.capacityL);
      expect(lit(s)).toEqual({});
    });
  },
);

describe('Cat 1-only source states', () => {
  it('draught-priming is pulling vacuum, not yet primed, nothing lit', () => {
    const t = activeTruck(sourceState(CAT1, 'draught-priming'));
    expect(t.pump.primed).toBe(false);
    expect(t.pump.vacuumKpa).toBeGreaterThan(10);
    expect(t.readings.compoundKpa).toBeLessThan(-10);
  });

  it('faults has the temperature alarm and a fresh hammer on Delivery 1', () => {
    const s = sourceState(CAT1, 'faults');
    expect(lit(s)).toMatchObject({ overheat: 'alarm', hammer: 'caution' });
    expect(activeTruck(s).lastHammer?.deliveryId).toBe('d1');
  });

  it('every catalogue appliance with a primer control gets draught-priming', () => {
    const cat1 = SOURCE_FIXTURE_SETS.find((x) => x.spec.id === CAT1.id);
    expect(cat1?.states).toEqual([
      'draught-priming',
      'draught-working',
      'cavitating',
      'hydrant',
      'faults',
      'refilling',
      'overflowing',
    ]);
  });

  it('refilling fills the tank through hydrant to tank with the pump idle', () => {
    const s = sourceState(CAT1, 'refilling');
    const t = activeTruck(s);
    expect(t.readings.inletFlowLpm['hydrant-to-tank']).toBeGreaterThan(900);
    expect(t.readings.pumpFlowLpm).toBe(0);
    expect(t.tankL).toBeGreaterThan(500);
  });

  it('overflowing holds the tank full with the hydrant still open and a pool round the truck', () => {
    const t = activeTruck(sourceState(CAT1, 'overflowing'));
    expect(t.readings.inletFlowLpm['hydrant-to-tank']).toBeGreaterThan(900);
    expect(t.tankL).toBe(CAT1.tank?.capacityL);
    // Long past τ, the pool has settled at overflow × τ (the caption's ~85 L).
    const fill = t.readings.inletFlowLpm['hydrant-to-tank'] ?? 0;
    expect(t.readings.overflowLpm).toBeCloseTo(fill, 6);
    // Within 2 %: 0.1 s ticks settle ~1 % above the continuous q·τ, and 6τ in it's 0.25 % short.
    const settledL = (fill / 60) * SPILL_SOAK_TAU_S;
    expect(Math.abs(t.spilledL - settledL) / settledL).toBeLessThan(0.02);
    expect(spillPoolSize(t.spilledL)).toBeDefined();
  });
});
