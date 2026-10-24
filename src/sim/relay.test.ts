// Relay pumping (PLAN M5, ARCHITECTURE §4.7). Relays run between two different appliance specs
// wherever the behaviour is generic; the contract suite covers every pair.
import { describe, expect, it } from 'vitest';
import { CAT1 } from './appliances/cat1';
import { inletOfKind } from './appliances/controls';
import { TEST_APPLIANCE } from './appliances/testAppliance';
import { HOSES, RELAY_DELIVERY_KPA, RELAY_MIN_RESIDUAL_KPA, STANDARD_LENGTH_M } from './constants';
import { createSiteState, type TruckSetup } from './engine';
import { valveLossCoeff } from './network';
import { relayEndKpa, relayOrder } from './relay';
import {
  expectSane,
  expectWithinRel,
  inputsWith,
  layLine,
  run,
  suctionInletOf,
  truck,
} from './testUtils';
import type { ApplianceSpec, RelayEnd, RelayLink, SimState, WaterSource } from './types';

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

// ---------------------------------------------------------------------------
// Closed relay: the base pump's delivery feeds the receiving pump's suction inlet.
// ---------------------------------------------------------------------------

/** First delivery closest to 65 mm: where a relay leaves (as `attachLines` would choose). */
const relayDelivery = (spec: ApplianceSpec) =>
  spec.deliveries.reduce((a, b) => (Math.abs(b.sizeMm - 65) < Math.abs(a.sizeMm - 65) ? b : a)).id;

interface PairOptions {
  lengths?: number;
  elevationM?: number;
  baseThrottle?: number;
  /** Tip of the receiving truck's branches. */
  tipMm?: number;
}

/**
 * A base pump of `base` on its own tank, relay delivery held open, pushing `lengths` × 30 m of
 * 65 mm up `elevationM` to the suction inlet of a receiving pump of `receiver`, which has a 38 mm
 * line on every delivery. The receiver is active.
 */
function closedPair(base: ApplianceSpec, receiver: ApplianceSpec, opts: PairOptions = {}) {
  const { lengths = 4, elevationM = 0, baseThrottle = 0.8, tipMm = 15 } = opts;
  const out = relayDelivery(base);
  const inlet = suctionInletOf(receiver);
  const link: RelayLink = {
    id: 'relay',
    truckId: 'base',
    deliveryId: out,
    segments: Array.from({ length: lengths }, () => ({ hose: '65L', lengthM: 30 })),
    elevationM,
    to: { kind: 'inlet', truckId: 'attack', inletId: inlet },
  };
  const lines = receiver.deliveries.map((d) => ({
    ...layLine(d.id, '38L', 2, tipMm),
    id: `attack-${d.id}`,
    truckId: 'attack',
  }));
  const tankIn = base.inlets.filter((i) => i.kind === 'tank').map((i) => i.id);
  const state = createSiteState(
    [
      { id: 'attack', label: 'Attack pump', spec: receiver },
      {
        id: 'base',
        label: 'Base pump',
        spec: base,
        inputs: inputsWith(baseThrottle, [...tankIn, out]),
      },
    ],
    lines,
    { links: [link] },
  );
  const attackInputs = (throttle: number, open = receiver.deliveries.map((d) => d.id)) =>
    inputsWith(throttle, [inlet, ...open]);
  return { state, link, inlet, out, attackInputs };
}

const PAIRS = [
  [CAT1, TEST_APPLIANCE],
  [TEST_APPLIANCE, CAT1],
] as const;

