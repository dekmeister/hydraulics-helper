// Journeys: a player's lesson driven through the real controls (docs/TESTING.md §4).
import { expect, gotoApp, test } from '../fixtures';
import {
  activeTruckOf,
  controlName,
  dragThrottle,
  dragValve,
  expectStatus,
  getState,
  instrumentName,
  JOURNEY_APPLIANCES,
  layoutFor,
  layoutItems,
  meterValue,
  sliderValue,
  startEngine,
  stepAndSettle,
  tapOrClick,
} from '../panel';

for (const spec of JOURNEY_APPLIANCES) {
  test.describe(`tank attack on ${spec.id}`, () => {
    test.beforeEach(async ({ page }) => {
      await gotoApp(page);
      await page.evaluate((appliance) => {
        window.__pumpops?.load({ scenario: 'tank-attack', appliance });
      }, spec.id);
      await startEngine(page);
    });

    test('open tank-to-pump, open a delivery, throttle up; a second line sags', async ({
      page,
    }, testInfo) => {
      const layout = layoutFor(spec.id);
      const initial = await getState(page);
      const [first, second] = initial.lines;
      const tankInlet = spec.inlets.find((i) => i.kind === 'tank');
      if (first === undefined || second === undefined || tankInlet === undefined)
        throw new Error('tank attack needs two lines and a tank inlet');
      const discharge = instrumentName(initial, layout, 'discharge');
      const tank = instrumentName(initial, layout, 'tank');
      const capacity = activeTruckOf(initial).tankL;

      const tankToPump = page.getByRole('slider', { name: controlName(layout, tankInlet.id) });
      await tankToPump.scrollIntoViewIfNeeded();
      await tapOrClick(tankToPump, testInfo);
      await expect(tankToPump).toHaveAttribute('aria-valuenow', '100');

      await dragValve(
        page,
        page.getByRole('slider', { name: controlName(layout, first.deliveryId) }),
        1,
      );
      await dragThrottle(page, 0.6);
      await stepAndSettle(page, 300);

      const state = await getState(page);
      const truck = activeTruckOf(state);
      expect(truck.inputs.valves[first.deliveryId]).toBe(1);
      expect(truck.inputs.throttle).toBeGreaterThan(0.5);
      expect(truck.inputs.throttle).toBeLessThan(0.7);
      // What the panel shows is what the sim computed (rounded to whole kPa / L).
      const shown = await meterValue(page, discharge);
      expect(shown).toBeGreaterThan(0);
      expect(Math.abs(shown - truck.readings.dischargeKpa)).toBeLessThanOrEqual(0.5);
      expect(await meterValue(page, tank)).toBeLessThan(capacity);
      expect(Math.abs((await meterValue(page, tank)) - truck.tankL)).toBeLessThanOrEqual(0.5);
      await expectStatus(page, 'No warnings.');

      await dragValve(
        page,
        page.getByRole('slider', { name: controlName(layout, second.deliveryId) }),
        1,
      );
      await stepAndSettle(page, 50);
      expect(await meterValue(page, discharge)).toBeLessThan(shown);
    });

    test('runs dry: low then empty warnings, and the discharge collapses', async ({ page }) => {
      const layout = layoutFor(spec.id);
      const state = await getState(page);
      const [first] = state.lines;
      const tankInlet = spec.inlets.find((i) => i.kind === 'tank');
      if (first === undefined || tankInlet === undefined) throw new Error('no line or tank inlet');
      // A nearly empty tank, loaded as a state blob (no input shortcuts: controls stay shut).
      for (const t of state.trucks) t.tankL = 60;
      await page.evaluate((s) => {
        window.__pumpops?.load({ state: s });
      }, state);

      await dragValve(
        page,
        page.getByRole('slider', { name: controlName(layout, tankInlet.id) }),
        1,
      );
      await dragValve(
        page,
        page.getByRole('slider', { name: controlName(layout, first.deliveryId) }),
        1,
      );
      await dragThrottle(page, 0.5);
      await stepAndSettle(page, 20);
      await expectStatus(page, /Tank low/);
      const discharge = instrumentName(state, layout, 'discharge');
      expect(await meterValue(page, discharge)).toBeGreaterThan(0);

      await stepAndSettle(page, 600);
      await expectStatus(page, /Tank empty/);
      expect(await meterValue(page, discharge)).toBe(0);
      expect(await meterValue(page, instrumentName(state, layout, 'tank'))).toBe(0);
    });

    test('valve drag precision: half open is 45–55 % in the control and the sim', async ({
      page,
    }) => {
      const layout = layoutFor(spec.id);
      const [first] = (await getState(page)).lines;
      if (first === undefined) throw new Error('no line');
      const valve = page.getByRole('slider', { name: controlName(layout, first.deliveryId) });
      await dragValve(page, valve, 0.5);
      const shown = await sliderValue(valve);
      expect(shown).toBeGreaterThanOrEqual(0.45);
      expect(shown).toBeLessThanOrEqual(0.55);
      await stepAndSettle(page, 1);
      const open = activeTruckOf(await getState(page)).inputs.valves[first.deliveryId] ?? -1;
      expect(open).toBeGreaterThanOrEqual(0.45);
      expect(open).toBeLessThanOrEqual(0.55);
    });

    test('a tap does what the layout says', async ({ page }, testInfo) => {
      const layout = layoutFor(spec.id);
      const state = await getState(page);
      for (const line of state.lines) {
        // 'none' must never charge a line from a stray thumb; 'toggle' snaps fully open.
        const item = layoutItems(layout).find(
          (i) => i.kind === 'delivery' && i.control === line.deliveryId,
        );
        if (item?.kind !== 'delivery') throw new Error(`${line.deliveryId} not placed`);
        const valve = page.getByRole('slider', { name: item.label });
        await valve.scrollIntoViewIfNeeded();
        await tapOrClick(valve, testInfo);
        await expect(valve).toHaveAttribute('aria-valuenow', item.tap === 'toggle' ? '100' : '0');
      }
    });

    test('a delivery with nothing connected opens and gushes at the truck (issue #16)', async ({
      page,
    }) => {
      const layout = layoutFor(spec.id);
      const state = await getState(page);
      const used = new Set(state.lines.map((l) => l.deliveryId));
      const bare = spec.deliveries.find((d) => !used.has(d.id));
      const tankInlet = spec.inlets.find((i) => i.kind === 'tank');
      test.skip(bare === undefined, 'tank attack lays a line on every delivery');
      if (bare === undefined || tankInlet === undefined)
        throw new Error('no bare delivery or tank');
      const discharge = instrumentName(state, layout, 'discharge');
      const gush = page.getByTestId(`outlet-gush-${bare.id}`);

      await dragValve(
        page,
        page.getByRole('slider', { name: controlName(layout, tankInlet.id) }),
        1,
      );
      await dragThrottle(page, 0.5);
      await stepAndSettle(page, 50);
      const shut = await meterValue(page, discharge);
      await expect(gush).toHaveCount(0);

      const valve = page.getByRole('slider', { name: controlName(layout, bare.id) });
      await expect(valve).not.toHaveAttribute('aria-disabled', 'true');
      await dragValve(page, valve, 1);
      await stepAndSettle(page, 50);
      await expect(gush).toBeVisible();
      expect(await meterValue(page, discharge)).toBeLessThan(shut / 2);

      await dragValve(page, valve, 0);
      await stepAndSettle(page, 50);
      await expect(gush).toHaveCount(0);
    });

    test('throttle vernier buttons step the throttle', async ({ page }) => {
      const throttle = page.getByRole('slider', { name: 'Throttle', exact: true });
      await page.getByRole('button', { name: 'Throttle up' }).click();
      await page.getByRole('button', { name: 'Throttle up' }).click();
      const up = await sliderValue(throttle);
      expect(up).toBeGreaterThan(0);
      await page.getByRole('button', { name: 'Throttle down' }).click();
      expect(await sliderValue(throttle)).toBeLessThan(up);
    });
  });
}
