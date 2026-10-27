// M4 journeys (docs/TESTING.md §4): draughting and priming through the real primer, cavitation
// induced and recovered with the throttle, hydrant over-run, churn overheat, water hammer.
import { CAT1 } from '../../src/sim/appliances/cat1';
import { primerControlId as primerControl } from '../../src/sim/appliances/controls';
import { CAVITATION_FLUTTER_COMPOUND_KPA } from '../../src/sim/constants';
import { getScenario } from '../../src/sim/scenarios';
import { supports } from '../../src/sim/scenarios/types';
import { expect, test } from '../fixtures';
import { stepUntilCharged } from '../scene';
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
  warningsStatus,
} from '../panel';
import {
  compoundShown,
  expectCompoundAlert,
  holdPrimer,
  inletOf,
  load,
  openInlet,
  overRuns,
  relayBurstsOnSlam,
  prime,
  throttle,
} from '../sources';

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
    const primerId = primerControl(spec);
    if (primerId !== undefined) {
      // Part way: the water stands part way up the hard suction, still dry at the pump.
      const held = await holdPrimer(page, controlName(layout, primerId), 30);
      const level = Number(await supply.getAttribute('data-level'));
      expect(level).toBeGreaterThan(0);
      expect(level).toBeLessThan(1);
      await expect(supply).toHaveAttribute('data-state', 'dry');
      await held.release();
    }
    await prime(page, spec);
    await expect(supply).toHaveAttribute('data-state', 'primed');
    await expect(supply).toHaveAttribute('data-level', '1.00');
    // Primed, nothing flowing: the compound shows the lift, 10 kPa per m (C11).
    const lift = initial.sources.find((s) => s.kind === 'static');
    const liftM = lift?.kind === 'static' ? lift.liftM : 0;
    expect(Math.abs((await compoundShown(page, spec)) + 10 * liftM)).toBeLessThanOrEqual(1);

    // Charge the line at idle, then build pressure: an empty hose would run the draught out.
    await dragValve(
      page,
      page.getByRole('slider', { name: controlName(layout, first.deliveryId) }),
      1,
    );
    await stepUntilCharged(page, first.deliveryId);
    await dragThrottle(page, 0.6);
    await stepAndSettle(page, 100);
    await expect(supply).toHaveAttribute('data-flowing', 'true');
    expect(await meterValue(page, discharge)).toBeGreaterThan(300);
    expect(await compoundShown(page, spec)).toBeLessThan(-10 * liftM);
    await expectStatus(page, 'No warnings.');

    if (!overRuns('draughting', spec)) {
      test.info().annotations.push({
        type: 'physics',
        description: `${spec.id} can't draw past this lift with these lines: no cavitation to induce`,
      });
      return;
    }

    // Push it: second line open, throttle wide.
    await dragValve(
      page,
      page.getByRole('slider', { name: controlName(layout, second.deliveryId) }),
      1,
    );
    await stepUntilCharged(page, second.deliveryId);
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
    await stepUntilCharged(page, first.deliveryId);
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
    await stepUntilCharged(page, second.deliveryId);
    await throttle(page).focus();
    await page.keyboard.press('End');
    await stepAndSettle(page, 50);
    if (!overRuns('hydrant-supply', spec)) {
      // A pump this size can't out-draw the hydrant: the compound stays positive at full throttle.
      expect(await compoundShown(page, spec)).toBeGreaterThan(50);
      await expect(supply).toHaveAttribute('data-state', 'charged');
      return;
    }
    // Over-running: inlet zero (± the flutter), hose soft, cavitating (Table 7).
    expect(Math.abs(await compoundShown(page, spec))).toBeLessThanOrEqual(
      CAVITATION_FLUTTER_COMPOUND_KPA + 0.5,
    );
    await expect(supply).toHaveAttribute('data-state', 'soft');
    await expectStatus(page, /hydrant/);
  });
}

for (const spec of JOURNEY_APPLIANCES.filter((s) => supports(getScenario('tank-refill'), s))) {
  test(`hydrant to tank left open on a full tank spills a pool that soaks away on ${spec.id}`, async ({
    page,
  }, info) => {
    await load(page, 'tank-refill', spec.id, undefined, { cold: true });
    const truckId = (await getState(page)).activeTruckId;
    const pool = page.getByTestId(`spill-pool-truck-${truckId}`);
    const capacityL = spec.tank?.capacityL ?? 0;
    await expect(pool).toHaveCount(0);

    await openInlet(page, spec, 'tankFill', info);
    for (let i = 0; i < 100 && activeTruckOf(await getState(page)).tankL < capacityL; i++)
      await stepAndSettle(page, 50);
    expect(activeTruckOf(await getState(page)).tankL).toBe(capacityL);
    // Half a minute more with the hydrant still open: the overflow spreads round the truck.
    await stepAndSettle(page, 300);
    await expect(pool).toBeVisible();
    const spread = Number(await pool.getAttribute('data-size'));
    expect(spread).toBeGreaterThan(0);

    // Shut it: the tank stays full and the pool soaks away.
    const valve = page.getByRole('slider', {
      name: controlName(layoutFor(spec.id), inletOf(spec, 'tankFill')),
    });
    await valve.scrollIntoViewIfNeeded();
    await tapOrClick(valve, info);
    await expect(valve).toHaveAttribute('aria-valuenow', '0');
    await stepAndSettle(page, 20);
    expect(Number(await pool.getAttribute('data-size'))).toBeLessThan(spread);
    for (let i = 0; i < 100 && (await pool.count()) > 0; i++) await stepAndSettle(page, 100);
    await expect(pool).toHaveCount(0);
    expect(activeTruckOf(await getState(page)).tankL).toBe(capacityL);
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
      if (spec.recirc !== undefined) {
        // Its recirculation bleed carries the churn heat back to the tank: it never gets hot.
        await expectStatus(page, 'No warnings.');
        return;
      }
      await expectStatus(page, /Pump hot/);
      await dragValve(
        page,
        page.getByRole('slider', { name: controlName(layout, first.deliveryId) }),
        0.3,
      );
      await stepAndSettle(page, 300);
      await expect(warningsStatus(page)).not.toContainText('Pump hot');
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
      await expect(warningsStatus(page)).not.toContainText('Water hammer');
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

// The over-run guards above skip only where the physics says so: the reference appliance must
// still be pushed past every supply, so the cavitation journeys always run somewhere.
test('the reference appliance over-runs every supply and bursts a slammed relay', () => {
  for (const scenario of ['draughting', 'hydrant-supply', 'closed-relay'])
    expect(overRuns(scenario, CAT1), scenario).toBe(true);
  expect(relayBurstsOnSlam(CAT1)).toBe(true);
});
