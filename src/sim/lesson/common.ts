// Failures most lessons share.
import { PUMP_DAMAGE_CAVITATION_S, PUMP_DAMAGE_OVERHEAT_S } from '../constants';
import type { Failure } from './types';

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
