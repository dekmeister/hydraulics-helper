import { flushSync } from 'react-dom';
import { getAppliance } from '../sim/appliances/catalogue';
import { createInitialState } from '../sim/engine';
import { eligibleAppliances, getScenario } from '../sim/scenarios';
import type { SimState } from '../sim/types';
import { useStore } from '../state/store';
import { snapAll } from '../ui/panel-pump/settle';
import type { LoadOptions, PumpOpsTestApi } from './types';

function loadSim({ scenario, appliance, state }: LoadOptions): SimState | undefined {
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
    const spec = appliance !== undefined ? getAppliance(appliance) : eligibleAppliances(s)[0];
    if (spec === undefined) throw new Error(`__pumpops.load: no appliance can play '${scenario}'`);
    return s.build(spec).state;
  }
  return appliance === undefined ? undefined : createInitialState(getAppliance(appliance));
}

export function createTestApi(): PumpOpsTestApi {
  return {
    load(opts) {
      // Seed is accepted now and unused until the sim has randomness (M4).
      const sim = loadSim(opts);
      flushSync(() => {
        useStore.getState().reset(sim);
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
