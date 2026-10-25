// Ways water gets back into the tank (ARCHITECTURE §4.3): pump to tank, a return from the
// discharge side that refills the tank from a hydrant or a draught and cools a churning pump; and
// a tank-fill inlet (hydrant to tank), which bypasses the pump.
import { describe, expect, it } from 'vitest';
import { valveControlIds } from './appliances/controls';
import { HEAD_KPA_PER_M, STANDARD_LENGTH_M, TICK_S } from './constants';
import { DEFAULT_TRUCK_ID, createInitialState, type SiteOptions } from './engine';
import { hoseResistance } from './hose';
import { draughtSite, hydrantSite, inputsWith, run, truckOf } from './testUtils';
import type { ApplianceSpec, SimState } from './types';

// Inline spec so these tests don't move when an appliance's placeholders are re-tuned.
const SPEC: ApplianceSpec = {
  id: 'tank-fill-test',
  name: 'Tank fill test',
  pump: {
    shutoffKpa: 1400,
    droopKpaPerLpm2: 4e-4,
    cavitationInletKpa: -84,
    casingVolumeL: 10,
    churnKw: 10,
  },
  engine: { idleRpm: 800, maxRpm: 3000, rpmLagS: 0.5, cylinders: 6 },
  tank: { capacityL: 3000 },
  inlets: [
    { id: 'tank', label: 'Tank', kind: 'tank', lossKpaPerLpm2: 15e-6 },
    { id: 'suction', label: 'Suction', kind: 'suction', sizeMm: 65, lossKpaPerLpm2: 10e-6 },
    {
      id: 'h2t',
      label: 'Hydrant to tank',
      kind: 'tankFill',
      sizeMm: 65,
      lossKpaPerLpm2: 20e-6,
      fillHeightM: 2,
    },
  ],
  deliveries: [{ id: 'a', label: 'A', sizeMm: 38 }],
  pumpToTank: { id: 'ptt', label: 'Pump to tank', sizeMm: 38, lossKpaPerLpm2: 2.8e-3 },
  primer: {
    kind: 'rotaryVane',
    id: 'primer',
    maxOnS: 60,
    periodS: 180,
    maxVacuumKpa: 80,
    displacementLps: 1.5,
  },
  instruments: [],
};

/** `state` with the tank at `tankL`. */
const withTank = (state: SimState, tankL: number): SimState => ({
  ...state,
  trucks: state.trucks.map((t) => ({ ...t, tankL })),
});

describe('pump to tank', () => {
  it('is a valve control on the spec', () => {
    expect(valveControlIds(SPEC)).toContain('ptt');
  });

  it('flows Q = open·√(P_d / k) back to the tank', () => {
    for (const open of [1, 0.5]) {
      const inputs = { ...inputsWith(0.6, ['tank']), valves: { tank: 1, ptt: open } };
      const t = truckOf(run(createInitialState(SPEC), inputs, 30));
      const q = t.readings.pumpToTankLpm;
      expect(q).toBeGreaterThan(50);
      expect(q).toBeCloseTo(open * Math.sqrt(t.readings.dischargeKpa / 2.8e-3), 6);
      // Drawn through the inlets like any other flow out of the pump.
      expect(t.readings.inletFlowLpm.tank).toBeCloseTo(q, 6);
      expect(t.readings.pumpFlowLpm).toBeCloseTo(q, 6);
    }
  });

  it('recirculates on tank supply: the level holds', () => {
    const t = truckOf(run(createInitialState(SPEC), inputsWith(0.6, ['tank', 'ptt']), 600));
    expect(t.readings.pumpToTankLpm).toBeGreaterThan(50);
    expect(t.tankL).toBeCloseTo(3000, 6);
  });

  it('refills the tank from a hydrant through the pump, at the return flow', () => {
    const start = withTank(createInitialState(SPEC, [], hydrantSite(SPEC)), 1000);
    const settled = run(start, inputsWith(0.4, ['suction', 'ptt']), 50);
    const before = truckOf(settled);
    const after = truckOf(run(settled, inputsWith(0.4, ['suction', 'ptt']), 600));
    const q = before.readings.pumpToTankLpm;
    expect(q).toBeGreaterThan(100);
    expect(before.readings.inletFlowLpm.suction).toBeCloseTo(q, 6);
    // 60 s at a steady q L/min.
    expect(after.tankL - before.tankL).toBeCloseTo(q, 0);
  });

  it('overflows a full tank rather than overfilling it', () => {
    const t = truckOf(
      run(
        createInitialState(SPEC, [], hydrantSite(SPEC)),
        inputsWith(0.4, ['suction', 'ptt']),
        300,
      ),
    );
    expect(t.readings.pumpToTankLpm).toBeGreaterThan(100);
    expect(t.tankL).toBe(3000);
  });

  it('cools a churning pump: water through it carries the heat away', () => {
    const fiveMin = Math.round(300 / TICK_S);
    const churn = truckOf(run(createInitialState(SPEC), inputsWith(0.8, ['tank']), fiveMin));
    const cracked = { throttle: 0.8, valves: { tank: 1, ptt: 0.2 }, switches: {} };
    const cooled = truckOf(run(createInitialState(SPEC), cracked, fiveMin));
    expect(churn.pump.tempC).toBeGreaterThan(cooled.pump.tempC + 10);
  });

  it('stops the primer catching while open: it lets air in on the discharge side', () => {
    const site = draughtSite(SPEC, 3);
    const primer = (open: string[]) =>
      truckOf(run(createInitialState(SPEC, [], site), inputsWith(0, open, ['primer']), 400));
    expect(primer(['suction']).pump.primed).toBe(true);
    const leaking = primer(['suction', 'ptt']);
    expect(leaking.pump.primed).toBe(false);
    expect(leaking.pump.vacuumKpa).toBe(0);
  });

  it('is absent from a spec without one: no control, no flow', () => {
    const bare: ApplianceSpec = { ...SPEC };
    delete bare.pumpToTank;
    expect(valveControlIds(bare)).not.toContain('ptt');
    const t = truckOf(run(createInitialState(bare), inputsWith(0.6, ['tank', 'ptt']), 30));
    expect(t.readings.pumpToTankLpm).toBe(0);
  });
});

