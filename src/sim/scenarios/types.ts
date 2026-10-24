import type { ApplianceSpec, ControlId, SimState } from '../types';

/** Capabilities an appliance needs to play a scenario (ARCHITECTURE §9.6). */
export interface ScenarioRequirements {
  tank: boolean;
  minDeliveries: number;
  /** An external suction inlet (hydrant or draught supply). */
  suction?: boolean;
  /** A way to prime for draughting: any primer, self-priming included. */
  primer?: boolean;
}

/** Input changes applied at sim time `tS`; unspecified controls keep their value. */
export interface ScriptStep {
  tS: number;
  throttle?: number;
  valves?: Record<ControlId, number>;
  switches?: Record<ControlId, boolean>;
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
  const { tank, minDeliveries, suction = false, primer = false } = scenario.requires;
  const hasTank = spec.tank !== undefined && spec.inlets.some((i) => i.kind === 'tank');
  const hasSuction = spec.inlets.some((i) => i.kind === 'suction');
  return (
    (!tank || hasTank) &&
    (!suction || hasSuction) &&
    (!primer || spec.primer !== undefined) &&
    spec.deliveries.length >= minDeliveries
  );
}
