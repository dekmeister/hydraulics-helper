// M4 journeys (docs/TESTING.md §4): draughting and priming through the real primer, cavitation
// induced and recovered with the throttle, hydrant over-run, churn overheat, water hammer.
import type { Page, TestInfo } from '@playwright/test';
import { inletOfKind, primerControlId } from '../../src/sim/appliances/controls';
import { CAVITATION_FLUTTER_COMPOUND_KPA } from '../../src/sim/constants';
import { getScenario } from '../../src/sim/scenarios';
import { supports } from '../../src/sim/scenarios/types';
import type { ApplianceSpec } from '../../src/sim/types';
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
  meterValue,
  stepAndSettle,
  tapOrClick,
} from '../panel';

const load = async (page: Page, scenario: string, appliance: string) => {
  await gotoApp(page);
  await page.evaluate(
    ([s, a]) => {
      window.__pumpops?.load({ scenario: s, appliance: a, seed: 7 });
    },
    [scenario, appliance] as const,
  );
};

const inletOf = inletOfKind;
const primerControl = primerControlId;

/** Tap an inlet valve (its tap toggles it) and check it opened. */
async function openInlet(
  page: Page,
  spec: ApplianceSpec,
  kind: 'tank' | 'suction',
  info: TestInfo,
) {
  const valve = page.getByRole('slider', {
    name: controlName(layoutFor(spec.id), inletOf(spec, kind)),
  });
  await valve.scrollIntoViewIfNeeded();
  await tapOrClick(valve, info);
  await expect(valve).toHaveAttribute('aria-valuenow', '100');
}

/** Hold the primer down with a finger (pointer) while `ticks` of sim time pass, then let go. */
async function holdPrimer(page: Page, name: string, ticks: number) {
  const primer = page.getByRole('switch', { name, exact: true });
  await primer.scrollIntoViewIfNeeded();
  const box = await primer.boundingBox();
  if (box === null) throw new Error('primer not rendered');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(primer).toHaveAttribute('aria-checked', 'true');
  await stepAndSettle(page, ticks);
  return {
    primer,
    release: async () => {
      await page.mouse.up();
      await expect(primer).toHaveAttribute('aria-checked', 'false');
    },
  };
}

/** Prime the pump: hold the primer until it catches, or let a self-priming pump do it. */
async function prime(page: Page, spec: ApplianceSpec) {
  const id = primerControl(spec);
  if (id === undefined) {
    await stepAndSettle(page, 300);
  } else {
    const held = await holdPrimer(page, controlName(layoutFor(spec.id), id), 250);
    await expect(page.locator('.primer', { has: held.primer })).toHaveAttribute(
      'data-state',
      'primed',
    );
    await held.release();
  }
  expect(activeTruckOf(await getState(page)).pump.primed).toBe(true);
}

const throttle = (page: Page) => page.getByRole('slider', { name: 'Throttle', exact: true });

/**
 * What the compound gauge shows, or, on an appliance with none fitted, the inlet pressure the
 * sim reports (the lesson still holds; there is just no needle to read it from).
 */
async function compoundShown(page: Page, spec: ApplianceSpec): Promise<number> {
  const placed = spec.instruments.some((i) => i.kind === 'compound');
  if (placed)
    return meterValue(page, instrumentName(await getState(page), layoutFor(spec.id), 'compound'));
  return activeTruckOf(await getState(page)).readings.compoundKpa;
}

/** The compound gauge's needle colour flag, where one is fitted. */
async function expectCompoundAlert(page: Page, spec: ApplianceSpec, alert: boolean) {
  if (!spec.instruments.some((i) => i.kind === 'compound')) return;
  const name = instrumentName(await getState(page), layoutFor(spec.id), 'compound');
  await expect(page.getByRole('meter', { name, exact: true })).toHaveAttribute(
    'data-alert',
    String(alert),
  );
}

for (const spec of JOURNEY_APPLIANCES.filter((s) => supports(getScenario('draughting'), s))) {
  test(`draught from the dam, then induce and recover cavitation on ${spec.id}`, async ({
    page,
  }, info) => {
    await load(page, 'draughting', spec.id);
    const layout = layoutFor(spec.id);
    const initial = await getState(page);
    const [first, second] = initial.lines;
    if (first === undefined || second === undefined) throw new Error('two lines expected');
    const discharge = instrumentName(initial, layout, 'discharge');
    const supply = page.getByTestId(`supply-lay-${inletOf(spec, 'suction')}`);
    await expect(supply).toHaveAttribute('data-state', 'dry');

    await openInlet(page, spec, 'suction', info);
    await prime(page, spec);
    await expect(supply).toHaveAttribute('data-state', 'primed');
    // Primed, nothing flowing: the compound shows the lift, 10 kPa per m (C11).
    const lift = initial.sources.find((s) => s.kind === 'static');
    const liftM = lift?.kind === 'static' ? lift.liftM : 0;
    expect(Math.abs((await compoundShown(page, spec)) + 10 * liftM)).toBeLessThanOrEqual(1);

    await dragValve(
      page,
      page.getByRole('slider', { name: controlName(layout, first.deliveryId) }),
      1,
    );
    await dragThrottle(page, 0.6);
    await stepAndSettle(page, 100);
    expect(await meterValue(page, discharge)).toBeGreaterThan(300);
    expect(await compoundShown(page, spec)).toBeLessThan(-10 * liftM);
    await expectStatus(page, 'No warnings.');

    // Push it: second line open, throttle wide.
    await dragValve(
      page,
      page.getByRole('slider', { name: controlName(layout, second.deliveryId) }),
      1,
    );
    await throttle(page).focus();
    await page.keyboard.press('End');
    await stepAndSettle(page, 50);
    await expectStatus(page, /More throttle won’t help/);
    const full = activeTruckOf(await getState(page));
    expect(full.readings.cavitation).toBeGreaterThan(0);
    await expectCompoundAlert(page, spec, true);
    await expect(page.getByTestId(`hose-lay-${first.deliveryId}`)).toHaveAttribute(
      'data-cavitating',
      'true',
    );

    // The classic lesson: a little less throttle (four vernier steps), same discharge and flow;
    // the rpm was wasted.
    const down = page.getByRole('button', { name: 'Throttle down', exact: true });
    for (let i = 0; i < 4; i++) await down.click();
    await stepAndSettle(page, 50);
    const eased = activeTruckOf(await getState(page));
    expect(eased.readings.cavitation).toBeGreaterThan(0);
    expect(eased.rpm).toBeLessThan(full.rpm - 50);
    expect(Math.abs(eased.readings.dischargeKpa - full.readings.dischargeKpa)).toBeLessThan(1);
    expect(Math.abs(eased.readings.pumpFlowLpm - full.readings.pumpFlowLpm)).toBeLessThan(1);

    // Recover: ease the throttle back until the gauges steady.
    await dragThrottle(page, 0.6);
    await stepAndSettle(page, 50);
    expect(activeTruckOf(await getState(page)).readings.cavitation).toBe(0);
    await expectStatus(page, 'No warnings.');
    await expectCompoundAlert(page, spec, false);
  });
}

