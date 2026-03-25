/**
 * Playwright Post-Deploy Configuration
 *
 * Runs e2e tests against a DEPLOYED environment (stage or prod), not localhost.
 * Tests actual browser rendering, JS hydration, navigation, and user flows.
 *
 * The URL is set via the DEPLOY_URL environment variable.
 *
 * Usage:
 *   DEPLOY_URL=https://d10immmzyp7xgr.cloudfront.net npx playwright test --config=playwright.deploy.config.ts
 *   DEPLOY_URL=https://stage.immigrationcompass.fyi npx playwright test --config=playwright.deploy.config.ts
 *   DEPLOY_URL=https://immigrationcompass.fyi npx playwright test --config=playwright.deploy.config.ts
 *
 * Called automatically by deploy.sh and promote-to-prod.sh after smoke tests pass.
 */
import { defineConfig } from "@playwright/test";

const DEPLOY_URL =
  process.env.DEPLOY_URL ?? "https://d10immmzyp7xgr.cloudfront.net";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "post-deploy.spec.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1, // Retry once to handle transient CF cache misses
  reporter: "list",

  use: {
    baseURL: DEPLOY_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    browserName: "chromium",
    // Reasonable desktop viewport
    viewport: { width: 1280, height: 800 },
  },
});
