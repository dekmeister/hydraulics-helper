// Several trucks on one fireground (PLAN M5): creation, held inputs, switching, per-truck noise.
import { describe, expect, it } from 'vitest';
import { CAT1 } from './appliances/cat1';
import { TEST_APPLIANCE } from './appliances/testAppliance';
import {
  createIdleInputs,
  createInitialState,
  createSiteState,
  DEFAULT_TRUCK_ID,
  reseed,
  switchTruck,
} from './engine';
import { draughtSite, inputsWith, layLine, primedState, run, truckOf } from './testUtils';
import type { SimState, TruckState } from './types';

const truck = (s: SimState, id: string): TruckState => {
  const t = s.trucks.find((x) => x.id === id);
  if (t === undefined) throw new Error(`no truck ${id}`);
  return t;
};

/** A base pump of the test appliance with a line on 'right', tank and that delivery held open. */
const BASE = {
  id: 'base',
  label: 'Base pump',
  spec: TEST_APPLIANCE,
  inputs: inputsWith(0.6, ['tank-valve', 'right']),
};
const baseLine = { ...layLine('right', '65L', 2, 20), id: 'base-line', truckId: 'base' };

describe('createSiteState', () => {
  it('builds every truck with its own spec copy, label and held inputs; the first is active', () => {
    const s = createSiteState([{ id: 'attack', label: 'Attack pump', spec: CAT1 }, BASE]);
    expect(s.activeTruckId).toBe('attack');
    expect(s.trucks.map((t) => t.label)).toEqual(['Attack pump', 'Base pump']);
    expect(truck(s, 'attack').spec).toEqual(CAT1);
    expect(truck(s, 'base').spec).not.toBe(TEST_APPLIANCE);
    expect(truck(s, 'attack').inputs).toEqual(createIdleInputs(CAT1));
    expect(truck(s, 'base').inputs.valves.right).toBe(1);
    expect(truck(s, 'base').inputs.throttle).toBe(0.6);
    expect(s.links).toEqual([]);
    expect(s.linkReadings).toEqual({});
  });

  it('can start another truck active, and a truck already primed', () => {
    const s = createSiteState(
      [
        { id: 'a', spec: CAT1 },
        { ...BASE, primed: true },
      ],
      [],
      {
        activeTruckId: 'base',
      },
    );
    expect(s.activeTruckId).toBe('base');
    expect(truck(s, 'base').pump.primed).toBe(true);
    expect(truck(s, 'a').label).toBe('Truck 1');
  });

  it('rejects duplicate truck ids, an unknown active truck and inputs the spec lacks', () => {
    expect(() => createSiteState([BASE, BASE])).toThrow(/duplicate truck/);
    expect(() => createSiteState([BASE], [], { activeTruckId: 'nope' })).toThrow(/no truck/);
    expect(() => createSiteState([{ ...BASE, inputs: inputsWith(0, ['d1']) }])).toThrow(
      /unknown valve 'd1'/,
    );
  });

  it('keeps the one-truck form as createInitialState, labelled Truck 1', () => {
    const s = createInitialState(CAT1);
    expect(s.trucks.map((t) => [t.id, t.label])).toEqual([[DEFAULT_TRUCK_ID, 'Truck 1']]);
  });
});

describe('trucks the player is not operating', () => {
  it('hold their inputs and keep pumping while the player works another truck', () => {
    const s0 = createSiteState([{ id: 'attack', spec: CAT1 }, BASE], [baseLine]);
    const s = run(s0, createIdleInputs(CAT1), 50);
    expect(truck(s, 'base').readings.deliveryFlowLpm.right).toBeGreaterThan(0);
    expect(truck(s, 'base').tankL).toBeLessThan(TEST_APPLIANCE.tank?.capacityL ?? 0);
    expect(truck(s, 'attack').readings.pumpFlowLpm).toBe(0);
  });
});

describe('switchTruck', () => {
  it('leaves the player’s inputs held on the truck left, and makes the other active', () => {
    const s0 = createSiteState([{ id: 'attack', spec: CAT1 }, BASE], [baseLine]);
    const held = inputsWith(0.3, ['tank-to-pump']);
    const s = switchTruck(s0, 'base', held);
    expect(s.activeTruckId).toBe('base');
    expect(truck(s, 'attack').inputs).toEqual({
      ...createIdleInputs(CAT1),
      throttle: 0.3,
      valves: { ...createIdleInputs(CAT1).valves, 'tank-to-pump': 1 },
    });
    // The attack truck now runs on what it was left with.
    const later = run(s, truck(s, 'base').inputs, 30);
    expect(truck(later, 'attack').inputs.throttle).toBe(0.3);
    expect(truck(later, 'attack').rpm).toBeGreaterThan(CAT1.engine.idleRpm);
  });

  it('throws on a truck that is not on the fireground', () => {
    expect(() => switchTruck(createInitialState(CAT1), 'ghost', createIdleInputs(CAT1))).toThrow(
      /no truck 'ghost'/,
    );
  });
});

describe('per-truck noise', () => {
  const cavitatingAlone = () =>
    primedState(createInitialState(CAT1, [layLine('d1', '65L', 1, 32)], draughtSite(CAT1, 6)));

  it('gives the first truck the scenario seed and every truck its own stream', () => {
    const s = createSiteState([{ id: DEFAULT_TRUCK_ID, spec: CAT1 }, BASE], [], { seed: 42 });
    expect(s.trucks[0]?.rngState).toBe(42);
    expect(s.trucks[1]?.rngState).not.toBe(42);
  });

  it('adding a truck does not change another truck’s flutter', () => {
    const alone = cavitatingAlone();
    const withBase: SimState = {
      ...alone,
      trucks: [...alone.trucks, ...createSiteState([BASE], [baseLine]).trucks],
      lines: [...alone.lines, baseLine],
    };
    const inputs = inputsWith(1, ['suction', 'd1']);
    const a = truckOf(run(alone, inputs, 60));
    const b = truckOf(run(withBase, inputs, 60));
    expect(a.readings.cavitation).toBeGreaterThan(0);
    expect(b.pump.flutter).toBe(a.pump.flutter);
  });

  it('reseed restarts every stream from a new seed', () => {
    const s = reseed(createSiteState([{ id: 'x', spec: CAT1 }, BASE]), 9);
    expect(s.trucks[0]?.rngState).toBe(9);
    expect(reseed(s, 9)).toStrictEqual(s);
    expect(s.trucks[1]?.rngState).not.toBe(reseed(s, 10).trucks[1]?.rngState);
  });
});
