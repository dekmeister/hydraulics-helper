// Helpers for the scene panel (docs/TESTING.md §3.3: hose lays by data-testid, keyed by spec id).
import type { Locator, Page, TestInfo } from '@playwright/test';
import { deliveryIdentities } from '../src/ui/appliances/identity';
import { layoutFor } from './panel';

export function hoseLay(page: Page, deliveryId: string): Locator {
  return page.getByTestId(`hose-lay-${deliveryId}`);
}

export function spray(page: Page, deliveryId: string): Locator {
  return page.getByTestId(`spray-${deliveryId}`);
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
