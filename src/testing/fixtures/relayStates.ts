// Sim states for the M5 relay fixtures (docs/TESTING.md §3.2): pure sim calls on the closed- and
// open-relay scenarios, the player's appliance and the base pump's chosen per fixture set.
import { inletOfKind, primerSwitchIds } from '../../sim/appliances/controls';
import { switchTruck } from '../../sim/engine';
import { getScenario } from '../../sim/scenarios';
import { withHeavyLines } from '../../sim/scenarios/heavyLines';
import type { SupportSpecs } from '../../sim/scenarios/types';
import type { ApplianceSpec, ControlId, PlayerInputs, SimState } from '../../sim/types';
import { chargedFor, settle, throttleForKpa } from './panelStates';
import { OVERFLOW_FIXTURE_S } from './sourceStates';

export type RelayStateId =
  'closed-working' | 'closed-over-run' | 'burst' | 'open-dam' | 'dam-overflowing' | 'base-panel';

/** Scenario each state is built from, so the header picker shows it. */
export const RELAY_STATE_SCENARIO: Readonly<Record<RelayStateId, string>> = {
  'closed-working': 'closed-relay',
  'closed-over-run': 'closed-relay',
  burst: 'closed-relay',
  'open-dam': 'open-relay',
  'dam-overflowing': 'open-relay',
  'base-panel': 'closed-relay',
};

/** Attack pump throttle on the heavy lines and the open relay: a comfortable residual. */
const WORKING_THROTTLE = 0.6;

/** Attack pump discharge the closed relay's bush lines are trimmed to: ~250 kPa at each branch. */
const BUSH_WORKING_KPA = 950;

const inputs = (throttle: number, open: readonly ControlId[], on: readonly ControlId[] = []) =>
  ({
    throttle,
    valves: Object.fromEntries(open.map((id) => [id, 1])),
    switches: Object.fromEntries(on.map((id) => [id, true])),
  }) satisfies PlayerInputs;

/**
 * Sim state for a generated relay fixture. 'closed-working': the relay inlet and both bush lines
 * open, trimmed to `BUSH_WORKING_KPA`. 'closed-over-run': heavy lines (`withHeavyLines`) at full
 * throttle. 'burst': heavy lines working, then the relay inlet slammed shut for a tick (a length
 * bursts) and opened again. 'open-dam': primed on the
 * portable dam, both lines open at the working throttle. 'dam-overflowing': the dam full, the attack
 * pump idle with its lines shut, the relay left filling it for `OVERFLOW_FIXTURE_S`. 'base-panel':
 * closed-working, then the player switches to the base pump.
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
  // The scenario's bush lines can't over-run or burst the relay (issue #10): those use heavy lines.
  const heavy = withHeavyLines(built);
  const heavyLines = heavy.lines.map((l) => l.deliveryId);
  const trimmedInputs = () => {
    const at = (x: number) => inputs(x, [inlet, ...lines]);
    return at(throttleForKpa(built, at, BUSH_WORKING_KPA));
  };
  const trimmed = (open: PlayerInputs) => settle(chargedFor(built, open), open, 15);
  switch (id) {
    case 'closed-working':
      return trimmed(trimmedInputs());
    case 'closed-over-run': {
      const full = inputs(1, [inlet, ...heavyLines]);
      return settle(chargedFor(heavy, full), full, 15);
    }
    case 'burst': {
      const flowing = inputs(WORKING_THROTTLE, [inlet, ...heavyLines]);
      const s = settle(chargedFor(heavy, flowing), flowing, 15);
      const slammed = settle(s, inputs(WORKING_THROTTLE, heavyLines), 0.1);
      return settle(slammed, flowing, 3);
    }
    case 'open-dam': {
      let s = initial;
      const priming = inputs(0, [inlet], primerSwitchIds(spec));
      for (let i = 0; i < 120 && s.trucks[0]?.pump.primed !== true; i++) s = settle(s, priming, 1);
      if (s.trucks[0]?.pump.primed !== true) throw new Error(`${spec.id} never primed`);
      return settle(s, working, 20);
    }
    case 'dam-overflowing': {
      const full = initial.sources.map((x) =>
        x.kind === 'static' && x.capacityL !== undefined ? { ...x, volumeL: x.capacityL } : x,
      );
      return settle({ ...initial, sources: full }, inputs(0, [inlet]), OVERFLOW_FIXTURE_S);
    }
    case 'base-panel': {
      const open = trimmedInputs();
      return switchTruck(trimmed(open), 'base', open);
    }
  }
}
