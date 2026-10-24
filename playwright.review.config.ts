import { defineConfig } from '@playwright/test';
import { baseConfig } from './playwright.base';

// npm run review: visual baselines + the review bundle in review/ (docs/TESTING.md §5–6).
export default defineConfig({
  ...baseConfig,
  testMatch: 'visual/**/*.spec.ts',
  // Never write a baseline implicitly: a missing one fails as "New" until reviewed and written
  // with --update-snapshots (docs/TESTING.md §5).
  updateSnapshots: 'none',
  snapshotPathTemplate: '{testDir}/visual/__screenshots__/{projectName}/{arg}{ext}',
  reporter: [['list'], ['./e2e/review/reporter.ts', { outputDir: 'review' }]],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled', caret: 'hide' },
  },
});
