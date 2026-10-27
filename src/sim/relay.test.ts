// Relay pumping (M5, ARCHITECTURE §4.7). Relays run between two different appliance specs
// wherever the behaviour is generic; the contract suite covers every pair.
import { describe, expect, it } from 'vitest';
import { CAT1 } from './appliances/cat1';
import { inletOfKind } from './appliances/controls';
import { TEST_APPLIANCE } from './appliances/testAppliance';
import {
  HOSE_BURST_KPA,
  HOSES,
  RELAY_DELIVERY_KPA,
  RELAY_MIN_RESIDUAL_KPA,
  STANDARD_LENGTH_M,
} from './constants';
import {
  chargeLines,
  createIdleInputs,
  createSiteState,
  switchTruck,
  type TruckSetup,
} from './engine';
import { hoseResistance } from './hose';
import { valveLossCoeff } from './network';
import { relayEndKpa, relayOrder } from './relay';
import { getScenario } from './scenarios';
import {
  closedRelayPair,
  expectSane,
  expectWithinRel,
  inputsWith,
  layLine,
  relayDelivery,
  run,
  suctionInletOf,
  truck,
} from './testUtils';
import type {
  ApplianceSpec,
  PlayerInputs,
  RelayEnd,
  RelayLink,
  SimState,
  SupplyLine,
  WaterSource,
} from './types';

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

const PAIRS = [
  [CAT1, TEST_APPLIANCE],
  [TEST_APPLIANCE, CAT1],
] as const;

