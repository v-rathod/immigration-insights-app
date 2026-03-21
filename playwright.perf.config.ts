/**
 * Playwright Performance Test Configuration
 *
 * Runs performance benchmarks against the local dev server.
 * No screenshot diffing needed — metrics only.
 *
 * Usage:
 *   npx playwright test --config=playwright.perf.config.ts
 *
 * Prerequisites: npm run dev must be running on port 3000.
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "performance.spec.ts",
  timeout: 90_000,
  fullyParallel: false,
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-perf" }]],

  use: {
    baseURL: "http://localhost:3000",
    // Throttle network to simulate a realistic connection (Fast 3G equivalent)
    // Comment this out for raw localhost speed measurements
    // launchOptions: { args: ["--disable-dev-shm-usage"] },
    trace: "retain-on-failure",
    browserName: "chromium",
  },

  projects: [
    {
      name: "Desktop",
      use: {
        viewport: { width: 1280, height: 800 },
        // Throttle CPU to 4x slowdown to approximate a mid-range device
        // This makes tests more reproducible across different machines
      },
    },
  ],
});
