import type { ApplianceSpec, ControlId, SimState } from '../types';

/** Capabilities an appliance needs to play a scenario (ARCHITECTURE §9.6). */
export interface ScenarioRequirements {
  tank: boolean;
  minDeliveries: number;
}

/** Input changes applied at sim time `tS`; unspecified controls keep their value. */
export interface ScriptStep {
  tS: number;
  throttle?: number;
  valves?: Record<ControlId, number>;
}

export interface ScriptedRun {
  state: SimState;
  script: ScriptStep[];
  durationS: number;
}

export interface Scenario {
  id: string;
  title: string;
  requires: ScenarioRequirements;
  /** Initial state and input timeline for `spec`, keyed by that spec's control ids. */
  build(spec: ApplianceSpec): ScriptedRun;
}

/** Whether `spec` has every capability the scenario requires. */
export function supports(scenario: Scenario, spec: ApplianceSpec): boolean {
  const { tank, minDeliveries } = scenario.requires;
  const hasTank = spec.tank !== undefined && spec.inlets.some((i) => i.kind === 'tank');
  return (!tank || hasTank) && spec.deliveries.length >= minDeliveries;
}
