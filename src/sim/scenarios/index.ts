import { APPLIANCES } from '../appliances/catalogue';
import type { ApplianceSpec, PlayerInputs, SimState } from '../types';
import { operate } from '../lesson/operator';
import { startLesson } from '../lesson/progress';
import { TICK_S } from '../constants';
import { runScript, type TraceSample } from './run';
import { CLOSED_RELAY } from './closedRelay';
import { DRAUGHTING } from './draughting';
import { FIRST_LINE } from './firstLine';
import { FREE_PLAY } from './freePlay';
import { HYDRANT_SUPPLY } from './hydrantSupply';
import { HYDRANT_TANK } from './hydrantTank';
import { INCIDENT } from './incident';
import { OPEN_RELAY } from './openRelay';
import { TANK_ATTACK } from './tankAttack';
import { traceCsv } from './trace';
import { supports, type Scenario, type SupportSpecs } from './types';

export { APPLIANCES };

/** Every scenario, in ladder order (ARCHITECTURE §5), then the free-play-only ones. */
export const SCENARIOS: readonly Scenario[] = [
  FIRST_LINE,
  TANK_ATTACK,
  HYDRANT_TANK,
  HYDRANT_SUPPLY,
  DRAUGHTING,
  CLOSED_RELAY,
  OPEN_RELAY,
  INCIDENT,
  FREE_PLAY,
];

export function getScenario(id: string): Scenario {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (scenario === undefined) throw new Error(`Unknown scenario '${id}'`);
  return scenario;
}

/** Appliances from `pool` that can play `scenario`. */
export function eligibleAppliances(
  scenario: Scenario,
  pool: readonly ApplianceSpec[] = APPLIANCES,
): ApplianceSpec[] {
  return pool.filter((spec) => supports(scenario, spec));
}

/**
 * A once-a-second trace of the scenario's solution played by the operator: for scenarios whose
 * events wait on the player, which an open-loop script can't time on every appliance.
 */
function solutionSamples(scenario: Scenario, state: SimState): TraceSample[] {
  const { lesson, solution } = scenario;
  if (lesson === undefined || solution === undefined)
    throw new Error(`'${scenario.id}' has no script and no solution to trace`);
  const player = state.activeTruckId;
  const samples: TraceSample[] = [];
  const sample = (s: SimState, inputs: PlayerInputs) => {
    const truck = s.trucks.find((t) => t.id === player);
    if (truck !== undefined) samples.push({ tS: s.timeS, inputs, truck, state: s });
  };
  sample(
    state,
    state.trucks.find((t) => t.id === player)?.inputs ?? { throttle: 0, valves: {}, switches: {} },
  );
  let ticks = 0;
  operate(lesson, { state, progress: startLesson(lesson, player) }, solution, (s, inputs) => {
    if (++ticks % Math.round(1 / TICK_S) === 0) sample({ ...s, timeS: ticks * TICK_S }, inputs);
  });
  return samples;
}

/**
 * Run `scenario` on `spec` (support roles on `support`, or the same), its lesson playing alongside,
 * and return its golden-trace CSV.
 */
export function scenarioTraceCsv(
  scenario: Scenario,
  spec: ApplianceSpec,
  support?: SupportSpecs,
): string {
  const run = scenario.build(spec, support);
  const samples =
    run.script.length === 0
      ? solutionSamples(scenario, run.state)
      : runScript(run, 1, scenario.lesson);
  // Lines laid by the lesson's events get columns too (zero until they're laid).
  return traceCsv(samples, samples.at(-1)?.state.lines ?? run.state.lines);
}
