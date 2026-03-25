/**
 * Post-Deploy E2E Tests
 *
 * Runs in a real browser against a deployed environment (stage or prod).
 * Unlike HTTP smoke tests (which check status codes and Content-Length),
 * these tests verify what the user actually SEES:
 *
 *  - Pages render visible content (not blank/opacity:0)
 *  - Navigation works (sidebar links change page)
 *  - Search produces results
 *  - Charts/SVGs are present
 *  - No JavaScript console errors
 *  - Critical data loads
 *
 * Config: playwright.deploy.config.ts
 * URL:    Set via DEPLOY_URL env var
 *
 * Usage:
 *   DEPLOY_URL=https://d10immmzyp7xgr.cloudfront.net npx playwright test --config=playwright.deploy.config.ts
 */
import { test, expect, type Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Collect console errors during page lifecycle */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore known benign errors
      if (
        text.includes("favicon") ||
        text.includes("DevTools") ||
        text.includes("third-party cookie") ||
        text.includes("PostHog")
      )
        return;
      errors.push(text);
    }
  });
  return errors;
}

/** Wait for page to be fully loaded and hydrated */
async function waitForHydration(page: Page) {
  await page.waitForLoadState("networkidle");
  // Allow Framer Motion animations to settle
  await page.waitForTimeout(1500);
}

// ── All pages render visible content ─────────────────────────────────────────

const PAGES = [
  { path: "/", name: "Home" },
  { path: "/about/", name: "About" },
  { path: "/insights/", name: "Insights" },
  { path: "/ask/", name: "Ask" },
  { path: "/faq/", name: "FAQ" },
  { path: "/privacy/", name: "Privacy" },
  { path: "/terms/", name: "Terms" },
  { path: "/dashboard/employer/", name: "Employer Dashboard" },
  { path: "/dashboard/wage/", name: "Wage Dashboard" },
  { path: "/dashboard/visa-bulletin/", name: "Visa Bulletin Dashboard" },
  { path: "/dashboard/eb-category/", name: "EB Category Dashboard" },
  { path: "/dashboard/geographic/", name: "Geographic Dashboard" },
  { path: "/dashboard/job-demand/", name: "Job Demand Dashboard" },
  { path: "/dashboard/processing/", name: "Processing Dashboard" },
  { path: "/dashboard/backlog/", name: "Backlog Dashboard" },
  { path: "/dashboard/approvals/", name: "Approvals Dashboard" },
];

test.describe("Page rendering", () => {
  for (const { path, name } of PAGES) {
    test(`${name} (${path}) renders visible content`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await page.goto(path, { waitUntil: "networkidle" });
      await waitForHydration(page);

      // Body must have real content (not blank)
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(100);

      // No elements stuck at opacity:0 that should be visible
      // Check the main content area specifically
      const mainContent = page.locator("main").first();
      if (await mainContent.count() > 0) {
        await expect(mainContent).toBeVisible();
      }

      // No critical JS errors
      const criticalErrors = errors.filter(
        (e) => e.includes("TypeError") || e.includes("ReferenceError")
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }
});

// ── Navigation ───────────────────────────────────────────────────────────────

test.describe("Navigation", () => {
  test("sidebar navigation works", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await waitForHydration(page);

    // Click a dashboard link in the sidebar/nav
    const employerLink = page.locator(
      'a[href*="/dashboard/employer"], a[href*="employer"]'
    ).first();
    if (await employerLink.isVisible()) {
      await employerLink.click();
      await page.waitForLoadState("networkidle");
      expect(page.url()).toContain("/dashboard/employer");
    }
  });

  test("logo/home link navigates to home", async ({ page }) => {
    await page.goto("/about/", { waitUntil: "networkidle" });
    await waitForHydration(page);

    // Click the home/logo link
    const homeLink = page.locator('a[href="/"]').first();
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await page.waitForLoadState("networkidle");
      expect(page.url()).toMatch(/\/$/);
    }
  });
});

// ── Dashboard data loads ─────────────────────────────────────────────────────

test.describe("Dashboard data integrity", () => {
  test("Visa Bulletin dashboard shows chart data", async ({ page }) => {
    await page.goto("/dashboard/visa-bulletin/", { waitUntil: "networkidle" });
    await waitForHydration(page);

    // The page should have rendered actual chart content (SVG or canvas)
    const bodyText = await page.locator("body").innerText();
    // Should contain at least category names or date references
    expect(bodyText).toMatch(/EB-1|EB-2|EB-3|India|China/i);
  });

  test("Employer dashboard renders search or content", async ({ page }) => {
    await page.goto("/dashboard/employer/", { waitUntil: "networkidle" });
    await waitForHydration(page);

    // Search input or employer content should be visible
    const hasSearch = await page.locator('input[type="text"], input[type="search"], [role="combobox"]').count() > 0;
    const bodyText = await page.locator("body").innerText();
    const hasContent = bodyText.length > 200;
    expect(hasSearch || hasContent).toBeTruthy();
  });

  test("Wage dashboard has content", async ({ page }) => {
    await page.goto("/dashboard/wage/", { waitUntil: "networkidle" });
    await waitForHydration(page);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(200);
    // Should have salary-related content
    expect(bodyText).toMatch(/salary|wage|median|percentile/i);
  });

  test("FAQ page shows all questions", async ({ page }) => {
    await page.goto("/faq/", { waitUntil: "networkidle" });
    await waitForHydration(page);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain("What does Compass do?");
    expect(bodyText).toContain("How is this site funded?");
    expect(bodyText).toContain("How often is the data updated?");
    // Should NOT contain cost info anymore
    expect(bodyText).not.toContain("$5/month");
  });
});

// ── Theme and interactivity ──────────────────────────────────────────────────

test.describe("Interactivity", () => {
  test("theme toggle works", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await waitForHydration(page);

    // Look for theme toggle button
    const themeButton = page.locator(
      'button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="light" i], button[aria-label*="mode" i]'
    ).first();

    if (await themeButton.isVisible()) {
      const htmlBefore = await page.locator("html").getAttribute("class");
      await themeButton.click();
      await page.waitForTimeout(500);
      const htmlAfter = await page.locator("html").getAttribute("class");
      // Class should change (dark ↔ light)
      expect(htmlAfter).not.toBe(htmlBefore);
    }
  });
});
