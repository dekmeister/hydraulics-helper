import { defineConfig } from '@playwright/test';
import { baseConfig, E2E_FULL } from './playwright.base';

/**
 * What each viewport runs (docs/TESTING.md §4). Journeys run on the phone: controls are Pointer
 * Events only, so a wider viewport repeats the same input path, and the layout invariants check
 * every width. Desktop adds the keyboard pass. `npm run test:e2e:full` runs everything everywhere.
 */
const SCOPE: Record<string, string[]> = {
  tablet: ['layout.spec.ts'],
  desktop: ['layout.spec.ts', 'journeys/keyboard.spec.ts', 'journeys/smoke.spec.ts'],
};

// npm run test:e2e: journeys + layout invariants. No pixel comparison here; that's `npm run review`.
export default defineConfig({
  ...baseConfig,
  testIgnore: ['visual/**', 'review/**'],
  reporter: [['list']],
  projects: (baseConfig.projects ?? []).map((p) => {
    const scope = p.name === undefined ? undefined : SCOPE[p.name];
    return E2E_FULL || scope === undefined ? p : { ...p, testMatch: scope };
  }),
});
