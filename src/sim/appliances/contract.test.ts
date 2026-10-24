// Appliance contract suite (ARCHITECTURE §9.5): every registered appliance, plus a test-only one
// with a different shape, must pass these. Generic behaviour belongs here, not in per-truck tests.
import { describe, expect, it } from 'vitest';
import { BRANCH_OPTIMUM_KPA, HOSES } from '../constants';
import { createIdleInputs, createInitialState } from '../engine';
import {
  layLine,
  lineOnEveryDelivery,
  run,
  seededRandom,
  tankAttackInputs,
  truckOf,
} from '../testUtils';
import type { ApplianceSpec, HoseLine, PlayerInputs, SimState } from '../types';
import { APPLIANCES } from './catalogue';
import { controlIds, validateInputs } from './controls';
import { TEST_APPLIANCE } from './testAppliance';

const ALL: readonly ApplianceSpec[] = [...APPLIANCES, TEST_APPLIANCE];
const allDeliveries = (spec: ApplianceSpec) => spec.deliveries.map((d) => d.id);

function expectSaneReadings(state: SimState) {
  const t = truckOf(state);
  const r = t.readings;
  const numbers = [
    t.rpm,
    t.tankL,
    r.dischargeKpa,
    r.compoundKpa,
    r.pumpFlowLpm,
    r.reliefFlowLpm,
    ...Object.values(r.deliveryFlowLpm),
    ...Object.values(r.branchKpa),
  ];
  for (const n of numbers) expect(Number.isFinite(n)).toBe(true);
  expect(r.dischargeKpa).toBeGreaterThanOrEqual(0);
  for (const q of Object.values(r.deliveryFlowLpm)) expect(q).toBeGreaterThanOrEqual(0);
  expect(t.tankL).toBeGreaterThanOrEqual(0);
  expect(t.tankL).toBeLessThanOrEqual(t.spec.tank?.capacityL ?? 0);
  expect(t.rpm).toBeGreaterThanOrEqual(t.spec.engine.idleRpm - 1e-9);
  expect(t.rpm).toBeLessThanOrEqual(t.spec.engine.maxRpm + 1e-9);
}

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
      expectSaneReadings(s);
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
          expectSaneReadings(s);
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
      expectSaneReadings(s);
    });
  },
);
