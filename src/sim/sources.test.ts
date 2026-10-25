// Water sources at the pump inlet (ARCHITECTURE §4.3): hydrant, tank and draught paths in
// parallel, the cavitation floor and soft-hose collapse.
import { describe, expect, it } from 'vitest';
import { createInitialState, type SiteOptions } from './engine';
import { inletKpaFor, inletPaths, supplyLpm } from './inlets';
import {
  draughtSite,
  hydrantSite,
  inputsWith,
  layLine,
  primedState,
  run,
  truckOf,
} from './testUtils';
import type { ApplianceSpec, HoseLine, PlayerInputs, SupplyLine } from './types';

// Inline spec so these tests don't move when an appliance's placeholders are re-tuned.
const SPEC: ApplianceSpec = {
  id: 'source-test',
  name: 'Source test',
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
    { id: 'suction', label: 'Suction', kind: 'suction', sizeMm: 64, lossKpaPerLpm2: 10e-6 },
  ],
  deliveries: [
    { id: 'a', label: 'A', sizeMm: 64 },
    { id: 'b', label: 'B', sizeMm: 64 },
  ],
  relief: { kind: 'preset', setKpa: 1100, dumpTo: 'tank', slopeLpmPerKpa: 50 },
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

/** Two big lines: far more than any supply here can give at full throttle. */
const BIG: HoseLine[] = [layLine('a', '65L', 1, 32), layLine('b', '65L', 1, 32)];
const ONE: HoseLine[] = [layLine('a', '65L', 3, 20)];

const settle = (
  site: SiteOptions,
  inputs: PlayerInputs,
  lines = ONE,
  primed = false,
  ticks = 50,
) => {
  const s = createInitialState(SPEC, lines, site);
  return truckOf(run(primed ? primedState(s) : s, inputs, ticks));
};

describe('hydrant supply', () => {
  it('reads its static pressure on the compound gauge with nothing flowing', () => {
    const t = settle(hydrantSite(SPEC, 400), inputsWith(0, ['suction']));
    expect(t.readings.compoundKpa).toBeCloseTo(400, 6);
  });

  it('reads positive and falls as more water is drawn (L3613)', () => {
    const low = settle(hydrantSite(SPEC), inputsWith(0.3, ['suction', 'a']));
    const high = settle(hydrantSite(SPEC), inputsWith(0.7, ['suction', 'a']));
    expect(low.readings.compoundKpa).toBeGreaterThan(high.readings.compoundKpa);
    expect(high.readings.compoundKpa).toBeGreaterThan(0);
    expect(high.readings.inletFlowLpm.suction).toBeCloseTo(high.readings.pumpFlowLpm, 3);
  });

  it('adds its pressure to the pump: discharge = inlet + pump rise', () => {
    const tank = settle({}, inputsWith(0.5, ['tank', 'a']));
    const hydrant = settle(hydrantSite(SPEC), inputsWith(0.5, ['suction', 'a']));
    expect(hydrant.readings.dischargeKpa).toBeGreaterThan(tank.readings.dischargeKpa + 200);
  });

  it('spares the tank when both are open: the tank feed sees higher pressure and gives nothing', () => {
    const t = settle(hydrantSite(SPEC), inputsWith(0.6, ['tank', 'suction', 'a']), ONE, false, 100);
    expect(t.readings.inletFlowLpm.tank).toBe(0);
    expect(t.tankL).toBe(3000);
  });

  it('refills the tank through the relief when every delivery is shut', () => {
    const half = createInitialState(SPEC, ONE, hydrantSite(SPEC));
    const s = { ...half, trucks: half.trucks.map((t) => ({ ...t, tankL: 1500 })) };
    const t = truckOf(run(s, inputsWith(1, ['suction']), 100));
    expect(t.readings.reliefFlowLpm).toBeGreaterThan(0);
    expect(t.tankL).toBeGreaterThan(1500);
  });

  it('over-run: the layflat goes soft, the inlet reads zero and the pump cavitates (Table 7)', () => {
    const t = settle(hydrantSite(SPEC), inputsWith(1, ['suction', 'a', 'b']), BIG);
    expect(t.readings.compoundKpa).toBeCloseTo(0, 6);
    expect(t.readings.cavitation).toBeGreaterThan(0);
    expect(t.readings.inletCollapsed.suction).toBe(true);
  });

  it('a layflat drawn within what the hydrant gives stays round', () => {
    const t = settle(hydrantSite(SPEC), inputsWith(0.7, ['suction', 'a']));
    expect(t.readings.inletCollapsed.suction).toBe(false);
  });

  it('C14: 400 kPa static, 300 residual at 1100 L/min leaves about as much again (L3127)', () => {
    const site = hydrantSite(SPEC, 400, 100 / 1100 ** 2, 0);
    const spec = { ...SPEC, inlets: SPEC.inlets.map((i) => ({ ...i, lossKpaPerLpm2: 1e-12 })) };
    const paths = inletPaths({
      spec,
      tankL: 0,
      inputs: inputsWith(0, ['suction']),
      primed: false,
      supplies:
        site.supplies?.map((supply) => ({ supply, source: site.sources?.[0] ?? never() })) ?? [],
    });
    expect(inletKpaFor(paths, 1100, -84)).toBeCloseTo(300, 3);
    // Residual reaches zero (soft hose) at twice the flow: 1100 L/min more available.
    expect(supplyLpm(paths, 0)).toBeCloseTo(2200, 0);
  });
});

