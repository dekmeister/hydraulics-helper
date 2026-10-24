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
    await page.evaluate(() => {
      window.__pumpops?.settle();
    });
    const shot = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
    await testInfo.attach('shot', { body: shot, contentType: 'image/png' });
    await attachDiagnostics(page, testInfo);

    await expect(page).toHaveScreenshot(`${fixtureFileName(fixture.id)}.png`, { fullPage: true });
  });
}
