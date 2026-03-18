/**
 * Playwright Configuration — Mobile E2E Tests
 *
 * Runs against the local dev server (npm run dev) on port 3000.
 * Uses Chromium only (installed). Mobile tests use iPhone 14 viewport
 * (390×844) with touch emulation via Chromium's device emulation.
 *
 * CLI: npx playwright test
 * Or:  npm run test:e2e
 */
import { defineConfig } from "@playwright/test";

// iPhone 14 physical specs at logical pixel resolution
const IPHONE_14 = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

// iPhone 14 landscape
const IPHONE_14_LANDSCAPE = {
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: IPHONE_14.userAgent,
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Always use Chromium — installed and confirmed present
    channel: undefined,
    browserName: "chromium",
  },

  projects: [
    {
      name: "iPhone 14",
      use: { ...IPHONE_14 },
    },
    {
      name: "iPhone 14 landscape",
      use: { ...IPHONE_14_LANDSCAPE },
    },
    {
      name: "Desktop Chrome",
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
});
