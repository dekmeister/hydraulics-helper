import type { OperatorStep } from '../lesson/operator';
import type { Condition, LessonDef } from '../lesson/types';
import { playerInstruments } from '../lesson/validate';
import type { ApplianceSpec, ControlId, InstrumentKind, SimState } from '../types';

/** Capabilities an appliance needs to play a scenario (docs/decisions/002). */
export interface ScenarioRequirements {
  tank: boolean;
  minDeliveries: number;
  /** An external suction inlet (hydrant or draught supply). */
  suction?: boolean;
  /** An inlet straight into the tank (hydrant to tank). */
  tankFill?: boolean;
  /** A way to prime for draughting: any primer, self-priming included. */
  primer?: boolean;
  /** Only these appliances, by spec id (a scenario written for one vehicle); default any. */
  appliances?: readonly string[];
}

/**
 * Input changes applied at sim time `tS`, or once `when` holds (checked against the player's
 * truck), whichever is later; unspecified controls keep their value. Steps fire in order.
 */
export interface ScriptStep {
  tS: number;
  when?: Condition;
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

/**
 * Where the job is (issue #10), which sets the crews' hose and the scene's backdrop: bush (draughting,
 * 25 mm canvas), village (hydrants, 38 mm rubber, a building alight) or the urban interface between.
 * The sim never reads it.
 */
export type ScenarioSetting = 'bush' | 'village' | 'interface';

export interface Scenario {
  id: string;
  title: string;
  setting: ScenarioSetting;
  /** What the player's appliance needs. */
  requires: ScenarioRequirements;
  /** Other trucks on the fireground, each with what its appliance needs. */
  support?: readonly SupportRole[];
  /**
   * Initial state and input timeline for the player on `spec` (script keyed by its control ids),
   * with each support role on `support[role]` or, by default, the same appliance.
   */
  build(spec: ApplianceSpec, support?: SupportSpecs): ScriptedRun;
  /** What the player must do, and what happens along the way; scenarios without one are sandbox only. */
  lesson?: LessonDef;
  /** How a competent operator passes the lesson on any eligible appliance (ladder.test.ts). */
  solution?: readonly OperatorStep[];
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
 * What the player's `spec` (support roles on `support[role]`, or the same appliance) lacks to play
 * the scenario, in words, e.g. 'a suction inlet', '2 deliveries'; empty when it can. With `lesson`,
 * also the gauges its lesson asks the player to read ('a compound gauge'): free play needs none.
 */
export function missingRequirements(
  scenario: Scenario,
  spec: ApplianceSpec,
  support: SupportSpecs = {},
  lesson = false,
): string[] {
  const missing = new Set<string>([
    ...lacks(scenario.requires, spec),
    ...(scenario.support ?? []).flatMap((role) =>
      lacks(role.requires, supportSpec(role, spec, support)),
    ),
  ]);
  if (lesson && scenario.lesson !== undefined)
    for (const kind of playerInstruments(scenario.lesson))
      if (!spec.instruments.some((i) => i.kind === kind)) missing.add(INSTRUMENT_WORDS[kind]);
  return [...missing];
}

/**
 * Whether the player's `spec` can play the scenario's fireground, with each support role on
 * `support[role]` or on the same appliance.
 */
export function supports(
  scenario: Scenario,
  spec: ApplianceSpec,
  support: SupportSpecs = {},
): boolean {
  return missingRequirements(scenario, spec, support).length === 0;
}

/** Whether the scenario has a lesson the player can play on `spec`, gauges included. */
export function supportsLesson(
  scenario: Scenario,
  spec: ApplianceSpec,
  support: SupportSpecs = {},
): boolean {
  return (
    scenario.lesson !== undefined && missingRequirements(scenario, spec, support, true).length === 0
  );
}

const INSTRUMENT_WORDS: Readonly<Record<InstrumentKind, string>> = {
  compound: 'a compound gauge',
  discharge: 'a discharge gauge',
  tacho: 'a tachometer',
  tank: 'a tank gauge',
};

/** What `spec` lacks of `requires`, in words. */
function lacks(requires: ScenarioRequirements, spec: ApplianceSpec): string[] {
  const {
    tank,
    minDeliveries,
    suction = false,
    tankFill = false,
    primer = false,
    appliances,
  } = requires;
  const out: string[] = [];
  if (appliances !== undefined && !appliances.includes(spec.id)) out.push('a different appliance');
  if (tank && (spec.tank === undefined || !spec.inlets.some((i) => i.kind === 'tank')))
    out.push('a tank');
  if (suction && !spec.inlets.some((i) => i.kind === 'suction')) out.push('a suction inlet');
  if (tankFill && !spec.inlets.some((i) => i.kind === 'tankFill'))
    out.push('a hydrant-to-tank inlet');
  if (primer && spec.primer === undefined) out.push('a primer');
  if (spec.deliveries.length < minDeliveries) out.push(`${String(minDeliveries)} deliveries`);
  return out;
}
