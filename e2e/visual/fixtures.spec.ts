import { FIXTURES, fixtureFileName, type ViewportName } from '../../src/testing/fixtures/catalog';
import { attachDiagnostics, expect, gotoApp, test } from '../fixtures';

// One screenshot per fixture × viewport: adding a fixture adds a screenshot (docs/TESTING.md §3.2).
for (const fixture of FIXTURES) {
  test(fixture.id, async ({ page }, testInfo) => {
    const project = testInfo.project.name as ViewportName;
    test.skip(fixture.viewports !== undefined && !fixture.viewports.includes(project));
    testInfo.annotations.push(
      { type: 'fixture', description: fixture.id },
      { type: 'expect', description: fixture.expect },
    );

    await gotoApp(page, `?fixture=${encodeURIComponent(fixture.id)}`);
    const fullPage = fixture.capture !== 'viewport';
    await page.evaluate((top) => {
      window.__pumpops?.settle();
      // Full-page shots read from the top; a viewport shot keeps the scroll the app chose. The
      // coach scrolled its target into view on first render, before layout had settled (a few px
      // either way run to run), so centre it again now, as CoachAnchor does.
      if (top) window.scrollTo(0, 0);
      else document.querySelector('[data-coach-target] > *')?.scrollIntoView({ block: 'center' });
    }, fullPage);
    const shot = await page.screenshot({ fullPage, animations: 'disabled', caret: 'hide' });
    await testInfo.attach('shot', { body: shot, contentType: 'image/png' });
    await attachDiagnostics(page, testInfo);

    await expect(page).toHaveScreenshot(`${fixtureFileName(fixture.id)}.png`, { fullPage });
  });
}
