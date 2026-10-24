// Keyboard pass (docs/TESTING.md layout invariant 5): Tab visits every enabled control; arrow
// keys change a focused slider. Runs on desktop, the keyboard project.
import { APPLIANCES } from '../../src/sim/appliances/catalogue';
import { expect, gotoApp, test } from '../fixtures';
import { getState, layoutFor, layoutItems, sliderValue } from '../panel';

for (const spec of APPLIANCES) {
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
        case 'delivery':
          return laid.has(i.control) ? [i.label] : []; // NO LINE valves are disabled
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
}
