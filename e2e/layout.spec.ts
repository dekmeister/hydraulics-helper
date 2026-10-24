import type { Page } from '@playwright/test';
import { FIXTURES } from '../src/testing/fixtures/catalog';
import { SIDE_BY_SIDE_MIN_PX } from '../src/ui/layout/breakpoints';
import { expect, gotoApp, test } from './fixtures';
import {
  expectNoHorizontalScroll,
  expectNoOverlaps,
  expectSpecRenderedOnce,
  expectTouchTargets,
} from './invariants';
import { layoutFor } from './panel';

async function panelBoxes(page: Page) {
  const scene = await page.getByRole('region', { name: 'Scene' }).boundingBox();
  const pump = await page.getByRole('region', { name: 'Pump panel' }).boundingBox();
  if (!scene || !pump) throw new Error('Scene or Pump panel region not rendered');
  return { scene, pump };
}

async function expectArrangement(page: Page, width: number) {
  const { scene, pump } = await panelBoxes(page);
  if (width >= SIDE_BY_SIDE_MIN_PX) {
    expect(scene.x + scene.width, 'scene left of pump panel').toBeLessThanOrEqual(pump.x);
    expect(Math.abs(scene.y - pump.y), 'panels top-aligned').toBeLessThan(1);
  } else {
    expect(scene.y + scene.height, 'scene above pump panel').toBeLessThanOrEqual(pump.y);
    expect(Math.abs(scene.x - pump.x), 'panels left-aligned').toBeLessThan(1);
  }
}

test.describe('app shell layout invariants', () => {
  test('mobile floor and panel arrangement', async ({ page }) => {
    await gotoApp(page);
    const width = page.viewportSize()?.width ?? 0;
    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page);
    await expectNoOverlaps(page);
    await expectArrangement(page, width);
  });

  test('switches arrangement exactly at the breakpoint', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'viewport-independent; run once');
    for (const width of [SIDE_BY_SIDE_MIN_PX - 1, SIDE_BY_SIDE_MIN_PX]) {
      await page.setViewportSize({ width, height: 800 });
      await gotoApp(page);
      await expectNoHorizontalScroll(page);
      await expectArrangement(page, width);
    }
  });
});

// Every generated panel fixture, at every viewport (docs/TESTING.md §4 layout invariants).
test.describe('pump panel layout invariants', () => {
  for (const fixture of FIXTURES.filter((f) => f.applianceId !== undefined)) {
    test(fixture.id, async ({ page }) => {
      await gotoApp(page, `?fixture=${encodeURIComponent(fixture.id)}`);
      await expectNoHorizontalScroll(page);
      await expectTouchTargets(page);
      await expectNoOverlaps(page);
      await expectSpecRenderedOnce(page, layoutFor(fixture.applianceId ?? ''));
    });
  }
});
