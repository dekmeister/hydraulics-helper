import { expect, gotoApp, test } from '../fixtures';

test('app opens on the scenario menu; free play shows both panels', async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByRole('heading', { name: 'Scenarios', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Free play', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Scene' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Pump panel' })).toBeVisible();
});

test('sim time moves only through __pumpops.step()', async ({ page }) => {
  await gotoApp(page);
  // The menu pauses the sim: play from the panels.
  await page.getByRole('button', { name: 'Free play', exact: true }).click();
  // Let several animation frames pass: the real-time loop is off in the e2e build.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const idle = await page.evaluate(() => window.__pumpops?.getState().timeS);
  expect(idle).toBe(0);

  const stepped = await page.evaluate(() => {
    window.__pumpops?.step(10);
    return window.__pumpops?.getState().timeS;
  });
  expect(stepped).toBeCloseTo(1.0, 9);
});

test('the browser error guard fails a test that logs console.error', async ({ page }) => {
  test.fail(); // an unknown fixture logs an error; the guard must turn that into a failure
  await gotoApp(page, '?fixture=does-not-exist');
});
