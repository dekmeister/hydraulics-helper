// Sim states for the generated panel fixtures (docs/TESTING.md §3.2). Pure sim calls, built per
// appliance from the tank-attack scenario so every appliance gets the same set.
import { TICK_S } from '../../sim/constants';
import { advance } from '../../sim/engine';
import { TANK_ATTACK } from '../../sim/scenarios/tankAttack';
import type { ApplianceSpec, ControlId, PlayerInputs, SimState } from '../../sim/types';

/** Discharge the `tank-attack-700` fixture is trimmed to, kPa: the manual's working branch pressure. */
export const TANK_ATTACK_TARGET_KPA = 700;

/** Sim time each fixture state runs for before capture, s: long past the 0.5 s rpm lag. */
const RUN_S = 10;

export type PanelStateId = 'idle' | 'tank-attack-700' | 'tank-low' | 'tank-empty';

function settle(state: SimState, inputs: PlayerInputs, seconds = RUN_S): SimState {
  let s = state;
  const ticks = Math.round(seconds / TICK_S);
  for (let i = 0; i < ticks; i++) s = advance(s, inputs, TICK_S);
  return s;
}

function withTankL(state: SimState, tankL: number): SimState {
  return { ...state, trucks: state.trucks.map((t) => ({ ...t, tankL })) };
}

const discharge = (s: SimState) => s.trucks[0]?.readings.dischargeKpa ?? 0;

/** Tank-to-pump open and the first line's delivery open, at `throttle`. */
function attackInputs(spec: ApplianceSpec, deliveryId: ControlId, throttle: number): PlayerInputs {
  const valves: Record<ControlId, number> = { [deliveryId]: 1 };
  for (const i of spec.inlets) if (i.kind === 'tank') valves[i.id] = 1;
  return { throttle, valves, switches: {} };
}

/** Throttle that holds `targetKpa` on the first line: bisection, since discharge rises with throttle. */
function throttleFor(
  initial: SimState,
  spec: ApplianceSpec,
  deliveryId: ControlId,
  targetKpa: number,
) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (discharge(settle(initial, attackInputs(spec, deliveryId, mid))) < targetKpa) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Sim state for a generated panel fixture. Throws if the appliance can't play tank attack. */
export function panelState(spec: ApplianceSpec, id: PanelStateId): SimState {
  const initial = TANK_ATTACK.build(spec).state;
  if (id === 'idle') return initial;
  const line = initial.lines[0];
  if (line === undefined) throw new Error(`tank attack laid no line on ${spec.id}`);
  const capacityL = spec.tank?.capacityL ?? 0;
  const throttle = throttleFor(initial, spec, line.deliveryId, TANK_ATTACK_TARGET_KPA);
  const inputs = attackInputs(spec, line.deliveryId, throttle);
  switch (id) {
    case 'tank-attack-700':
      return settle(initial, inputs);
    case 'tank-low':
      // Starts at a fifth of a tank; 10 s at the branch's flow leaves it just under.
      return settle(withTankL(initial, 0.2 * capacityL), inputs);
    case 'tank-empty':
      return settle(withTankL(initial, 0), inputs);
  }
}
