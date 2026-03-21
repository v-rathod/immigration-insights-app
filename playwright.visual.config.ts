/**
 * Playwright Visual Regression Configuration
 *
 * Separate config for visual screenshot comparison tests.
 * Uses toHaveScreenshot() for pixel-level regression detection.
 *
 * Workflow:
 *   1. First run creates baseline screenshots in e2e/visual.spec.ts-snapshots/
 *   2. Subsequent runs compare against baselines
 *   3. On intentional UI change: npx playwright test --config=playwright.visual.config.ts --update-snapshots
 *
 * Prerequisites: npm run dev must be running on port 3000.
 * Run: npx playwright test --config=playwright.visual.config.ts
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "visual*.spec.ts",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      // Allow small anti-aliasing differences across OS/GPU
      maxDiffPixelRatio: 0.01,
      // Threshold per-pixel color difference (0-1)
      threshold: 0.2,
      // Animation settling time
      animations: "disabled",
    },
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    browserName: "chromium",
  },

  projects: [
    {
      name: "Desktop",
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      name: "Mobile",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      },
    },
  ],
});
