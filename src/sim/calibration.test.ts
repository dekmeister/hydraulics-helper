// Worked examples from docs/CALIBRATION.md (manual pump calcs): pump pressure = nozzle + friction ± head.
// Tolerance: ±5 % on pump pressure, the friction fits' ±10 % scatter diluted by the nozzle term.
import { describe, expect, it } from 'vitest';
import { branchFlowLpm } from './branch';
import { HEAD_KPA_PER_M, STANDARD_LENGTH_M } from './constants';
import { hoseFrictionKpa } from './hose';
import { expectWithinRel } from './testUtils';
import type { HoseSegment } from './types';

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
