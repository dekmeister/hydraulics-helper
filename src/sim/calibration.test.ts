// Worked examples from docs/CALIBRATION.md (manual pump calcs): pump pressure = nozzle + friction ± head.
// Tolerance: ±5 % on pump pressure, the friction fits' ±10 % scatter diluted by the nozzle term.
import { describe, expect, it } from 'vitest';
import { CAT1 } from './appliances/cat1';
import { branchFlowLpm } from './branch';
import { HEAD_KPA_PER_M, STANDARD_LENGTH_M } from './constants';
import { hoseFrictionKpa } from './hose';
import { pumpRiseKpa } from './pump';
import { chargeLines, createInitialState } from './engine';
import {
  draughtSite,
  expectWithinRel,
  inputsWith,
  layLine,
  primedState,
  run,
  truckOf,
  TEST_STARTING,
} from './testUtils';
import type { ApplianceSpec, HoseLine, HoseSegment } from './types';

const lengths = (hose: string, n: number): HoseSegment[] =>
  Array.from({ length: n }, () => ({ hose, lengthM: STANDARD_LENGTH_M }));

/** The doctrine pump calculation, built from the sim's own friction and head functions. */
const pumpKpa = (nozzleKpa: number, segments: HoseSegment[], flowLpm: number, riseM = 0) =>
  nozzleKpa + hoseFrictionKpa(segments, flowLpm) + HEAD_KPA_PER_M * riseM;

const PUMP_TOL = 0.05;

describe('calibration: pump pressure worked examples', () => {
  it.each([
    ['C1 25 mm ×1, 150 L/min, 250 kPa nozzle (L927)', pumpKpa(250, lengths('25L', 1), 150), 500],
    ['C2 25 mm ×4, 150 L/min, 250 kPa nozzle (L933)', pumpKpa(250, lengths('25L', 4), 150), 1250],
    ['C3 38 mm lined ×4, 150 L/min, 250 kPa (L949)', pumpKpa(250, lengths('38L', 4), 150), 390],
    ['C4 38 mm lined ×3, 500 L/min, 700 kPa (L964)', pumpKpa(700, lengths('38L', 3), 500), 1900],
    ['C5 65 mm lined ×3, 500 L/min, 700 kPa (L969)', pumpKpa(700, lengths('65L', 3), 500), 790],
    [
      'C6 65 ×2 + 38 ×1 lined, 500 L/min, 700 kPa (L980)',
      pumpKpa(700, [...lengths('65L', 2), ...lengths('38L', 1)], 500),
      1160,
    ],
    ['C7 50 mm lined ×3, 500 L/min, 700 kPa (L987)', pumpKpa(700, lengths('50L', 3), 500), 970],
    ['C8 branch 16 m above pump, 700 kPa (L702)', pumpKpa(700, [], 0, 16), 860],
    ['C9 branch 16 m below pump, 700 kPa (L702)', pumpKpa(700, [], 0, -16), 540],
  ])('%s', (_name, actual, expected) => {
    expectWithinRel(actual, expected, PUMP_TOL);
  });
});

describe('calibration: supply-line friction C10 (L1024–1039), 1000 L/min over 3 lengths', () => {
  it.each([
    ['single 65 mm unlined', hoseFrictionKpa(lengths('65U', 3), 1000), 1050],
    ['twinned 65 mm unlined (500 L/min each)', hoseFrictionKpa(lengths('65U', 3), 500), 255],
    ['single 90 mm unlined', hoseFrictionKpa(lengths('90U', 3), 1000), 195],
  ])('%s', (_name, actual, expected) => {
    expectWithinRel(actual, expected, PUMP_TOL);
  });
});

// Table 3 has no 25 mm unlined column: 25U is 25L scaled by the 38 and 65 mm unlined:lined ratio
// (2.8). PLACEHOLDER — needs Dek. One length with a 12 mm branch is the bush crew's lay.
describe('calibration: 25 mm percolating hose (PLACEHOLDER)', () => {
  it('loses about 2.8 × the lined figure: ~680 kPa a length at 150 L/min', () => {
    expectWithinRel(hoseFrictionKpa(lengths('25U', 1), 150), 2.8 * 243, PUMP_TOL);
  });

  it('needs about 930 kPa at the pump for one length and a 12 mm branch', () => {
    expectWithinRel(pumpKpa(250, lengths('25U', 1), 150), 930, PUMP_TOL);
  });
});

