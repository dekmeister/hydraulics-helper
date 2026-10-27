// Sim states for the village and interface scene fixtures (issue #10): each setting's backdrop with
// its crews at work. Pure sim calls, per appliance.
import { inletOfKind } from '../../sim/appliances/controls';
import { applyEffect } from '../../sim/lesson/effects';
import { getScenario } from '../../sim/scenarios';
import type { ApplianceSpec, ControlId, PlayerInputs, SimState } from '../../sim/types';
import { chargedFor, settle, throttleForKpa } from './panelStates';

export type SettingStateId = 'village' | 'interface';

/** Scenario each state is built from, so the scene draws its backdrop. */
export const SETTING_STATE_SCENARIO: Readonly<Record<SettingStateId, string>> = {
  village: 'hydrant-tank',
  interface: 'incident',
};

/**
 * Discharge each is trimmed to, kPa: ~700 for the village's 38 mm lines, ~950 for the interface's
 * uphill 38 mm and 25 mm canvas.
 */
const WORKING_KPA: Readonly<Record<SettingStateId, number>> = { village: 700, interface: 950 };

/** Tank at the start of each, as a fraction of capacity. */
const LOW_TANK = 0.3;

export function isSettingState(id: string): id is SettingStateId {
  return id in SETTING_STATE_SCENARIO;
}

const inputs = (throttle: number, open: readonly ControlId[]): PlayerInputs => ({
  throttle,
  valves: Object.fromEntries(open.map((id) => [id, 1])),
  switches: {},
});

/**
 * 'village': hydrant to tank and both crews' lines open on the house fire. 'interface': the
 * incident once every event has fired (crew 1 moved uphill, crew 2's line in, the hydrant on),
 * with hydrant to tank and both lines open. Both start on a tank at `LOW_TANK`.
 */
export function settingState(spec: ApplianceSpec, id: SettingStateId): SimState {
  const scenario = getScenario(SETTING_STATE_SCENARIO[id]);
  const effects = (scenario.lesson?.events ?? []).flatMap((e) => e.effects ?? []);
  const fired = effects.reduce(
    (s, e) => applyEffect(s, s.activeTruckId, e),
    scenario.build(spec).state,
  );
  // By the time the hydrant arrives the tank is low: it fills without overflowing round the truck.
  const built = {
    ...fired,
    trucks: fired.trucks.map((t) => ({ ...t, tankL: LOW_TANK * (t.spec.tank?.capacityL ?? 0) })),
  };
  const open = [
    inletOfKind(spec, 'tank'),
    inletOfKind(spec, 'tankFill'),
    ...built.lines.map((l) => l.deliveryId),
  ];
  const at = (t: number) => inputs(t, open);
  const working = at(throttleForKpa(built, at, WORKING_KPA[id]));
  return settle(chargedFor(built, working), working);
}
