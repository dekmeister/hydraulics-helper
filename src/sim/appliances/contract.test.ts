// Appliance contract suite (ARCHITECTURE §9.5): every registered appliance, plus a test-only one
// with a different shape, must pass these. Generic behaviour belongs here, not in per-truck tests.
import { describe, expect, it } from 'vitest';
import { BRANCH_OPTIMUM_KPA, HOSES } from '../constants';
import { createIdleInputs, createInitialState, switchTruck } from '../engine';
import {
  closedRelayPair,
  draughtSite,
  expectSane,
  hydrantSite,
  inputsWith,
  layLine,
  lineOnEveryDelivery,
  primedState,
  run,
  seededRandom,
  suctionInletOf,
  tankAttackInputs,
  truck,
  truckOf,
} from '../testUtils';
import type { ApplianceSpec, HoseLine, PlayerInputs } from '../types';
import { APPLIANCES } from './catalogue';
import { controlIds, switchControlIds, validateInputs } from './controls';
import { TEST_APPLIANCE } from './testAppliance';

const ALL: readonly ApplianceSpec[] = [...APPLIANCES, TEST_APPLIANCE];
const allDeliveries = (spec: ApplianceSpec) => spec.deliveries.map((d) => d.id);

describe('appliance catalogue', () => {
  it('has unique ids and never registers the test appliance', () => {
    const ids = APPLIANCES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(TEST_APPLIANCE.id);
  });
});