describe.each(PAIRS.map(([b, r]) => [`${b.id} → ${r.id}`, b, r] as const))(
  'closed relay %s',
  (_name, base, receiver) => {
    it('delivers the base pump’s water to the receiving lines with a positive residual', () => {
      const { state, inlet, out, attackInputs } = closedRelayPair(base, receiver);
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
      const { state, link, inlet, out, attackInputs } = closedRelayPair(base, receiver, {
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
        const { state, attackInputs } = closedRelayPair(base, receiver, { elevationM });
        return truck(run(state, attackInputs(0.3), 100), 'attack').readings.compoundKpa;
      };
      expect(residual(20)).toBeLessThan(residual(0) - 100);
    });

    it('over-running the relay flattens the layflat: compound 0, cavitation, throttle adds nothing', () => {
      const { state, inlet, attackInputs } = closedRelayPair(base, receiver, {
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
      const { state, inlet, out, attackInputs } = closedRelayPair(base, receiver);
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
      const { state, inlet, attackInputs } = closedRelayPair(base, receiver);
      const tankIn = inletOfKind(receiver, 'tank');
      const both = attackInputs(0.3);
      both.valves[tankIn] = 1;
      const a = truck(run(state, both, 100), 'attack');
      expect(a.readings.inletFlowLpm[inlet]).toBeGreaterThan(0);
      expect(a.readings.inletFlowLpm[tankIn]).toBe(0);
    });

    it('is deterministic', () => {
      const { state, attackInputs } = closedRelayPair(base, receiver);
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

// ---------------------------------------------------------------------------
// Over-pressure: the shutdown spike bursts a relay hose (manual L3865–3873).
// ---------------------------------------------------------------------------

describe.each(PAIRS.map(([b, r]) => [`${b.id} → ${r.id}`, b, r] as const))(
  'relay burst %s',
  (_name, base, receiver) => {
    const flowing = () => {
      const pair = closedRelayPair(base, receiver);
      return { ...pair, s: run(pair.state, pair.attackInputs(0.6), 150) };
    };
    const inletShut = (inputs: PlayerInputs, inlet: string, open = 0): PlayerInputs => ({
      ...inputs,
      valves: { ...inputs.valves, [inlet]: open },
    });

    it('slamming the relay inlet shut bursts the length by the pump; the base pump then runs into it', () => {
      const { s, inlet, out, attackInputs } = flowing();
      const shut = inletShut(attackInputs(0.6), inlet);
      const s1 = run(s, shut, 1);
      const burst = s1.links[0]?.burst;
      expect(burst?.atS).toBeCloseTo(s1.timeS, 9);
      // The surge runs back up the hose and adds to the pressure everywhere it passes, so the
      // hose goes where it was already highest: at the pump on a flat relay.
      expect(burst?.segment).toBe(0);
      expect(burst?.peakKpa).toBeGreaterThan(truck(s, 'base').readings.dischargeKpa);
      expect(burst?.peakKpa).toBeGreaterThanOrEqual(HOSE_BURST_KPA);
      expect(truck(s1, 'base').tally.hoseBursts).toBe(1);

      const s2 = run(s1, shut, 50);
      expect(truck(s2, 'base').tally.hoseBursts).toBe(1);
      expect(s2.links[0]?.burst).toEqual(burst);
      // The attack pump has lost its supply; the base pump's water runs out of the burst length:
      // high rpm, low delivery pressure, water flowing (Table 6).
      const reopened = run(s2, attackInputs(0.6), 20);
      expect(truck(reopened, 'attack').readings.inletFlowLpm[inlet]).toBe(0);
      expect(truck(s2, 'base').readings.deliveryFlowLpm[out]).toBeGreaterThan(500);
      expect(truck(s2, 'base').readings.dischargeKpa).toBeLessThan(
        truck(s, 'base').readings.dischargeKpa,
      );
      expect(s2.linkReadings.relay?.endKpa).toBe(0);
      expectSane(reopened);
    });

    it('easing the relay inlet shut over 3 s, slowest at the end, leaves the hose whole', () => {
      const { s, inlet, attackInputs } = flowing();
      // A valve cuts most of its flow in the last of its travel (loss ∝ 1/open²), so easing it
      // means slowing towards shut: an even sweep still cuts ~300 L/min in its last tenth.
      let eased = s;
      for (let i = 1; i <= 30; i++)
        eased = run(eased, inletShut(attackInputs(0.6), inlet, (1 - i / 30) ** 2), 1);
      eased = run(eased, inletShut(attackInputs(0.6), inlet), 100);
      expect(eased.links[0]?.burst).toBeUndefined();
      expect(truck(eased, 'base').tally.hoseBursts).toBe(0);
    });

    it('the base pump slamming its own relay delivery is water hammer on it, not a burst', () => {
      const { s, out } = flowing();
      const switched = switchTruck(s, 'base', truck(s, 'attack').inputs);
      const held = truck(switched, 'base').inputs;
      const s1 = run(switched, { ...held, valves: { ...held.valves, [out]: 0 } }, 1);
      expect(s1.links[0]?.burst).toBeUndefined();
      expect(truck(s1, 'base').tally.waterHammer).toBe(1);
    });

    // Losing supply drops the hose's pressure; it can't send a surge back up it.
    it('the base pump running its tank dry mid-relay leaves the hose whole', () => {
      const { s, attackInputs } = flowing();
      const low: SimState = {
        ...s,
        trucks: s.trucks.map((t) => (t.id === 'base' ? { ...t, tankL: 1 } : t)),
      };
      const dry = run(low, attackInputs(0.6), 20);
      expect(truck(dry, 'base').tankL).toBe(0);
      expect(dry.linkReadings.relay?.flowLpm).toBeLessThan(1);
      expect(dry.links[0]?.burst).toBeUndefined();
      expect(truck(dry, 'base').tally.hoseBursts).toBe(0);
    });

    it('the base pump shutting its own tank-to-pump leaves the hose whole', () => {
      const { s } = flowing();
      const switched = switchTruck(s, 'base', truck(s, 'attack').inputs);
      const held = truck(switched, 'base').inputs;
      const tankIn = base.inlets.filter((i) => i.kind === 'tank').map((i) => i.id);
      const shut = {
        ...held,
        valves: { ...held.valves, ...Object.fromEntries(tankIn.map((i) => [i, 0])) },
      };
      const s1 = run(switched, shut, 20);
      expect(s1.linkReadings.relay?.flowLpm).toBeLessThan(1);
      expect(s1.links[0]?.burst).toBeUndefined();
      expect(truck(s1, 'base').tally.hoseBursts).toBe(0);
    });
  },
);

// ---------------------------------------------------------------------------
// Open relay: the base pump discharges into a tank or a portable dam.
// ---------------------------------------------------------------------------

/** Base pump of `base` on its tank, relay held open at `throttle`, into `to` over 3 lengths. */
function openRelay(
  base: ApplianceSpec,
  receiver: TruckSetup,
  to: RelayEnd,
  sources: WaterSource[] = [],
  supplies: SupplyLine[] = [],
  throttle = 0.6,
) {
  const out = relayDelivery(base);
  const link: RelayLink = {
    id: 'relay',
    truckId: 'base',
    deliveryId: out,
    segments: Array.from({ length: 3 }, () => ({ hose: '65L', lengthM: 30 })),
    elevationM: 5,
    to,
  };
  const tankIn = base.inlets.filter((i) => i.kind === 'tank').map((i) => i.id);
  const state = chargeLines(
    createSiteState(
      [receiver, { id: 'base', spec: base, inputs: inputsWith(throttle, [...tankIn, out]) }],
      receiver.spec.deliveries.map((d) => ({
        ...layLine(d.id, '38L', 2, 15),
        id: `attack-${d.id}`,
        truckId: 'attack',
      })),
      { links: [link], sources, supplies },
    ),
  );
  return { state, link, out };
}

describe.each(PAIRS.map(([b, r]) => [`${b.id} → ${r.id}`, b, r] as const))(
  'open relay %s',
  (_name, base, receiver) => {
    it('into a tank: flows by valve and hose alone, refills the tank, overflows when full', () => {
      const { state, link, out } = openRelay(
        base,
        { id: 'attack', spec: receiver },
        {
          kind: 'tank',
          truckId: 'attack',
        },
      );
      // The base pump's own tank holds more than the 1000 L the attack tank is short of.
      const startL = (receiver.tank?.capacityL ?? 0) - 1000;
      const low: SimState = {
        ...state,
        trucks: state.trucks.map((t) => (t.id === 'attack' ? { ...t, tankL: startL } : t)),
      };
      const s = run(low, createIdleInputs(receiver), 100);
      const b = truck(s, 'base');
      const q = s.linkReadings.relay?.flowLpm ?? 0;
      const delivery = base.deliveries.find((d) => d.id === out);
      if (delivery === undefined) throw new Error('no relay delivery');
      // Open end: discharge − head = (valve + hose)·Q², no branch.
      const r = valveLossCoeff(delivery.sizeMm) + hoseResistance(link.segments);
      expect(q).toBeCloseTo(Math.sqrt((b.readings.dischargeKpa - 10 * link.elevationM) / r), 6);
      expect(s.linkReadings.relay?.endKpa).toBe(0);
      // Ten seconds of flow, less the first moments while the base engine came up.
      expect(truck(s, 'attack').tankL).toBeGreaterThan(startL + (q * 8) / 60);
      const full = run(s, createIdleInputs(receiver), 1200);
      expect(truck(full, 'attack').tankL).toBe(receiver.tank?.capacityL);
      expect(truck(full, 'attack').spilledL).toBeGreaterThan(0);
      expectSane(full);
    });

    describe('into a portable dam the attack pump draughts from', () => {
      // Small enough that the base pump's own tank can fill it.
      const dam = (volumeL: number): WaterSource => ({ ...PORTABLE_DAM, volumeL, capacityL: 1000 });
      const suction = suctionInletOf(receiver);
      const site = (volumeL: number, throttle?: number) =>
        openRelay(
          base,
          { id: 'attack', spec: receiver, primed: true },
          { kind: 'dam', sourceId: 'pd' },
          [dam(volumeL)],
          [
            {
              id: 'suction-hose',
              truckId: 'attack',
              inletId: suction,
              sourceId: 'pd',
              segments: [{ hose: '65H', lengthM: 3 }],
            },
          ],
          throttle,
        );
      const volume = (s: SimState) => {
        const pd = s.sources.find((x) => x.id === 'pd');
        return pd?.kind === 'static' ? pd.volumeL : Number.NaN;
      };
      const draw = (throttle: number) =>
        inputsWith(throttle, [suction, ...receiver.deliveries.map((d) => d.id)]);

      it('fills the dam while nothing draws, and overflows at its capacity', () => {
        const { state } = site(0);
        const s = run(state, createIdleInputs(receiver), 100);
        const q = s.linkReadings.relay?.flowLpm ?? 0;
        expect(q).toBeGreaterThan(100);
        expect(volume(s)).toBeGreaterThan((q * 8) / 60);
        expect(volume(s)).toBeLessThan((q * 10) / 60);
        const full = run(s, createIdleInputs(receiver), 1200);
        expect(volume(full)).toBe(1000);
        const pd = full.sources.find((x) => x.id === 'pd');
        expect(pd?.kind === 'static' ? pd.spilledL : undefined).toBeGreaterThan(0);
      });

      it('balances fill against draw: drawn faster than filled, it empties and the pump loses prime', () => {
        const { state } = site(1000, 0.3);
        let s = run(state, draw(1), 100);
        const a = truck(s, 'attack');
        const fill = s.linkReadings.relay?.flowLpm ?? 0;
        expect(a.readings.inletFlowLpm[suction]).toBeGreaterThan(fill);
        for (let i = 0; i < 3000 && truck(s, 'attack').pump.primed; i++) s = run(s, draw(1), 10);
        expect(volume(s)).toBe(0);
        expect(truck(s, 'attack').pump.primed).toBe(false);
        expectSane(s);
      });

      it('decouples the pumps: the base throttle doesn’t move the attack pump’s gauges', () => {
        const attackAt = (baseThrottle: number) =>
          truck(run(site(1000, baseThrottle).state, draw(0.6), 50), 'attack').readings;
        expect(attackAt(0.9)).toEqual(attackAt(0.4));
      });
    });
  },
);

describe('relay burst in the closed-relay scenario', () => {
  it.each(PAIRS.map(([b, r]) => [`${b.id} → ${r.id}`, b, r] as const))(
    'slamming the relay inlet at working flow bursts a length (%s)',
    (_name, base, receiver) => {
      const { state } = getScenario('closed-relay').build(receiver, { base });
      const inlet = suctionInletOf(receiver);
      const lines = state.lines.map((l) => l.deliveryId);
      const working = run(state, inputsWith(0.6, [inlet, ...lines]), 150);
      expect(working.links[0]?.burst).toBeUndefined();
      const slammed = run(working, inputsWith(0.6, lines), 1);
      expect(slammed.links[0]?.burst?.segment).toBe(0);
    },
  );

  it.each(PAIRS.map(([b, r]) => [`${b.id} → ${r.id}`, b, r] as const))(
    'shutting down from the attack end first leaves it whole (%s)',
    (_name, base, receiver) => {
      const { state } = getScenario('closed-relay').build(receiver, { base });
      const inlet = suctionInletOf(receiver);
      const lines = state.lines.map((l) => l.deliveryId);
      let s = run(state, inputsWith(0.6, [inlet, ...lines]), 150);
      // Throttle back to idle over 3 s, then ease the lines shut over 5 s, slowest at the end.
      for (let i = 1; i <= 30; i++)
        s = run(s, inputsWith(0.6 * (1 - i / 30), [inlet, ...lines]), 1);
      for (let i = 1; i <= 50; i++) {
        const open = (1 - i / 50) ** 3;
        const valves: Record<string, number> = { [inlet]: 1 };
        for (const id of lines) valves[id] = open;
        s = run(s, { throttle: 0, valves, switches: {} }, 1);
      }
      s = run(s, inputsWith(0, [inlet]), 100);
      expect(s.links[0]?.burst).toBeUndefined();
    },
  );
});
