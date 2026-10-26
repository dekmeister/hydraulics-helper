// Supply hoses on the scene (issue #8): how far water stands in them and whether it moves.
import { describe, expect, it } from 'vitest';
import { APPLIANCES } from '../sim/appliances/catalogue';
import { primerSwitchIds } from '../sim/appliances/controls';
import { TEST_APPLIANCE } from '../sim/appliances/testAppliance';
import { HEAD_KPA_PER_M } from '../sim/constants';
import { createInitialState } from '../sim/engine';
import {
  draughtSite,
  hydrantSite,
  inputsWith,
  layLine,
  run,
  suctionInletOf,
  truckOf,
  withBigLines,
} from '../sim/testUtils';
import type { ApplianceSpec, PlayerInputs, SimState } from '../sim/types';
import { supplyLays } from './supply';

const DRAUGHTING = [...APPLIANCES, TEST_APPLIANCE].filter((s) => s.primer !== undefined);
const lay = (s: SimState, inputs: PlayerInputs) => {
  const [first] = supplyLays(s, inputs);
  if (first === undefined) throw new Error('no supply');
  return first;
};

describe.each(DRAUGHTING.map((s) => [s.id, s] as const))('suction on %s', (_id, spec) => {
  const LIFT_M = 4;
  const inlet = suctionInletOf(spec);
  const d = spec.deliveries[0]?.id ?? '';
  const site = draughtSite(spec, LIFT_M);
  const priming = inputsWith(0, [inlet], primerSwitchIds(spec));

  it('is empty before priming, with the suction shut', () => {
    const s = createInitialState(spec, [layLine(d, '38L', 2, 15)], site);
    expect(lay(s, inputsWith(0, []))).toMatchObject({ level: 0, flowing: false, state: 'dry' });
  });

  it('shows the water rising up it while priming: the vacuum over 10 kPa per m of lift', () => {
    let s = createInitialState(spec, [layLine(d, '38L', 2, 15)], site);
    s = run(s, priming, 3);
    const { level, flowing } = lay(s, priming);
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(1);
    expect(level).toBeCloseTo(truckOf(s).pump.vacuumKpa / (HEAD_KPA_PER_M * LIFT_M), 9);
    // Climbing while the primer pulls: streaks run up it.
    expect(flowing).toBe(true);
    // Let go: the column stands where the vacuum holds it, still. (A self-priming pump has no
    // control to let go of: it pulls while the suction is open.)
    if (primerSwitchIds(spec).length === 0) return;
    const released = inputsWith(0, [inlet]);
    const held = lay(run(s, released, 1), released);
    expect(held.level).toBeGreaterThan(0);
    expect(held.flowing).toBe(false);
  });

  it('is full once primed, and flowing while the pump draws on it', () => {
    let s = createInitialState(spec, [layLine(d, '38L', 2, 15)], site);
    for (let i = 0; i < 1200 && !truckOf(s).pump.primed; i++) s = run(s, priming, 1);
    // Flowing already where a recirculation bleed draws whenever the pump has water (Cat 7).
    expect(lay(s, priming)).toMatchObject({ level: 1, state: 'primed' });
    const open = inputsWith(0.5, [inlet, d]);
    expect(lay(run(s, open, 30), open)).toMatchObject({ level: 1, flowing: true });
  });
});

describe.each(APPLIANCES.map((s) => [s.id, s] as const))('hydrant layflat on %s', (_id, spec) => {
  const inlet = suctionInletOf(spec);
  const d = spec.deliveries[0]?.id ?? '';

  it('is charged before the job starts, flowing once a line draws on it', () => {
    const s = createInitialState(spec, [layLine(d, '38L', 2, 15)], hydrantSite(spec));
    expect(lay(s, inputsWith(0, []))).toMatchObject({ level: 1, flowing: false });
    const open = inputsWith(0.5, [inlet, d]);
    expect(lay(run(s, open, 30), open)).toMatchObject({ level: 1, flowing: true });
  });

  it('goes soft and empty when over-run', () => {
    const weak = hydrantSite(spec, 150, 5e-4);
    const s = withBigLines(createInitialState(spec, [layLine(d, '65L', 1, 32)], weak));
    const full = inputsWith(1, [inlet, d]);
    const soft = lay(run(s, full, 200), full);
    expect(soft.state).toBe('soft');
    expect(soft.level).toBe(0);
  });
});

/** The hard-suction appliances this covers, so a new one isn't silently skipped. */
it('covers every appliance with a primer', () => {
  expect(DRAUGHTING.map((s: ApplianceSpec) => s.id)).toContain('cat1-generic');
});
