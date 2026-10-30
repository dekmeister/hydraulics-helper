// Priming (ARCHITECTURE §4.6): every primer kind, the vacuum test, air leaks, duty cycle, loss of
// prime. Inline specs so placeholders elsewhere can be re-tuned without moving these.
import { describe, expect, it } from 'vitest';
import { CAT1 } from './appliances/cat1';
import { CAT7 } from './appliances/cat7';
import { primerSwitchIds } from './appliances/controls';
import { ATMOSPHERIC_KPA, HEAD_KPA_PER_M, TICK_S, VACUUM_HOLD_TAU_S } from './constants';
import { connectedSupplies, createInitialState } from './engine';
import { hoseVolumeL } from './hose';
import { draughtSupply, suctionWaterFraction } from './priming';
import {
  draughtSite,
  inputsWith,
  layLine,
  run,
  suctionInletOf,
  truckOf,
  TEST_STARTING,
} from './testUtils';
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
  engine: { idleRpm: 800, maxRpm: 3000, rpmLagS: 0.5, cylinders: 6, ...TEST_STARTING },
  tank: { capacityL: 3000, headM: 0 },
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
const priming = (spec: ApplianceSpec) => inputsWith(0, ['suction'], primerSwitchIds(spec));

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

  it('can’t prime with a bare delivery open either: the outlet is open to air (issue #16)', () => {
    const bare = createInitialState(spec, [], draughtSite(spec, 3, 1e6));
    const inputs = { ...priming(spec), valves: { suction: 1, a: 1 } };
    expect(timeToPrime(bare, inputs, 60)).toBeUndefined();
    expect(timeToPrime(bare, priming(spec))).toBeDefined();
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

describe('water rising up the hard suction (issue #8)', () => {
  const LIFT_M = 4;
  const suctionL = hoseVolumeL(draughtSite(ROTARY, LIFT_M).supplies?.[0]?.segments ?? []);
  const level = (s: SimState) => {
    const t = truckOf(s);
    return suctionWaterFraction(t.pump, draughtSupply(connectedSupplies(s, t.id)));
  };

  it('stands at the height the vacuum holds it, 10 kPa per m, until the pump catches', () => {
    const s = run(draught(ROTARY, LIFT_M), priming(ROTARY), 50);
    const { pump } = truckOf(s);
    expect(pump.primed).toBe(false);
    expect(level(s)).toBeGreaterThan(0);
    expect(level(s)).toBeLessThan(1);
    expect(level(s)).toBeCloseTo(pump.vacuumKpa / (HEAD_KPA_PER_M * LIFT_M), 9);
  });

  it('fills the suction once primed, and stays full with the suction valve shut', () => {
    const primed = run(draught(ROTARY, LIFT_M), priming(ROTARY), 300);
    expect(truckOf(primed).pump.primed).toBe(true);
    expect(level(primed)).toBe(1);
    expect(level(run(primed, inputsWith(0, []), 50))).toBe(1);
  });

  it('never lifts water with the suction valve shut: the primer only empties the casing', () => {
    const shut = run(draught(ROTARY, LIFT_M), inputsWith(0, [], ['primer']), 50);
    expect(truckOf(shut).pump.vacuumKpa).toBeGreaterThan(30);
    expect(level(shut)).toBe(0);
  });

  it('shutting the suction valve traps the column where it stands', () => {
    const part = run(draught(ROTARY, LIFT_M), priming(ROTARY), 80);
    const before = level(part);
    expect(before).toBeGreaterThan(0.2);
    expect(before).toBeLessThan(1);
    // Primer still running on the casing alone, and then let go: the hose holds its water.
    // It sinks only as slowly as a sound pump's vacuum leaks (VACUUM_HOLD_TAU_S), ~4 % in 5 s.
    const shut = run(part, inputsWith(0, [], ['primer']), 50);
    expect(level(shut)).toBeCloseTo(before * Math.exp(-5 / VACUUM_HOLD_TAU_S), 3);
    expect(level(run(shut, inputsWith(0, []), 50))).toBeCloseTo(
      before * Math.exp(-10 / VACUUM_HOLD_TAU_S),
      3,
    );
  });

  it('reopening shares the vacuum between casing and hose: the column settles to the mix', () => {
    const part = run(draught(ROTARY, LIFT_M), priming(ROTARY), 80);
    const before = level(part);
    // The casing pulled harder while shut: opening lifts the column further, short of the casing's.
    const harder = run(part, inputsWith(0, [], ['primer']), 30);
    const casingKpa = truckOf(harder).pump.vacuumKpa;
    const opened = run(harder, inputsWith(0, ['suction']), 1);
    expect(level(opened)).toBeGreaterThan(before);
    expect(truckOf(opened).pump.vacuumKpa).toBeLessThan(casingKpa);
    // A delivery opened while shut vents the casing: opening drops the column, not to empty.
    const vented = run(part, inputsWith(0, ['a']), 5);
    expect(truckOf(vented).pump.vacuumKpa).toBe(0);
    expect(level(vented)).toBeCloseTo(before, 1);
    const dropped = run(vented, inputsWith(0, ['suction']), 1);
    expect(level(dropped)).toBeLessThan(before);
    expect(level(dropped)).toBeGreaterThan(0);
  });

  it('slows priming: the rising column squeezes the air left, so more must be pumped out', () => {
    const { maxVacuumKpa, displacementLps } = PERF;
    const catchKpa = HEAD_KPA_PER_M * LIFT_M;
    const toCatch = Math.log(maxVacuumKpa / (maxVacuumKpa - catchKpa));
    // Rigid volume (no column): τ = V/D. Column at atmospheric pressure all the way: the upper bound.
    const rigidS = ((10 + suctionL) / displacementLps) * toCatch;
    const columnL = (ATMOSPHERIC_KPA * suctionL) / (HEAD_KPA_PER_M * LIFT_M);
    const boundS = ((10 + suctionL + columnL) / displacementLps) * toCatch;
    const t = timeToPrime(draught(ROTARY, LIFT_M), priming(ROTARY)) ?? Infinity;
    expect(t).toBeGreaterThan(rigidS * 1.3);
    expect(t).toBeLessThan(boundS);
  });
});

describe('appliance prime times at 4 m on 2 × 3 m of 65 mm hard suction (CALIBRATION)', () => {
  // The primers' displacements are PLACEHOLDERs set to give these times; ±0.5 s.
  it.each([
    [CAT1.id, CAT1, 13.9],
    [CAT7.id, CAT7, 30.4],
  ] as const)('%s', (_id, spec, wantS) => {
    const s = createInitialState(spec, [], draughtSite(spec, 4));
    const t = timeToPrime(s, inputsWith(0, [suctionInletOf(spec)], primerSwitchIds(spec)));
    expect(t).toBeGreaterThan(wantS - 0.5);
    expect(t).toBeLessThan(wantS + 0.5);
  });
});
