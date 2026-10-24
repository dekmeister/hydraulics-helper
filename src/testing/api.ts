import { getAppliance } from '../sim/appliances/catalogue';
import { createInitialState } from '../sim/engine';
import { useStore } from '../state/store';
import type { LoadOptions, PumpOpsTestApi } from './types';

export function createTestApi(): PumpOpsTestApi {
  return {
    load({ scenario, appliance, state }: LoadOptions) {
      // Seed is accepted now and unused until the sim has randomness (M4).
      if (scenario !== undefined) {
        throw new Error('__pumpops.load: scenario loading is not implemented yet (M6)');
      }
      if (appliance !== undefined && state !== undefined) {
        throw new Error('__pumpops.load: pass either appliance or state, not both');
      }
      const sim =
        appliance !== undefined
          ? createInitialState(getAppliance(appliance))
          : state === undefined
            ? undefined
            : structuredClone(state);
      useStore.getState().reset(sim);
    },
    step(ticks) {
      if (!Number.isInteger(ticks) || ticks < 0) {
        throw new Error(
          `__pumpops.step: ticks must be a non-negative integer, got ${String(ticks)}`,
        );
      }
      useStore.getState().step(ticks);
    },
    settle() {
      // Nothing is damped or animated yet; needles snap here from M2.
    },
    getState() {
      return structuredClone(useStore.getState().sim);
    },
  };
}
