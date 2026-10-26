// Failures and objectives most lessons share.
import { PUMP_DAMAGE_CAVITATION_S, PUMP_DAMAGE_OVERHEAT_S } from '../constants';
import type { Failure, Objective } from './types';

/** The pump damaged by sustained cavitation or churning hot. */
export const PUMP_DAMAGE: readonly Failure[] = [
  {
    id: 'cavitation-damage',
    text: `The pump cavitated for over ${String(PUMP_DAMAGE_CAVITATION_S)} s and was damaged.`,
    when: { kind: 'tally', tally: 'cavitationS', min: PUMP_DAMAGE_CAVITATION_S },
  },
  {
    id: 'overheat-damage',
    text: `The pump ran hot for over ${String(PUMP_DAMAGE_OVERHEAT_S)} s and was damaged.`,
    when: { kind: 'tally', tally: 'overheatS', min: PUMP_DAMAGE_OVERHEAT_S },
  },
];

/** The player's tank ran dry with crews depending on it. */
export const TANK_DRY: Failure = {
  id: 'tank-dry',
  text: 'The tank ran dry with crews on the branches.',
  when: { kind: 'tank', max: 0 },
};

/**
 * Every lesson ends with the pump shut down properly, once `after` is done: throttle to idle, the
 * crews' `lines` eased shut, the engine stopped (STOP held until it has run down) and the ignition
 * off.
 */
export function shutdownObjective(after: readonly string[], lines: readonly string[]): Objective {
  return {
    id: 'shutdown',
    text: 'Shut down: throttle to idle, ease the deliveries shut, stop the engine, ignition off.',
    when: {
      kind: 'all',
      of: [
        { kind: 'throttle', max: 0.02 },
        ...lines.map((line) => ({ kind: 'valve' as const, valve: { line }, max: 0 })),
        { kind: 'engine', running: false, ignition: false },
      ],
    },
    after: [...after],
    windDown: true,
  };
}
