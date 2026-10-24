import type { SimState } from '../sim/types';

export interface LoadOptions {
  scenario?: string;
  appliance?: string;
  state?: SimState;
  seed?: number;
}

/** window.__pumpops, present only in the e2e build (docs/TESTING.md §3.1). No setInputs, by design. */
export interface PumpOpsTestApi {
  /** Load a scenario (or a raw SimState) with a fixed RNG seed. */
  load(opts: LoadOptions): void;
  /** Advance the sim N fixed ticks (100 ms each) synchronously. */
  step(ticks: number): void;
  /** Snap damped needles/animations to their targets so a screenshot is stable. */
  settle(): void;
  /** Serialisable snapshot for assertions. */
  getState(): SimState;
}

declare global {
  interface Window {
    __pumpops?: PumpOpsTestApi;
  }
}
