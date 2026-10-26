// Starting and stopping the pump engine through its panel (issue #19): every job starts cold, START
// must be held until it fires, and STOP until it has run down or it picks up again.
import { REALISTIC_APPLIANCES } from '../../src/testing/fixtures/realisticStates';
import { expect, test } from '../fixtures';
import {
  activeTruckOf,
  engineSwitch,
  getState,
  holdEngineSwitch,
  JOURNEY_APPLIANCES,
  setIgnition,
  showRealistic,
  startEngine,
  stepAndSettle,
} from '../panel';
import { load } from '../sources';

/** Long enough for the governor to settle, whatever the appliance's rpm lag: ticks. */
const settleTicks = (lagS: number) => Math.ceil(lagS * 10 * 8);

const running = async (page: Parameters<typeof getState>[0]) =>
  activeTruckOf(await getState(page)).engine.running;

for (const spec of JOURNEY_APPLIANCES) {
  test.describe(`engine on ${spec.id}`, () => {
    test.beforeEach(async ({ page }) => {
      await load(page, 'tank-attack', spec.id, undefined, { cold: true });
    });

    test('starts from cold only with the ignition on and START held until it fires', async ({
      page,
    }) => {
      const status = page.getByRole('status', { name: 'Engine' });
      await expect(status).toHaveText('Stopped · ignition off');
      expect(activeTruckOf(await getState(page)).rpm).toBe(0);

      // START with the ignition off does nothing.
      await holdEngineSwitch(page, 'start', 30);
      expect(await running(page)).toBe(false);

      await setIgnition(page, true);
      await expect(status).toHaveText('Stopped · ignition on');
      // Let go of START before it fires and it doesn't catch.
      await holdEngineSwitch(page, 'start', Math.floor(spec.engine.crankS * 10 * 0.5));
      await stepAndSettle(page, 20);
      expect(await running(page)).toBe(false);

      await holdEngineSwitch(page, 'start', Math.ceil(spec.engine.crankS * 10) + 2);
      await stepAndSettle(page, settleTicks(spec.engine.rpmLagS));
      expect(await running(page)).toBe(true);
      await expect(status).toHaveText('Running');
      expect(activeTruckOf(await getState(page)).rpm).toBeCloseTo(spec.engine.idleRpm, -1);
    });

    test('a tap on STOP only dips it; held, it stops, and the ignition goes off after', async ({
      page,
    }) => {
      await startEngine(page);
      await stepAndSettle(page, settleTicks(spec.engine.rpmLagS));
      await holdEngineSwitch(page, 'stop', 1);
      await stepAndSettle(page, settleTicks(spec.engine.rpmLagS));
      expect(await running(page)).toBe(true);
      expect(activeTruckOf(await getState(page)).rpm).toBeCloseTo(spec.engine.idleRpm, -1);

      await holdEngineSwitch(page, 'stop', 40);
      expect(await running(page)).toBe(false);
      expect(activeTruckOf(await getState(page)).rpm).toBe(0);
      await setIgnition(page, false);
      await expect(page.getByRole('status', { name: 'Engine' })).toHaveText(
        'Stopped · ignition off',
      );
    });

    test(`STOP with the ignition off ${spec.engine.controls.stop.needsIgnition ? 'does nothing' : 'still stops it'}`, async ({
      page,
    }) => {
      await startEngine(page);
      await setIgnition(page, false);
      const stop = await engineSwitch(page, 'stop');
      await stop.focus();
      await page.keyboard.down(' ');
      await stepAndSettle(page, 40);
      if (spec.engine.controls.stop.needsIgnition) {
        await expect(page.getByRole('status', { name: 'Engine' })).toHaveText(
          'Running · STOP needs the ignition on',
        );
      }
      await page.keyboard.up(' ');
      expect(await running(page)).toBe(spec.engine.controls.stop.needsIgnition);
    });
  });
}

for (const spec of REALISTIC_APPLIANCES) {
  test(`the realistic ${spec.id} panel starts and stops it, its lamps lit only with the ignition on and the engine stopped`, async ({
    page,
  }) => {
    await load(page, 'tank-attack', spec.id, undefined, { cold: true });
    await showRealistic(page);
    const charge = page.getByRole('img', { name: /^Charge \(ALT\) lamp/ });
    await expect(charge).toHaveAccessibleName('Charge (ALT) lamp: off');
    await setIgnition(page, true);
    await expect(charge).toHaveAccessibleName('Charge (ALT) lamp: lit');
    await holdEngineSwitch(page, 'start', Math.ceil(spec.engine.crankS * 10) + 2);
    expect(await running(page)).toBe(true);
    await expect(charge).toHaveAccessibleName('Charge (ALT) lamp: off');
    await holdEngineSwitch(page, 'stop', 40);
    expect(await running(page)).toBe(false);
    await expect(charge).toHaveAccessibleName('Charge (ALT) lamp: lit');
  });
}
