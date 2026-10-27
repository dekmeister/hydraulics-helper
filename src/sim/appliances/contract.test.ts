// Appliance contract suite (ARCHITECTURE §9.5): every registered appliance, plus a test-only one
// with a different shape, must pass these. Generic behaviour belongs here, not in per-truck tests.
import { describe, expect, it } from 'vitest';
import {
  BRANCH_OPTIMUM_KPA,
  HEAD_KPA_PER_M,
  HOSES,
  PUMP_TEMP_CAUTION_C,
  SPILL_SOAK_TAU_S,
  TICK_S,
} from '../constants';
import { createIdleInputs, createInitialState, switchTruck } from '../engine';
import {
  closedRelayPair,
  draughtSite,
  expectSane,
  hydrantFillSite,
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
import { controlIds, primerSwitchIds, validateInputs } from './controls';
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
      if (spec.inlets.some((i) => i.kind === 'tank')) {
        expect(spec.tank?.capacityL).toBeGreaterThan(0);
        expect(spec.tank?.headM).toBeGreaterThanOrEqual(0);
      }
      if (spec.primer?.kind === 'rotaryVane')
        expect(spec.primer.maxOnS).toBeLessThan(spec.primer.periodS);
      if (spec.primer !== undefined) {
        expect(spec.primer.maxVacuumKpa).toBeGreaterThan(0);
        expect(spec.primer.maxVacuumKpa).toBeLessThan(100);
        expect(spec.primer.displacementLps).toBeGreaterThan(0);
      }
      expect(spec.pump.cavitationInletKpa).toBeLessThan(0);
      if (spec.engine.vernier !== undefined) {
        expect(spec.engine.vernier.throttlePerTurn).toBeGreaterThan(0);
        expect(spec.engine.vernier.throttlePerTurn).toBeLessThan(0.5);
      }
      expect(Number.isInteger(spec.engine.cylinders)).toBe(true);
      expect(spec.engine.cylinders).toBeGreaterThan(0);
      if (spec.recirc !== undefined) {
        expect(spec.tank).toBeDefined();
        expect(spec.recirc.lossKpaPerLpm2).toBeGreaterThan(0);
      }
      if (spec.pumpToTank !== undefined) {
        expect(spec.tank).toBeDefined();
        expect(spec.pumpToTank.lossKpaPerLpm2).toBeGreaterThan(0);
      }
      for (const i of spec.instruments) {
        if (i.kind !== 'tank' || i.display.kind !== 'bands') continue;
        // Bands run up from empty in order, each starting inside the tank.
        const from = i.display.bands.map((b) => b.fromFraction);
        expect(from[0]).toBe(0);
        expect([...from].sort((a, b) => a - b)).toEqual(from);
        for (const f of from) expect(f).toBeLessThan(1);
      }
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

    describe('engine start and stop', () => {
      const { ignition, start, stop } = spec.engine.controls;
      const ticksFor = (s: number) => Math.round(s / TICK_S);
      /** Tank attack at `throttle` on every delivery, with the named engine switches held on. */
      const attack = (throttle: number, held: Record<string, boolean>): PlayerInputs => {
        const base = tankAttackInputs(spec, throttle, allDeliveries(spec));
        return { ...base, switches: { ...base.switches, ...held } };
      };
      const cold = () =>
        createInitialState(spec, lineOnEveryDelivery(spec), { engine: 'off' as const });
      /** Long enough to crank it, fire and settle at the throttle. */
      const startS = spec.engine.crankS + 6 * spec.engine.rpmLagS;
      const started = () =>
        run(
          run(cold(), attack(0, { [ignition]: true, [start]: true }), ticksFor(startS)),
          attack(0, { [ignition]: true }),
          ticksFor(2),
        );

      it('sits cold: no rpm and no pressure on tank, with every valve open', () => {
        const s = run(cold(), attack(0.6, {}), ticksFor(3));
        expect(truckOf(s).engine.running).toBe(false);
        expect(truckOf(s).rpm).toBe(0);
        expect(truckOf(s).readings.dischargeKpa).toBeLessThan(5);
        expectSane(s);
      });

      it('reads the tank’s head on the compound once tank to pump opens, cold (issue #13)', () => {
        const tankIn = spec.inlets.filter((i) => i.kind === 'tank').map((i) => i.id);
        const shut = run(cold(), inputsWith(0, []), ticksFor(1));
        const open = run(shut, inputsWith(0, tankIn), ticksFor(1));
        const headKpa = HEAD_KPA_PER_M * (spec.tank?.headM ?? 0);
        expect(truckOf(shut).readings.compoundKpa).toBe(0);
        expect(Math.abs(truckOf(open).readings.compoundKpa - headKpa)).toBeLessThanOrEqual(0.5);
        expect(truckOf(open).readings.compoundKpa).toBeGreaterThan(0);
        expect(truckOf(open).rpm).toBe(0);
      });

      it('starts with the ignition on and START held through the crank, and settles at idle', () => {
        const s = started();
        expect(truckOf(s).engine.running).toBe(true);
        expect(truckOf(s).rpm).toBeCloseTo(spec.engine.idleRpm, -1); // ±5 rpm
        expect(truckOf(s).readings.dischargeKpa).toBeGreaterThan(0);
      });

      it('does not start if START is let go before it fires, or with the ignition off', () => {
        const early = run(
          cold(),
          attack(0, { [ignition]: true, [start]: true }),
          ticksFor(spec.engine.crankS * 0.6),
        );
        expect(truckOf(early).rpm).toBeGreaterThan(0); // the starter turned it
        const released = run(early, attack(0, { [ignition]: true }), ticksFor(3));
        expect(truckOf(released).engine.running).toBe(false);
        expect(truckOf(released).rpm).toBe(0);
        // A second short crank starts the count again: two short goes don't add up.
        const again = run(
          released,
          attack(0, { [ignition]: true, [start]: true }),
          ticksFor(spec.engine.crankS * 0.6),
        );
        expect(truckOf(again).engine.running).toBe(false);
        const noIgnition = run(cold(), attack(0, { [start]: true }), ticksFor(startS));
        expect(truckOf(noIgnition).engine.running).toBe(false);
        expect(truckOf(noIgnition).rpm).toBe(0);
      });

      it('ignores START while it runs, and keeps running with the ignition switched off', () => {
        const s = started();
        const cranked = run(s, attack(0, { [ignition]: true, [start]: true }), ticksFor(3));
        expect(truckOf(cranked).rpm).toBeCloseTo(spec.engine.idleRpm, -1); // ±5 rpm
        const ignOff = run(s, attack(0.5, {}), ticksFor(5));
        expect(truckOf(ignOff).engine.running).toBe(true);
        expect(truckOf(ignOff).rpm).toBeGreaterThan(spec.engine.idleRpm);
      });

      it('stops while STOP is held, and stays stopped once let go', () => {
        const held = run(started(), attack(0, { [ignition]: true, [stop.id]: true }), ticksFor(5));
        expect(truckOf(held).engine.running).toBe(false);
        expect(truckOf(held).rpm).toBe(0);
        const after = run(held, attack(0, { [ignition]: true }), ticksFor(5));
        expect(truckOf(after).engine.running).toBe(false);
        expect(truckOf(after).rpm).toBe(0);
        expect(truckOf(after).readings.dischargeKpa).toBeLessThan(5);
      });

      it('picks up again if STOP is let go before the engine has run down', () => {
        const s = run(started(), attack(0.5, { [ignition]: true }), ticksFor(3));
        // One tick of fuel cut drops it a little, nowhere near the refire speed.
        const tapped = run(s, attack(0.5, { [ignition]: true, [stop.id]: true }), 1);
        expect(truckOf(tapped).rpm).toBeLessThan(truckOf(s).rpm);
        expect(truckOf(tapped).engine.running).toBe(true);
        const settle = ticksFor(12 * spec.engine.rpmLagS);
        const back = run(tapped, attack(0.5, { [ignition]: true }), settle);
        const untouched = run(s, attack(0.5, { [ignition]: true }), settle + 1);
        expect(truckOf(back).rpm).toBeCloseTo(truckOf(untouched).rpm, -1); // ±5 rpm
      });

      it(`STOP with the ignition off ${stop.needsIgnition ? 'does nothing (solenoid stop)' : 'still stops it (mechanical stop)'}`, () => {
        const s = run(started(), attack(0, { [stop.id]: true }), ticksFor(5));
        expect(truckOf(s).engine.running).toBe(stop.needsIgnition);
      });

      it('replays a start and a stop exactly', () => {
        const go = () =>
          run(started(), attack(0, { [ignition]: true, [stop.id]: true }), ticksFor(2));
        expect(go()).toStrictEqual(go());
      });

      it('has starting figures that make sense together', () => {
        expect(new Set([ignition, start, stop.id]).size).toBe(3);
        expect(spec.engine.crankS).toBeGreaterThan(0);
        expect(spec.engine.crankRpm).toBeGreaterThan(0);
        expect(spec.engine.crankRpm).toBeLessThan(spec.engine.refireRpm);
        expect(spec.engine.refireRpm).toBeLessThan(spec.engine.idleRpm);
        expect(spec.engine.runDownS).toBeGreaterThan(0);
      });
    });

    const hasSuction = spec.inlets.some((i) => i.kind === 'suction');
    const primerIds = primerSwitchIds(spec);

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

    it.runIf(hasSuction && spec.primer !== undefined)('fills the casing when it primes', () => {
      expect(truckOf(createInitialState(spec)).pump.casingWet).toBe(false);
      expect(truckOf(primeAt(4)).pump.casingWet).toBe(true);
    });

    const tankInlets = spec.inlets.filter((i) => i.kind === 'tank').map((i) => i.id);
    it.runIf(tankInlets.length > 0)(
      'keeps the casing full once the tank has filled it, until an open line pumps it out',
      () => {
        const lines = lineOnEveryDelivery(spec);
        let s = createInitialState(spec, lines);
        expect(truckOf(s).pump.casingWet).toBe(false);
        s = run(s, tankAttackInputs(spec, 0, []), 1);
        expect(truckOf(s).pump.casingWet).toBe(true);
        // Every valve shut: the water stays in the casing.
        s = run(s, createIdleInputs(spec), 50);
        expect(truckOf(s).pump.casingWet).toBe(true);
        // No feed and a line open to air: the pump pushes its water out.
        s = run(s, inputsWith(0.5, allDeliveries(spec)), 1);
        expect(truckOf(s).pump.casingWet).toBe(false);
        expectSane(s);
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

    const ptt = spec.pumpToTank?.id;
    const tankIn = spec.inlets.filter((i) => i.kind === 'tank').map((i) => i.id);

    it.runIf(ptt !== undefined && spec.tank !== undefined)(
      'pump to tank recirculates on tank supply and the level holds',
      () => {
        const s = run(createInitialState(spec), inputsWith(0.6, [...tankIn, ptt ?? '']), 300);
        expect(truckOf(s).readings.pumpToTankLpm).toBeGreaterThan(0);
        expect(truckOf(s).tankL).toBeCloseTo(spec.tank?.capacityL ?? 0, 6);
        expectSane(s);
      },
    );

    it.runIf(ptt !== undefined && hasSuction)(
      'pump to tank refills the tank from a hydrant',
      () => {
        let s = createInitialState(spec, [], hydrantSite(spec));
        s = { ...s, trucks: s.trucks.map((t) => ({ ...t, tankL: 0 })) };
        s = run(s, inputsWith(0.3, [suctionInletOf(spec), ptt ?? '']), 300);
        expect(truckOf(s).tankL).toBeGreaterThan(0);
        expectSane(s);
      },
    );

    it.runIf(ptt !== undefined && hasSuction && spec.primer !== undefined)(
      'pump to tank open stops the pump priming',
      () => {
        let s = createInitialState(spec, [], draughtSite(spec, 3));
        s = run(s, inputsWith(0, [suctionInletOf(spec), ptt ?? ''], primerIds), 600);
        expect(truckOf(s).pump.primed).toBe(false);
      },
    );

    const fill = spec.inlets.find((i) => i.kind === 'tankFill')?.id;

    describe.runIf(fill !== undefined && spec.tank !== undefined)('hydrant to tank', () => {
      const id = fill ?? '';
      const capacityL = spec.tank?.capacityL ?? 0;
      const fillState = (
        tankL: number,
        lines: HoseLine[] = [],
        engine: 'off' | 'running' = 'off',
      ) => {
        const s = createInitialState(spec, lines, { ...hydrantFillSite(spec), engine });
        return { ...s, trucks: s.trucks.map((t) => ({ ...t, tankL })) };
      };
      const valve = (open: number, extra: Record<string, number> = {}): PlayerInputs => ({
        throttle: 0,
        valves: { [id]: open, ...extra },
        switches: {},
      });
      const fillLpm = (s: ReturnType<typeof fillState>) =>
        truckOf(s).readings.inletFlowLpm[id] ?? 0;

      it('fills nothing while shut', () => {
        const s = run(fillState(100), valve(0), 300);
        expect(fillLpm(s)).toBe(0);
        expect(truckOf(s).tankL).toBe(100);
      });

      it('fills the tank with the engine off and the pump dry; half open fills slower', () => {
        const full = run(fillState(0), valve(1), 100);
        const half = run(fillState(0), valve(0.5), 100);
        expect(fillLpm(full)).toBeGreaterThan(fillLpm(half));
        expect(fillLpm(half)).toBeGreaterThan(0);
        expect(truckOf(full).tankL).toBeGreaterThan(truckOf(half).tankL);
        expect(truckOf(full).readings.pumpFlowLpm).toBe(0);
        expect(truckOf(full).rpm).toBe(0);
        expectSane(full);
      });

      it('stops the next tick it is shut, and fills again when reopened', () => {
        const open = run(fillState(0), valve(1), 50);
        const shut = run(open, valve(0), 1);
        expect(fillLpm(shut)).toBe(0);
        const held = run(shut, valve(0), 100);
        expect(truckOf(held).tankL).toBe(truckOf(shut).tankL);
        const reopened = run(held, valve(1), 1);
        expect(fillLpm(reopened)).toBeCloseTo(fillLpm(open), 6);
        expect(truckOf(reopened).tankL).toBeGreaterThan(truckOf(held).tankL);
      });

      it('overflows a full tank rather than overfilling it', () => {
        const s = run(fillState(capacityL), valve(1), 300);
        expect(fillLpm(s)).toBeGreaterThan(0);
        expect(truckOf(s).tankL).toBe(capacityL);
      });

      it('spills the overflow onto a pool that soaks away once it is shut', () => {
        const first = run(fillState(capacityL), valve(1), 1);
        expect(truckOf(first).spilledL).toBeCloseTo((fillLpm(first) * TICK_S) / 60, 9);
        const spilling = run(first, valve(1), 300);
        expect(truckOf(spilling).spilledL).toBeGreaterThan(truckOf(first).spilledL);
        // Nothing draws: all of it goes out the overflow.
        expect(truckOf(spilling).readings.overflowLpm).toBeCloseTo(fillLpm(spilling), 6);
        const shut = run(spilling, valve(0), Math.round((3 * SPILL_SOAK_TAU_S) / TICK_S));
        expect(truckOf(shut).tankL).toBe(capacityL);
        // Three time constants: e⁻³ ≈ 5 % left.
        expect(truckOf(shut).spilledL).toBeCloseTo(truckOf(spilling).spilledL * Math.exp(-3), 6);
        const filling = truckOf(run(fillState(capacityL / 2), valve(1), 50));
        expect(filling.spilledL).toBe(0);
        expect(filling.readings.overflowLpm).toBe(0);
        expect(truckOf(shut).readings.overflowLpm).toBe(0);
      });

      it('never feeds the pump: with tank to pump shut a delivery stays dry', () => {
        const d = spec.deliveries[0]?.id ?? '';
        const lines = [layLine(d, '38L', 2, 15)];
        const s = run(fillState(0, lines, 'running'), inputsWith(0.6, [id, d]), 300);
        expect(fillLpm(s)).toBeGreaterThan(0);
        expect(truckOf(s).readings.pumpFlowLpm).toBe(0);
      });

      it.runIf(tankInlets.length > 0)(
        'with tank to pump open, the tank changes by what goes in less what the pump draws',
        () => {
          const d = spec.deliveries[0]?.id ?? '';
          const inputs = tankAttackInputs(spec, 0.6, [id, d]);
          const lines = [layLine(d, '38L', 2, 15)];
          const settled = run(fillState(capacityL / 2, lines, 'running'), inputs, 300);
          const before = truckOf(settled);
          const after = truckOf(run(settled, inputs, Math.round(10 / TICK_S)));
          const draw = tankInlets.reduce((q, i) => q + (before.readings.inletFlowLpm[i] ?? 0), 0);
          expect(draw).toBeGreaterThan(50);
          // 10 s at steady flows, L/min ÷ 6.
          expect(after.tankL - before.tankL).toBeCloseTo((fillLpm(settled) - draw) / 6, -1);
        },
      );
    });

    it.runIf(spec.recirc !== undefined && tankInlets.length > 0)(
      'its recirculation keeps it below the temperature lamp churning at full rpm, every delivery shut',
      () => {
        const tenMin = Math.round(600 / TICK_S);
        const s = run(createInitialState(spec), tankAttackInputs(spec, 1, []), tenMin);
        expect(truckOf(s).readings.recircLpm).toBeGreaterThan(0);
        expect(truckOf(s).pump.tempC).toBeLessThan(PUMP_TEMP_CAUTION_C);
        expect(truckOf(s).tankL).toBeCloseTo(spec.tank?.capacityL ?? 0, 6);
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
