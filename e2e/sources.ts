// Helpers for supply-side journeys (M4 sources, M5 relays): loading a scenario, opening inlets,
// priming through the real primer, and reading the compound gauge on any appliance.
import type { Page, TestInfo } from '@playwright/test';
import { inletOfKind, primerControlId } from '../src/sim/appliances/controls';
import { TICK_S } from '../src/sim/constants';
import { advance, chargeLines, warmStart } from '../src/sim/engine';
import { getScenario } from '../src/sim/scenarios';
import { withHeavyLines } from '../src/sim/scenarios/heavyLines';
import type { ApplianceSpec, PlayerInputs, SimState } from '../src/sim/types';
import { expect, gotoApp } from './fixtures';
import {
  activeTruckOf,
  controlName,
  getState,
  instrumentName,
  JOURNEY_APPLIANCES,
  layoutFor,
  meterValue,
  startEngine,
  stepAndSettle,
  tapOrClick,
} from './panel';

/**
 * Open the app on `scenario` with the player on `appliance` (support trucks on `support`), and
 * start the player's engine from its panel (`cold` leaves it as the scenario does: stopped).
 * `heavy` swaps the player's lines for the heavy test pair (`withHeavyLines`): the scenario's bush
 * lines can't over-run a draught or a relay, or burst one (issue #10). Built here and loaded as a
 * state, so it has no scenario: the scene draws the bush.
 */
export async function load(
  page: Page,
  scenario: string,
  appliance: string,
  support?: string,
  { cold = false, heavy = false }: { cold?: boolean; heavy?: boolean } = {},
) {
  await gotoApp(page);
  if (heavy) {
    const other = support === undefined ? undefined : specOf(support);
    const state = fireground(scenario, specOf(appliance), other, true);
    await page.evaluate((st) => {
      window.__pumpops?.load({ state: st });
    }, state);
  } else {
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
  if (!cold) await startEngine(page);
}

/** A journey appliance by id. */
function specOf(id: string): ApplianceSpec {
  const spec = JOURNEY_APPLIANCES.find((a) => a.id === id);
  if (spec === undefined) throw new Error(`unknown journey appliance '${id}'`);
  return spec;
}

/** The scenario's initial fireground, support roles on `support` (or the same), maybe heavy. */
function fireground(
  scenario: string,
  spec: ApplianceSpec,
  support: ApplianceSpec | undefined,
  heavy: boolean,
): SimState {
  const s = getScenario(scenario);
  const roles = Object.fromEntries((s.support ?? []).map((r) => [r.id, support ?? spec]));
  const built = s.build(spec, roles).state;
  return heavy ? withHeavyLines(built) : built;
}

export const inletOf = inletOfKind;
const primerControl = primerControlId;

/** Tap an inlet valve (its tap toggles it) and check it opened. */
export async function openInlet(
  page: Page,
  spec: ApplianceSpec,
  kind: 'tank' | 'suction' | 'tankFill',
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
    // Long enough for the slowest primer (a hand diaphragm, ~32 s at 4 m).
    const held = await holdPrimer(page, controlName(layoutFor(spec.id), id), 450);
    await expect(
      page.locator('.primer, .pull-primer, .hand-primer', { has: held.primer }),
    ).toHaveAttribute('data-state', 'primed');
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

/**
 * The scenario's fireground on `spec` after `ticks` with the player's suction inlet and every line
 * open at `throttle`, the pump primed: headless, to ask the sim what a journey will see.
 */
function pushed(
  scenario: string,
  spec: ApplianceSpec,
  throttle: number,
  ticks: number,
  heavy = false,
): SimState {
  // Steady over-run: the lines start charged, so the fill's rush isn't counted.
  const built = chargeLines(warmStart(fireground(scenario, spec, undefined, heavy)));
  const player = built.activeTruckId;
  let s: SimState = {
    ...built,
    trucks: built.trucks.map((t) =>
      t.id === player ? { ...t, pump: { ...t.pump, primed: true, casingWet: true } } : t,
    ),
  };
  const open = [
    inletOf(spec, 'suction'),
    ...s.lines.filter((l) => l.truckId === player).map((l) => l.deliveryId),
  ];
  const inputs: PlayerInputs = {
    throttle,
    valves: Object.fromEntries(open.map((id) => [id, 1])),
    switches: {},
  };
  for (let i = 0; i < ticks; i++) s = advance(s, inputs, TICK_S);
  return s;
}

/**
 * Whether full throttle with every line open runs `spec` past its supply on the scenario's
 * fireground (cavitation). A small pump can't over-run a good hydrant, a 4 m draught or a relay
 * with its crew lines: that's physics, so a journey checks before it asks for it.
 */
export function overRuns(scenario: string, spec: ApplianceSpec, heavy = false): boolean {
  const s = pushed(scenario, spec, 1, 100, heavy);
  return (s.trucks.find((t) => t.id === s.activeTruckId)?.readings.cavitation ?? 0) > 0;
}

/**
 * Whether every line flat out draws the open relay's portable dam down on `spec` (more than the
 * relay brings). Bush lines on a small pump can't (issue #10): that's physics, so check first.
 */
export function drainsPortableDam(spec: ApplianceSpec, heavy = false): boolean {
  const volume = (s: SimState) => {
    const dam = s.sources.find((x) => x.id === 'portable-dam');
    return dam?.kind === 'static' ? dam.volumeL : Number.NaN;
  };
  const before = pushed('open-relay', spec, 1, Math.round(50 / TICK_S), heavy);
  let s = before;
  const player = s.trucks.find((t) => t.id === s.activeTruckId);
  if (player === undefined) return false;
  for (let i = 0; i < Math.round(300 / TICK_S); i++) s = advance(s, player.inputs, TICK_S);
  return volume(s) < volume(before);
}

/** Whether snapping the closed relay's inlet shut at 0.6 throttle bursts the relay on `spec`. */
export function relayBurstsOnSlam(spec: ApplianceSpec, heavy = false): boolean {
  let s = pushed('closed-relay', spec, 0.6, 150, heavy);
  const player = s.trucks.find((t) => t.id === s.activeTruckId);
  if (player === undefined) return false;
  const inputs = {
    ...player.inputs,
    valves: { ...player.inputs.valves, [inletOf(spec, 'suction')]: 0 },
  };
  s = advance(s, inputs, TICK_S);
  return s.links.some((l) => l.burst !== undefined);
}
