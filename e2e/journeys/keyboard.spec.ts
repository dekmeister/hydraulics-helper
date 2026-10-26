// Keyboard pass (docs/TESTING.md layout invariant 5): Tab visits every enabled control; arrow
// keys change a focused slider, on the simplified panel and the realistic bay. Runs on desktop,
// the keyboard project.
import { REALISTIC_APPLIANCES } from '../../src/testing/fixtures/realisticStates';
import { expect, gotoApp, test } from '../fixtures';
import {
  getState,
  JOURNEY_APPLIANCES,
  layoutFor,
  layoutItems,
  showRealistic,
  sliderValue,
  startEngine,
} from '../panel';
import { load, throttle } from '../sources';

for (const spec of JOURNEY_APPLIANCES) {
  test(`keyboard reaches and works every control on ${spec.id}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'keyboard pass runs on desktop');
    await gotoApp(page);
    await page.evaluate((appliance) => {
      window.__pumpops?.load({ scenario: 'tank-attack', appliance });
    }, spec.id);
    await startEngine(page);
    const state = await getState(page);
    const laid = new Set(state.lines.map((l) => l.deliveryId));
    const expected = layoutItems(layoutFor(spec.id)).flatMap((i) => {
      switch (i.kind) {
        case 'valve':
        case 'primer':
        case 'engine-switch':
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
    await startEngine(page);
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

for (const spec of REALISTIC_APPLIANCES) {
  test(`keyboard reaches every control on ${spec.id}'s realistic bay, and arrows move the throttle`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'keyboard pass runs on desktop');
    await load(page, 'tank-attack', spec.id);
    await showRealistic(page);
    const laid = new Set((await getState(page)).lines.map((l) => l.deliveryId));
    const expected = layoutItems(layoutFor(spec.id)).flatMap((i) => {
      switch (i.kind) {
        case 'valve':
        case 'primer':
        case 'throttle':
        case 'engine-switch':
          return [i.label];
        case 'delivery': {
          const locate = [`Show ${i.label} on scene`, `Show ${i.label} on panel`];
          return laid.has(i.control) ? [i.label, ...locate] : locate;
        }
        default:
          return [];
      }
    });
    const visited = new Set<string>();
    for (let i = 0; i < expected.length + 12; i++) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
      if (name) visited.add(name);
    }
    expect([...visited].sort()).toEqual([...expected].sort());

    const sw = throttle(page);
    await sw.focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    const two = await sliderValue(sw);
    expect(two).toBeGreaterThan(0);
    await page.keyboard.press('ArrowDown');
    expect(await sliderValue(sw)).toBeLessThan(two);
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
  await startEngine(page);
  const onBase = async () =>
    page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.truck === 'base');
  for (let i = 0; i < 60 && !(await onBase()); i++) await page.keyboard.press('Tab');
  expect(await onBase()).toBe(true);
  await page.keyboard.press('Enter');
  expect((await getState(page)).activeTruckId).toBe('base');
  await expect(page.getByRole('button', { name: /^Base pump/, pressed: true })).toBeVisible();
});

test('keyboard starts a lesson from the menu and works the coach', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'keyboard pass runs on desktop');
  await gotoApp(page);
  const focusedName = () =>
    page.evaluate(
      () =>
        document.activeElement?.getAttribute('aria-label') ??
        document.activeElement?.textContent.trim() ??
        '',
    );
  const tabTo = async (name: RegExp) => {
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      if (name.test(await focusedName())) return;
    }
    throw new Error(`Tab never reached ${String(name)}`);
  };
  await tabTo(/^Start 1\. /);
  await page.keyboard.press('Enter');
  const dock = page.getByRole('region', { name: 'Lesson' });
  await expect(dock).toContainText('Step 1 of 12');
  await tabTo(/^Got it$/);
  await page.keyboard.press('Enter');
  await expect(dock).toContainText('Step 2 of 12');
});
