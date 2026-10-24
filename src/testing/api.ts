import { useStore } from '../state/store';
import type { LoadOptions, PumpOpsTestApi } from './types';

export function createTestApi(): PumpOpsTestApi {
  return {
    load({ scenario, appliance, state }: LoadOptions) {
      // Scenarios and appliances arrive in M1; seed is accepted now and unused until the sim has randomness.
      if (scenario !== undefined || appliance !== undefined) {
        throw new Error('__pumpops.load: scenario/appliance loading is not implemented yet (M1)');
      }
      useStore.getState().reset(state === undefined ? undefined : structuredClone(state));
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
