// Sim states for the M4 source and fault fixtures (docs/TESTING.md §3.2): pure sim calls, built per
// appliance from the hydrant, draughting and tank-attack scenarios.
import { inletOfKind, switchControlIds } from '../../sim/appliances/controls';
import { getScenario } from '../../sim/scenarios';
import { TANK_ATTACK } from '../../sim/scenarios/tankAttack';
import type { ApplianceSpec, ControlId, PlayerInputs, SimState } from '../../sim/types';
import { settle, TANK_ATTACK_TARGET_KPA, throttleForKpa } from './panelStates';

export type SourceStateId =
  'draught-priming' | 'draught-working' | 'cavitating' | 'hydrant' | 'faults';

/** Scenario each state is built from, so the header picker shows it. */
export const SOURCE_STATE_SCENARIO: Readonly<Record<SourceStateId, string>> = {
  'draught-priming': 'draughting',
  'draught-working': 'draughting',
  cavitating: 'draughting',
  hydrant: 'hydrant-supply',
  faults: 'tank-attack',
};

const inletOf = inletOfKind;
const primerSwitch = switchControlIds;

const inputs = (throttle: number, open: readonly ControlId[], on: readonly ControlId[] = []) =>
  ({
    throttle,
    valves: Object.fromEntries(open.map((id) => [id, 1])),
    switches: Object.fromEntries(on.map((id) => [id, true])),
  }) satisfies PlayerInputs;

/** Run the primer (or let a self-priming pump prime) until it catches. */
function primed(spec: ApplianceSpec, state: SimState): SimState {
  let s = state;
  const priming = inputs(0, [inletOf(spec, 'suction')], primerSwitch(spec));
  for (let i = 0; i < 120 && s.trucks[0]?.pump.primed !== true; i++) s = settle(s, priming, 1);
  if (s.trucks[0]?.pump.primed !== true) throw new Error(`${spec.id} never primed`);
  return s;
}

/**
 * Sim state for a generated source fixture. 'draught-priming': primer held 8 s on the suction.
 * 'draught-working': primed, the first line open at the working discharge. 'cavitating': both lines
 * open at full throttle. 'hydrant': the first line open on hydrant supply at the working discharge.
 * 'faults': tank attack churning with every delivery shut, casing hot, just after a water hammer.
 */
export function sourceState(spec: ApplianceSpec, id: SourceStateId): SimState {
  const initial = getScenario(SOURCE_STATE_SCENARIO[id]).build(spec).state;
  const lines = initial.lines.map((l) => l.deliveryId);
  const first = lines.slice(0, 1);
  switch (id) {
    case 'draught-priming':
      return settle(initial, inputs(0, [inletOf(spec, 'suction')], primerSwitch(spec)), 8);
    case 'draught-working': {
      const s = primed(spec, initial);
      const open = [inletOf(spec, 'suction'), ...first];
      const t = throttleForKpa(s, (x) => inputs(x, open), TANK_ATTACK_TARGET_KPA);
      return settle(s, inputs(t, open));
    }
    case 'cavitating':
      return settle(primed(spec, initial), inputs(1, [inletOf(spec, 'suction'), ...lines]));
    case 'hydrant': {
      const open = [inletOf(spec, 'suction'), ...first];
      const t = throttleForKpa(initial, (x) => inputs(x, open), TANK_ATTACK_TARGET_KPA);
      return settle(initial, inputs(t, open));
    }
    case 'faults': {
      const attack = TANK_ATTACK.build(spec).state;
      const flowing = settle(attack, inputs(0.6, [inletOf(spec, 'tank'), ...first]));
      // Slam the line shut on the last tick: the hammer lamp is fresh.
      const s = settle(flowing, inputs(0.6, [inletOf(spec, 'tank')]), 0.1);
      return { ...s, trucks: s.trucks.map((t) => ({ ...t, pump: { ...t.pump, tempC: 85 } })) };
    }
  }
}
