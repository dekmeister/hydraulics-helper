// Helpers for driving the pump panel through its real controls (docs/TESTING.md §3–4).
import type { Locator, Page, TestInfo } from '@playwright/test';
import { APPLIANCES } from '../src/sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../src/sim/appliances/testAppliance';
import type { ApplianceSpec, SimState, TruckState } from '../src/sim/types';
import { CATALOGUE_LAYOUTS } from '../src/ui/appliances/registry';
import type { PanelItem, PanelLayout } from '../src/ui/appliances/types';
import { TEST_APPLIANCE_LAYOUT } from '../src/testing/appliances/testApplianceLayout';
import { expect } from './fixtures';

export const ALL_LAYOUTS: readonly PanelLayout[] = [...CATALOGUE_LAYOUTS, TEST_APPLIANCE_LAYOUT];

/** Appliances the journeys run on: the catalogue plus the test-only one, whose panel differs. */
export const JOURNEY_APPLIANCES: readonly ApplianceSpec[] = [...APPLIANCES, TEST_APPLIANCE];

export function layoutFor(applianceId: string): PanelLayout {
  const layout = ALL_LAYOUTS.find((l) => l.applianceId === applianceId);
  if (layout === undefined) throw new Error(`no layout for ${applianceId}`);
  return layout;
}

export function layoutItems(layout: PanelLayout): PanelItem[] {
  return layout.sections.flatMap((s) => s.items);
}

/** Accessible name of the control placed for a spec control id. */
export function controlName(layout: PanelLayout, controlId: string): string {
  const item = layoutItems(layout).find(
    (i) =>
      (i.kind === 'valve' ||
        i.kind === 'delivery' ||
        i.kind === 'primer' ||
        i.kind === 'engine-switch') &&
      i.control === controlId,
  );
  if (item === undefined || !('label' in item)) throw new Error(`${controlId} not placed`);
  return item.label;
}

/** Accessible name of the gauge placed for the instrument of `kind`. */
export function instrumentName(state: SimState, layout: PanelLayout, kind: string): string {
  const truck = activeTruckOf(state);
  const id = truck.spec.instruments.find((i) => i.kind === kind)?.id;
  const item = layoutItems(layout).find(
    (i) => (i.kind === 'gauge' || i.kind === 'tank-level') && i.instrument === id,
  );
  if (item === undefined || !('label' in item)) throw new Error(`no ${kind} instrument placed`);
  return item.label;
}

export function activeTruckOf(state: SimState): TruckState {
  const t = state.trucks.find((x) => x.id === state.activeTruckId);
  if (t === undefined) throw new Error('no active truck');
  return t;
}

export async function getState(page: Page): Promise<SimState> {
  const s = await page.evaluate(() => window.__pumpops?.getState());
  if (s === undefined) throw new Error('__pumpops missing');
  return s;
}

/** Advance sim time and snap the needles, so meters show the new readings. */
export async function stepAndSettle(page: Page, ticks: number): Promise<void> {
  await page.evaluate((n) => {
    window.__pumpops?.step(n);
    window.__pumpops?.settle();
  }, ticks);
}

export async function meterValue(page: Page, name: string): Promise<number> {
  const v = await page.getByRole('meter', { name, exact: true }).getAttribute('aria-valuenow');
  return Number(v);
}

export async function sliderValue(locator: Locator): Promise<number> {
  return Number(await locator.getAttribute('aria-valuenow')) / 100;
}

/** A tap on touch projects, a click with the mouse elsewhere. */
export async function tapOrClick(locator: Locator, testInfo: TestInfo): Promise<void> {
  if (testInfo.project.use.hasTouch === true) await locator.tap();
  else await locator.click();
}

async function centre(locator: Locator): Promise<{ x: number; y: number; width: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('element not rendered');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width };
}

/**
 * Drag a lever valve to `opening` (0–1): press beside the lever at its current angle, then sweep
 * around the pivot to the target angle, as a thumb would.
 */
