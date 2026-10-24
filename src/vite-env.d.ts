/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** True only in `vite build --mode e2e`; see docs/TESTING.md §3. */
  readonly VITE_E2E: boolean;
}