describe.each(PAIRS.map(([b, r]) => [`${b.id} → ${r.id}`, b, r] as const))(
  'closed relay %s',
  (_name, base, receiver) => {
    it('delivers the base pump’s water to the receiving lines with a positive residual', () => {
      const { state, inlet, out, attackInputs } = closedPair(base, receiver);
      const s = run(state, attackInputs(0.3), 100);
      const b = truck(s, 'base');
      const a = truck(s, 'attack');
      expect(a.readings.compoundKpa).toBeGreaterThan(50);
      expect(a.readings.inletFlowLpm[inlet]).toBeGreaterThan(100);
      for (const d of receiver.deliveries)
        expect(a.readings.deliveryFlowLpm[d.id]).toBeGreaterThan(0);
      // Water is conserved: what leaves the base pump arrives at the attack pump.
      expect(b.readings.deliveryFlowLpm[out]).toBeCloseTo(a.readings.inletFlowLpm[inlet] ?? 0, 6);
      expect(s.linkReadings.relay?.flowLpm).toBeCloseTo(a.readings.inletFlowLpm[inlet] ?? 0, 6);
      // The attack pump's own tank isn't touched while the relay feeds it.
      expect(a.tankL).toBe(receiver.tank?.capacityL);
      expectSane(s);
    });

    it('residual = base discharge − valve − hose friction − head, and matches the compound', () => {
      const { state, link, inlet, out, attackInputs } = closedPair(base, receiver, {
        elevationM: 15,
      });
      const s = run(state, attackInputs(0.3), 150);
      const r = s.linkReadings.relay;
      if (r === undefined) throw new Error('no link reading');
      const q = r.flowLpm;
      const b = truck(s, 'base');
      const open = b.inputs.valves[out] ?? 0;
      const delivery = base.deliveries.find((d) => d.id === out);
      if (delivery === undefined) throw new Error('no relay delivery');
      expect(r.startKpa).toBeCloseTo(
        b.readings.dischargeKpa - (valveLossCoeff(delivery.sizeMm) / open ** 2) * q * q,
        6,
      );
      expect(r.endKpa).toBeCloseTo(relayEndKpa(r.startKpa, link.segments, 15, q), 6);
      // The attack pump's compound reads the hose end less its inlet valve (±1 %: the equivalent
      // source is fitted from the last tick's flow).
      const inletLoss = receiver.inlets.find((i) => i.id === inlet)?.lossKpaPerLpm2 ?? 0;
      expectWithinRel(truck(s, 'attack').readings.compoundKpa, r.endKpa - inletLoss * q * q, 0.01);
    });

    it('pushing uphill leaves less residual at the attack pump', () => {
      const residual = (elevationM: number) => {
        const { state, attackInputs } = closedPair(base, receiver, { elevationM });
        return truck(run(state, attackInputs(0.3), 100), 'attack').readings.compoundKpa;
      };
      expect(residual(20)).toBeLessThan(residual(0) - 100);
    });

    it('over-running the relay flattens the layflat: compound 0, cavitation, throttle adds nothing', () => {
      const { state, inlet, attackInputs } = closedPair(base, receiver, {
        lengths: 6,
        baseThrottle: 0.5,
        tipMm: 20,
      });
      const r90 = truck(run(state, attackInputs(0.9), 100), 'attack').readings;
      const r100 = truck(run(state, attackInputs(1), 100), 'attack').readings;
      expect(r100.compoundKpa).toBeCloseTo(0, 3);
      expect(r100.inletCollapsed[inlet]).toBe(true);
      expect(r100.cavitation).toBeGreaterThan(0);
      expect(r100.pumpFlowLpm).toBeCloseTo(r90.pumpFlowLpm, 0);
    });

    it('gives nothing when the base pump shuts its relay delivery or runs dry', () => {
      const { state, inlet, out, attackInputs } = closedPair(base, receiver);
      const shut: SimState = {
        ...state,
        trucks: state.trucks.map((t) =>
          t.id === 'base'
            ? { ...t, inputs: { ...t.inputs, valves: { ...t.inputs.valves, [out]: 0 } } }
            : t,
        ),
      };
      const s1 = run(shut, attackInputs(0.3), 50);
      expect(truck(s1, 'attack').readings.inletFlowLpm[inlet]).toBe(0);
      expect(s1.linkReadings.relay?.flowLpm).toBe(0);

      const dry: SimState = {
        ...state,
        trucks: state.trucks.map((t) => (t.id === 'base' ? { ...t, tankL: 0 } : t)),
      };
      const s2 = run(dry, attackInputs(0.3), 50);
      expect(truck(s2, 'attack').readings.inletFlowLpm[inlet]).toBe(0);
      expect(truck(s2, 'base').readings.dischargeKpa).toBe(0);
      expectSane(s2);
    });

    it('beats the attack pump’s own tank when both are open (higher head wins, as a hydrant)', () => {
      const { state, inlet, attackInputs } = closedPair(base, receiver);
      const tankIn = inletOfKind(receiver, 'tank');
      const both = attackInputs(0.3);
      both.valves[tankIn] = 1;
      const a = truck(run(state, both, 100), 'attack');
      expect(a.readings.inletFlowLpm[inlet]).toBeGreaterThan(0);
      expect(a.readings.inletFlowLpm[tankIn]).toBe(0);
    });

    it('is deterministic', () => {
      const { state, attackInputs } = closedPair(base, receiver);
      expect(run(state, attackInputs(0.5), 200)).toStrictEqual(run(state, attackInputs(0.5), 200));
    });
  },
);

