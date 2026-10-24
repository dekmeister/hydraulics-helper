// Scene journeys (PLAN M3): the scene reacts to what the player does on the panel, and the scene
// and panel point at each other. Driven through the real controls, on every journey appliance.
import { expect, gotoApp, test } from '../fixtures';
import {
  controlName,
  dragThrottle,
  dragValve,
  getState,
  JOURNEY_APPLIANCES,
  layoutFor,
  stepAndSettle,
} from '../panel';
import {
  deliveryLabel,
  hoseLay,
  legendButton,
  panelLocateButton,
  spray,
  tapHoseLay,
} from '../scene';

for (const spec of JOURNEY_APPLIANCES) {
  test.describe(`scene on ${spec.id}`, () => {
    test.beforeEach(async ({ page }) => {
      await gotoApp(page);
      await page.evaluate((appliance) => {
        window.__pumpops?.load({ scenario: 'tank-attack', appliance });
      }, spec.id);
    });

    test('turn off a delivery and its branch stops spraying; the other keeps going', async ({
      page,
    }) => {
      const layout = layoutFor(spec.id);
      const [first, second] = (await getState(page)).lines;
      const tankInlet = spec.inlets.find((i) => i.kind === 'tank');
      if (first === undefined || second === undefined || tankInlet === undefined)
        throw new Error('tank attack needs two lines and a tank inlet');
      const valve = (id: string) => page.getByRole('slider', { name: controlName(layout, id) });

      for (const line of [first, second]) {
        await expect(hoseLay(page, line.deliveryId)).toHaveAttribute('data-state', 'dry');
        await expect(spray(page, line.deliveryId)).toHaveCount(0);
      }

      await dragValve(page, valve(tankInlet.id), 1);
      await dragValve(page, valve(first.deliveryId), 1);
      await dragValve(page, valve(second.deliveryId), 1);
      await dragThrottle(page, 0.6);
      await stepAndSettle(page, 100);
      for (const line of [first, second]) {
        await expect(hoseLay(page, line.deliveryId)).toHaveAttribute('data-state', 'charged');
        await expect(spray(page, line.deliveryId)).toBeVisible();
      }

      await dragValve(page, valve(first.deliveryId), 0);
      await stepAndSettle(page, 10);
      await expect(hoseLay(page, first.deliveryId)).toHaveAttribute('data-state', 'dry');
      await expect(spray(page, first.deliveryId)).toHaveCount(0);
      await expect(hoseLay(page, second.deliveryId)).toHaveAttribute('data-state', 'charged');
      await expect(spray(page, second.deliveryId)).toBeVisible();
      await expect(
        legendButton(page, deliveryLabel(spec.id, first.deliveryId)),
      ).toHaveAccessibleDescription('Laid, dry');
    });

    test('every line goes dry when the tank runs out', async ({ page }) => {
      const layout = layoutFor(spec.id);
      const state = await getState(page);
      const [first] = state.lines;
      const tankInlet = spec.inlets.find((i) => i.kind === 'tank');
      if (first === undefined || tankInlet === undefined) throw new Error('no line or tank inlet');
      for (const t of state.trucks) t.tankL = 60;
      await page.evaluate((s) => {
        window.__pumpops?.load({ state: s });
      }, state);
      const valve = (id: string) => page.getByRole('slider', { name: controlName(layout, id) });
      await dragValve(page, valve(tankInlet.id), 1);
      await dragValve(page, valve(first.deliveryId), 1);
      await dragThrottle(page, 0.5);
      await stepAndSettle(page, 5);
      await expect(hoseLay(page, first.deliveryId)).toHaveAttribute('data-state', 'charged');
      await stepAndSettle(page, 600);
      await expect(hoseLay(page, first.deliveryId)).toHaveAttribute('data-state', 'dry');
      await expect(spray(page, first.deliveryId)).toHaveCount(0);
    });

    test('tapping a hose on the scene highlights its delivery on the panel', async ({
      page,
    }, testInfo) => {
      const [, second] = (await getState(page)).lines;
      if (second === undefined) throw new Error('need two lines');
      const label = deliveryLabel(spec.id, second.deliveryId);

      await tapHoseLay(page, second.deliveryId, testInfo);
      const row = page.locator(`.delivery-row[data-delivery="${second.deliveryId}"]`);
      await expect(row).toHaveAttribute('data-highlighted', 'true');
      await expect(row).toBeInViewport();
      await expect(panelLocateButton(page, label)).toHaveAttribute('aria-pressed', 'true');
      await expect(legendButton(page, label)).toHaveAttribute('aria-pressed', 'true');
      await expect(hoseLay(page, second.deliveryId)).toHaveAttribute('data-highlighted', 'true');
      // Only one delivery is ever highlighted.
      await expect(page.locator('.delivery-row[data-highlighted="true"]')).toHaveCount(1);

      await tapHoseLay(page, second.deliveryId, testInfo);
      await expect(row).toHaveAttribute('data-highlighted', 'false');
      await expect(hoseLay(page, second.deliveryId)).toHaveAttribute('data-highlighted', 'false');
    });

    test('tapping a delivery on the panel highlights its line on the scene', async ({
      page,
    }, testInfo) => {
      const [first] = (await getState(page)).lines;
      if (first === undefined) throw new Error('no line');
      const label = deliveryLabel(spec.id, first.deliveryId);
      const locate = panelLocateButton(page, label);
      await locate.scrollIntoViewIfNeeded();
      if (testInfo.project.use.hasTouch === true) await locate.tap();
      else await locate.click();

      await expect(hoseLay(page, first.deliveryId)).toHaveAttribute('data-highlighted', 'true');
      await expect(page.getByRole('img', { name: /^Plan view/ })).toBeInViewport();
      await expect(legendButton(page, label)).toHaveAttribute('aria-pressed', 'true');
      // The valve itself was not touched.
      const open = (await getState(page)).trucks[0]?.inputs.valves[first.deliveryId];
      expect(open ?? 0).toBe(0);

      // The legend row is the same switch from the scene side.
      await legendButton(page, label).click();
      await expect(hoseLay(page, first.deliveryId)).toHaveAttribute('data-highlighted', 'false');
      await expect(locate).toHaveAttribute('aria-pressed', 'false');
    });
  });
}
