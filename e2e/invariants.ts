import { expect, type Page } from '@playwright/test';

/** Minimum touch target edge in CSS px (CLAUDE.md mobile floor; Design token touch.min). */
export const TOUCH_MIN_PX = 44;

interface Box {
  name: string;
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
        return { name, x: r.x, y: r.y, width: r.width, height: r.height };
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
      const intersects =
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      if (intersects) overlaps.push(`${a.name} ∩ ${b.name}`);
    });
  });
  expect(overlaps, 'overlapping interactive elements').toEqual([]);
}
