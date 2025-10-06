import { defineConfig, devices } from "@playwright/test";

const resolvedPort = Number(process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? 3000);
const resolvedHost = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const resolvedBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${resolvedHost}:${resolvedPort}`;

/**
 * Playwright E2E Test Configuration
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: resolvedBaseURL,

    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video on failure */
    video: "retain-on-failure",
  },

  /* Configure projects for major browsers */
  // On CI, only run chromium. Locally, run all browsers if PLAYWRIGHT_ALL_BROWSERS is set, otherwise chromium only
  projects: process.env.CI
    ? [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ]
    : process.env.PLAYWRIGHT_ALL_BROWSERS === "true"
    ? [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },
        {
          name: "webkit",
          use: { ...devices["Desktop Safari"] },
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "bun run start",
    url: resolvedBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      PORT: String(resolvedPort),
    },
  },
});
