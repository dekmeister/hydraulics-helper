// Lesson journeys (M6 demo): a new player completes scenarios 1–3 from the menu, through the
// real controls, and their progress survives a reload. Run on the phone, the baseline constraint.
import type { Page, TestInfo } from '@playwright/test';
import { APPLIANCES } from '../../src/sim/appliances/catalogue';
import { inletOfKind } from '../../src/sim/appliances/controls';
import { DEFAULT_APPLIANCE_ID } from '../../src/state/store';
import { expect, gotoApp, test } from '../fixtures';
import {
  band,
  branchKpa,
  gateBranch,
  getLesson,
  lineFlow,
  nudgeThrottle,
  objectiveDone,
  playUntil,
  presses,
  shutDownLesson,
  startButton,
  trimBranch,
} from '../lesson';
import {
  activeTruckOf,
  controlName,
  dragThrottle,
  dragValve,
  engineSwitch,
  getState,
  holdEngineSwitch,
  JOURNEY_APPLIANCES,
  layoutFor,
  setIgnition,
  startEngine,
  stepAndSettle,
  tapOrClick,
} from '../panel';

test.skip(({ isMobile }) => !isMobile, 'lesson journeys run on the phone');

const dock = (page: Page) => page.getByRole('region', { name: 'Lesson' });

/** The valve slider for a spec control id, by its panel label. */
async function valveFor(page: Page, controlId: string) {
  const state = await getState(page);
  return page.getByRole('slider', {
    name: controlName(layoutFor(activeTruckOf(state).spec.id), controlId),
    exact: true,
  });
}

async function deliveryOf(page: Page, line: string) {
  const state = await getState(page);
  const id = state.lines.find((l) => l.id === line)?.deliveryId;
  if (id === undefined) throw new Error(`no line ${line}`);
  return { id, valve: await valveFor(page, id) };
}

async function inlet(page: Page, kind: 'tank' | 'suction', testInfo: TestInfo) {
  const spec = activeTruckOf(await getState(page)).spec;
  const valve = await valveFor(page, inletOfKind(spec, kind));
  await valve.scrollIntoViewIfNeeded();
  await tapOrClick(valve, testInfo);
  return valve;
}

/** End of a passed lesson: the dock offers the debrief, which says so. */
async function expectPassedDebrief(page: Page) {
  await expect(dock(page)).toContainText('Scenario complete.');
  await dock(page).getByRole('button', { name: 'See debrief' }).click();
  await expect(page.getByRole('heading', { name: 'Scenario complete', level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: /of 3 stars/ })).toBeVisible();
}

