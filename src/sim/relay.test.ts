// Relay pumping (PLAN M5, ARCHITECTURE §4.7). Relays run between two different appliance specs
// wherever the behaviour is generic; the contract suite covers every pair.
import { describe, expect, it } from 'vitest';
import { CAT1 } from './appliances/cat1';
import { TEST_APPLIANCE } from './appliances/testAppliance';
import { createSiteState, type TruckSetup } from './engine';
import { relayOrder } from './relay';
import { layLine } from './testUtils';
import type { RelayEnd, RelayLink, WaterSource } from './types';

const relay = (id: string, from: string, deliveryId: string, to: RelayEnd): RelayLink => ({
  id,
  truckId: from,
  deliveryId,
  segments: [{ hose: '65L', lengthM: 30 }],
  elevationM: 0,
  to,
});

const A: TruckSetup = { id: 'a', spec: CAT1 };
const B: TruckSetup = { id: 'b', spec: TEST_APPLIANCE };
const intoB: RelayEnd = { kind: 'inlet', truckId: 'b', inletId: 'intake' };
const PORTABLE_DAM: WaterSource = {
  id: 'pd',
  kind: 'static',
  label: 'Portable dam',
  liftM: 1,
  volumeL: 0,
  capacityL: 5000,
};

describe('relay site checks', () => {
  const site =
    (links: RelayLink[], sources: WaterSource[] = []) =>
    () =>
      createSiteState([A, B], [], { links, sources });

  it('accepts a closed relay, an open relay into a tank and one into a portable dam', () => {
    expect(site([relay('r', 'a', 'd1', intoB)])).not.toThrow();
    expect(site([relay('r', 'a', 'd1', { kind: 'tank', truckId: 'b' })])).not.toThrow();
    expect(
      site([relay('r', 'b', 'right', { kind: 'dam', sourceId: 'pd' })], [PORTABLE_DAM]),
    ).not.toThrow();
  });

  it('rejects relays that do not fit the trucks', () => {
    expect(site([relay('r', 'a', 'd9', intoB)])).toThrow(/no delivery 'd9'/);
    expect(site([relay('r', 'x', 'd1', intoB)])).toThrow(/leaves no truck 'x'/);
    expect(
      site([relay('r', 'a', 'd1', { kind: 'inlet', truckId: 'b', inletId: 'tank-valve' })]),
    ).toThrow(/no suction inlet 'tank-valve'/);
    expect(
      site([relay('r', 'a', 'd1', { kind: 'inlet', truckId: 'a', inletId: 'suction' })]),
    ).toThrow(/its own truck/);
    expect(site([relay('r', 'a', 'd1', { kind: 'dam', sourceId: 'nope' })])).toThrow(
      /no static source 'nope'/,
    );
    expect(
      site([relay('r', 'a', 'd1', intoB), relay('r', 'a', 'd2', { kind: 'tank', truckId: 'b' })]),
    ).toThrow(/duplicate relay id/);
  });

  it('allows one hose per delivery and one supply per inlet', () => {
    expect(site([relay('r1', 'a', 'd1', intoB), relay('r2', 'a', 'd2', intoB)])).toThrow(
      /'intake' already has a supply/,
    );
    expect(
      site([relay('r1', 'a', 'd1', intoB), relay('r2', 'a', 'd1', { kind: 'tank', truckId: 'b' })]),
    ).toThrow(/'d1' already has a hose/);
    const line = { ...layLine('d1', '38L', 1, 15), truckId: 'a' };
    expect(() =>
      createSiteState([A, B], [line], { links: [relay('r', 'a', 'd1', intoB)] }),
    ).toThrow(/'d1' already has a hose/);
  });

  it('rejects closed relays that loop, and orders pumps supply-first', () => {
    const loop = [
      relay('ab', 'a', 'd1', intoB),
      relay('ba', 'b', 'right', { kind: 'inlet', truckId: 'a', inletId: 'suction' }),
    ];
    expect(site(loop)).toThrow(/loop/);
    // b feeds a: b is solved first. An open relay doesn't couple the pumps.
    expect(relayOrder(['a', 'b'], [loop[1] as RelayLink])).toEqual(['b', 'a']);
    expect(
      relayOrder(['a', 'b'], [relay('o', 'b', 'right', { kind: 'tank', truckId: 'a' })]),
    ).toEqual(['a', 'b']);
  });
});
