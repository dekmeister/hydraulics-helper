import { describe, expect, it } from 'vitest';
import { isSettled, NEEDLE_OMEGA, stepDamped, type Damped } from './damping';

function run(target: number, totalS: number, dtS: number): Damped[] {
  const out: Damped[] = [];
  let d: Damped = { value: 0, velocity: 0 };
  for (let t = 0; t < totalS - 1e-9; t += dtS) {
    d = stepDamped(d, target, dtS);
    out.push(d);
  }
  return out;
}

describe('needle damping', () => {
  it('approaches the target without overshoot', () => {
    const path = run(700, 2, 1 / 60);
    for (const d of path) expect(d.value).toBeLessThanOrEqual(700 + 1e-9);
    expect(path.at(-1)?.value).toBeCloseTo(700, 2);
  });

  it('settles to within 1 % in 0.7 s at the default frequency', () => {
    const d = run(700, 0.7, 1 / 60).at(-1);
    expect(NEEDLE_OMEGA).toBe(10);
    expect(Math.abs((d?.value ?? 0) - 700)).toBeLessThan(7); // within 1 %
  });

  it('gives the same result for one long step as many short ones (exact solution)', () => {
    const one = stepDamped({ value: 0, velocity: 0 }, 500, 0.3);
    const many = run(500, 0.3, 0.01).at(-1);
    expect(one.value).toBeCloseTo(many?.value ?? 0, 6);
  });

  it('ignores non-finite targets and negative frame times', () => {
    const d = { value: 10, velocity: 0 };
    expect(stepDamped(d, Number.NaN, 0.1)).toEqual(d);
    expect(stepDamped(d, 20, -1).value).toBe(10);
  });

  it('reports settled only near the target and at rest', () => {
    expect(isSettled({ value: 700, velocity: 0 }, 700, 1600)).toBe(true);
    expect(isSettled({ value: 690, velocity: 0 }, 700, 1600)).toBe(false);
    expect(isSettled({ value: 700, velocity: 50 }, 700, 1600)).toBe(false);
  });
});
