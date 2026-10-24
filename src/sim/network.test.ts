import { describe, expect, it } from 'vitest';
import { sanitiseInputs } from './appliances/controls';
import { branchPressureKpa } from './branch';
import { HEAD_KPA_PER_M } from './constants';
import { hoseFrictionKpa } from './hose';
import { solveTruck, valveLossCoeff } from './network';
import { layLine } from './testUtils';
import type { ApplianceSpec, PlayerInputs, ReliefSpec } from './types';

// Inline spec so solver tests don't move when an appliance's placeholders are re-tuned.
const SPEC: ApplianceSpec = {
  id: 'solver-test',
  name: 'Solver test',
  pump: { shutoffKpa: 1400, droopKpaPerLpm2: 4e-4 },
  engine: { idleRpm: 800, maxRpm: 3000, rpmLagS: 0.5 },
  tank: { capacityL: 3000 },
  inlets: [{ id: 'tank', label: 'Tank', kind: 'tank', lossKpaPerLpm2: 1e-4 }],
  deliveries: [
    { id: 'a', label: 'A', sizeMm: 38 },
    { id: 'b', label: 'B', sizeMm: 64 },
  ],
  instruments: [],
};

/** Solve `spec` at fixed rpm with a full tank; valves not listed are shut. */
const solve = (
  valves: Record<string, number>,
  lines = [layLine('a', '38L', 3, 15)],
  rpm = 2500,
  spec = SPEC,
) => {
  const inputs: PlayerInputs = { throttle: 0, valves, switches: {} };
  return solveTruck({ spec, rpm, tankL: 3000, inputs: sanitiseInputs(spec, inputs) }, lines);
};

describe('network solve', () => {
  it('balances each line: discharge = nozzle + valve + friction + head', () => {
    const line = layLine('a', '38L', 3, 15, 8);
    const r = solve({ tank: 1, a: 1 }, [line]);
    const q = r.deliveryFlowLpm.a ?? 0;
    expect(q).toBeGreaterThan(100);
    const sum =
      branchPressureKpa(line.branch, q) +
      valveLossCoeff(38) * q * q +
      hoseFrictionKpa(line.segments, q) +
      HEAD_KPA_PER_M * line.elevationM;
    expect(r.dischargeKpa).toBeCloseTo(sum, 3);
    expect(r.branchKpa[line.id]).toBeCloseTo(branchPressureKpa(line.branch, q), 9);
  });

  it('meets the pump curve: discharge = inlet + pump rise at total flow', () => {
    const r = solve({ tank: 1, a: 1 });
    const q = r.pumpFlowLpm;
    expect(r.dischargeKpa).toBeCloseTo(1400 * (2500 / 3000) ** 2 - 4e-4 * q * q + r.compoundKpa, 3);
  });

  it('compound gauge reads slightly negative on tank supply, more so at higher flow (L3529)', () => {
    const low = solve({ tank: 1, a: 1 }, undefined, 1500);
    const high = solve({ tank: 1, a: 1 }, undefined, 3000);
    expect(low.compoundKpa).toBeLessThan(0);
    expect(high.compoundKpa).toBeLessThan(low.compoundKpa);
  });

  it('holds shutoff pressure with water but every delivery shut', () => {
    const r = solve({ tank: 1 });
    expect(r.pumpFlowLpm).toBe(0);
    expect(r.dischargeKpa).toBeCloseTo(1400 * (2500 / 3000) ** 2, 3);
  });

  it('reads zero everywhere with tank-to-pump shut (dry pump, Table 6)', () => {
    const r = solve({ a: 1 });
    expect(r).toMatchObject({ dischargeKpa: 0, compoundKpa: 0, pumpFlowLpm: 0 });
    expect(r.deliveryFlowLpm.a).toBe(0);
  });

  it('treats a delivery with no line laid as blank-capped', () => {
    expect(solve({ tank: 1, b: 1 }).deliveryFlowLpm.b).toBe(0);
  });

  it('a partly open delivery valve passes less water', () => {
    expect(solve({ tank: 1, a: 0.2 }).deliveryFlowLpm.a ?? 0).toBeLessThan(
      solve({ tank: 1, a: 1 }).deliveryFlowLpm.a ?? 0,
    );
  });

  it('opening a second line drops discharge pressure and first-line flow (L3379, L3504)', () => {
    const lines = [layLine('a', '38L', 3, 15), layLine('b', '65L', 3, 20)];
    const one = solve({ tank: 1, a: 1 }, lines);
    const two = solve({ tank: 1, a: 1, b: 1 }, lines);
    expect(two.dischargeKpa).toBeLessThan(one.dischargeKpa);
    expect(two.deliveryFlowLpm.a ?? 0).toBeLessThan(one.deliveryFlowLpm.a ?? 0);
  });

  it('a line uphill flows less than the same line on the flat', () => {
    const flat = solve({ tank: 1, a: 1 }, [layLine('a', '38L', 3, 15, 0)]);
    const up = solve({ tank: 1, a: 1 }, [layLine('a', '38L', 3, 15, 20)]);
    expect(up.deliveryFlowLpm.a ?? 0).toBeLessThan(flat.deliveryFlowLpm.a ?? 0);
  });
});

describe('pressure relief', () => {
  const withRelief = (relief: ReliefSpec): ApplianceSpec => ({ ...SPEC, relief });
  const preset: ReliefSpec = { kind: 'preset', setKpa: 800, dumpTo: 'tank', slopeLpmPerKpa: 50 };

  it('stays shut below its set pressure', () => {
    const r = solve({ tank: 1, a: 1 }, undefined, 1500, withRelief(preset));
    expect(r.dischargeKpa).toBeLessThan(800);
    expect(r.reliefFlowLpm).toBe(0);
  });

  it('opens above its set pressure and holds discharge near it', () => {
    const r = solve({ tank: 1 }, undefined, 3000, withRelief(preset));
    expect(r.reliefFlowLpm).toBeGreaterThan(0);
    expect(r.dischargeKpa).toBeGreaterThan(800);
    expect(r.dischargeKpa).toBeLessThan(850);
    expect(r.pumpFlowLpm).toBeCloseTo(r.reliefFlowLpm, 9);
  });

  it('dumping to tank draws the bypass through the tank inlet; dumping to inlet does not', () => {
    const toTank = solve({ tank: 1 }, undefined, 3000, withRelief(preset));
    const toInlet = solve({ tank: 1 }, undefined, 3000, withRelief({ ...preset, dumpTo: 'inlet' }));
    expect(toTank.compoundKpa).toBeLessThan(0);
    expect(toInlet.compoundKpa).toBe(-0);
  });

  it('an adjustable relief takes its set pressure from its control', () => {
    const spec = withRelief({
      kind: 'adjustable',
      id: 'relief',
      minKpa: 500,
      maxKpa: 1500,
      dumpTo: 'inlet',
      slopeLpmPerKpa: 50,
    });
    expect(solve({ tank: 1, relief: 0 }, [], 3000, spec).dischargeKpa).toBeLessThan(600);
    expect(solve({ tank: 1, relief: 1 }, [], 3000, spec).reliefFlowLpm).toBe(0);
  });
});
