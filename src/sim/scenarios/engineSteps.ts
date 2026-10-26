// Script steps that start and stop a truck's engine from its panel switches, as a player would.
import type { OperatorStep } from '../lesson/operator';
import type { ApplianceSpec } from '../types';
import type { ScriptStep } from './types';

/** Openings a line is closed through, a second apart: halving, so no one step cuts much flow. */
const EASE_SHUT = [0.5, 0.25, 0.12, 0.06, 0.03, 0.015, 0];

/** How much longer than its crank the script holds START, or holds STOP at all, s. */
const HOLD_MARGIN_S = 1;
const STOP_HOLD_S = 4;

/** Ignition on and START held from `tS` until well past the crank, then let go. */
export function startEngineSteps(spec: ApplianceSpec, tS = 0): ScriptStep[] {
  const { ignition, start } = spec.engine.controls;
  return [
    { tS, switches: { [ignition]: true, [start]: true } },
    { tS: tS + Math.ceil(spec.engine.crankS) + HOLD_MARGIN_S, switches: { [start]: false } },
  ];
}

/** STOP held from `tS` until the engine has run down, then let go and the ignition switched off. */
export function stopEngineSteps(spec: ApplianceSpec, tS: number): ScriptStep[] {
  const { ignition, stop } = spec.engine.controls;
  return [
    { tS, switches: { [stop.id]: true } },
    { tS: tS + STOP_HOLD_S, switches: { [stop.id]: false, [ignition]: false } },
  ];
}

/** Longest a solution waits for a line to charge, s. */
const CHARGE_MAX_S = 120;

/**
 * Open `lines` with the pump at idle and wait until water reaches every branch: charge before
 * building pressure. An empty hose takes all a pump can give, so charging at working revs runs a
 * draught, hydrant or relay supply out (issue #6).
 */
export function chargeLines(lines: readonly string[]): OperatorStep[] {
  return [
    { throttle: 0 },
    ...lines.map((line): OperatorStep => ({ open: { line } })),
    ...lines.map((line): OperatorStep => ({
      until: { kind: 'flow', line, min: 1 },
      maxS: CHARGE_MAX_S,
    })),
  ];
}

/** A solution's opening: ignition on, crank until it fires. */
export const START_UP: readonly OperatorStep[] = [{ ignition: true }, { crank: true }];

/**
 * A solution's close: throttle to idle, let it settle, ease each line shut, stop the engine and
 * switch the ignition off (`shutdownObjective`).
 */
export function shutDown(lines: readonly string[]): OperatorStep[] {
  return [
    { trim: null },
    { throttle: 0 },
    { wait: 3 },
    ...lines.flatMap((line) =>
      EASE_SHUT.flatMap((to): OperatorStep[] => [{ open: { line }, to }, { wait: 1 }]),
    ),
    { stopEngine: true },
    { ignition: false },
    { wait: 1 },
  ];
}
