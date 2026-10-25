// Realistic-view journeys (docs/TESTING.md §4): the same jobs as on the simplified panel, done on
// the truck's own arrangement through its real controls: bay levers, its throttle (a speed
// controller or a vernier knob), its primer (a pull handle or a hand pump) and hydrant to tank.
import { inletOfKind } from '../../src/sim/appliances/controls';
import { getScenario } from '../../src/sim/scenarios';
import { supports } from '../../src/sim/scenarios/types';
import { REALISTIC_APPLIANCES } from '../../src/testing/fixtures/realisticStates';
import { getRealisticLayout } from '../../src/ui/appliances/registry';
import { expect, gotoApp, test } from '../fixtures';
import {
  activeTruckOf,
  controlName,
  dragValve,
  expectStatus,
  getState,
  instrumentName,
  layoutFor,
  layoutItems,
  meterValue,
  sliderValue,
  stepAndSettle,
  tapOrClick,
} from '../panel';
import { load, openInlet, prime, throttle } from '../sources';
import type { Page } from '@playwright/test';

const showRealistic = async (page: Page) => {
  await page.getByRole('button', { name: 'Realistic', exact: true }).click();
  await expect(page.locator('.pump-panel')).toHaveAttribute('data-view', 'realistic');
};

/** The realistic throttle's variant on `applianceId`. */
function throttleVariant(applianceId: string) {
  const item = getRealisticLayout(applianceId)
    ?.plates.flatMap((p) => p.items)
    .find((i) => i.kind === 'throttle');
  if (item?.kind !== 'throttle') throw new Error(`${applianceId} has no realistic throttle`);
  return item.variant;
}

/** Drag the vernier knob by a fraction of its box: sideways pulls or pushes, up or down twists. */
async function dragVernier(page: Page, along: 'pull' | 'twist', fraction: number) {
  const knob = throttle(page);
  await knob.scrollIntoViewIfNeeded();
  const box = await knob.boundingBox();
  if (box === null) throw new Error('vernier not rendered');
  const x = box.x + box.width * 0.6;
  const y = box.y + box.height * 0.45;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const f = (fraction * i) / steps;
    if (along === 'pull') await page.mouse.move(x + box.width * f, y);
    else await page.mouse.move(x, y - box.height * f);
  }
  await page.mouse.up();
}

/** Bring the engine up on the realistic throttle, whatever kind it is. */
async function throttleUp(page: Page, applianceId: string) {
  if (throttleVariant(applianceId) === 'vernier') await dragVernier(page, 'pull', 0.3);
  else await holdSpeedSwitch(page, 'up', 20);
}

/** Bring the engine back to idle on the realistic throttle. */
async function throttleIdle(page: Page, applianceId: string) {
  if (throttleVariant(applianceId) === 'vernier') await dragVernier(page, 'pull', -0.6);
  else await holdSpeedSwitch(page, 'down', 40);
}

/** Hold one half of the speed controller while `ticks` of sim time pass. */
async function holdSpeedSwitch(page: Page, direction: 'up' | 'down', ticks: number) {
  const sw = throttle(page);
  await sw.scrollIntoViewIfNeeded();
  const box = await sw.boundingBox();
  if (box === null) throw new Error('speed switch not rendered');
  const y = box.y + box.height * (direction === 'up' ? 0.2 : 0.8);
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await stepAndSettle(page, ticks);
  await page.mouse.up();
}

