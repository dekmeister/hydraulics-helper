// Priming (ARCHITECTURE §4.6): every primer kind, the vacuum test, air leaks, duty cycle, loss of
// prime. Inline specs so placeholders elsewhere can be re-tuned without moving these.
import { describe, expect, it } from 'vitest';
import { switchControlIds } from './appliances/controls';
import { TICK_S } from './constants';
import { createInitialState } from './engine';
import { draughtSite, inputsWith, layLine, run, truckOf } from './testUtils';
import type { ApplianceSpec, PlayerInputs, PrimerSpec, SimState } from './types';

const PERF = { maxVacuumKpa: 80, displacementLps: 1.5 };

const specWith = (primer: PrimerSpec | undefined): ApplianceSpec => ({
  id: `prime-${primer?.kind ?? 'none'}`,
  name: 'Priming test',
  pump: {
    shutoffKpa: 1400,
    droopKpaPerLpm2: 4e-4,
    cavitationInletKpa: -84,
    casingVolumeL: 10,
    churnKw: 10,
  },
  engine: { idleRpm: 800, maxRpm: 3000, rpmLagS: 0.5 },
  tank: { capacityL: 3000 },
  inlets: [
    { id: 'tank', label: 'Tank', kind: 'tank', lossKpaPerLpm2: 15e-6 },
    { id: 'suction', label: 'Suction', kind: 'suction', sizeMm: 64, lossKpaPerLpm2: 10e-6 },
  ],
  deliveries: [{ id: 'a', label: 'A', sizeMm: 64 }],
  ...(primer === undefined ? {} : { primer }),
  instruments: [],
});

const ROTARY = specWith({ kind: 'rotaryVane', id: 'primer', maxOnS: 60, periodS: 180, ...PERF });
const DIAPHRAGM = specWith({ kind: 'diaphragm', id: 'primer', ...PERF, displacementLps: 0.5 });
const SELF = specWith({ kind: 'selfPriming', ...PERF });
const NONE = specWith(undefined);

const LINE = [layLine('a', '65L', 3, 20)];

/** Draught state at `liftM`, optionally with a small dam. */
const draught = (spec: ApplianceSpec, liftM: number, volumeL = 1e6) =>
  createInitialState(spec, LINE, draughtSite(spec, liftM, volumeL));

/** Seconds of `inputs` until the pump primes, or undefined within `maxS`. */
function timeToPrime(state: SimState, inputs: PlayerInputs, maxS = 300): number | undefined {
  let s = state;
  for (let i = 1; i <= maxS / TICK_S; i++) {
    s = run(s, inputs, 1);
    if (truckOf(s).pump.primed) return i * TICK_S;
  }
  return undefined;
}

/** Primer held (if it has a control) with the suction valve open. */
const priming = (spec: ApplianceSpec) => inputsWith(0, ['suction'], switchControlIds(spec));

describe.each([
  ['rotary vane', ROTARY],
  ['hand diaphragm', DIAPHRAGM],
  ['self-priming', SELF],
] as const)('priming with a %s primer', (_kind, spec) => {
  it('primes at 4 m, and takes longer the higher the lift', () => {
    const t3 = timeToPrime(draught(spec, 3), priming(spec));
    const t6 = timeToPrime(draught(spec, 6), priming(spec));
    expect(t3).toBeDefined();
    expect(t6).toBeGreaterThan(t3 ?? 0);
  });

  it('can’t prime from 8 m: the primer can’t pull enough vacuum (manual: 7.5 m max, L1162)', () => {
    expect(timeToPrime(draught(spec, 8), priming(spec), 600)).toBeUndefined();
  });

  it('can’t prime through layflat: soft hose flattens under vacuum instead of lifting water', () => {
    const site = draughtSite(spec, 3);
    const soft = createInitialState(spec, LINE, {
      ...site,
      supplies: (site.supplies ?? []).map((x) => ({
        ...x,
        segments: [{ hose: '65L', lengthM: 6 }],
      })),
    });
    expect(timeToPrime(soft, priming(spec), 120)).toBeUndefined();
  });

  it('can’t prime with a delivery open: the hose is an air leak (L3265)', () => {
    const inputs = { ...priming(spec), valves: { suction: 1, a: 1 } };
    expect(timeToPrime(draught(spec, 3), inputs, 60)).toBeUndefined();
    expect(truckOf(run(draught(spec, 3), inputs, 50)).pump.vacuumKpa).toBe(0);
  });

  it('once primed, delivers water and loses prime when the dam runs dry', () => {
    let s = draught(spec, 3, 400);
    while (!truckOf(s).pump.primed) s = run(s, priming(spec), 1);
    s = run(s, inputsWith(0.6, ['suction', 'a']), 20);
    expect(truckOf(s).readings.pumpFlowLpm).toBeGreaterThan(0);
    s = run(s, inputsWith(0.6, ['suction', 'a']), 600);
    expect(truckOf(s).pump.primed).toBe(false);
    expect(truckOf(s).readings.pumpFlowLpm).toBe(0);
    expect(truckOf(s).readings.dischargeKpa).toBe(0);
  });
});

