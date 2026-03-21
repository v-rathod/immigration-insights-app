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

// ---------------------------------------------------------------------------
// Employer Dashboard — interactive states
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Employer Dashboard States", () => {
  test("employer: empty search (no selection)", async ({ page }) => {
    await visit(page, "/dashboard/employer/");
    await expect(page).toHaveScreenshot("employer-landing.png", { fullPage: true });
  });

  test("employer: after searching 'Google'", async ({ page }) => {
    await visit(page, "/dashboard/employer/");
    const search = page.getByPlaceholder(/search.*employer/i).first();
    if (await search.isVisible()) {
      await search.fill("Google");
      await page.waitForTimeout(600);
      await expect(page).toHaveScreenshot("employer-search-google.png", { fullPage: true });
    }
  });

  test("employer: with employer selected", async ({ page }) => {
    await visit(page, "/dashboard/employer/");
    const search = page.getByPlaceholder(/search.*employer/i).first();
    if (await search.isVisible()) {
      await search.fill("Google");
      await page.waitForTimeout(600);
      // Click first result
      const firstResult = page.locator('[role="option"], [data-testid*="employer"], button').filter({ hasText: /google/i }).first();
      if (await firstResult.isVisible()) {
        await firstResult.click();
        await page.waitForTimeout(800);
      }
    }
    await expect(page).toHaveScreenshot("employer-selected-google.png", { fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Geographic Dashboard — interaction states
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Geographic Dashboard States", () => {
  test("geographic: map view default", async ({ page }) => {
    await visit(page, "/dashboard/geographic/");
    await expect(page).toHaveScreenshot("geographic-map-default.png", { fullPage: true });
  });

  test("geographic: table view", async ({ page }) => {
    await visit(page, "/dashboard/geographic/");
    const tableBtn = page.getByRole("button", { name: /table/i }).first();
    if (await tableBtn.isVisible()) {
      await tableBtn.click();
      await page.waitForTimeout(400);
    }
    await expect(page).toHaveScreenshot("geographic-table-view.png", { fullPage: true });
  });

  test("geographic: state selected (California)", async ({ page }) => {
    await visit(page, "/dashboard/geographic/");
    // Click on California in the map — find by accessible label or data attr
    const caButton = page.locator('[aria-label*="California"], [title*="California"]').first();
    if (await caButton.isVisible()) {
      await caButton.click();
      await page.waitForTimeout(600);
    } else {
      // Skip gracefully if map interaction not locatable
    }
    await expect(page).toHaveScreenshot("geographic-california-selected.png", { fullPage: true });
  });

  test("geographic: metric changed to Median Wage", async ({ page }) => {
    await visit(page, "/dashboard/geographic/");
    const select = page.locator("select").first();
    if (await select.isVisible()) {
      await select.selectOption({ label: "Median Wage" });
      await page.waitForTimeout(400);
    }
    await expect(page).toHaveScreenshot("geographic-median-wage.png", { fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Visa Bulletin Dashboard — interaction states
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Visa Bulletin Deep States", () => {
  test("visa bulletin: EB3 India selected", async ({ page }) => {
    await visit(page, "/dashboard/visa-bulletin/");
    const eb3 = page.getByRole("button", { name: /EB3/i }).first();
    if (await eb3.isVisible()) { await eb3.click(); await page.waitForTimeout(400); }
    const india = page.getByRole("button", { name: /India|IND/i }).first();
    if (await india.isVisible()) { await india.click(); await page.waitForTimeout(400); }
    await expect(page).toHaveScreenshot("visa-bulletin-eb3-india.png", { fullPage: true });
  });

  test("visa bulletin: EB2 China selected", async ({ page }) => {
    await visit(page, "/dashboard/visa-bulletin/");
    const eb2 = page.getByRole("button", { name: /EB2/i }).first();
    if (await eb2.isVisible()) { await eb2.click(); await page.waitForTimeout(400); }
    const china = page.getByRole("button", { name: /China|CHN/i }).first();
    if (await china.isVisible()) { await china.click(); await page.waitForTimeout(400); }
    await expect(page).toHaveScreenshot("visa-bulletin-eb2-china.png", { fullPage: true });
  });

  test("visa bulletin: priority date entered (triggers predictions)", async ({ page }) => {
    await visit(page, "/dashboard/visa-bulletin/");
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      await dateInput.fill("2021-06-15");
      await page.waitForTimeout(600);
    }
    await expect(page).toHaveScreenshot("visa-bulletin-pd-entered.png", { fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Wage Dashboard — interaction states
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Wage Dashboard States", () => {
  test("wage: default view", async ({ page }) => {
    await visit(page, "/dashboard/wage/");
    await expect(page).toHaveScreenshot("wage-default.png", { fullPage: true });
  });

  test("wage: soc category selected", async ({ page }) => {
    await visit(page, "/dashboard/wage/");
    // Try to select a SOC category if buttons/select are present
    const firstBtn = page.locator('[role="tab"], button').filter({ hasText: /software|engineer|developer/i }).first();
    if (await firstBtn.isVisible()) {
      await firstBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(page).toHaveScreenshot("wage-soc-selected.png", { fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// EB Category Dashboard
// ---------------------------------------------------------------------------

test.describe("Visual Regression — EB Category Dashboard States", () => {
  test("eb-category: default view", async ({ page }) => {
    await visit(page, "/dashboard/eb-category/");
    await expect(page).toHaveScreenshot("eb-category-default.png", { fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Processing + Approvals + Backlog Dashboards
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Additional Dashboard States", () => {
  test("processing: default view", async ({ page }) => {
    await visit(page, "/dashboard/processing/");
    await expect(page).toHaveScreenshot("processing-default.png", { fullPage: true });
  });

  test("approvals: default view", async ({ page }) => {
    await visit(page, "/dashboard/approvals/");
    await expect(page).toHaveScreenshot("approvals-default.png", { fullPage: true });
  });

  test("backlog: default view", async ({ page }) => {
    await visit(page, "/dashboard/backlog/");
    await expect(page).toHaveScreenshot("backlog-default.png", { fullPage: true });
  });

  test("job-demand: default view", async ({ page }) => {
    await visit(page, "/dashboard/job-demand/");
    await expect(page).toHaveScreenshot("job-demand-default.png", { fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Insights Page — profile form states
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Insights Profile States", () => {
  test("insights: tier 1 filled (PD + EB2 + India)", async ({ page }) => {
    await visit(page, "/insights");
    // Fill priority date
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      await dateInput.fill("2021-03-01");
      await dateInput.dispatchEvent("change");
      await page.waitForTimeout(300);
    }
    // Select EB2 category
    const eb2Btn = page.getByRole("button", { name: /EB2/i }).first();
    if (await eb2Btn.isVisible()) { await eb2Btn.click(); await page.waitForTimeout(200); }
    // Select India
    const indiaBtn = page.getByRole("button", { name: /India/i }).first();
    if (await indiaBtn.isVisible()) { await indiaBtn.click(); await page.waitForTimeout(200); }
    await waitForStable(page);
    await expect(page).toHaveScreenshot("insights-tier1-filled.png", { fullPage: true });
  });

  test("insights: tier 2 opened (employer search)", async ({ page }) => {
    await visit(page, "/insights");
    // Try to expand tier 2 if there's a toggle
    const tier2Toggle = page.locator('button').filter({ hasText: /employer|sponsor/i }).first();
    if (await tier2Toggle.isVisible()) {
      await tier2Toggle.click();
      await page.waitForTimeout(400);
    }
    await expect(page).toHaveScreenshot("insights-tier2-opened.png", { fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Mobile Navigation — open state
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Mobile Navigation", () => {
  test("mobile nav: hamburger menu open", async ({ page }) => {
    // This test only runs on mobile viewport
    await visit(page, "/dashboard/visa-bulletin/");
    const hamburger = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"], button[aria-label*="Menu"]').first();
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(400);
      await expect(page).toHaveScreenshot("mobile-nav-open.png");
    } else {
      // Desktop viewport — skip silently
      test.skip();
    }
  });
});

// ---------------------------------------------------------------------------
// Home page — returning user banner
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Home Welcome Back Banner", () => {
  test("home: welcome back banner visible (profile in localStorage)", async ({ page }) => {
    await page.goto("/");
    // Inject a mock profile into localStorage to trigger the banner
    await page.evaluate(() => {
      window.localStorage.setItem(
        "compass_profile",
        JSON.stringify({
          priorityDate: "2020-08-15",
          category: "EB2",
          countryOfChargeability: "IND",
          employerName: "Google LLC",
        })
      );
    });
    await page.reload({ waitUntil: "networkidle" });
    await waitForStable(page);
    await expect(page).toHaveScreenshot("home-welcome-back-banner.png", { fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Home page — quick check widgets interaction
// ---------------------------------------------------------------------------

test.describe("Visual Regression — Home Quick Check Widgets", () => {
  test("home: PD quick check with EB2 India selected", async ({ page }) => {
    await visit(page, "/");
    // Select EB2 in PD quick check widget
    const eb2 = page.getByRole("button", { name: /EB2/i }).first();
    if (await eb2.isVisible()) {
      await eb2.click();
      await page.waitForTimeout(300);
    }
    const india = page.getByRole("button", { name: /India|IND/i }).first();
    if (await india.isVisible()) {
      await india.click();
      await page.waitForTimeout(300);
    }
    await expect(page).toHaveScreenshot("home-pd-quickcheck-eb2-india.png", { fullPage: true });
  });
});