describe('calibration: Table 1 branch flows at optimum pressure (L465–490)', () => {
  // Manual flows are rounded; the formula lands within 2 % of every row.
  it.each([
    [12, 250, 150],
    [15, 350, 280],
    [20, 500, 600],
    [25, 700, 1100],
    [30, 800, 1700],
    [32, 800, 1900],
  ])('%i mm tip at %i kPa flows ~%i L/min', (tipMm, kpa, lpm) => {
    expectWithinRel(branchFlowLpm({ tipMm }, kpa), lpm, 0.02);
  });

  it('flow scales with √pressure: 4× the pressure doubles the flow', () => {
    expect(branchFlowLpm({ tipMm: 15 }, 1000)).toBeCloseTo(
      2 * branchFlowLpm({ tipMm: 15 }, 250),
      9,
    );
  });
});

describe('calibration: Cat 1 rated duty (data plate, Resources/Photos/Cat1B_Panel.jpg)', () => {
  it('C15: 1200 L/min at 1000 kPa at max rpm', () => {
    // Tolerance ±1 kPa: the droop is fitted to this point exactly.
    const { pump, engine } = CAT1;
    expect(pumpRiseKpa(pump, engine, engine.maxRpm, 1200)).toBeCloseTo(1000, 0);
  });
});

// Draughting (manual §2.x lift, Table 4). The pump in these is generic: −84 kPa cavitation is the
// fitted figure (docs/CALIBRATION.md), the suction is 2 × 3 m of hard suction plus a strainer.
const DRAUGHT_SPEC: ApplianceSpec = {
  id: 'calibration-draught',
  name: 'Draught calibration',
  pump: {
    shutoffKpa: 1400,
    droopKpaPerLpm2: 4e-4,
    cavitationInletKpa: -84,
    casingVolumeL: 10,
    churnKw: 10,
  },
  engine: { idleRpm: 800, maxRpm: 3000, rpmLagS: 0.5, cylinders: 6, ...TEST_STARTING },
  inlets: [{ id: 'suction', label: 'Suction', kind: 'suction', sizeMm: 64, lossKpaPerLpm2: 10e-6 }],
  deliveries: [
    { id: 'a', label: 'A', sizeMm: 64 },
    { id: 'b', label: 'B', sizeMm: 64 },
  ],
  instruments: [],
};

/** Readings after drawing from a primed draught at `liftM` for 5 s. */
function draughtAt(liftM: number, throttle: number, lines: HoseLine[]) {
  const s = primedState(
    chargeLines(createInitialState(DRAUGHT_SPEC, lines, draughtSite(DRAUGHT_SPEC, liftM))),
  );
  // Only the laid deliveries: a bare one would dump water at the truck (issue #16).
  const open = ['suction', ...lines.map((l) => l.deliveryId)];
  return truckOf(run(s, inputsWith(throttle, open), 50)).readings;
}

/** Wide open on two big lines: whatever the suction can give, the pump takes. */
const flatOut = (liftM: number) =>
  draughtAt(liftM, 1, [layLine('a', '65L', 1, 32), layLine('b', '65L', 1, 32)]).pumpFlowLpm;

describe('calibration: draughting', () => {
  it('C11: 4 m of lift reads about −40 kPa on the compound gauge (L3222–3225)', () => {
    // A trickle (12 mm branch at idle), so suction friction is negligible. Tolerance ±2 kPa.
    const r = draughtAt(4, 0, [layLine('a', '38L', 1, 12)]);
    expect(r.pumpFlowLpm).toBeGreaterThan(0);
    expect(Math.abs(r.compoundKpa - -40)).toBeLessThanOrEqual(2);
  });

  // Table 4 (L1179–1194): capacity lost against capacity at 3 m. The −84 kPa floor reproduces it
  // to within 5 % up to 7 m; at 7.5 m the model keeps 43 % against the manual's 33 % (noted in
  // docs/CALIBRATION.md, needs Dek).
  it.each([
    [4.5, 1 - 1 / 7],
    [6, 1 - 1 / 3],
    [7, 1 - 1 / 2],
  ])('Table 4: at %s m lift the pump gives %s of its 3 m capacity', (liftM, fraction) => {
    expectWithinRel(flatOut(liftM) / flatOut(3), fraction, 0.05);
  });

  it('7 m of lift ⇒ about half rated flow; 8 m ⇒ far short of it', () => {
    const rated = flatOut(3);
    expect(flatOut(7)).toBeLessThan(0.55 * rated);
    expect(flatOut(8)).toBeLessThan(0.3 * rated);
  });
});
