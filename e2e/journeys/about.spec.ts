import { expect, gotoApp, test } from '../fixtures';

test('About opens from the app bar and goes back where it came from', async ({ page }) => {
  await gotoApp(page);
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'About PumpOps', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /hydraulics-helper/ })).toHaveAttribute(
    'href',
    'https://github.com/dekmeister/hydraulics-helper',
  );
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Scenarios', level: 1 })).toBeVisible();

  // From the panels: About pauses the sim and Back returns to them.
  await page.getByRole('button', { name: 'Free play', exact: true }).click();
  await page.getByRole('button', { name: 'About', exact: true }).click();
  const timeS = await page.evaluate(() => {
    window.__pumpops?.step(10);
    return window.__pumpops?.getState().timeS;
  });
  expect(timeS).toBe(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pump panel' })).toBeVisible();
});