for (const spec of REALISTIC_APPLIANCES) {
  test.describe(`realistic bay on ${spec.id}`, () => {
    test('the view switch shows the realistic bay and is remembered', async ({ page }) => {
      await gotoApp(page);
      await page.evaluate((appliance) => {
        window.__pumpops?.load({ scenario: 'tank-attack', appliance });
      }, spec.id);
      await expect(page.getByRole('button', { name: 'Simplified', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await showRealistic(page);
      await expect(page.locator('[data-plate="bay"]')).toBeVisible();
      await page.reload();
      await page.evaluate((appliance) => {
        window.__pumpops?.load({ scenario: 'tank-attack', appliance });
      }, spec.id);
      await expect(page.locator('.pump-panel')).toHaveAttribute('data-view', 'realistic');
      await page.getByRole('button', { name: 'Simplified', exact: true }).click();
      await expect(page.locator('.pump-panel')).toHaveAttribute('data-view', 'simplified');
    });

    test('the pipework shows the water: empty, still, flowing, and kept in the casing', async ({
      page,
    }, info) => {
      await load(page, 'tank-attack', spec.id);
      await showRealistic(page);
      const layout = layoutFor(spec.id);
      const [first] = (await getState(page)).lines;
      if (first === undefined) throw new Error('tank attack needs a line');
      const casing = page.locator('[data-plate="bay"] [data-water-ref="casing"]').first();
      const drop = page.locator(`[data-water-ref="delivery:${first.deliveryId}"]`);
      await expect(casing).toHaveAttribute('data-water', 'empty');

      await openInlet(page, spec, 'tank', info);
      await stepAndSettle(page, 1);
      // A recirculation bleed keeps water moving through the pump with every outlet shut.
      await expect(casing).toHaveAttribute(
        'data-water',
        spec.recirc === undefined ? 'still' : 'flowing',
      );
      await expect(drop).toHaveAttribute('data-water', 'empty');

      const delivery = page.getByRole('slider', { name: controlName(layout, first.deliveryId) });
      await dragValve(page, delivery, 1);
      await throttleUp(page, spec.id);
      await stepAndSettle(page, 20);
      await expect(casing).toHaveAttribute('data-water', 'flowing');
      await expect(drop).toHaveAttribute('data-water', 'flowing');

      // Shut it all down: the line empties, the pump stays full.
      await throttleIdle(page, spec.id);
      await dragValve(page, delivery, 0);
      const tank = page.getByRole('slider', {
        name: controlName(layout, inletOfKind(spec, 'tank')),
      });
      await dragValve(page, tank, 0);
      await stepAndSettle(page, 10);
      await expect(drop).toHaveAttribute('data-water', 'empty');
      await expect(casing).toHaveAttribute('data-water', 'still');
    });

    test('tank attack through the bay levers and the speed controller', async ({ page }, info) => {
      test.skip(throttleVariant(spec.id) !== 'speed-switch', 'no speed controller');
      await load(page, 'tank-attack', spec.id);
      await showRealistic(page);
      const layout = layoutFor(spec.id);
      const initial = await getState(page);
      const [first] = initial.lines;
      if (first === undefined) throw new Error('tank attack needs a line');
      const discharge = instrumentName(initial, layout, 'discharge');

      await openInlet(page, spec, 'tank', info);
      const delivery = page.getByRole('slider', { name: controlName(layout, first.deliveryId) });
      await dragValve(page, delivery, 1);
      expect(await sliderValue(delivery)).toBe(1);

      // A flick nudges the speed a little; holding it up runs the engine up by sim time.
      const sw = throttle(page);
      await sw.scrollIntoViewIfNeeded();
      const swBox = await sw.boundingBox();
      if (swBox === null) throw new Error('speed switch not rendered');
      const upper = { x: swBox.width / 2, y: swBox.height * 0.2 };
      if (info.project.use.hasTouch === true) await sw.tap({ position: upper });
      else await sw.click({ position: upper });
      await stepAndSettle(page, 1);
      const flicked = activeTruckOf(await getState(page)).inputs.throttle;
      expect(flicked).toBeGreaterThan(0);
      expect(flicked).toBeLessThan(0.1);
      await holdSpeedSwitch(page, 'up', 25);
      const up = activeTruckOf(await getState(page)).inputs.throttle;
      expect(up).toBeGreaterThan(flicked + 0.3);
      await stepAndSettle(page, 100);
      expect(activeTruckOf(await getState(page)).inputs.throttle).toBe(up);
      const shown = await meterValue(page, discharge);
      expect(shown).toBeGreaterThan(300);
      await expectStatus(page, 'No warnings.');

      await holdSpeedSwitch(page, 'down', 10);
      await stepAndSettle(page, 50);
      expect(await meterValue(page, discharge)).toBeLessThan(shown);

      // The number plate on the coupling picks the hose out on the scene.
      const locate = page.getByRole('button', {
        name: `Show ${controlName(layout, first.deliveryId)} on scene`,
      });
      await tapOrClick(locate, info);
      await expect(locate).toHaveAttribute('aria-pressed', 'true');
    });

    test('tank attack through the bay levers and the vernier throttle', async ({ page }, info) => {
      test.skip(throttleVariant(spec.id) !== 'vernier', 'no vernier throttle');
      await load(page, 'tank-attack', spec.id);
      await showRealistic(page);
      const layout = layoutFor(spec.id);
      const initial = await getState(page);
      const [first] = initial.lines;
      if (first === undefined) throw new Error('tank attack needs a line');
      const discharge = instrumentName(initial, layout, 'discharge');
      await openInlet(page, spec, 'tank', info);
      const delivery = page.getByRole('slider', { name: controlName(layout, first.deliveryId) });
      await dragValve(page, delivery, 1);

      // Release held, the knob pulls out a long way; let go, it stays.
      await dragVernier(page, 'pull', 0.3);
      await stepAndSettle(page, 1);
      const pulled = activeTruckOf(await getState(page)).inputs.throttle;
      expect(pulled).toBeGreaterThan(0.4);
      await stepAndSettle(page, 100);
      expect(activeTruckOf(await getState(page)).inputs.throttle).toBe(pulled);
      const shown = await meterValue(page, discharge);
      expect(shown).toBeGreaterThan(300);
      await expectStatus(page, 'No warnings.');

      // A twist down fine-tunes: a little less, a little lower on the gauge.
      await dragVernier(page, 'twist', -0.5);
      await stepAndSettle(page, 1);
      const twisted = activeTruckOf(await getState(page)).inputs.throttle;
      expect(twisted).toBeLessThan(pulled);
      expect(twisted).toBeGreaterThan(pulled - 0.05);
      await stepAndSettle(page, 50);
      expect(await meterValue(page, discharge)).toBeLessThan(shown);

      const locate = page.getByRole('button', {
        name: `Show ${controlName(layout, first.deliveryId)} on scene`,
      });
      await tapOrClick(locate, info);
      await expect(locate).toHaveAttribute('aria-pressed', 'true');
    });

    test('draught: prime with the primer on the bay', async ({ page }, info) => {
      test.skip(!supports(getScenario('draughting'), spec), 'no draught');
      await load(page, 'draughting', spec.id);
      await showRealistic(page);
      await openInlet(page, spec, 'suction', info);
      await prime(page, spec);
      await expect(page.getByTestId(`supply-lay-${inletOfKind(spec, 'suction')}`)).toHaveAttribute(
        'data-state',
        'primed',
      );
    });

    test('keyboard reaches every control, and arrows move the throttle', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'keyboard pass runs on desktop');
      await load(page, 'tank-attack', spec.id);
      await showRealistic(page);
      const laid = new Set((await getState(page)).lines.map((l) => l.deliveryId));
      const expected = layoutItems(layoutFor(spec.id)).flatMap((i) => {
        switch (i.kind) {
          case 'valve':
          case 'primer':
          case 'throttle':
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

    test('a held speed controller stops when the bay goes away', async ({ page }) => {
      test.skip(throttleVariant(spec.id) !== 'speed-switch', 'no speed controller');
      await load(page, 'tank-attack', spec.id);
      await showRealistic(page);
      const sw = throttle(page);
      await sw.scrollIntoViewIfNeeded();
      const box = await sw.boundingBox();
      if (box === null) throw new Error('speed switch not rendered');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.2);
      await page.mouse.down();
      // Switch view mid-hold (the pointer is busy holding, so press the button directly).
      await page
        .getByRole('button', { name: 'Simplified', exact: true })
        .evaluate((b: HTMLElement) => {
          b.click();
        });
      await expect(page.locator('.pump-panel')).toHaveAttribute('data-view', 'simplified');
      await page.mouse.up();
      const held = await sliderValue(throttle(page));
      await stepAndSettle(page, 50);
      expect(await sliderValue(throttle(page))).toBe(held);
    });

    test('refill the tank through hydrant to tank', async ({ page }) => {
      test.skip(!supports(getScenario('tank-refill'), spec), 'no hydrant to tank');
      await load(page, 'tank-refill', spec.id);
      await showRealistic(page);
      const layout = layoutFor(spec.id);
      const tank = instrumentName(await getState(page), layout, 'tank');
      const before = await meterValue(page, tank);
      const fill = page.getByRole('slider', {
        name: controlName(layout, inletOfKind(spec, 'tankFill')),
      });
      await dragValve(page, fill, 1);
      await stepAndSettle(page, 300);
      // 30 s at the hydrant's ~1000 L/min.
      expect(await meterValue(page, tank)).toBeGreaterThan(before + 400);
      expect(activeTruckOf(await getState(page)).readings.pumpFlowLpm).toBe(0);
    });
  });
}
