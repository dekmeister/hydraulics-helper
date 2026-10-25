// Helpers for supply-side journeys (M4 sources, M5 relays): loading a scenario, opening inlets,
// priming through the real primer, and reading the compound gauge on any appliance.
import type { Page, TestInfo } from '@playwright/test';
import { inletOfKind, primerControlId } from '../src/sim/appliances/controls';
import type { ApplianceSpec } from '../src/sim/types';
import { expect, gotoApp } from './fixtures';
import {
  activeTruckOf,
  controlName,
  getState,
  instrumentName,
  layoutFor,
  meterValue,
  stepAndSettle,
  tapOrClick,
} from './panel';

/** Open the app on `scenario` with the player on `appliance` (support trucks on `support`). */
export async function load(page: Page, scenario: string, appliance: string, support?: string) {
  await gotoApp(page);
  await page.evaluate(
    ([s, a, b]) => {
      window.__pumpops?.load({
        scenario: s,
        appliance: a,
        seed: 7,
        ...(b === '' ? {} : { support: b }),
      });
    },
    [scenario, appliance, support ?? ''] as const,
  );
}

export const inletOf = inletOfKind;
const primerControl = primerControlId;

/** Tap an inlet valve (its tap toggles it) and check it opened. */
export async function openInlet(
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
export async function holdPrimer(page: Page, name: string, ticks: number) {
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
export async function prime(page: Page, spec: ApplianceSpec) {
  const id = primerControl(spec);
  if (id === undefined) {
    await stepAndSettle(page, 300);
  } else {
    const held = await holdPrimer(page, controlName(layoutFor(spec.id), id), 250);
    await expect(page.locator('.primer, .pull-primer', { has: held.primer })).toHaveAttribute(
      'data-state',
      'primed',
    );
    await held.release();
  }
  expect(activeTruckOf(await getState(page)).pump.primed).toBe(true);
}

export const throttle = (page: Page) => page.getByRole('slider', { name: 'Throttle', exact: true });

/**
 * What the compound gauge shows, or, on an appliance with none fitted, the inlet pressure the
 * sim reports (the lesson still holds; there is just no needle to read it from).
 */
export async function compoundShown(page: Page, spec: ApplianceSpec): Promise<number> {
  const placed = spec.instruments.some((i) => i.kind === 'compound');
  if (placed)
    return meterValue(page, instrumentName(await getState(page), layoutFor(spec.id), 'compound'));
  return activeTruckOf(await getState(page)).readings.compoundKpa;
}

/** The compound gauge's needle colour flag, where one is fitted. */
export async function expectCompoundAlert(page: Page, spec: ApplianceSpec, alert: boolean) {
  if (!spec.instruments.some((i) => i.kind === 'compound')) return;
  const name = instrumentName(await getState(page), layoutFor(spec.id), 'compound');
  await expect(page.getByRole('meter', { name, exact: true })).toHaveAttribute(
    'data-alert',
    String(alert),
  );
}