for (const spec of JOURNEY_APPLIANCES.filter((s) => supports(getScenario('hydrant-supply'), s))) {
  test(`hydrant supply reads positive, then over-runs on ${spec.id}`, async ({ page }, info) => {
    await load(page, 'hydrant-supply', spec.id);
    const layout = layoutFor(spec.id);
    const initial = await getState(page);
    const [first, second] = initial.lines;
    if (first === undefined || second === undefined) throw new Error('two lines expected');
    const supply = page.getByTestId(`supply-lay-${inletOf(spec, 'suction')}`);
    await expect(page.getByTestId('scene-hydrant')).toBeVisible();

    await openInlet(page, spec, 'suction', info);
    await dragValve(
      page,
      page.getByRole('slider', { name: controlName(layout, first.deliveryId) }),
      1,
    );
    await dragThrottle(page, 0.4);
    await stepAndSettle(page, 50);
    expect(await compoundShown(page, spec)).toBeGreaterThan(50);
    await expect(supply).toHaveAttribute('data-state', 'charged');
    await expectStatus(page, 'No warnings.');

    await dragValve(
      page,
      page.getByRole('slider', { name: controlName(layout, second.deliveryId) }),
      1,
    );
    await throttle(page).focus();
    await page.keyboard.press('End');
    await stepAndSettle(page, 50);
    // Over-running: inlet zero (± the flutter), hose soft, cavitating (Table 7).
    expect(Math.abs(await compoundShown(page, spec))).toBeLessThanOrEqual(
      CAVITATION_FLUTTER_COMPOUND_KPA + 0.5,
    );
    await expect(supply).toHaveAttribute('data-state', 'soft');
    await expectStatus(page, /hydrant/);
  });
}

for (const spec of JOURNEY_APPLIANCES) {
  test.describe(`pump faults on ${spec.id}`, () => {
    test.beforeEach(async ({ page }) => {
      await load(page, 'tank-attack', spec.id);
    });

    test('churning with every delivery shut overheats; cracking a delivery cools it', async ({
      page,
    }, info) => {
      const layout = layoutFor(spec.id);
      const [first] = (await getState(page)).lines;
      if (first === undefined) throw new Error('no line laid');
      await openInlet(page, spec, 'tank', info);
      await dragThrottle(page, 0.8);
      await stepAndSettle(page, 4000);
      await expectStatus(page, /Pump hot/);
      await dragValve(
        page,
        page.getByRole('slider', { name: controlName(layout, first.deliveryId) }),
        0.3,
      );
      await stepAndSettle(page, 300);
      await expect(page.getByRole('status')).not.toContainText('Pump hot');
    });

    test('slamming a delivery shut is water hammer; the lamp clears after a few seconds', async ({
      page,
    }, info) => {
      const layout = layoutFor(spec.id);
      const [first] = (await getState(page)).lines;
      if (first === undefined) throw new Error('no line laid');
      const name = controlName(layout, first.deliveryId);
      await openInlet(page, spec, 'tank', info);
      const valve = page.getByRole('slider', { name, exact: true });
      await dragValve(page, valve, 1);
      await dragThrottle(page, 0.6);
      await stepAndSettle(page, 50);
      await valve.focus();
      await page.keyboard.press('Home');
      await stepAndSettle(page, 1);
      await expectStatus(page, /Water hammer/);
      expect(activeTruckOf(await getState(page)).tally.waterHammer).toBe(1);
      await stepAndSettle(page, 60);
      await expect(page.getByRole('status')).not.toContainText('Water hammer');
    });
  });
}

for (const spec of JOURNEY_APPLIANCES.filter((s) => primerControl(s) !== undefined)) {
  test(`vacuum test: suction shut, the primer pulls a vacuum that holds on ${spec.id}`, async ({
    page,
  }) => {
    await load(page, 'draughting', spec.id);
    const layout = layoutFor(spec.id);
    const held = await holdPrimer(page, controlName(layout, primerControl(spec) ?? ''), 200);
    expect(await compoundShown(page, spec)).toBeLessThan(-70);
    await held.release();
    await stepAndSettle(page, 100);
    expect(await compoundShown(page, spec)).toBeLessThan(-65);
    expect(activeTruckOf(await getState(page)).pump.primed).toBe(false);
  });
}