for (const spec of JOURNEY_APPLIANCES) {
  test(`scenario 1, guided by the coach, on ${spec.id}`, async ({ page }, testInfo) => {
    await gotoApp(page);
    if (APPLIANCES.includes(spec)) {
      // A catalogue truck is picked on the menu and its lesson started there, as a player would.
      await expect(page.getByRole('heading', { name: 'Scenarios', level: 1 })).toBeVisible();
      await page.getByRole('radio', { name: new RegExp(`^${spec.name}`) }).check();
      await startButton(page, 1).click();
    } else {
      // The test appliance isn't on the menu.
      await page.evaluate((appliance) => {
        window.__pumpops?.load({ scenario: 'first-line', appliance, lesson: true });
      }, spec.id);
    }
    await expect(dock(page)).toContainText('Step 1 of 12');
    await dock(page).getByRole('button', { name: 'Got it' }).click();

    // Start from cold: ignition on, then hold START until it fires.
    await expect(dock(page)).toContainText('Step 2 of 12');
    await setIgnition(page, true);
    await stepAndSettle(page, 1);
    await expect(dock(page)).toContainText('Step 3 of 12');
    // Let go too soon and it doesn't catch; hold on and it does.
    await holdEngineSwitch(page, 'start', 5);
    await stepAndSettle(page, 5);
    expect(activeTruckOf(await getState(page)).engine.running).toBe(false);
    await expect(dock(page)).toContainText('Step 3 of 12');
    await holdEngineSwitch(page, 'start', 25);
    await stepAndSettle(page, 1);
    await expect(dock(page)).toContainText('Step 4 of 12');
    await expect(page.getByRole('status', { name: 'Engine' })).toHaveText('Running');

    const tank = await inlet(page, 'tank', testInfo);
    await expect(tank).toHaveAttribute('aria-valuenow', '100');
    await stepAndSettle(page, 1);
    await expect(dock(page)).toContainText('Step 5 of 12');

    const line = await deliveryOf(page, 'line-38');
    await dragValve(page, line.valve, 1);
    await stepAndSettle(page, 1);
    await expect(dock(page)).toContainText('Step 6 of 12');

    await dragThrottle(page, 0.6);
    await playUntil(
      page,
      (p) => p.coachIndex >= 6,
      async (s) => {
        if (activeTruckOf(s).readings.dischargeKpa < 650) await nudgeThrottle(page, 6);
      },
      30,
    );
    for (const step of ['Step 7 of 12', 'Step 8 of 12']) {
      await expect(dock(page)).toContainText(step);
      await dock(page).getByRole('button', { name: 'Got it' }).click();
    }
    await expect(dock(page)).toContainText('Step 9 of 12');
    await playUntil(
      page,
      (p) => objectiveDone(p, 'pressure'),
      (s) => trimBranch(page, s, 'line-38'),
    );

    // Shut down: idle first, then ease the delivery shut over a few seconds.
    await expect(dock(page)).toContainText('Step 10 of 12');
    await dragThrottle(page, 0);
    await stepAndSettle(page, 30);
    for (const open of [0.5, 0.2, 0]) {
      await dragValve(page, line.valve, open);
      await stepAndSettle(page, 10);
    }
    // Then the engine: a tap on STOP only dips it and it picks up again; held, it stops.
    await expect(dock(page)).toContainText('Step 11 of 12');
    await holdEngineSwitch(page, 'stop', 1);
    await stepAndSettle(page, 20);
    expect(activeTruckOf(await getState(page)).engine.running).toBe(true);
    await holdEngineSwitch(page, 'stop', 40);
    await stepAndSettle(page, 1);
    await expect(dock(page)).toContainText('Step 12 of 12');
    await expect(await engineSwitch(page, 'ignition')).toHaveAttribute('aria-checked', 'true');
    await setIgnition(page, false);
    await stepAndSettle(page, 1);
    expect((await getLesson(page)).status).toBe('passed');
    await expectPassedDebrief(page);
    expect(activeTruckOf(await getState(page)).tally.waterHammer).toBe(0);
  });
}

test('scenarios 2 and 3 unassisted, and the progress survives a reload', async ({
  page,
}, testInfo) => {
  // Two whole lessons played a second at a time through the controls.
  test.setTimeout(120_000);
  await gotoApp(page);
  // 2: two lines on the tank, the 38 mm sets the pump and the 65 mm is gated back.
  await startButton(page, 2).click();
  await startEngine(page);
  await inlet(page, 'tank', testInfo);
  const small = await deliveryOf(page, 'line-38');
  const big = await deliveryOf(page, 'line-65');
  await dragValve(page, small.valve, 1);
  await dragValve(page, big.valve, 1);
  await dragThrottle(page, 0.7);
  const bigName = (await big.valve.getAttribute('aria-label')) ?? '';
  await playUntil(
    page,
    (p) => objectiveDone(p, 'both'),
    async (s) => {
      await trimBranch(page, s, 'line-38');
      await gateBranch(page, s, 'line-65', bigName);
    },
    150,
  );
  await shutDownLesson(page, [small.valve, big.valve]);
  await expectPassedDebrief(page);

  // 3, from the debrief: water from the hydrant without over-running it.
  await page.getByRole('button', { name: 'Next scenario' }).click();
  await expect(dock(page)).toContainText('Take water from the hydrant');
  await startEngine(page);
  await inlet(page, 'suction', testInfo);
  const attack = await deliveryOf(page, 'line-65');
  await dragValve(page, attack.valve, 1);
  await dragThrottle(page, 0.3);
  const compound = (s: Awaited<ReturnType<typeof getState>>) =>
    activeTruckOf(s).readings.compoundKpa;
  // Push the 65 mm line hard, watching the compound for the hydrant's reserve.
  await playUntil(
    page,
    (p) => objectiveDone(p, 'reserve'),
    async (s) => {
      if (lineFlow(s, 'line-65') < 730 && compound(s) > 140) await nudgeThrottle(page, 4);
      else if (compound(s) < 120) await nudgeThrottle(page, -3);
    },
  );
  const second = await deliveryOf(page, 'line-38');
  await dragValve(page, second.valve, 1);
  await playUntil(
    page,
    (p) => objectiveDone(p, 'both'),
    async (s) => {
      if (compound(s) < 75) await nudgeThrottle(page, presses(compound(s) - 90, 8));
      else if (lineFlow(s, 'line-38') < 220 && compound(s) > 100) await nudgeThrottle(page, 2);
    },
  );
  await shutDownLesson(page, [attack.valve, second.valve]);
  await expectPassedDebrief(page);

  // Back on the menu, and after a reload: 2 and 3 passed; 1, never tried, is up next.
  for (const reload of [false, true]) {
    if (reload) await gotoApp(page);
    else await page.getByRole('button', { name: 'All scenarios' }).click();
    const card = (id: string) => page.locator(`[data-scenario="${id}"]`);
    await expect(card('first-line')).toContainText('Not tried yet');
    await expect(card('first-line')).toContainText('Next up');
    await expect(card('tank-attack')).toContainText('Passed');
    await expect(card('hydrant-supply')).toContainText('Passed');
    await expect(card('draughting')).toContainText('Not tried yet');
  }
});