describe.each(ALL.map((spec) => [spec.id, spec] as const))(
  'appliance contract: %s',
  (_id, spec) => {
    it('is well-formed', () => {
      const ids = controlIds(spec);
      expect(new Set(ids).size).toBe(ids.length);
      expect(spec.deliveries.length).toBeGreaterThan(0);
      expect(spec.engine.idleRpm).toBeGreaterThan(0);
      expect(spec.engine.maxRpm).toBeGreaterThan(spec.engine.idleRpm);
      expect(spec.engine.rpmLagS).toBeGreaterThan(0);
      expect(spec.pump.shutoffKpa).toBeGreaterThan(0);
      expect(spec.pump.droopKpaPerLpm2).toBeGreaterThan(0);
      for (const d of spec.deliveries) expect(d.sizeMm).toBeGreaterThan(0);
      for (const i of spec.inlets) expect(i.lossKpaPerLpm2).toBeGreaterThan(0);
      if (spec.inlets.some((i) => i.kind === 'tank'))
        expect(spec.tank?.capacityL).toBeGreaterThan(0);
      if (spec.primer?.kind === 'rotaryVane')
        expect(spec.primer.maxOnS).toBeLessThan(spec.primer.periodS);
      if (spec.primer !== undefined) {
        expect(spec.primer.maxVacuumKpa).toBeGreaterThan(0);
        expect(spec.primer.maxVacuumKpa).toBeLessThan(100);
        expect(spec.primer.displacementLps).toBeGreaterThan(0);
      }
      expect(spec.pump.cavitationInletKpa).toBeLessThan(0);
      expect(spec.pump.cavitationInletKpa).toBeGreaterThan(-100);
      expect(spec.pump.casingVolumeL).toBeGreaterThan(0);
      expect(spec.pump.churnKw).toBeGreaterThan(0);
      for (const i of spec.inlets) if (i.kind === 'suction') expect(i.sizeMm).toBeGreaterThan(0);
    });

    it('has dial scales that cover what its pump and engine can reach', () => {
      for (const inst of spec.instruments) {
        if (inst.kind === 'tank') continue;
        const { fullScale, zones } = inst.scale;
        // Tank supply can't push discharge past shutoff, and the governor caps rpm at maxRpm.
        const reach = inst.kind === 'tacho' ? spec.engine.maxRpm : spec.pump.shutoffKpa;
        expect(fullScale).toBeGreaterThanOrEqual(reach);
        const low = inst.kind === 'compound' ? -100 : 0;
        for (const z of zones) {
          expect(z.from).toBeLessThan(z.to);
          expect(z.from).toBeGreaterThanOrEqual(low);
          expect(z.to).toBeLessThanOrEqual(fullScale);
        }
      }
    });

    it('has idle inputs covering exactly its controls', () => {
      const idle = createIdleInputs(spec);
      expect(validateInputs(spec, idle)).toEqual([]);
      expect([...Object.keys(idle.valves), ...Object.keys(idle.switches)].sort()).toEqual(
        controlIds(spec).sort(),
      );
    });

    it('flags input ids its spec does not define', () => {
      const bad: PlayerInputs = {
        throttle: 0,
        valves: { 'no-such-valve': 1 },
        switches: { 'no-such-switch': true },
      };
      expect(validateInputs(spec, bad)).toHaveLength(2);
    });

    it('is deterministic: same inputs give identical state after N ticks', () => {
      const go = () =>
        run(
          createInitialState(spec, lineOnEveryDelivery(spec)),
          tankAttackInputs(spec, 0.7, allDeliveries(spec)),
          600,
        );
      expect(go()).toStrictEqual(go());
    });

    it('delivers water on a tank attack and every reading is sane', () => {
      const s = run(
        createInitialState(spec, lineOnEveryDelivery(spec)),
        tankAttackInputs(spec, 0.6, allDeliveries(spec)),
        50,
      );
      expectSane(s);
      expect(truckOf(s).readings.pumpFlowLpm).toBeGreaterThan(0);
      expect(truckOf(s).readings.dischargeKpa).toBeGreaterThan(0);
    });

    it('survives fuzzed inputs and lays without NaN or out-of-range readings', () => {
      const rand = seededRandom(0xc0ffee);
      const hoses = Object.keys(HOSES);
      const tips = Object.keys(BRANCH_OPTIMUM_KPA).map(Number);
      const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
      const wild = () => pick([rand(), 0, 1, -1, 2, Number.NaN, Number.POSITIVE_INFINITY, 1e-9]);
      for (let trial = 0; trial < 40; trial++) {
        const lines: HoseLine[] = spec.deliveries
          .filter(() => rand() < 0.7)
          .map((d) =>
            layLine(d.id, pick(hoses), 1 + Math.floor(rand() * 8), pick(tips), (rand() - 0.5) * 60),
          );
        let s = createInitialState(spec, lines);
        for (let burst = 0; burst < 5; burst++) {
          const inputs: PlayerInputs = {
            throttle: wild(),
            valves: Object.fromEntries(controlIds(spec).map((id) => [id, wild()])),
            switches: Object.fromEntries(controlIds(spec).map((id) => [id, rand() < 0.5])),
          };
          s = run(s, inputs, 10);
          expectSane(s);
        }
      }
    });

    it('runs dry: flow collapses to zero, the tank never goes negative, nothing throws', () => {
      const inputs = tankAttackInputs(spec, 1, allDeliveries(spec));
      let s = createInitialState(spec, lineOnEveryDelivery(spec));
      let prevTank = truckOf(s).tankL;
      let ticks = 0;
      while (truckOf(s).tankL > 0) {
        s = run(s, inputs, 1);
        expect(truckOf(s).tankL).toBeLessThanOrEqual(prevTank);
        prevTank = truckOf(s).tankL;
        expect(++ticks).toBeLessThan(100_000);
      }
      s = run(s, inputs, 10);
      const r = truckOf(s).readings;
      expect(truckOf(s).tankL).toBe(0);
      expect(r.dischargeKpa).toBe(0);
      expect(r.pumpFlowLpm).toBe(0);
      for (const q of Object.values(r.deliveryFlowLpm)) expect(q).toBe(0);
      expectSane(s);
    });

    const hasSuction = spec.inlets.some((i) => i.kind === 'suction');
    const primerIds = switchControlIds(spec);

    /** Prime from a dam at `liftM` with the primer (or self-priming), within `maxTicks`. */
    const primeAt = (liftM: number, volumeL = 1e6, maxTicks = 1200) => {
      const suction = suctionInletOf(spec);
      let s = createInitialState(
        spec,
        lineOnEveryDelivery(spec),
        draughtSite(spec, liftM, volumeL),
      );
      for (let i = 0; i < maxTicks && !truckOf(s).pump.primed; i++) {
        s = run(s, inputsWith(0, [suction], primerIds), 1);
      }
      return s;
    };

    it.runIf(hasSuction && spec.primer !== undefined)(
      'primes from a dam at 4 m, then draws water with the compound in vacuum',
      () => {
        let s = primeAt(4);
        expect(truckOf(s).pump.primed).toBe(true);
        s = run(s, inputsWith(0.6, [suctionInletOf(spec), ...allDeliveries(spec)]), 50);
        expectSane(s);
        expect(truckOf(s).readings.pumpFlowLpm).toBeGreaterThan(0);
        expect(truckOf(s).readings.compoundKpa).toBeLessThan(-40);
      },
    );

    it.runIf(hasSuction && spec.primer !== undefined)(
      'cavitates when pushed past what the lift allows, and throttle then adds no flow',
      () => {
        const open = [suctionInletOf(spec), ...allDeliveries(spec)];
        const big = spec.deliveries.map((d) => layLine(d.id, '65L', 1, 32));
        const s0 = primedState(createInitialState(spec, big, draughtSite(spec, 6)));
        const r90 = truckOf(run(s0, inputsWith(0.9, open), 50)).readings;
        const r100 = truckOf(run(s0, inputsWith(1, open), 50)).readings;
        expect(r100.cavitation).toBeGreaterThan(0);
        expect(r100.compoundKpa).toBeCloseTo(spec.pump.cavitationInletKpa, 3);
        expect(r100.pumpFlowLpm).toBeCloseTo(r90.pumpFlowLpm, 3);
      },
    );

    it.runIf(hasSuction && spec.primer !== undefined)(
      'loses prime when the dam runs dry, without NaN or a crash',
      () => {
        let s = primeAt(3, 300);
        s = run(s, inputsWith(1, [suctionInletOf(spec), ...allDeliveries(spec)]), 600);
        expect(truckOf(s).pump.primed).toBe(false);
        expect(truckOf(s).readings.pumpFlowLpm).toBe(0);
        expectSane(s);
      },
    );

    it.runIf(hasSuction)('survives fuzzed inputs on hydrant and draught supplies', () => {
      const rand = seededRandom(0xbeef);
      const wild = () => [rand(), 0, 1, -1, Number.NaN, 1e-9][Math.floor(rand() * 6)] ?? 0;
      for (const site of [hydrantSite(spec), draughtSite(spec, 1 + rand() * 9, 500)]) {
        let s = createInitialState(spec, lineOnEveryDelivery(spec), site);
        if (rand() < 0.5) s = primedState(s);
        for (let burst = 0; burst < 20; burst++) {
          const inputs: PlayerInputs = {
            throttle: wild(),
            valves: Object.fromEntries(controlIds(spec).map((id) => [id, wild()])),
            switches: Object.fromEntries(controlIds(spec).map((id) => [id, rand() < 0.5])),
          };
          s = run(s, inputs, 10);
          expectSane(s);
        }
      }
    });
  },
);

