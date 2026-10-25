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

/** Another truck the scenario puts on the fireground, which holds fixed settings (AI later). */
export interface SupportRole {
  /** Truck id in the built state, e.g. 'base'. */
  id: string;
  /** UI name, e.g. 'Base pump'. */
  label: string;
  requires: ScenarioRequirements;
}

/** Appliance chosen for each support role, by role id; a missing role takes the player's. */
export type SupportSpecs = Readonly<Record<string, ApplianceSpec>>;

export interface Scenario {
  id: string;
  title: string;
  /** What the player's appliance needs. */
  requires: ScenarioRequirements;
  /** Other trucks on the fireground, each with what its appliance needs. */
  support?: readonly SupportRole[];
  /**
   * Initial state and input timeline for the player on `spec` (script keyed by its control ids),
   * with each support role on `support[role]` or, by default, the same appliance.
   */
  build(spec: ApplianceSpec, support?: SupportSpecs): ScriptedRun;
}

/** The appliance a support role uses: the one chosen for it, or the player's. */
export function supportSpec(
  role: Pick<SupportRole, 'id'>,
  spec: ApplianceSpec,
  support: SupportSpecs = {},
): ApplianceSpec {
  return support[role.id] ?? spec;
}

/**
 * Whether the player's `spec` can play the scenario, with each support role on `support[role]` or
 * on the same appliance.
 */
export function supports(
  scenario: Scenario,
  spec: ApplianceSpec,
  support: SupportSpecs = {},
): boolean {
  return (
    meets(scenario.requires, spec) &&
    (scenario.support ?? []).every((role) => meets(role.requires, supportSpec(role, spec, support)))
  );
}

/** Whether `spec` has every capability in `requires`. */
function meets(requires: ScenarioRequirements, spec: ApplianceSpec): boolean {
  const { tank, minDeliveries, suction = false, primer = false } = requires;
  const hasTank = spec.tank !== undefined && spec.inlets.some((i) => i.kind === 'tank');
  const hasSuction = spec.inlets.some((i) => i.kind === 'suction');
  return (
    (!tank || hasTank) &&
    (!suction || hasSuction) &&
    (!primer || spec.primer !== undefined) &&
    spec.deliveries.length >= minDeliveries
  );
}
