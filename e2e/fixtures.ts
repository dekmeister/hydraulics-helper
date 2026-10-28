import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import type {} from '../src/testing/types'; // window.__pumpops typing

/** Every test fails on console.error, uncaught page errors or failed requests (docs/TESTING.md §4). */
export const test = base.extend<{ browserErrorGuard: undefined }>({
  browserErrorGuard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
      });
      page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
      page.on('requestfailed', (req) =>
        problems.push(`requestfailed: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`),
      );
      await use(undefined);
      expect(problems, 'browser reported errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Open the e2e build (optionally with a query such as '?fixture=shell/empty') and wait until it's
 * stable. A new player gets the realistic panel; the journeys and baselines were written against the
 * simplified one, so they start with that saved, unless `freshPlayer` asks for the true default.
 */
export async function gotoApp(page: Page, query = '', freshPlayer = false): Promise<void> {
  if (!freshPlayer) {
    await page.addInitScript(() => {
      // Only when nothing is saved, so a reload keeps whatever view the test then chose.
      if (localStorage.getItem('pumpops:v1') === null)
        localStorage.setItem(
          'pumpops:v1',
          JSON.stringify({
            version: 1,
            settings: { sound: true, panelView: 'simplified' },
            results: {},
          }),
        );
    });
  }
  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__pumpops !== undefined);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/** Every rendered instrument as 'Name value', joined with ' · ' (for the review report). */
export async function meterReadings(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="meter"]')]
      .map(
        (m) => `${m.getAttribute('aria-label') ?? '?'} ${m.getAttribute('aria-valuetext') ?? ''}`,
      )
      .join(' · '),
  );
}

/** Attach the ARIA snapshot, instrument readings and sim state, for triage and the review bundle. */
export async function attachDiagnostics(page: Page, testInfo: TestInfo): Promise<void> {
  await testInfo.attach('meters', { body: await meterReadings(page), contentType: 'text/plain' });
  const aria = await page.locator('body').ariaSnapshot();
  await testInfo.attach('aria', { body: aria, contentType: 'text/plain' });
  const state = await page.evaluate(() => window.__pumpops?.getState());
  await testInfo.attach('state', {
    body: JSON.stringify(state ?? null),
    contentType: 'application/json',
  });
}
