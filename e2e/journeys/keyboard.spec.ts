// Keyboard pass (docs/TESTING.md layout invariant 5): Tab visits every enabled control; arrow
// keys change a focused slider. Runs on desktop, the keyboard project.
import { expect, gotoApp, test } from '../fixtures';
import { getState, JOURNEY_APPLIANCES, layoutFor, layoutItems, sliderValue } from '../panel';

for (const spec of JOURNEY_APPLIANCES) {
  test(`keyboard reaches and works every control on ${spec.id}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'keyboard pass runs on desktop');
    await gotoApp(page);
    await page.evaluate((appliance) => {
      window.__pumpops?.load({ scenario: 'tank-attack', appliance });
    }, spec.id);
    const state = await getState(page);
    const laid = new Set(state.lines.map((l) => l.deliveryId));
    const expected = layoutItems(layoutFor(spec.id)).flatMap((i) => {
      switch (i.kind) {
        case 'valve':
        case 'primer':
          return [i.label];
        case 'delivery': {
          // Every delivery can be found on the scene and back; NO LINE valves are disabled.
          const locate = [`Show ${i.label} on scene`, `Show ${i.label} on panel`];
          return laid.has(i.control) ? [i.label, ...locate] : locate;
        }
        case 'throttle':
          return [i.label, `${i.label} down`, `${i.label} up`];
        default:
          return [];
      }
    });

    const visited = new Set<string>();
    for (let i = 0; i < expected.length + 10; i++) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
      if (name) visited.add(name);
    }
    expect([...visited].sort()).toEqual([...expected].sort());

    const throttle = page.getByRole('slider', { name: 'Throttle', exact: true });
    await throttle.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await sliderValue(throttle)).toBeCloseTo(0.2, 9);
    await page.keyboard.press('End');
    expect(await sliderValue(throttle)).toBe(1);
    await page.keyboard.press('Home');
    expect(await sliderValue(throttle)).toBe(0);
  });

  test(`keyboard and assistive tech work the valves and primer on ${spec.id}`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'keyboard pass runs on desktop');
    await gotoApp(page);
    await page.evaluate((appliance) => {
      window.__pumpops?.load({ scenario: 'tank-attack', appliance });
    }, spec.id);
    const laid = new Set((await getState(page)).lines.map((l) => l.deliveryId));
    const items = layoutItems(layoutFor(spec.id));

    for (const item of items) {
      if (item.kind !== 'valve' && item.kind !== 'delivery') continue;
      if (item.kind === 'delivery' && !laid.has(item.control)) continue;
      const valve = page.getByRole('slider', { name: item.label, exact: true });
      await valve.focus();
      await page.keyboard.press('ArrowUp');
      expect(await sliderValue(valve)).toBeCloseTo(0.1, 9);
      await page.keyboard.press('End');
      expect(await sliderValue(valve)).toBe(1);
      await page.keyboard.press('Enter');
      // Enter snaps a tap-to-toggle valve shut; a drag-only valve ignores it.
      expect(await sliderValue(valve)).toBe(item.tap === 'toggle' ? 0 : 1);
      await page.keyboard.press('Home');
      expect(await sliderValue(valve)).toBe(0);
    }

    for (const item of items) {
      if (item.kind !== 'primer') continue;
      const primer = page.getByRole('switch', { name: item.label, exact: true });
      await primer.focus();
      await page.keyboard.down(' ');
      await expect(primer).toHaveAttribute('aria-checked', 'true');
      await page.keyboard.up(' ');
      await expect(primer).toHaveAttribute('aria-checked', 'false');
      // A screen reader's activate is a click with no press or release (detail 0): it latches.
      await primer.dispatchEvent('click');
      await expect(primer).toHaveAttribute('aria-checked', 'true');
      await primer.dispatchEvent('click');
      await expect(primer).toHaveAttribute('aria-checked', 'false');
    }
  });
}

test('keyboard reaches the truck switcher and changes trucks with Enter', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'keyboard pass runs on desktop');
  await gotoApp(page);
  await page.evaluate(() => {
    window.__pumpops?.load({ scenario: 'closed-relay' });
  });
  const onBase = async () =>
    page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.truck === 'base');
  for (let i = 0; i < 60 && !(await onBase()); i++) await page.keyboard.press('Tab');
  expect(await onBase()).toBe(true);
  await page.keyboard.press('Enter');
  expect((await getState(page)).activeTruckId).toBe('base');
  await expect(page.getByRole('button', { name: /^Base pump/, pressed: true })).toBeVisible();
});