// Relay contract (ARCHITECTURE §4.7): every appliance relays to every other, its own kind included.
const PAIRS = ALL.flatMap((base) => ALL.map((receiver) => [base, receiver] as const)).filter(
  ([, receiver]) => receiver.inlets.some((i) => i.kind === 'suction'),
);

describe.each(PAIRS.map(([b, r]) => [`${b.id} → ${r.id}`, b, r] as const))(
  'relay contract: %s',
  (_name, base, receiver) => {
    it('a closed relay delivers water, conserves it, and replays exactly', () => {
      const { state, inlet, out, attackInputs } = closedRelayPair(base, receiver);
      const go = () => run(state, attackInputs(0.4), 200);
      const s = go();
      expect(s).toStrictEqual(go());
      expectSane(s);
      const q = truck(s, 'attack').readings.inletFlowLpm[inlet] ?? 0;
      expect(q).toBeGreaterThan(0);
      expect(truck(s, 'base').readings.deliveryFlowLpm[out]).toBeCloseTo(q, 6);
      expect(truck(s, 'attack').readings.compoundKpa).toBeGreaterThan(0);
    });

    it('over-running the relay caps the flow without NaN', () => {
      const { state, attackInputs } = closedRelayPair(base, receiver, {
        lengths: 8,
        baseThrottle: 0.3,
        tipMm: 25,
      });
      const s = run(state, attackInputs(1), 100);
      expectSane(s);
      expect(truck(s, 'attack').readings.cavitation).toBeGreaterThan(0);
    });

    it('survives fuzzed inputs on both pumps, bursting the hose or not', () => {
      const rand = seededRandom(0xfeed);
      const wild = () => [rand(), 0, 1, -1, Number.NaN, 1e-9][Math.floor(rand() * 6)] ?? 0;
      const fuzz = (spec: ApplianceSpec): PlayerInputs => ({
        throttle: wild(),
        valves: Object.fromEntries(controlIds(spec).map((id) => [id, wild()])),
        switches: Object.fromEntries(controlIds(spec).map((id) => [id, rand() < 0.5])),
      });
      let s = closedRelayPair(base, receiver).state;
      for (let burst = 0; burst < 30; burst++) {
        // Now and then the base pump's settings change too (as the player would leave them).
        if (burst % 5 === 4) {
          s = switchTruck(switchTruck(s, 'base', fuzz(receiver)), 'attack', fuzz(base));
        }
        s = run(s, fuzz(receiver), 10);
        expectSane(s);
      }
    });

    it('an open relay into the receiving tank refills it', () => {
      const { state, link, out } = closedRelayPair(base, receiver);
      const open = {
        ...state,
        links: [{ ...link, to: { kind: 'tank' as const, truckId: 'attack' } }],
        trucks: state.trucks.map((t) => (t.id === 'attack' ? { ...t, tankL: 0 } : t)),
      };
      const s = run(open, createIdleInputs(receiver), 100);
      expectSane(s);
      expect(truck(s, 'base').readings.deliveryFlowLpm[out]).toBeGreaterThan(0);
      expect(truck(s, 'attack').tankL).toBeGreaterThan(0);
    });
  },
);
