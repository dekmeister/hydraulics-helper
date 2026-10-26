import { expect, type Page } from '@playwright/test';
import type {} from '../src/testing/types'; // window.__pumpops typing
import type { PanelLayout } from '../src/ui/appliances/types';

/** Minimum touch target edge in CSS px (CLAUDE.md mobile floor; Design token touch.min). */
export const TOUCH_MIN_PX = 44;

interface Box {
  name: string;
  /** Inside the lesson dock, which is fixed over the page (the page reserves its height). */
  docked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

const INTERACTIVE =
  'button, a[href], input, select, textarea, [role="button"], [role="slider"], [role="switch"], [role="link"]';

/** Visible interactive elements with their accessible-ish names and bounding boxes. */
export async function interactiveBoxes(page: Page): Promise<Box[]> {
  return page.evaluate((selector) => {
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const name =
          el.getAttribute('aria-label') ?? (el.textContent.trim() || el.tagName.toLowerCase());
        const docked = el.closest('[data-dock]') !== null;
        return { name, docked, x: r.x, y: r.y, width: r.width, height: r.height };
      })
      .filter((b) => b.width > 0 && b.height > 0);
  }, INTERACTIVE);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'page must not scroll horizontally').toBeLessThanOrEqual(innerWidth);
}

export async function expectTouchTargets(page: Page): Promise<void> {
  const small = (await interactiveBoxes(page)).filter(
    (b) => b.width < TOUCH_MIN_PX || b.height < TOUCH_MIN_PX,
  );
  expect(small, `interactive elements under ${String(TOUCH_MIN_PX)} px`).toEqual([]);
}

export async function expectNoOverlaps(page: Page): Promise<void> {
  const boxes = await interactiveBoxes(page);
  const overlaps: string[] = [];
  boxes.forEach((a, i) => {
    boxes.slice(i + 1).forEach((b) => {
      // The dock floats over the page; expectDockReserved checks the page can scroll clear of it.
      if (a.docked !== b.docked) return;
      const intersects =
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      if (intersects) overlaps.push(`${a.name} ∩ ${b.name}`);
    });
  });
  expect(overlaps, 'overlapping interactive elements').toEqual([]);
}

/**
 * Invariant 4: every control and instrument the layout places for the spec is rendered exactly
 * once, by role and accessible name, and can be scrolled into view.
 */
export async function expectSpecRenderedOnce(page: Page, layout: PanelLayout): Promise<void> {
  const expected = layout.sections
    .flatMap((s) => s.items)
    .flatMap((i): { role: 'meter' | 'slider' | 'switch' | 'status'; name: string }[] => {
      switch (i.kind) {
        case 'gauge':
        case 'tank-level':
          return [{ role: 'meter', name: i.label }];
        case 'valve':
        case 'delivery':
        case 'throttle':
          return [{ role: 'slider', name: i.label }];
        case 'primer':
        case 'engine-switch':
          return [{ role: 'switch', name: i.label }];
        case 'engine-status':
          return [{ role: 'status', name: 'Engine' }];
        case 'warnings':
          return [];
      }
    });
  for (const { role, name } of expected) {
    const found = page.getByRole(role, { name, exact: true });
    await expect(found, `${role} "${name}"`).toHaveCount(1);
    // A live region may be visually hidden (the realistic panel's engine status): read, not seen.
    if (role === 'status') continue;
    await found.scrollIntoViewIfNeeded();
    await expect(found, `${role} "${name}" reachable`).toBeInViewport();
  }
  // The warning strip's live region, and the engine's.
  await expect(page.getByRole('status')).toHaveCount(2);
}

/**
 * Scene invariant: one legend button per spec delivery of the active truck, by the name the layout
 * gives it, each reachable; one hose lay per laid line, on its own truck; one relay hose per relay.
 */
export async function expectSceneRenderedOnce(page: Page, layout: PanelLayout): Promise<void> {
  const state = await page.evaluate(() => window.__pumpops?.getState());
  if (state === undefined) throw new Error('__pumpops missing');
  const deliveries = layout.sections
    .flatMap((s) => s.items)
    .flatMap((i) => (i.kind === 'delivery' ? [i] : []));
  for (const d of deliveries) {
    const row = page.getByRole('button', { name: `Show ${d.label} on panel`, exact: true });
    await expect(row, `legend row for ${d.label}`).toHaveCount(1);
    await row.scrollIntoViewIfNeeded();
    await expect(row, `legend row for ${d.label} reachable`).toBeInViewport();
  }
  // Delivery ids repeat between trucks, so hose lays are counted within the active truck's groups.
  const active = page.locator('[data-truck-active="true"]');
  const laid = state.lines.filter((l) => l.truckId === state.activeTruckId);
  for (const line of laid) {
    await expect(active.getByTestId(`hose-lay-${line.deliveryId}`)).toHaveCount(1);
  }
  await expect(active.locator('[data-testid^="hose-lay-"]')).toHaveCount(laid.length);
  await expect(page.locator('[data-testid^="hose-lay-"]')).toHaveCount(state.lines.length);
  for (const link of state.links) {
    await expect(page.getByTestId(`relay-lay-${link.id}`)).toHaveCount(1);
  }
}

/**
 * With the lesson dock up, the page reserves at least its height at the foot, so every control can
 * be scrolled clear of it; and nothing scrolls horizontally inside it.
 */
export async function expectDockReserved(page: Page): Promise<void> {
  const dock = page.locator('[data-dock]');
  if ((await dock.count()) === 0) return;
  const { dockH, reserved } = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-dock]');
    const play = document.querySelector<HTMLElement>('.app-play--lesson');
    return {
      dockH: el?.offsetHeight ?? 0,
      reserved: play === null ? 0 : parseFloat(getComputedStyle(play).paddingBottom),
    };
  });
  expect(reserved, 'page reserves the dock height').toBeGreaterThanOrEqual(dockH - 1);
}
