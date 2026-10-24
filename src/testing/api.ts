import { flushSync } from 'react-dom';
import { APPLIANCES } from '../sim/appliances/catalogue';
import { TEST_APPLIANCE } from '../sim/appliances/testAppliance';
import { createInitialState, reseed } from '../sim/engine';
import { eligibleAppliances, getScenario } from '../sim/scenarios';
import type { ApplianceSpec, SimState } from '../sim/types';
import { useStore } from '../state/store';
import { snapAll } from '../ui/panel-pump/settle';
import type { LoadOptions, PumpOpsTestApi } from './types';

/** The e2e build can load the test-only appliance too, so journeys prove the panel is generic. */
const LOADABLE: readonly ApplianceSpec[] = [...APPLIANCES, TEST_APPLIANCE];

function specById(id: string): ApplianceSpec {
  const spec = LOADABLE.find((a) => a.id === id);
  if (spec === undefined) throw new Error(`__pumpops.load: unknown appliance '${id}'`);
  return spec;
}

function loadSim(opts: LoadOptions): SimState | undefined {
  const sim = buildSim(opts);
  const { seed } = opts;
  return sim === undefined || seed === undefined ? sim : reseed(sim, seed);
}

function buildSim({ scenario, appliance, state }: LoadOptions): SimState | undefined {
  if (state !== undefined) {
    if (scenario !== undefined || appliance !== undefined) {
      throw new Error('__pumpops.load: pass a state on its own');
    }
    return structuredClone(state);
  }
  if (scenario !== undefined) {
    // The scenario's initial state (lines laid, controls shut). Objectives and the full loader
    // arrive in M6; the scripted input timeline is for golden traces, not the player.
    const s = getScenario(scenario);
    const spec = appliance !== undefined ? specById(appliance) : eligibleAppliances(s)[0];
    if (spec === undefined) throw new Error(`__pumpops.load: no appliance can play '${scenario}'`);
    return s.build(spec).state;
  }
  return appliance === undefined ? undefined : createInitialState(specById(appliance));
}

export function createTestApi(): PumpOpsTestApi {
  return {
    load(opts) {
      const sim = loadSim(opts);
      flushSync(() => {
        useStore.getState().reset(sim, sim === undefined ? undefined : (opts.scenario ?? null));
      });
      snapAll();
    },
    step(ticks) {
      if (!Number.isInteger(ticks) || ticks < 0) {
        throw new Error(
          `__pumpops.step: ticks must be a non-negative integer, got ${String(ticks)}`,
        );
      }
      // Commit the render synchronously, so a following settle() snaps to the new readings.
      flushSync(() => {
        useStore.getState().step(ticks);
      });
    },
    settle() {
      snapAll();
    },
    getState() {
      return structuredClone(useStore.getState().sim);
    },
  };
}
