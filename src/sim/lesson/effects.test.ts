import { describe, expect, it } from 'vitest';
import { CAT1 } from '../appliances/cat1';
import { TEST_APPLIANCE } from '../appliances/testAppliance';
import { STANDARD_LENGTH_M } from '../constants';
import { createInitialState, DEFAULT_TRUCK_ID } from '../engine';
import { closedRelayPair, expectSane, layLine, run, tankAttackInputs } from '../testUtils';
import type { ApplianceSpec, SimState, WaterSource } from '../types';
import { applyEffect } from './effects';

const P = DEFAULT_TRUCK_ID;

function oneLine(spec: ApplianceSpec): SimState {
  const [d] = spec.deliveries;
  if (d === undefined) throw new Error('no delivery');
  return createInitialState(spec, [{ ...layLine(d.id, '38L', 3, 15), id: 'line-1' }]);
}

const hydrant: WaterSource = {
  id: 'hydrant',
  kind: 'hydrant',
  label: 'Hydrant',
  staticKpa: 400,
  mainLossKpaPerLpm2: 1e-4,
};

describe.each([CAT1, TEST_APPLIANCE])('effects on $id', (spec) => {
  it('lays a line on the free delivery closest in size', () => {
    const s = applyEffect(oneLine(spec), P, {
      kind: 'layLine',
      line: { id: 'line-2', hose: '65L', lengths: 2, tipMm: 20, elevationM: 5 },
    });
    const line = s.lines.find((l) => l.id === 'line-2');
    const first = s.lines.find((l) => l.id === 'line-1');
    expect(line?.deliveryId).not.toBe(first?.deliveryId);
    expect(line?.segments).toHaveLength(2);
    expect(line?.elevationM).toBe(5);
    const free = spec.deliveries.filter((d) => d.id !== first?.deliveryId);
    const best = Math.min(...free.map((d) => Math.abs(d.sizeMm - 65)));
    const chosen = spec.deliveries.find((d) => d.id === line?.deliveryId);
    expect(Math.abs((chosen?.sizeMm ?? 0) - 65)).toBe(best);
  });

  it('refuses a line when every delivery is taken, or a duplicate id', () => {
    let s = oneLine(spec);
    for (let i = 2; i <= spec.deliveries.length; i++) {
      s = applyEffect(s, P, {
        kind: 'layLine',
        line: { id: `line-${String(i)}`, hose: '38L', lengths: 1, tipMm: 15 },
      });
    }
    expect(() =>
      applyEffect(s, P, {
        kind: 'layLine',
        line: { id: 'more', hose: '38L', lengths: 1, tipMm: 15 },
      }),
    ).toThrow(/free delivery/);
    expect(() =>
      applyEffect(oneLine(spec), P, {
        kind: 'layLine',
        line: { id: 'line-1', hose: '38L', lengths: 1, tipMm: 15 },
      }),
    ).toThrow(/line-1/);
  });

  it('moves a branch uphill, adding lengths: the branch loses pressure', () => {
    const before = oneLine(spec);
    const moved = applyEffect(before, P, {
      kind: 'moveBranch',
      line: 'line-1',
      addLengths: 1,
      elevationM: 10,
    });
    const line = moved.lines.find((l) => l.id === 'line-1');
    expect(line?.segments).toHaveLength(4);
    expect(line?.segments[3]).toEqual({ hose: '38L', lengthM: STANDARD_LENGTH_M });
    expect(line?.elevationM).toBe(10);
    const d = line?.deliveryId ?? '';
    const inputs = tankAttackInputs(spec, 0.6, [d]);
    const kpa = (s: SimState) => run(s, inputs, 300).trucks[0]?.readings.branchKpa['line-1'] ?? 0;
    expect(kpa(moved)).toBeLessThan(kpa(before) - 50);
  });

  it('connects a hydrant to the suction inlet, and the pump can draw on it', () => {
    const s = applyEffect(oneLine(spec), P, {
      kind: 'connectSupply',
      source: hydrant,
      supply: {
        id: 'hydrant-line',
        sourceId: 'hydrant',
        segments: [{ hose: '65L', lengthM: 30 }],
      },
    });
    expect(s.sources).toHaveLength(1);
    const supply = s.supplies[0];
    expect(spec.inlets.find((i) => i.id === supply?.inletId)?.kind).toBe('suction');
    const d = s.lines[0]?.deliveryId ?? '';
    const after = run(
      s,
      { throttle: 0.5, valves: { [supply?.inletId ?? '']: 1, [d]: 1 }, switches: {} },
      50,
    );
    expectSane(after);
    expect(after.trucks[0]?.readings.compoundKpa).toBeGreaterThan(0);
  });

  it('refuses a supply to a source that does not exist', () => {
    expect(() =>
      applyEffect(oneLine(spec), P, {
        kind: 'connectSupply',
        supply: { id: 'x', sourceId: 'nowhere', segments: [{ hose: '65L', lengthM: 30 }] },
      }),
    ).toThrow(/nowhere/);
  });
});

describe('relay effects', () => {
  it('repairs a burst relay and changes a support truck’s held throttle', () => {
    const { state } = closedRelayPair(CAT1, CAT1);
    const link = state.links[0];
    if (link === undefined) throw new Error('no relay');
    const burst = {
      ...state,
      links: [{ ...link, burst: { atS: 1, segment: 0, peakKpa: 1500 } }],
    };
    const fixed = applyEffect(burst, state.activeTruckId, { kind: 'repairRelay', link: link.id });
    expect(fixed.links[0]?.burst).toBeUndefined();
    expect(() =>
      applyEffect(burst, state.activeTruckId, { kind: 'repairRelay', link: 'nope' }),
    ).toThrow(/nope/);

    const supplier = link.truckId;
    const held = applyEffect(state, state.activeTruckId, {
      kind: 'holdSettings',
      truck: supplier,
      throttle: 0.3,
    });
    expect(held.trucks.find((t) => t.id === supplier)?.inputs.throttle).toBe(0.3);
    expect(() =>
      applyEffect(state, state.activeTruckId, {
        kind: 'holdSettings',
        truck: state.activeTruckId,
        throttle: 1,
      }),
    ).toThrow(/player/);
  });
});
