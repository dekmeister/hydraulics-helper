/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** True only in `vite build --mode e2e`; see docs/TESTING.md §3. */
  readonly VITE_E2E: boolean;
  /** '1' under `npm run test:matrix` (Vitest only); see docs/TESTING.md §7. */
  readonly VITEST_MATRIX?: string;
}
