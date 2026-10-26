// Helpers for lesson journeys (M6): start from the menu, read the lesson, and play like a player:
// closed-loop on what the branches and gauges show, but only ever through the real controls.
import type { Locator, Page } from '@playwright/test';
import { BRANCH_BAND_FRACTION, BRANCH_OPTIMUM_KPA } from '../src/sim/constants';
import type { LessonProgress } from '../src/sim/lesson/progress';
import type { SimState } from '../src/sim/types';
import { expect } from './fixtures';
import {
  activeTruckOf,
  dragThrottle,
  dragValve,
  getState,
  stepAndSettle,
  stopEngine,
} from './panel';

export async function getLesson(page: Page): Promise<LessonProgress> {
  const p = await page.evaluate(() => window.__pumpops?.getLesson());
  if (p === null || p === undefined) throw new Error('no lesson in play');
  return p;
}

export const objectiveDone = (p: LessonProgress, id: string) =>
  p.objectives[id]?.doneAtS !== undefined;

/** The ladder card's start button on the menu, e.g. 'Start 1. First line: …'. */
export function startButton(page: Page, n: number) {
  return page.getByRole('button', { name: new RegExp(`^Start ${String(n)}\\. `) });
}

export function branchKpa(state: SimState, line: string): number {
  const lay = state.lines.find((l) => l.id === line);
  const truck = state.trucks.find((t) => t.id === lay?.truckId);
  return truck?.readings.branchKpa[line] ?? 0;
}

export function lineFlow(state: SimState, line: string): number {
  const lay = state.lines.find((l) => l.id === line);
  return lay === undefined
    ? 0
    : (activeTruckOf(state).readings.deliveryFlowLpm[lay.deliveryId] ?? 0);
}

/** A branch's Table 1 target and band, as the lesson judges it. */
export function band(state: SimState, line: string) {
  const tip = state.lines.find((l) => l.id === line)?.branch.tipMm ?? 0;
  const target = BRANCH_OPTIMUM_KPA[tip] ?? 0;
  return {
    target,
    min: target * (1 - BRANCH_BAND_FRACTION),
    max: target * (1 + BRANCH_BAND_FRACTION),
  };
}

/** Press the throttle's − or + vernier `n` times (Design sheet 03: 25 rpm a press). */
export async function nudgeThrottle(page: Page, n: number): Promise<void> {
  const button = page.getByRole('button', { name: n > 0 ? 'Throttle up' : 'Throttle down' });
  for (let i = 0; i < Math.abs(n); i++) await button.click();
}

/** Presses that move a reading `error` (in its own units) at `perPress`, capped. */
export const presses = (error: number, perPress: number, cap = 6) =>
  Math.sign(error) * Math.min(cap, Math.max(1, Math.round(Math.abs(error) / perPress)));

/**
 * Play on, a second at a time, letting `adjust` look at the fireground and work the controls,
 * until the lesson shows `done`. Fails after `maxS` seconds.
 */
export async function playUntil(
  page: Page,
  done: (p: LessonProgress) => boolean,
  adjust: (state: SimState) => Promise<void>,
  maxS = 120,
): Promise<void> {
  for (let s = 0; s < maxS; s++) {
    if (done(await getLesson(page))) return;
    await adjust(await getState(page));
    await stepAndSettle(page, 10);
  }
  expect(done(await getLesson(page)), `lesson goal reached within ${String(maxS)} s`).toBe(true);
}

/** Trim the throttle towards a branch's target pressure (the hardest line sets the pump). */
export async function trimBranch(page: Page, state: SimState, line: string): Promise<void> {
  const { target, min, max } = band(state, line);
  const kpa = branchKpa(state, line);
  const inner = (max - min) / 4;
  if (Math.abs(kpa - target) > inner) await nudgeThrottle(page, presses(target - kpa, 12));
}

/** Gate a delivery back while its branch runs over its band. */
export async function gateBranch(
  page: Page,
  state: SimState,
  line: string,
  valveName: string,
): Promise<void> {
  const { target, max } = band(state, line);
  const kpa = branchKpa(state, line);
  if (kpa <= max - (max - target) / 2) return;
  const valve = page.getByRole('slider', { name: valveName, exact: true });
  const open = Number(await valve.getAttribute('aria-valuenow')) / 100;
  await fineDragValve(page, valve, Math.max(0.1, open - 0.4 * ((kpa - target) / target) - 0.03));
}

/**
 * Move a lever valve a little: a drag must travel past its threshold before the lever follows, so
 * a thumb overshoots and comes back within one gesture. Same pivot geometry as `dragValve`.
 */
export async function fineDragValve(page: Page, valve: Locator, opening: number): Promise<void> {
  await valve.scrollIntoViewIfNeeded();
  const box = await valve.locator('[data-part="pivot"]').boundingBox();
  if (box === null) throw new Error('valve not rendered');
  const pivot = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const r = 50;
  const at = (f: number) => {
    const a = (f * Math.PI) / 2; // clockwise from 12 o'clock
    return { x: pivot.x + r * Math.sin(a), y: pivot.y - r * Math.cos(a) };
  };
  const from = Number(await valve.getAttribute('aria-valuenow')) / 100;
  const away = opening < from ? Math.max(0, opening - 0.15) : Math.min(1, opening + 0.15);
  await page.mouse.move(at(from).x, at(from).y);
  await page.mouse.down();
  for (const f of [away, (away + opening) / 2, opening])
    await page.mouse.move(at(f).x, at(f).y, { steps: 4 });
  await page.mouse.up();
}

/**
 * A lesson's shutdown objective, as a player would do it: throttle to idle, ease each line's valve
 * shut in steps, then hold STOP until the engine has stopped and switch the ignition off.
 */
export async function shutDownLesson(page: Page, valves: readonly Locator[]): Promise<void> {
  await dragThrottle(page, 0);
  await stepAndSettle(page, 30);
  for (const valve of valves) {
    for (const open of [0.5, 0.2, 0]) {
      await dragValve(page, valve, open);
      await stepAndSettle(page, 10);
    }
  }
  await stopEngine(page);
  await stepAndSettle(page, 1);
}