test('the incident’s events: the crew moves uphill and calls for pressure', async ({
  page,
}, testInfo) => {
  await gotoApp(page);
  await page.evaluate(() => {
    window.__pumpops?.load({ scenario: 'incident', appliance: 'cat1-generic', lesson: true });
  });
  await startEngine(page);
  await inlet(page, 'tank', testInfo);
  const line = await deliveryOf(page, 'line-1');
  await dragValve(page, line.valve, 1);
  await dragThrottle(page, 0.6);
  await playUntil(
    page,
    (p) => objectiveDone(p, 'attack'),
    (s) => trimBranch(page, s, 'line-1'),
  );
  await stepAndSettle(page, 10);
  await expect(dock(page)).toContainText('Branch 1: Moving up the slope');
  const state = await getState(page);
  expect(state.lines.find((l) => l.id === 'line-1')?.elevationM).toBe(10);
  // Further from the pump and 10 m up: the same throttle now leaves the branch short.
  expect(branchKpa(state, 'line-1')).toBeLessThan(band(state, 'line-1').min);
  await expect(dock(page)).toContainText(/Branch on .*target/);

  await playUntil(
    page,
    (p) => objectiveDone(p, 'uphill'),
    (s) => trimBranch(page, s, 'line-1'),
  );
  await stepAndSettle(page, 10);
  await expect(dock(page)).toContainText('OIC: Second crew has run out 65 mm');
  const after = await getState(page);
  const second = after.lines.find((l) => l.id === 'line-2');
  expect(second).toBeDefined();
  await expect(
    page.locator('[data-truck-active="true"]').getByTestId(`hose-lay-${second?.deliveryId ?? ''}`),
  ).toHaveCount(1);
});

test('the sound setting is kept across visits', async ({ page }) => {
  await gotoApp(page);
  const sound = page.getByRole('switch', { name: /Sound/ });
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await gotoApp(page);
  await expect(page.getByRole('switch', { name: /Sound/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
});

// M7 demo: the same tank attack on another appliance, picked on the menu, with its own panel and
// pump. Every catalogue appliance other than the default gets the journey.
for (const spec of JOURNEY_APPLIANCES.filter(
  (a) => a.id !== DEFAULT_APPLIANCE_ID && APPLIANCES.includes(a),
)) {
  test(`pick ${spec.id} on the menu and play the tank attack on it; the pick is kept`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await gotoApp(page);
    const pick = page.getByRole('radio', { name: new RegExp(`^${spec.name}`) });
    await pick.check();
    await expect(pick).toBeChecked();
    // Briefs name what this truck's crews run, filled in for it.
    const card = page.locator('[data-scenario="tank-attack"]');
    await expect(card).not.toContainText('{');
    await startButton(page, 2).click();
    await expect(page.locator('.pump-panel__appliance')).toContainText(spec.name);

    await startEngine(page);
    await inlet(page, 'tank', testInfo);
    const crew = await deliveryOf(page, 'line-38');
    const second = await deliveryOf(page, 'line-65');
    await dragValve(page, crew.valve, 1);
    await dragValve(page, second.valve, 1);
    await dragThrottle(page, 0.8);
    const secondName = (await second.valve.getAttribute('aria-label')) ?? '';
    await playUntil(
      page,
      (p) => objectiveDone(p, 'both'),
      async (s) => {
        await trimBranch(page, s, 'line-38');
        await gateBranch(page, s, 'line-65', secondName);
      },
      150,
    );
    await shutDownLesson(page, [crew.valve, second.valve]);
    await expectPassedDebrief(page);

    await page.reload();
    await page.waitForFunction(() => window.__pumpops !== undefined);
    await expect(page.getByRole('radio', { name: new RegExp(`^${spec.name}`) })).toBeChecked();
    await expect(page.locator('[data-scenario="tank-attack"]')).toContainText('Passed');
  });
}
