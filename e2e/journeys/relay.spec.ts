// M5 journeys (M5 demo): a closed relay pushing water uphill, worked from the attack pump's
// real controls; switching trucks from the map and the switcher; the shutdown spike bursting a
// relay hose; an open relay through a portable dam. On every journey appliance that can play
// them, and once with a different appliance as the base pump.
import type { Page } from '@playwright/test';
import { CAVITATION_FLUTTER_COMPOUND_KPA, RELAY_MIN_RESIDUAL_KPA } from '../../src/sim/constants';
import { getScenario } from '../../src/sim/scenarios';
import { supports } from '../../src/sim/scenarios/types';
import { TEST_APPLIANCE } from '../../src/sim/appliances/testAppliance';
import { expect, test } from '../fixtures';
import {
  activeTruckOf,
  controlName,
  dragThrottle,
  dragValve,
  expectStatus,
  getState,
  JOURNEY_APPLIANCES,
  layoutFor,
  stepAndSettle,
  tapOrClick,
} from '../panel';
import { relayLay, tapTruck } from '../scene';
import {
  compoundShown,
  inletOf,
  load,
  openInlet,
  overRuns,
  prime,
  relayBurstsOnSlam,
} from '../sources';

const truckButton = (page: Page, label: string) =>
  page.getByRole('group', { name: 'Truck you operate' }).getByRole('button', { name: label });

for (const spec of JOURNEY_APPLIANCES.filter((s) => supports(getScenario('closed-relay'), s))) {
  test.describe(`closed relay on ${spec.id}`, () => {
    test('hold the residual on the relay, over-run it, and recover', async ({ page }, info) => {
      await load(page, 'closed-relay', spec.id);
      const layout = layoutFor(spec.id);
      const lines = (await getState(page)).lines.filter((l) => l.truckId === 'attack');
      // The base pump is already pumping: the relay is charged up to the shut inlet.
      await stepAndSettle(page, 50);
      await expect(relayLay(page, 'relay')).toHaveAttribute('data-state', 'charged');

      await openInlet(page, spec, 'suction', info);
      for (const line of lines) {
        await dragValve(
          page,
          page.getByRole('slider', { name: controlName(layout, line.deliveryId) }),
          1,
        );
      }
      await dragThrottle(page, 0.6);
      await stepAndSettle(page, 150);
      expect(await compoundShown(page, spec)).toBeGreaterThan(RELAY_MIN_RESIDUAL_KPA);
      await expect(relayLay(page, 'relay')).toHaveAttribute('data-state', 'charged');
      await expectStatus(page, 'No warnings');
      await expect(page.locator('[data-relay="relay"]')).toContainText('kPa at the inlet');

      if (!overRuns('closed-relay', spec)) {
        test.info().annotations.push({
          type: 'physics',
          description: `${spec.id}'s lines can't out-draw the relay: no over-run to recover from`,
        });
        return;
      }

      // Full throttle: more than the relay can give. The layflat goes soft at inlet zero.
      await dragThrottle(page, 1);
      await stepAndSettle(page, 100);
      // Inlet zero, within the gauge's cavitation flutter.
      expect(Math.abs(await compoundShown(page, spec))).toBeLessThanOrEqual(
        CAVITATION_FLUTTER_COMPOUND_KPA + 1,
      );
      await expect(relayLay(page, 'relay')).toHaveAttribute('data-state', 'soft');
      await expectStatus(page, /Relay residual low.*100 kPa/);

      await dragThrottle(page, 0.6);
      await stepAndSettle(page, 100);
      expect(await compoundShown(page, spec)).toBeGreaterThan(RELAY_MIN_RESIDUAL_KPA);
      await expect(relayLay(page, 'relay')).toHaveAttribute('data-state', 'charged');
    });

    test('slamming the relay inlet shut bursts the relay hose', async ({ page }, info) => {
      // The surge scales with the flow cut off: a light tanker's relay doesn't carry enough.
      test.skip(!relayBurstsOnSlam(spec), `${spec.id}'s relay flow is too small to burst a length`);
      await load(page, 'closed-relay', spec.id);
      const layout = layoutFor(spec.id);
      const lines = (await getState(page)).lines.filter((l) => l.truckId === 'attack');
      await openInlet(page, spec, 'suction', info);
      for (const line of lines) {
        await dragValve(
          page,
          page.getByRole('slider', { name: controlName(layout, line.deliveryId) }),
          1,
        );
      }
      await dragThrottle(page, 0.6);
      await stepAndSettle(page, 150);
      await expect(relayLay(page, 'relay')).toHaveAttribute('data-state', 'charged');

      // A tap snaps the inlet valve shut in one go: the shutdown spike.
      const inlet = page.getByRole('slider', {
        name: controlName(layout, inletOf(spec, 'suction')),
      });
      await tapOrClick(inlet, info);
      await stepAndSettle(page, 1);
      await expect(relayLay(page, 'relay')).toHaveAttribute('data-state', 'burst');
      await expect(page.getByTestId('relay-burst-relay')).toBeVisible();
      await expectStatus(page, 'Relay hose burst');
      expect((await getState(page)).trucks.find((t) => t.id === 'base')?.tally.hoseBursts).toBe(1);
    });
  });

  test(`switch trucks on the map and with the switcher, base pump ${TEST_APPLIANCE.id}, on ${spec.id}`, async ({
    page,
  }, info) => {
    await load(page, 'closed-relay', spec.id, TEST_APPLIANCE.id);
    await expect(truckButton(page, 'Attack pump')).toHaveAttribute('aria-pressed', 'true');

    // Tap the base pump on the map: the panel becomes the base pump's.
    await tapTruck(page, 'base', info);
    await expect(truckButton(page, 'Base pump')).toHaveAttribute('aria-pressed', 'true');
    let state = await getState(page);
    expect(state.activeTruckId).toBe('base');
    await expect(page.locator('.pump-panel__appliance')).toHaveText(
      `Base pump · ${TEST_APPLIANCE.name}`,
    );
    const relay = state.links[0];
    if (relay === undefined) throw new Error('no relay');
    const relayValve = page.getByRole('slider', {
      name: controlName(layoutFor(TEST_APPLIANCE.id), relay.deliveryId),
    });
    // The relay delivery is a working valve, held open by the scenario.
    await expect(relayValve).toHaveAttribute('aria-valuenow', '100');
    await expect(page.locator(`.delivery-row[data-delivery="${relay.deliveryId}"]`)).toContainText(
      'Relay · 4 × 30 m 65 mm lined · to Attack pump · 20 m uphill',
    );

    // Ease the base pump's throttle, then go back to the attack pump with the switcher.
    await dragThrottle(page, 0.5);
    await stepAndSettle(page, 20);
    await tapOrClick(truckButton(page, 'Attack pump'), info);
    await expect(truckButton(page, 'Attack pump')).toHaveAttribute('aria-pressed', 'true');
    state = await getState(page);
    expect(activeTruckOf(state).id).toBe('attack');
    await stepAndSettle(page, 20);
    // The base pump holds what it was left with.
    const base = (await getState(page)).trucks.find((t) => t.id === 'base');
    expect(base?.inputs.throttle).toBeGreaterThan(0.4);
    expect(base?.inputs.throttle).toBeLessThan(0.6);
  });
}

