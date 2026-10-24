import { defineConfig } from '@playwright/test';
import { baseConfig } from './playwright.base';

// npm run test:e2e: journeys + layout invariants. No pixel comparison here; that's `npm run review`.
export default defineConfig({
  ...baseConfig,
  testIgnore: ['visual/**', 'review/**'],
  reporter: [['list']],
});