describe('relay chains', () => {
  it('a booster in the middle passes the base pump’s water on to the attack pump', () => {
    const relayTo = (id: string, from: string, deliveryId: string, to: string, inletId: string) =>
      relay(id, from, deliveryId, { kind: 'inlet', truckId: to, inletId });
    const s0 = createSiteState(
      [
        { id: 'attack', spec: CAT1 },
        { id: 'booster', spec: TEST_APPLIANCE, inputs: inputsWith(0.6, ['intake', 'right']) },
        { id: 'base', spec: CAT1, inputs: inputsWith(0.8, ['tank-to-pump', 'd1']) },
      ],
      [{ ...layLine('d2', '38L', 2, 15), truckId: 'attack' }],
      {
        links: [
          relayTo('base-booster', 'base', 'd1', 'booster', 'intake'),
          relayTo('booster-attack', 'booster', 'right', 'attack', 'suction'),
        ],
      },
    );
    const s = run(s0, inputsWith(0.3, ['suction', 'd2']), 150);
    expect(truck(s, 'attack').readings.deliveryFlowLpm.d2).toBeGreaterThan(100);
    // What reaches the attack pump: its line, plus any relief it dumps to its tank.
    const q = truck(s, 'attack').readings.inletFlowLpm.suction ?? 0;
    expect(s.linkReadings['base-booster']?.flowLpm).toBeCloseTo(q, 6);
    expect(s.linkReadings['booster-attack']?.flowLpm).toBeCloseTo(q, 6);
    expect(truck(s, 'booster').readings.compoundKpa).toBeGreaterThan(0);
    expectSane(s);
  });
});

describe('relay spacing (C12, C13: 700 kPa out, 100 kPa residual, 600 kPa budget)', () => {
  // 65 mm lined loses 100 kPa per length at this flow (the manual's rule-of-thumb loss).
  const q = Math.sqrt(100 / (HOSES['65L']?.kPerM ?? 0) / STANDARD_LENGTH_M);
  const lengths = (n: number) => Array.from({ length: n }, () => ({ hose: '65L', lengthM: 30 }));

  it('C12: 20 m uphill, 4 lengths leave the minimum residual', () => {
    expect(relayEndKpa(RELAY_DELIVERY_KPA, lengths(4), 20, q)).toBeCloseTo(
      RELAY_MIN_RESIDUAL_KPA,
      6,
    );
  });

  it('C13: flat, 6 lengths leave the minimum residual', () => {
    expect(relayEndKpa(RELAY_DELIVERY_KPA, lengths(6), 0, q)).toBeCloseTo(
      RELAY_MIN_RESIDUAL_KPA,
      6,
    );
  });
});
