/**
 * Home / Landing Page — iPhone 14 Mobile E2E Tests
 *
 * Full test suite for the landing page at mobile viewport (390 × 844).
 * Verifies that the most-visited page on mobile provides a first-class
 * touch experience: no overflow, tappable CTAs with adequate touch targets,
 * correct responsive grid layouts, and all content reachable by scrolling.
 *
 * Prerequisites: npm run dev must be running on port 3000.
 * Run:  npx playwright test home-mobile
 *
 * Coverage:
 *   1. Page Load & Structure     (5 tests)
 *   2. Mobile Navigation         (4 tests)
 *   3. Hero Section — CTAs       (8 tests)
 *   4. Stats Bar                 (5 tests)
 *   5. Quick Access Cards        (6 tests)
 *   6. Dashboard Grid            (6 tests)
 *   7. Value Props               (4 tests)
 *   8. Scroll Reachability       (3 tests)
 */

import { test, expect, type Page } from "@playwright/test";

// ── Constants ──────────────────────────────────────────────────────────────

const URL = "/";

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Navigate to the home page and wait for the h1 to appear */
async function goToHome(page: Page) {
  await page.goto(URL);
  await page.waitForSelector("h1", { timeout: 10_000 });
}

/** Assert no horizontal scrollbar (no content spills past viewport edge) */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow, "Page should not have horizontal overflow").toBe(false);
}

// ===========================================================================
// GROUP 1 — Page Load & Structure
// ===========================================================================

test.describe("Home — Page Load & Structure", () => {
  test("page loads with a visible h1 heading", async ({ page }) => {
    await goToHome(page);
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    const text = await h1.textContent();
    expect(text!.trim().length).toBeGreaterThan(10);
  });

  test("loads within 3 seconds on local dev", async ({ page }) => {
    const start = Date.now();
    await goToHome(page);
    expect(Date.now() - start).toBeLessThan(3_000);
  });

  test("document <title> contains 'Compass'", async ({ page }) => {
    await page.goto(URL);
    await expect(page).toHaveTitle(/Compass/i);
  });

  test("no horizontal overflow at 390px viewport width", async ({ page }) => {
    await goToHome(page);
    await expectNoHorizontalOverflow(page);
  });

  test("main content area does not extend beyond viewport width", async ({ page }) => {
    await goToHome(page);
    const overflow = await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      return main.scrollWidth > window.innerWidth + 2; // 2px sub-pixel tolerance
    });
    expect(overflow).toBe(false);
  });
});

// ===========================================================================
// GROUP 2 — Mobile Navigation
// ===========================================================================

test.describe("Home — Mobile Navigation", () => {
  test("desktop sidebar is hidden at 390px viewport", async ({ page }) => {
    await goToHome(page);
    // Desktop nav collapses entirely — hidden on mobile
    const desktopSidebar = page.locator("nav").filter({ hasText: "My Insights" }).first();
    await expect(desktopSidebar).toBeHidden();
  });

  test("hamburger menu button is visible on mobile", async ({ page }) => {
    await goToHome(page);
    const hamburger = page.locator("button.lg\\:hidden").first();
    await expect(hamburger).toBeVisible();
  });

  test("tapping hamburger opens mobile navigation overlay", async ({ page }) => {
    await goToHome(page);
    const hamburger = page.locator("button.lg\\:hidden").first();
    await hamburger.tap();
    const overlay = page.locator(".fixed.inset-0, [class*='overlay'], [class*='backdrop']").first();
    await expect(overlay).toBeVisible({ timeout: 2_000 });
  });

  test("tapping overlay backdrop closes mobile navigation", async ({ page }) => {
    await goToHome(page);
    const hamburger = page.locator("button.lg\\:hidden").first();
    await hamburger.tap();
    const overlay = page.locator(".fixed.inset-0").last();
    await overlay.tap({ position: { x: 300, y: 400 } });
    await expect(overlay).toBeHidden({ timeout: 2_000 });
  });
});

// ===========================================================================
// GROUP 3 — Hero Section
// ===========================================================================