function never(): never {
  throw new Error('missing source');
}

describe('cavitation floor', () => {
  it('caps the flow a draught can give, so more throttle adds nothing ("rpm does nothing")', () => {
    const site = draughtSite(SPEC, 6);
    const at = (throttle: number) =>
      settle(site, inputsWith(throttle, ['suction', 'a', 'b']), BIG, true).readings;
    const r90 = at(0.9);
    const r100 = at(1);
    expect(r90.cavitation).toBeGreaterThan(0);
    expect(r100.pumpFlowLpm).toBeCloseTo(r90.pumpFlowLpm, 3);
    expect(r100.dischargeKpa).toBeCloseTo(r90.dischargeKpa, 3);
    expect(r100.compoundKpa).toBeCloseTo(-84, 3);
    // Hard suction holds its shape at the floor: cavitation, not a collapsed hose.
    expect(r100.inletCollapsed.suction).toBe(false);
    expect(r100.cavitation).toBeGreaterThanOrEqual(r90.cavitation);
  });

  it('grows from zero at onset as the throttle pushes past the limit', () => {
    const site = draughtSite(SPEC, 6);
    const levels = [0.5, 0.7, 0.8, 0.9, 1].map(
      (x) => settle(site, inputsWith(x, ['suction', 'a']), ONE, true).readings.cavitation,
    );
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1] ?? 0);
    }
    expect(levels[0]).toBe(0);
    expect(levels.some((x) => x > 0 && x < 1)).toBe(true);
  });

  it('easing the throttle back below the limit stops it', () => {
    const t = settle(draughtSite(SPEC, 6), inputsWith(0.3, ['suction', 'a']), ONE, true);
    expect(t.readings.cavitation).toBe(0);
    expect(t.readings.compoundKpa).toBeGreaterThan(-84);
  });

  it('tank supply never reaches it at this pump’s flows', () => {
    const t = settle({}, inputsWith(1, ['tank', 'a', 'b']), BIG);
    expect(t.readings.cavitation).toBe(0);
  });
});

