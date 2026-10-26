// Helpers for the scene panel (docs/TESTING.md §3.3: hose lays by data-testid, keyed by spec id).
import type { Locator, Page, TestInfo } from '@playwright/test';
import { deliveryIdentities } from '../src/ui/appliances/identity';
import { expect } from './fixtures';
import { layoutFor, stepAndSettle } from './panel';

/** The scene groups of the truck being operated: delivery ids repeat between trucks. */
export function activeTruckOnScene(page: Page): Locator {
  return page.locator('[data-truck-active="true"]');
}

export function hoseLay(page: Page, deliveryId: string): Locator {
  return activeTruckOnScene(page).getByTestId(`hose-lay-${deliveryId}`);
}

/** Step the sim until the hose on `deliveryId` has charged (water at its branch). */
export async function stepUntilCharged(page: Page, deliveryId: string, maxTicks = 1500) {
  const hose = hoseLay(page, deliveryId);
  for (let t = 0; t < maxTicks; t += 50) {
    if ((await hose.getAttribute('data-state')) === 'charged') return;
    await stepAndSettle(page, 50);
  }
  await expect(hose).toHaveAttribute('data-state', 'charged');
}

export function spray(page: Page, deliveryId: string): Locator {
  return activeTruckOnScene(page).getByTestId(`spray-${deliveryId}`);
}

export function relayLay(page: Page, linkId: string): Locator {
  return page.getByTestId(`relay-lay-${linkId}`);
}

/**
 * Tap a truck the player isn't operating, on the map, as a thumb would: the middle of its body.
 * Mouse elsewhere.
 */
export async function tapTruck(page: Page, truckId: string, testInfo: TestInfo): Promise<void> {
  const target = page.getByTestId(`truck-tap-${truckId}`);
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box === null) throw new Error(`truck ${truckId} not on the map`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (testInfo.project.use.hasTouch === true) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Label of a delivery as the panel and scene name it. */
export function deliveryLabel(applianceId: string, deliveryId: string): string {
  const identity = deliveryIdentities(layoutFor(applianceId)).get(deliveryId);
  if (identity === undefined) throw new Error(`${deliveryId} not placed on ${applianceId}`);
  return identity.label;
}

export function legendButton(page: Page, label: string): Locator {
  return page.getByRole('button', { name: `Show ${label} on panel`, exact: true });
}

export function panelLocateButton(page: Page, label: string): Locator {
  return page.getByRole('button', { name: `Show ${label} on scene`, exact: true });
}

/**
 * Tap the hose itself, as a thumb would: a point 60 % of the way along the drawn path, in screen
 * coordinates (a curved path's bounding-box centre is usually not on the hose).
 */
export async function tapHoseLay(
  page: Page,
  deliveryId: string,
  testInfo: TestInfo,
): Promise<void> {
  const lay = hoseLay(page, deliveryId);
  await lay.scrollIntoViewIfNeeded();
  const point = await lay.locator('[data-part="hit"]').evaluate((el) => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() * 0.6);
    const m = path.getScreenCTM();
    if (m === null) throw new Error('hose not rendered');
    return { x: p.x * m.a + p.y * m.c + m.e, y: p.x * m.b + p.y * m.d + m.f };
  });
  if (testInfo.project.use.hasTouch === true) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}
