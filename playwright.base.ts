import { devices, type PlaywrightTestConfig } from '@playwright/test';

/** Fixed port for the e2e preview server; strictPort makes a clash fail loudly. */
const PORT = 4317;

/**
 * Opt-in override for machines whose preinstalled Chromium doesn't match the pinned Playwright
 * (e.g. cloud containers). Baselines are only valid for one browser build (docs/TESTING.md §4).
 */
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;

const common = {
  ...devices['Desktop Chrome'],
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
  ...(executablePath ? { launchOptions: { executablePath } } : {}),
} as const;

/** Shared by playwright.config.ts (journeys + layout) and playwright.review.config.ts (visual). */
export const baseConfig: PlaywrightTestConfig = {
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'retain-on-failure',
  },
  // Always rebuild: the e2e build takes well under a second, and reusing a running server
  // risks testing a stale bundle.
  webServer: {
    command: `npm run build:e2e && npx vite preview --outDir dist-e2e --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'phone',
      use: { ...common, viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true },
    },
    {
      name: 'tablet',
      use: { ...common, viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    {
      name: 'desktop',
      use: { ...common, viewport: { width: 1280, height: 800 } },
    },
  ],
};