const MAIN_LOSS = 100 / 1100 ** 2;
const HOSE = Array.from({ length: 2 }, () => ({ hose: '65L', lengthM: STANDARD_LENGTH_M }));

/** A hydrant at `staticKpa` on 2 × 30 m of 65 mm layflat to the hydrant-to-tank inlet. */
const fillSite = (staticKpa = 400): SiteOptions => ({
  sources: [
    { id: 'hyd', kind: 'hydrant', label: 'Hydrant', staticKpa, mainLossKpaPerLpm2: MAIN_LOSS },
  ],
  supplies: [
    { id: 'fill', truckId: DEFAULT_TRUCK_ID, inletId: 'h2t', sourceId: 'hyd', segments: HOSE },
  ],
});

/** Q = √((static − 10·height)/(main + hose + valve/open²)): the hydrant pushes straight into the tank. */
const expectedFillLpm = (staticKpa: number, open: number) =>
  Math.sqrt(
    (staticKpa - HEAD_KPA_PER_M * 2) / (MAIN_LOSS + hoseResistance(HOSE) + 20e-6 / open ** 2),
  );

describe('hydrant to tank', () => {
  it('is a valve control on the spec', () => {
    expect(valveControlIds(SPEC)).toContain('h2t');
  });

  it('fills the tank at the hydrant’s flow with the engine at idle and the pump dry', () => {
    for (const open of [1, 0.5]) {
      const start = withTank(createInitialState(SPEC, [], fillSite()), 1000);
      const inputs = { throttle: 0, valves: { h2t: open }, switches: {} };
      const t = truckOf(run(start, inputs, 600));
      const q = expectedFillLpm(400, open);
      expect(t.readings.inletFlowLpm.h2t).toBeCloseTo(q, 6);
      expect(t.tankL - 1000).toBeCloseTo(q, 6); // 60 s
      expect(t.readings.pumpFlowLpm).toBe(0);
      expect(t.readings.dischargeKpa).toBe(0);
    }
  });

  it('gives nothing to the pump: a delivery open on it alone stays dry', () => {
    const start = withTank(createInitialState(SPEC, [], fillSite()), 0);
    const t = truckOf(run(start, inputsWith(0.6, ['h2t', 'a']), 50));
    expect(t.readings.pumpFlowLpm).toBe(0);
    expect(t.readings.inletFlowLpm.h2t).toBeGreaterThan(0);
  });

  it('fills while the pump draws the tank, and the tank holds the difference', () => {
    const lines = [
      {
        id: 'line-a',
        truckId: DEFAULT_TRUCK_ID,
        deliveryId: 'a',
        segments: HOSE,
        elevationM: 0,
        branch: { tipMm: 15 },
      },
    ];
    const s0 = withTank(createInitialState(SPEC, lines, fillSite()), 1000);
    const t = truckOf(run(s0, inputsWith(0.6, ['tank', 'h2t', 'a']), 600));
    const net = t.readings.inletFlowLpm.h2t ?? 0;
    const draw = t.readings.inletFlowLpm.tank ?? 0;
    expect(draw).toBeGreaterThan(100);
    expect(t.tankL - 1000).toBeCloseTo(net - draw, -1);
  });

  it('flows nothing while the hydrant can’t lift water into the tank', () => {
    const t = truckOf(run(createInitialState(SPEC, [], fillSite(15)), inputsWith(0, ['h2t']), 50));
    expect(t.readings.inletFlowLpm.h2t).toBe(0);
  });

  it('overflows a full tank', () => {
    const t = truckOf(run(createInitialState(SPEC, [], fillSite()), inputsWith(0, ['h2t']), 300));
    expect(t.readings.inletFlowLpm.h2t).toBeGreaterThan(0);
    expect(t.tankL).toBe(3000);
  });

  it('rejects a supply that can’t push water into the tank: static water, or a shared hydrant', () => {
    const fromDam: SiteOptions = {
      sources: [{ id: 'dam', kind: 'static', label: 'Dam', liftM: 2, volumeL: 1e5 }],
      supplies: [
        { id: 'fill', truckId: DEFAULT_TRUCK_ID, inletId: 'h2t', sourceId: 'dam', segments: HOSE },
      ],
    };
    expect(() => createInitialState(SPEC, [], fromDam)).toThrow(/hydrant/);
    const shared = fillSite();
    const both: SiteOptions = {
      ...shared,
      supplies: [
        ...(shared.supplies ?? []),
        {
          id: 'pump',
          truckId: DEFAULT_TRUCK_ID,
          inletId: 'suction',
          sourceId: 'hyd',
          segments: HOSE,
        },
      ],
    };
    expect(() => createInitialState(SPEC, [], both)).toThrow(/feeds/);
  });
});
