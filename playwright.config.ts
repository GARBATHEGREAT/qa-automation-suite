import { defineConfig, devices } from '@playwright/test';

/**
 * The suite tests a running ReviewDesk.
 *   BASE_URL     where it runs            (default http://localhost:4000)
 *   PW_CHANNEL   use an installed browser (for example "msedge" or "chrome"); otherwise Playwright's Chromium
 * The app must be started with a seeded database and a high AUTH_RATE_LIMIT (see README).
 */
const baseURL = process.env.BASE_URL ?? 'http://localhost:4000';
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Video needs Playwright's ffmpeg build, which CI installs; locally traces and screenshots are enough.
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },
  projects: [
    { name: 'api', testDir: './tests/api', use: {} },
    { name: 'chromium', testDir: './tests/e2e', use: { ...devices['Desktop Chrome'], channel } },
    { name: 'regression', testDir: './tests/regression', use: { ...devices['Desktop Chrome'], channel } },
    // Phone-sized screen: only the tests tagged @smoke
    { name: 'mobile', testDir: './tests/e2e', grep: /@smoke/, use: { ...devices['Pixel 7'], channel } },
    // Only when DOCS=1: refreshes the README screenshots (npm run docs:screenshots)
    ...(process.env.DOCS
      ? [{ name: 'docs', testDir: './tests/docs', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, channel } }]
      : []),
  ],
});
