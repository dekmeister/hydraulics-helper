import { describe, expect, it } from 'vitest';
import {
  dragPosition,
  keyedPosition,
  valveAngleDeg,
  valveOpeningAt,
  vernierStep,
} from './controlMath';

describe('valve lever angle → opening', () => {
  it('is shut straight up and open at 3 o’clock', () => {
    expect(valveOpeningAt(0, -50)).toBe(0);
    expect(valveOpeningAt(50, 0)).toBe(1);
  });

  it('is half open at 45°', () => {
    expect(valveOpeningAt(50, -50)).toBeCloseTo(0.5, 9);
  });

  it('clicks into the detents near either end', () => {
    expect(valveOpeningAt(Math.tan((3 * Math.PI) / 180) * 50, -50)).toBe(0);
    expect(valveOpeningAt(50, -Math.tan((3 * Math.PI) / 180) * 50)).toBe(1);
  });

  it('clamps beyond the travel: left of vertical shut, below the pipe open', () => {
    expect(valveOpeningAt(-30, -50)).toBe(0);
    expect(valveOpeningAt(30, 50)).toBe(1);
    expect(valveOpeningAt(-30, 50)).toBe(1);
    expect(valveOpeningAt(0, 0)).toBe(0);
  });

  it('maps an opening back to a lever angle', () => {
    expect(valveAngleDeg(0.5)).toBe(45);
    expect(valveAngleDeg(2)).toBe(90);
  });
});

describe('drag along a track', () => {
  it('moves by the fraction of travel dragged, clamped', () => {
    expect(dragPosition(0.2, 90, 180)).toBeCloseTo(0.7, 9);
    expect(dragPosition(0.2, -90, 180)).toBe(0);
    expect(dragPosition(0.5, 10, 0)).toBe(0.5);
  });
});

describe('throttle vernier', () => {
  it('steps 25 rpm of the governed range', () => {
    expect(vernierStep(800, 3000)).toBeCloseTo(25 / 2200, 12);
  });
});

describe('keyboard', () => {
  it('steps 10 % on arrows without float residue, and jumps on Home/End', () => {
    expect(keyedPosition('ArrowRight', 0.2)).toBe(0.3);
    expect(keyedPosition('ArrowDown', 0.05)).toBe(0);
    expect(keyedPosition('End', 0.3)).toBe(1);
    expect(keyedPosition('Home', 0.3)).toBe(0);
    expect(keyedPosition('Tab', 0.3)).toBeNull();
  });
});