describe('primer controls', () => {
  it('a switched primer does nothing until it is run', () => {
    expect(timeToPrime(draught(ROTARY, 3), inputsWith(0, ['suction']), 60)).toBeUndefined();
    expect(timeToPrime(draught(DIAPHRAGM, 3), inputsWith(0, ['suction']), 60)).toBeUndefined();
  });

  it('a self-priming pump primes as soon as the suction valve opens', () => {
    expect(timeToPrime(draught(SELF, 3), inputsWith(0, ['suction']), 60)).toBeDefined();
    expect(timeToPrime(draught(SELF, 3), inputsWith(0, []), 60)).toBeUndefined();
  });

  it('a hand diaphragm is slower than the rotary vane (smaller displacement)', () => {
    const rotary = timeToPrime(draught(ROTARY, 4), priming(ROTARY)) ?? Infinity;
    expect(timeToPrime(draught(DIAPHRAGM, 4), priming(DIAPHRAGM))).toBeGreaterThan(rotary);
  });

  it('no primer: the pump never primes', () => {
    expect(timeToPrime(draught(NONE, 3), inputsWith(0, ['suction']), 120)).toBeUndefined();
  });
});

describe('vacuum test and gauge', () => {
  it('suction valve shut: vacuum builds fast, the compound shows it, and a sound pump holds it', () => {
    const held = run(draught(ROTARY, 3), inputsWith(0, [], ['primer']), 200);
    const v = truckOf(held).pump.vacuumKpa;
    expect(v).toBeGreaterThan(75);
    expect(truckOf(held).pump.primed).toBe(false);
    expect(truckOf(held).readings.compoundKpa).toBeCloseTo(-v, 6);
    const later = run(held, inputsWith(0, []), 100);
    expect(truckOf(later).pump.vacuumKpa).toBeGreaterThan(0.9 * v);
  });

  it('the casing is flooded while the tank is open: no vacuum to pull', () => {
    const s = run(draught(ROTARY, 3), inputsWith(0, ['tank', 'suction'], ['primer']), 100);
    expect(truckOf(s).pump.vacuumKpa).toBe(0);
  });
});

describe('rotary vane duty cycle (max 1 min on in 3, L1890)', () => {
  it('cuts out after 60 s of running and recovers after the 2 min rest', () => {
    let s = run(draught(ROTARY, 3), inputsWith(0, [], ['primer']), 600);
    expect(truckOf(s).pump.primerCutOut).toBe(true);
    const v = truckOf(s).pump.vacuumKpa;
    s = run(s, inputsWith(0, [], ['primer']), 100);
    expect(truckOf(s).pump.vacuumKpa).toBeLessThan(v); // not running: holding, not pulling
    s = run(s, inputsWith(0, []), 1210);
    expect(truckOf(s).pump.primerCutOut).toBe(false);
  });

  it('times a continuous run and resets it on release', () => {
    let s = run(draught(ROTARY, 3), inputsWith(0, [], ['primer']), 50);
    expect(truckOf(s).pump.primerRunS).toBeCloseTo(5, 6);
    s = run(s, inputsWith(0, []), 1);
    expect(truckOf(s).pump.primerRunS).toBe(0);
  });
});