test.describe("Home — Hero Section", () => {
  test("hero h1 heading is visible and non-empty", async ({ page }) => {
    await goToHome(page);
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    const text = await h1.textContent();
    expect(text!.trim().length).toBeGreaterThan(10);
  });

  test("subheadline with '18.5M+' data count is visible", async ({ page }) => {
    await goToHome(page);
    await expect(page.getByText(/18\.5M\+/i).first()).toBeVisible();
  });

  test('"Get Started" primary CTA is visible', async ({ page }) => {
    await goToHome(page);
    await expect(page.getByRole("link", { name: /Get Started/i })).toBeVisible();
  });

  test('"Explore Dashboards" secondary CTA is visible', async ({ page }) => {
    await goToHome(page);
    await expect(page.getByRole("link", { name: /Explore Dashboards/i })).toBeVisible();
  });

  test("CTAs are stacked vertically on mobile (flex-col — not side by side)", async ({ page }) => {
    await goToHome(page);
    const primaryBox = await page.getByRole("link", { name: /Get Started/i }).boundingBox();
    const secondaryBox = await page.getByRole("link", { name: /Explore Dashboards/i }).boundingBox();
    expect(primaryBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    // "Explore Dashboards" must appear below "Get Started" at mobile viewport
    expect(secondaryBox!.y).toBeGreaterThan(primaryBox!.y + primaryBox!.height - 4);
  });

  test('"Get Started" CTA meets 44px WCAG minimum touch-target height', async ({ page }) => {
    await goToHome(page);
    const box = await page.getByRole("link", { name: /Get Started/i }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('"Explore Dashboards" CTA meets 44px WCAG minimum touch-target height', async ({ page }) => {
    await goToHome(page);
    const box = await page.getByRole("link", { name: /Explore Dashboards/i }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('"Get Started" tap navigates to /insights', async ({ page }) => {
    await goToHome(page);
    await page.getByRole("link", { name: /Get Started/i }).tap();
    await page.waitForURL("**/insights**", { timeout: 5_000 });
    expect(page.url()).toContain("/insights");
  });
});

// ===========================================================================
// GROUP 4 — Stats Bar
// ===========================================================================

test.describe("Home — Stats Bar", () => {
  test("'Data Points' stat label is visible", async ({ page }) => {
    await goToHome(page);
    const statsSection = page.locator('section[aria-label="Key statistics"]');
    await expect(statsSection.getByText("Data Points")).toBeVisible();
  });

  test("'Employers Tracked' stat label is visible", async ({ page }) => {
    await goToHome(page);
    const statsSection = page.locator('section[aria-label="Key statistics"]');
    await expect(statsSection.getByText("Employers Tracked")).toBeVisible();
  });

  test("all 4 stat labels render on mobile", async ({ page }) => {
    await goToHome(page);
    const statsSection = page.locator('section[aria-label="Key statistics"]');
    for (const label of ["Data Points", "Employers Tracked", "Countries", "Forecast Series"]) {
      await expect(statsSection.getByText(label)).toBeVisible();
    }
  });

  test("stats section has no horizontal overflow", async ({ page }) => {
    await goToHome(page);
    const section = page.locator('section[aria-label="Key statistics"]');
    await expect(section).toBeVisible();
    const box = await section.boundingBox();
    if (box) {
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 4);
    }
  });

  test("'243K' employers stat value is visible on mobile", async ({ page }) => {
    await goToHome(page);
    await expect(page.getByText(/243K/).first()).toBeVisible();
  });
});

// ===========================================================================
// GROUP 5 — Quick Access Cards (3 flagship tools)
// ===========================================================================

test.describe("Home — Quick Access Cards", () => {
  test('"Start Here" section heading is visible', async ({ page }) => {
    await goToHome(page);
    await expect(page.getByRole("heading", { name: /Start Here/i })).toBeVisible();
  });

  test("Priority Date Forecast card is visible", async ({ page }) => {
    await goToHome(page);
    const quickSection = page.locator('section[aria-label="Quick access to top tools"]');
    await expect(quickSection.getByText("Priority Date Forecast")).toBeVisible();
  });

  test("Employer Score (SRS) card is visible", async ({ page }) => {
    await goToHome(page);
    const quickSection = page.locator('section[aria-label="Quick access to top tools"]');
    await expect(quickSection.getByText("Employer Score (SRS)")).toBeVisible();
  });

  test("Wage Benchmarks card is visible", async ({ page }) => {
    await goToHome(page);
    const quickSection = page.locator('section[aria-label="Quick access to top tools"]');
    await expect(quickSection.getByText("Wage Benchmarks")).toBeVisible();
  });

  test("quick access cards are full-width on iPhone 14 (single-column layout)", async ({ page }) => {
    await goToHome(page);
    const section = page.locator('section[aria-label="Quick access to top tools"]');
    const firstCard = section.getByRole("link").first();
    const box = await firstCard.boundingBox();
    const viewportWidth = page.viewportSize()!.width;
    expect(box).not.toBeNull();
    // At 390px viewport, sm:grid-cols-3 hasn't kicked in — cards should be near full-width
    expect(box!.width).toBeGreaterThanOrEqual(viewportWidth * 0.8);
  });

  test('"Most Popular" badge is visible on Priority Date Forecast card', async ({ page }) => {
    await goToHome(page);
    await expect(page.getByText(/Most Popular/i)).toBeVisible();
  });
});

// ===========================================================================
// GROUP 6 — Dashboard Grid (8 dashboards)
// ===========================================================================

test.describe("Home — Dashboard Grid", () => {
  test('"8 Interactive Dashboards" heading is visible after scrolling', async ({ page }) => {
    await goToHome(page);
    await page.locator("#dashboards").scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: /8 Interactive Dashboards/i })).toBeVisible();
  });

  test("all 8 dashboard card titles are visible on scroll", async ({ page }) => {
    await goToHome(page);
    await page.locator("#dashboards").scrollIntoViewIfNeeded();
    const dashSection = page.locator('section[aria-label="Dashboards"]');
    const dashTitles = [
      "Visa Bulletin Trends",
      "Sponsor Reliability Score",
      "EB Category Comparison",
      "Geographic Heatmaps",
      "Wage Competitiveness",
      "Occupation Demand",
      "Processing Speed",
      "Approval & Denial Trends",
    ];
    for (const title of dashTitles) {
      await expect(dashSection.getByText(title).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("Visa Bulletin Trends card link has correct href", async ({ page }) => {
    await goToHome(page);
    await page.locator("#dashboards").scrollIntoViewIfNeeded();
    const link = page.getByRole("link", { name: /Visa Bulletin Trends/i });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toContain("visa-bulletin");
  });

  test("tapping Visa Bulletin Trends card navigates to the dashboard", async ({ page }) => {
    await goToHome(page);
    await page.locator("#dashboards").scrollIntoViewIfNeeded();
    await page.getByRole("link", { name: /Visa Bulletin Trends/i }).tap();
    await page.waitForURL("**/visa-bulletin**", { timeout: 5_000 });
    expect(page.url()).toContain("visa-bulletin");
  });

  test("no horizontal overflow after scrolling to dashboard grid", async ({ page }) => {
    await goToHome(page);
    await page.locator("#dashboards").scrollIntoViewIfNeeded();
    await expectNoHorizontalOverflow(page);
  });

  test('"Explore Dashboards" CTA scrolls to the dashboard grid section', async ({ page }) => {
    await goToHome(page);
    await page.getByRole("link", { name: /Explore Dashboards/i }).tap();
    await page.waitForTimeout(600); // allow smooth-scroll to settle
    await expect(page.locator("#dashboards")).toBeVisible();
  });
});

// ===========================================================================
// GROUP 7 — Value Props ("Built Different")
// ===========================================================================

test.describe("Home — Value Props Section", () => {
  test('"Built Different" section heading is visible on scroll', async ({ page }) => {
    await goToHome(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(
      page.getByRole("heading", { name: /Built Different/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test("all 3 value prop titles are visible", async ({ page }) => {
    await goToHome(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    for (const title of ["Real-Time Data", "Privacy First", "AI-Powered"]) {
      await expect(page.getByText(title)).toBeVisible({ timeout: 5_000 });
    }
  });

  test("Privacy First tile mentions no accounts or tracking", async ({ page }) => {
    await goToHome(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText(/No accounts/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test("value props section has no horizontal overflow", async ({ page }) => {
    await goToHome(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expectNoHorizontalOverflow(page);
  });
});

// ===========================================================================
// GROUP 8 — Scroll Reachability & Full-Page Health
// ===========================================================================

test.describe("Home — Scroll Reachability & Full-Page Health", () => {
  test("page footer is reachable by scrolling", async ({ page }) => {
    await goToHome(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator("footer")).toBeVisible({ timeout: 3_000 });
  });

  test("no horizontal overflow at any scroll position through the page", async ({ page }) => {
    await goToHome(page);
    for (const fraction of [0.25, 0.5, 0.75, 1.0]) {
      await page.evaluate(
        (f) => window.scrollTo(0, document.body.scrollHeight * f),
        fraction
      );
      await page.waitForTimeout(100);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("page has sufficient scrollable content (taller than one iPhone 14 viewport)", async ({ page }) => {
    await goToHome(page);
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    // Full landing page (hero + stats + 3 quick access + 8 dashboards + value props) >> 844px
    expect(bodyHeight).toBeGreaterThan(844);
  });
});
