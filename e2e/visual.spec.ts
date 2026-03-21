/**
 * Visual Regression Tests — Full-Page Screenshots
 *
 * Captures screenshots of every page at Desktop (1280×800) and Mobile (390×844)
 * viewports. Uses Playwright's built-in toHaveScreenshot() for pixel comparison.
 *
 * Baselines stored in: e2e/visual.spec.ts-snapshots/
 *
 * Usage:
 *   npx playwright test --config=playwright.visual.config.ts              # compare
 *   npx playwright test --config=playwright.visual.config.ts --update-snapshots  # update baselines
 *
 * Prerequisites: npm run dev on port 3000
 */
import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for page to be fully loaded and animations settled */
async function waitForStable(page: Page) {
  // Wait for network idle + DOM content loaded
  await page.waitForLoadState("networkidle");
  // Extra settle time for Framer Motion animations
  await page.waitForTimeout(1500);
}

/** Navigate and wait for stable rendering */
async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  await waitForStable(page);
}

// ---------------------------------------------------------------------------
// Pages to test
// ---------------------------------------------------------------------------

const PAGES = [
  { name: "home", path: "/" },
  { name: "insights", path: "/insights" },
  { name: "visa-bulletin", path: "/dashboard/visa-bulletin/" },
  { name: "employer", path: "/dashboard/employer/" },
  { name: "eb-category", path: "/dashboard/eb-category/" },
  { name: "geographic", path: "/dashboard/geographic/" },
  { name: "wage", path: "/dashboard/wage/" },
  { name: "job-demand", path: "/dashboard/job-demand/" },
  { name: "processing", path: "/dashboard/processing/" },
  { name: "approvals", path: "/dashboard/approvals/" },
  { name: "about", path: "/about" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
];

// ---------------------------------------------------------------------------
// Full-page visual regression for each page
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Full Page Screenshots", () => {
  for (const { name, path } of PAGES) {
    test(`${name} — full page`, async ({ page }) => {
      await visit(page, path);
      await expect(page).toHaveScreenshot(`${name}-full.png`, {
        fullPage: true,
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Home page component-level visual tests
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Home Page Components", () => {
  test("hero section", async ({ page }) => {
    await visit(page, "/");
    const hero = page.locator("section").first();
    await expect(hero).toHaveScreenshot("home-hero.png");
  });

  test("dashboard grid", async ({ page }) => {
    await visit(page, "/");
    const grid = page.locator("#dashboards");
    if (await grid.isVisible()) {
      await expect(grid).toHaveScreenshot("home-dashboard-grid.png");
    }
  });

  test("stats bar", async ({ page }) => {
    await visit(page, "/");
    const stats = page.locator('section[aria-label="Key statistics"]');
    if (await stats.isVisible()) {
      await expect(stats).toHaveScreenshot("home-stats-bar.png");
    }
  });
});

// ---------------------------------------------------------------------------
// Dashboard interaction states
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Dashboard Interaction States", () => {
  test("visa bulletin with EB2 India selected", async ({ page }) => {
    await visit(page, "/dashboard/visa-bulletin/");
    // Click EB2 pill if present
    const eb2 = page.getByRole("button", { name: /EB2/i }).first();
    if (await eb2.isVisible()) {
      await eb2.click();
      await page.waitForTimeout(500);
    }
    // Click India pill if present
    const india = page.getByRole("button", { name: /IND/i }).first();
    if (await india.isVisible()) {
      await india.click();
      await page.waitForTimeout(500);
    }
    await waitForStable(page);
    await expect(page).toHaveScreenshot("visa-bulletin-eb2-india.png", {
      fullPage: true,
    });
  });

  test("employer dashboard empty state", async ({ page }) => {
    await visit(page, "/dashboard/employer/");
    await expect(page).toHaveScreenshot("employer-empty-state.png", {
      fullPage: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Sidebar interaction states
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Sidebar States", () => {
  test("home page: sidebar collapsed (icon-only rail)", async ({ page }) => {
    await visit(page, "/");
    const sidebar = page.locator("aside.lg\\:flex").first();
    if (await sidebar.isVisible()) {
      await expect(sidebar).toHaveScreenshot("sidebar-collapsed.png");
    }
  });

  test("home page: sidebar hover-expanded (floating overlay)", async ({ page }) => {
    await visit(page, "/");
    // Hover over the collapsed sidebar to trigger the floating expansion
    const sidebar = page.locator("aside.lg\\:flex").first();
    if (await sidebar.isVisible()) {
      await sidebar.hover();
      // Wait for the 200ms width transition to complete
      await page.waitForTimeout(300);
      await expect(sidebar).toHaveScreenshot("sidebar-hover-expanded.png");
    }
  });

  test("insights page: sidebar fully expanded", async ({ page }) => {
    await visit(page, "/insights");
    const sidebar = page.locator("aside.lg\\:flex").first();
    if (await sidebar.isVisible()) {
      await expect(sidebar).toHaveScreenshot("sidebar-expanded.png");
    }
  });
});

// ---------------------------------------------------------------------------
// Insights page — profile form
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Insights Page", () => {
  test("profile form: collapsed state (no data)", async ({ page }) => {
    await visit(page, "/insights");
    // Wait for form to render
    await page.waitForSelector('[data-testid="insights-page"]', { timeout: 5000 }).catch(() => {});
    await expect(page).toHaveScreenshot("insights-form-empty.png", { fullPage: true });
  });

  test("profile form: CountryPicker expanded (3+3 rows)", async ({ page }) => {
    await visit(page, "/insights");
    // Click the "More countries" button to expand the second row
    const moreBtn = page.getByRole("button", { name: /more countries/i }).first();
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await page.waitForTimeout(200);
    }
    const form = page.locator('[class*="grid-cols-3"]').first();
    await expect(page).toHaveScreenshot("insights-country-picker-expanded.png", { fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Theme toggle — light vs dark
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Theme States", () => {
  test("home page in light mode", async ({ page }) => {
    await visit(page, "/");
    // Click light mode toggle (Sun icon)
    const lightToggle = page.locator('button[aria-label="Light mode"]').first();
    if (await lightToggle.isVisible()) {
      await lightToggle.click();
      await page.waitForTimeout(800);
    }
    await expect(page).toHaveScreenshot("home-light-mode.png", {
      fullPage: true,
    });
  });

  test("home page in dark mode", async ({ page }) => {
    await visit(page, "/");
    // Click dark mode toggle (Moon icon)
    const darkToggle = page.locator('button[aria-label="Dark mode"]').first();
    if (await darkToggle.isVisible()) {
      await darkToggle.click();
      await page.waitForTimeout(800);
    }
    await expect(page).toHaveScreenshot("home-dark-mode.png", {
      fullPage: true,
    });
  });
});