describe('draught supply', () => {
  it('gives nothing until primed', () => {
    const t = settle(draughtSite(SPEC, 3), inputsWith(0.6, ['suction', 'a']));
    expect(t.readings.pumpFlowLpm).toBe(0);
    expect(t.readings.dischargeKpa).toBe(0);
  });

  it('primed, reads −10 kPa per m of lift less suction losses, and draws down the dam', () => {
    const s0 = primedState(createInitialState(SPEC, ONE, draughtSite(SPEC, 3, 50_000)));
    const s1 = run(s0, inputsWith(0.6, ['suction', 'a']), 100);
    const r = truckOf(s1).readings;
    expect(r.pumpFlowLpm).toBeGreaterThan(300);
    expect(r.compoundKpa).toBeLessThan(-30);
    const dam = s1.sources[0];
    expect(dam?.kind === 'static' ? dam.volumeL : 0).toBeLessThan(50_000);
    expect(truckOf(s1).tankL).toBe(3000);
  });

  it('a layflat can’t draught: it flattens before it lifts any water', () => {
    const site = draughtSite(SPEC, 3);
    const soft: SiteOptions = {
      ...site,
      supplies:
        site.supplies?.map((x) => ({ ...x, segments: [{ hose: '65L', lengthM: 6 }] })) ?? [],
    };
    expect(
      settle(soft, inputsWith(0.6, ['suction', 'a']), ONE, true).readings.pumpFlowLpm,
    ).toBeCloseTo(0, 6);
  });

  it('rejects a supply whose source does not exist', () => {
    const site = draughtSite(SPEC, 3);
    expect(() => createInitialState(SPEC, ONE, { ...site, sources: [] })).toThrow(/no source/);
  });
});

describe('site validation (data errors fail at state creation, not silently)', () => {
  const site = draughtSite(SPEC, 3);
  const withSupply = (patch: Partial<SupplyLine>): SiteOptions => ({
    ...site,
    supplies: site.supplies?.map((x) => ({ ...x, ...patch })) ?? [],
  });

  it('rejects a supply on an inlet the appliance does not have', () => {
    expect(() => createInitialState(SPEC, ONE, withSupply({ inletId: 'nope' }))).toThrow(
      /no inlet 'nope'/,
    );
  });

  it('rejects a supply on the tank inlet', () => {
    expect(() => createInitialState(SPEC, ONE, withSupply({ inletId: 'tank' }))).toThrow(
      /not an external inlet/,
    );
  });

  it('rejects a supply to a truck that is not on the fireground', () => {
    expect(() => createInitialState(SPEC, ONE, withSupply({ truckId: 'truck-9' }))).toThrow(
      /no truck 'truck-9'/,
    );
  });

  it('rejects two supplies on one inlet', () => {
    const [hose] = site.supplies ?? [];
    if (hose === undefined) throw new Error('draughtSite has no supply');
    const twice: SiteOptions = { ...site, supplies: [hose, { ...hose, id: 'second' }] };
    expect(() => createInitialState(SPEC, ONE, twice)).toThrow(/already has a supply/);
  });

  it('rejects more than one static source per truck (priming is tracked per pump)', () => {
    const twoSuction: ApplianceSpec = {
      ...SPEC,
      inlets: [
        ...SPEC.inlets,
        { id: 'suction-2', label: 'Suction 2', kind: 'suction', lossKpaPerLpm2: 10e-6 },
      ],
    };
    const [hose] = site.supplies ?? [];
    if (hose === undefined) throw new Error('draughtSite has no supply');
    const twoDams: SiteOptions = {
      sources: [
        { id: 'dam', kind: 'static', label: 'Dam', liftM: 3, volumeL: 1e6 },
        { id: 'dam-2', kind: 'static', label: 'Dam 2', liftM: 3, volumeL: 1e6 },
      ],
      supplies: [hose, { ...hose, id: 'second', inletId: 'suction-2', sourceId: 'dam-2' }],
    };
    expect(() => createInitialState(twoSuction, ONE, twoDams)).toThrow(/one static source/);
  });

  it('rejects duplicate source ids', () => {
    const dam = site.sources?.[0];
    if (dam === undefined) throw new Error('draughtSite has no source');
    expect(() => createInitialState(SPEC, ONE, { ...site, sources: [dam, dam] })).toThrow(
      /duplicate source id 'dam'/,
    );
  });
});
