// Sim states for the M5 relay fixtures (docs/TESTING.md §3.2): pure sim calls on the closed- and
// open-relay scenarios, the player's appliance and the base pump's chosen per fixture set.
import { inletOfKind, primerSwitchIds } from '../../sim/appliances/controls';
import { switchTruck } from '../../sim/engine';
import { getScenario } from '../../sim/scenarios';
import type { SupportSpecs } from '../../sim/scenarios/types';
import type { ApplianceSpec, ControlId, PlayerInputs, SimState } from '../../sim/types';
import { chargedFor, settle } from './panelStates';

export type RelayStateId =
  'closed-working' | 'closed-over-run' | 'burst' | 'open-dam' | 'base-panel';

/** Scenario each state is built from, so the header picker shows it. */
export const RELAY_STATE_SCENARIO: Readonly<Record<RelayStateId, string>> = {
  'closed-working': 'closed-relay',
  'closed-over-run': 'closed-relay',
  burst: 'closed-relay',
  'open-dam': 'open-relay',
  'base-panel': 'closed-relay',
};

/** Attack pump throttle while working the relay: both lines at a comfortable residual. */
const WORKING_THROTTLE = 0.6;

const inputs = (throttle: number, open: readonly ControlId[], on: readonly ControlId[] = []) =>
  ({
    throttle,
    valves: Object.fromEntries(open.map((id) => [id, 1])),
    switches: Object.fromEntries(on.map((id) => [id, true])),
  }) satisfies PlayerInputs;

/**
 * Sim state for a generated relay fixture. 'closed-working': the relay inlet and both lines open
 * at the working throttle. 'closed-over-run': the same at full throttle. 'burst': working, then the
 * relay inlet slammed shut for a tick (a length bursts) and opened again. 'open-dam': primed on the
 * portable dam, both lines open at the working throttle. 'base-panel': closed-working, then the
 * player switches to the base pump.
 */
export function relayState(
  spec: ApplianceSpec,
  id: RelayStateId,
  support?: SupportSpecs,
): SimState {
  const built = getScenario(RELAY_STATE_SCENARIO[id]).build(spec, support).state;
  const inlet = inletOfKind(spec, 'suction');
  const lines = built.lines.map((l) => l.deliveryId);
  const working = inputs(WORKING_THROTTLE, [inlet, ...lines]);
  // Every fixture here works the attack lines: they start charged (the fill is the scene's fixture).
  const initial = chargedFor(built, working);
  switch (id) {
    case 'closed-working':
      return settle(initial, working, 15);
    case 'closed-over-run':
      return settle(initial, inputs(1, [inlet, ...lines]), 15);
    case 'burst': {
      const slammed = settle(settle(initial, working, 15), inputs(WORKING_THROTTLE, lines), 0.1);
      return settle(slammed, working, 3);
    }
    case 'open-dam': {
      let s = initial;
      const priming = inputs(0, [inlet], primerSwitchIds(spec));
      for (let i = 0; i < 120 && s.trucks[0]?.pump.primed !== true; i++) s = settle(s, priming, 1);
      if (s.trucks[0]?.pump.primed !== true) throw new Error(`${spec.id} never primed`);
      return settle(s, working, 20);
    }
    case 'base-panel': {
      const s = settle(initial, working, 15);
      return switchTruck(s, 'base', working);
    }
  }
}
