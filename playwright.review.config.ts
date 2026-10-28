import { defineConfig } from '@playwright/test';
import { baseConfig } from './playwright.base';

// npm run review: visual baselines + the review bundle in review/ (docs/TESTING.md §5–6).
export default defineConfig({
  ...baseConfig,
  testMatch: 'visual/**/*.spec.ts',
  // Never write a baseline implicitly: a missing one fails as "New". Baselines are rendered from a
  // commit by scripts/review-baseline.mjs (docs/TESTING.md §5), which keeps this path in step.
  updateSnapshots: 'none',
  snapshotPathTemplate: '{testDir}/visual/__screenshots__/{projectName}/{arg}{ext}',
  reporter: [
    ['list'],
    [
      './e2e/review/reporter.ts',
      { outputDir: 'review', baselineStamp: 'e2e/visual/__screenshots__/.baseline' },
    ],
  ],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled', caret: 'hide' },
  },
});