export async function dragValve(page: Page, valve: Locator, opening: number): Promise<void> {
  await valve.scrollIntoViewIfNeeded();
  const pivot = await centre(valve.locator('[data-part="pivot"]'));
  // Realistic bay levers say which way they swing; the simplified panel's go 12 → 3 o'clock.
  const shutDeg = Number((await valve.getAttribute('data-shut-deg')) ?? 0);
  const openDeg = Number((await valve.getAttribute('data-open-deg')) ?? 90);
  // Stay on the lever's own hit box: small bay levers on a phone are under 50 px.
  const own = await valve.boundingBox();
  const r = Math.min(50, 0.75 * Math.min(own?.width ?? 50, own?.height ?? 50));
  const at = (f: number) => {
    const a = ((shutDeg + f * (openDeg - shutDeg)) * Math.PI) / 180; // clockwise from 12 o'clock
    return { x: pivot.x + r * Math.sin(a), y: pivot.y - r * Math.cos(a) };
  };
  const from = await sliderValue(valve);
  const start = at(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const p = at(from + ((opening - from) * i) / steps);
    await page.mouse.move(p.x, p.y);
  }
  await page.mouse.up();
}

/** Drag the throttle handle to `position` (0–1) along its track. */
export async function dragThrottle(page: Page, position: number): Promise<void> {
  const slider = page.getByRole('slider', { name: 'Throttle', exact: true });
  await slider.scrollIntoViewIfNeeded();
  const handle = await centre(slider.locator('[data-part="handle"]'));
  const track = await centre(slider.locator('[data-part="track"]'));
  const from = await sliderValue(slider);
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x + (position - from) * track.width, handle.y, { steps: 10 });
  await page.mouse.up();
}

/** The warning strip's live message (the panel's other status is the engine's). */
export function warningsStatus(page: Page): Locator {
  return page.locator('[role="status"]:not([aria-label="Engine"])');
}

export async function expectStatus(page: Page, text: string | RegExp): Promise<void> {
  await expect(warningsStatus(page)).toContainText(text);
}

/** Switch the pump panel to the truck's realistic bay. */
export async function showRealistic(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Realistic', exact: true }).click();
  await expect(page.locator('.pump-panel')).toHaveAttribute('data-view', 'realistic');
}

/** The active truck's engine switch for `role`, by its accessible name on the panel showing. */
export async function engineSwitch(
  page: Page,
  role: 'ignition' | 'start' | 'stop',
): Promise<Locator> {
  const { spec } = activeTruckOf(await getState(page));
  const { ignition, start, stop } = spec.engine.controls;
  const id = role === 'ignition' ? ignition : role === 'start' ? start : stop.id;
  return page.getByRole('switch', { name: controlName(layoutFor(spec.id), id), exact: true });
}

/** Hold a START or STOP switch down (Space held on it) for `ticks` of sim time, then let go. */
export async function holdEngineSwitch(
  page: Page,
  role: 'start' | 'stop',
  ticks: number,
): Promise<void> {
  const sw = await engineSwitch(page, role);
  await sw.focus();
  await page.keyboard.down(' ');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await stepAndSettle(page, ticks);
  await page.keyboard.up(' ');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
}

/** Turn the ignition on or off with a tap, if it isn't already. */
export async function setIgnition(page: Page, on: boolean): Promise<void> {
  const ign = await engineSwitch(page, 'ignition');
  if ((await ign.getAttribute('aria-checked')) !== String(on)) await ign.click();
  await expect(ign).toHaveAttribute('aria-checked', String(on));
}

/** Start the active truck from cold through its panel: ignition on, hold START until it fires. */
export async function startEngine(page: Page): Promise<void> {
  const { spec } = activeTruckOf(await getState(page));
  await setIgnition(page, true);
  await holdEngineSwitch(page, 'start', Math.ceil(spec.engine.crankS * 10) + 2);
  expect(activeTruckOf(await getState(page)).engine.running).toBe(true);
}

/** Stop the active truck: hold STOP until it has run down, then the ignition off. */
export async function stopEngine(page: Page): Promise<void> {
  await holdEngineSwitch(page, 'stop', 40);
  expect(activeTruckOf(await getState(page)).engine.running).toBe(false);
  await setIgnition(page, false);
}