for (const spec of JOURNEY_APPLIANCES.filter((s) => supports(getScenario('open-relay'), s))) {
  test(`open relay: draught from the portable dam the base pump fills, on ${spec.id}`, async ({
    page,
  }, info) => {
    await load(page, 'open-relay', spec.id);
    const layout = layoutFor(spec.id);
    const lines = (await getState(page)).lines.filter((l) => l.truckId === 'attack');
    const damVolume = async () => {
      const dam = (await getState(page)).sources.find((s) => s.id === 'portable-dam');
      return dam?.kind === 'static' ? dam.volumeL : Number.NaN;
    };
    await expect(page.getByTestId('portable-dam-portable-dam')).toBeVisible();

    await openInlet(page, spec, 'suction', info);
    await prime(page, spec);
    // Nothing drawn yet: the relay fills the dam.
    const filled = await damVolume();
    await stepAndSettle(page, 100);
    expect(await damVolume()).toBeGreaterThan(filled);
    await expect(relayLay(page, 'relay')).toHaveAttribute('data-state', 'charged');

    // Both lines flat out draw more than the relay brings: the level falls.
    for (const line of lines) {
      await dragValve(
        page,
        page.getByRole('slider', { name: controlName(layout, line.deliveryId) }),
        1,
      );
    }
    await dragThrottle(page, 1);
    await stepAndSettle(page, 50);
    const drawing = await damVolume();
    await stepAndSettle(page, 300);
    expect(await damVolume()).toBeLessThan(drawing);
    await expect(page.locator('[data-dam="portable-dam"]')).toContainText('of 5 000 L');
  });
}
