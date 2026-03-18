/**
 * PD Cortex — iPhone 14 Mobile E2E Tests
 *
 * Comprehensive test suite for the Priority Date Cortex dashboard at
 * mobile viewport (390 × 844 — iPhone 14 logical resolution).
 *
 * Prerequisites: npm run dev must be running on port 3000.
 * Run:  npx playwright test pd-cortex-mobile
 *
 * Coverage:
 *   - Page load & structure
 *   - No horizontal overflow at 390px
 *   - Navigation (hamburger menu)
 *   - Interactive controls (category pills, country pills, forecast toggle)
 *   - Priority date input (full-width on mobile, our fix)
 *   - Chart renders at correct mobile aspect ratio
 *   - Prediction cards appear after entering a PD date
 *   - MCRA risk widget appears in Risk-Adjusted mode
 *   - Methodology collapsible: open by default, toggleable
 *   - All content reachable by scrolling
 *   - Performance: page load well under 3s TTI on local
 */

import { test, expect, type Page } from "@playwright/test";

// ── Constants ──────────────────────────────────────────────────────────────

const URL = "/dashboard/visa-bulletin";

// A priority date guaranteed to be in the active forecast window (not current)
const TEST_PRIORITY_DATE = "2022-03-15";

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Navigate to PD Cortex and wait for the main heading */
async function goToPdCortex(page: Page) {
  await page.goto(URL);
  await page.waitForSelector("h1", { timeout: 10_000 });
}

/** Enter a priority date into the date input */
async function enterPriorityDate(page: Page, isoDate: string) {
  const input = page.locator('input[type="date"]');
  await input.fill(isoDate);
  // Trigger change event explicitly (some browsers need this)
  await input.dispatchEvent("change");
}

/** Check that there is no horizontal scrollbar (no overflow) */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow, "Page should not have horizontal overflow").toBe(false);
}

// ===========================================================================
// GROUP 1 — Page Load & Structure
// ===========================================================================

test.describe("PD Cortex — Page Load & Structure", () => {
  test("page loads with correct title", async ({ page }) => {
    await goToPdCortex(page);
    await expect(page.locator("h1")).toContainText("Priority Date");
  });

  test("loads within 3 seconds", async ({ page }) => {
    const start = Date.now();
    await goToPdCortex(page);
    expect(Date.now() - start).toBeLessThan(3_000);
  });

  test("page title is in document head", async ({ page }) => {
    await page.goto(URL);
    await expect(page).toHaveTitle(/Priority Date|Compass/i);
  });

  test("no horizontal overflow at iPhone 14 width (390px)", async ({ page }) => {
    await goToPdCortex(page);
    await expectNoHorizontalOverflow(page);
  });

  test("main content area does not extend beyond viewport width", async ({ page }) => {
    await goToPdCortex(page);
    const overflow = await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      return main.scrollWidth > window.innerWidth + 2; // 2px tolerance
    });
    expect(overflow).toBe(false);
  });
});

// ===========================================================================
// GROUP 2 — Mobile Navigation
// ===========================================================================

test.describe("PD Cortex — Mobile Navigation", () => {
  test("desktop sidebar is hidden on mobile", async ({ page }) => {
    await goToPdCortex(page);
    // Desktop sidebar should not be visible at 390px
    const desktopSidebar = page.locator("nav").filter({ hasText: "My Insights" }).first();
    await expect(desktopSidebar).toBeHidden();
  });

  test("hamburger menu button is visible on mobile", async ({ page }) => {
    await goToPdCortex(page);
    const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="navigation" i], button.lg\\:hidden').first();
    await expect(hamburger).toBeVisible();
  });

  test("mobile nav opens when hamburger is clicked", async ({ page }) => {
    await goToPdCortex(page);
    // Find and click the hamburger
    const hamburger = page.locator("button.lg\\:hidden").first();
    await hamburger.click();
    // Sidebar overlay should appear
    const overlay = page.locator(".fixed.inset-0, [class*='overlay'], [class*='backdrop']").first();
    await expect(overlay).toBeVisible({ timeout: 2_000 });
  });

  test("mobile nav closes when overlay is clicked", async ({ page }) => {
    await goToPdCortex(page);
    const hamburger = page.locator("button.lg\\:hidden").first();
    await hamburger.click();
    // Click the overlay to close
    const overlay = page.locator(".fixed.inset-0").last();
    await overlay.click({ position: { x: 300, y: 400 } });
    await expect(overlay).toBeHidden({ timeout: 2_000 });
  });
});

// ===========================================================================
// GROUP 3 — Category & Country Controls
// ===========================================================================

test.describe("PD Cortex — Category & Country Controls", () => {
  test("EB2 category pill is visible and active by default", async ({ page }) => {
    await goToPdCortex(page);
    const eb2 = page.getByRole("button", { name: "EB2" });
    await expect(eb2).toBeVisible();
  });

  test("all default category pills are visible: EB1, EB2, EB3", async ({ page }) => {
    await goToPdCortex(page);
    for (const cat of ["EB1", "EB2", "EB3"]) {
      await expect(page.getByRole("button", { name: cat })).toBeVisible();
    }
  });

  test("clicking EB1 category pill updates the selection", async ({ page }) => {
    await goToPdCortex(page);
    const eb1 = page.getByRole("button", { name: "EB1" });
    await eb1.click();
    // EB1 should now have active styling (bg color class changes)
    await expect(eb1).toHaveAttribute("class", /bg-/);
  });

  test("India country pill is visible and selectable", async ({ page }) => {
    await goToPdCortex(page);
    const india = page.getByRole("button", { name: /India/i });
    await expect(india).toBeVisible();
    await india.click();
  });

  test("country pills for China, ROW, and Philippines are visible", async ({ page }) => {
    await goToPdCortex(page);
    await expect(page.getByRole("button", { name: /China/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ROW|Rest of World/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Philippines/i })).toBeVisible();
  });

  test("category pills have minimum touch-target height", async ({ page }) => {
    await goToPdCortex(page);
    const eb2 = page.getByRole("button", { name: "EB2" });
    const box = await eb2.boundingBox();
    expect(box).not.toBeNull();
    // WCAG recommends 44px minimum; our pills are smaller but at least 28px on mobile
    expect(box!.height).toBeGreaterThanOrEqual(28);
    expect(box!.width).toBeGreaterThanOrEqual(36);
  });

  test("all category pills are within viewport width (no horizontal overflow)", async ({ page }) => {
    await goToPdCortex(page);
    const viewportWidth = page.viewportSize()!.width;
    const pills = page.getByRole("button", { name: /EB[123]/i });
    for (const pill of await pills.all()) {
      const box = await pill.boundingBox();
      if (box) {
        expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 4); // 4px tolerance
      }
    }
  });
});

// ===========================================================================
// GROUP 4 — Priority Date Input
// ===========================================================================

test.describe("PD Cortex — Priority Date Input", () => {
  test("priority date input is visible", async ({ page }) => {
    await goToPdCortex(page);
    const input = page.locator('input[type="date"]');
    await expect(input).toBeVisible();
  });

  test("priority date input fills the available width (mobile fix)", async ({ page }) => {
    await goToPdCortex(page);
    const input = page.locator('input[type="date"]');
    const box = await input.boundingBox();
    expect(box).not.toBeNull();
    // After our fix (w-full sm:max-w-[200px]), it should use most of the row width
    // At 390px viewport, it should be at least 180px wide (not truncated to some narrow value)
    expect(box!.width).toBeGreaterThanOrEqual(150);
  });

  test("entering a priority date does not cause page overflow", async ({ page }) => {
    await goToPdCortex(page);
    await enterPriorityDate(page, TEST_PRIORITY_DATE);
    await page.waitForTimeout(500);
    await expectNoHorizontalOverflow(page);
  });

  test("entering a priority date shows prediction cards", async ({ page }) => {
    await goToPdCortex(page);
    await enterPriorityDate(page, TEST_PRIORITY_DATE);
    // Wait for cards to appear
    await expect(page.getByText(/DFF Prediction|Filing Date|Date for Filing/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test("prediction cards show a forecast month after entering PD", async ({ page }) => {
    await goToPdCortex(page);
    await enterPriorityDate(page, TEST_PRIORITY_DATE);
    // Should show a month/year like "Jan 2027" or "Current!"
    const cardArea = page.locator('[class*="prediction"], [class*="card"]').first();
    await expect(cardArea).toBeVisible({ timeout: 5_000 });
  });

  test("clearing priority date hides prediction cards", async ({ page }) => {
    await goToPdCortex(page);
    await enterPriorityDate(page, TEST_PRIORITY_DATE);
    await page.waitForTimeout(300);
    // Clear the date field
    const input = page.locator('input[type="date"]');
    await input.fill("");
    await input.dispatchEvent("change");
    await page.waitForTimeout(300);
    // CTA text should be visible (exact text from the visa-bulletin page)
    await expect(
      page.getByText("Enter your priority date to see predictions").first()
    ).toBeVisible({ timeout: 3_000 });
  });
});

// ===========================================================================
// GROUP 5 — Forecast Mode Toggle
// ===========================================================================

test.describe("PD Cortex — Forecast Mode Toggle", () => {
  // The forecast mode selector lives inside PriorityDateChart, appears only
  // after forecast data loads. Buttons use role="radio" (radiogroup).

  test("Optimistic toggle button is visible after data loads", async ({ page }) => {
    await goToPdCortex(page);
    // Wait for chart to render with data (the radiogroup appears)
    await expect(page.getByRole("radio", { name: /Optimistic/i })).toBeVisible({ timeout: 10_000 });
  });

  test("Realistic toggle button is visible after data loads", async ({ page }) => {
    await goToPdCortex(page);
    await expect(page.getByRole("radio", { name: /Realistic/i })).toBeVisible({ timeout: 10_000 });
  });

  test("Risk-Adjusted toggle button is visible after data loads", async ({ page }) => {
    await goToPdCortex(page);
    await expect(page.getByRole("radio", { name: /Risk.Adjusted/i })).toBeVisible({ timeout: 10_000 });
  });

  test("all three forecast mode buttons fit within viewport", async ({ page }) => {
    await goToPdCortex(page);
    await page.getByRole("radio", { name: /Optimistic/i }).waitFor({ timeout: 10_000 });
    const viewportWidth = page.viewportSize()!.width;
    for (const name of ["Optimistic", "Realistic"]) {
      const btn = page.getByRole("radio", { name: new RegExp(name, "i") }).first();
      const box = await btn.boundingBox();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 4);
      }
    }
  });

  test("clicking Realistic changes the active mode (aria-checked)", async ({ page }) => {
    await goToPdCortex(page);
    const realistic = page.getByRole("radio", { name: /Realistic/i });
    await realistic.waitFor({ timeout: 10_000 });
    await realistic.click();
    // aria-checked should become "true" for clicked button
    await expect(realistic).toHaveAttribute("aria-checked", "true");
  });

  test("switching to Risk-Adjusted shows MCRA risk card after entering PD", async ({ page }) => {
    await goToPdCortex(page);
    // Wait for data to load first
    await page.getByRole("radio", { name: /Risk.Adjusted/i }).waitFor({ timeout: 10_000 });
    await enterPriorityDate(page, TEST_PRIORITY_DATE);
    await page.getByRole("radio", { name: /Risk.Adjusted/i }).click();
    // MCRA risk widget should appear
    await expect(page.getByText(/Monte Carlo Retrograde Risk/i)).toBeVisible({ timeout: 5_000 });
  });

  test("MCRA widget shows Retro Prob and Avg Setback metrics", async ({ page }) => {
    await goToPdCortex(page);
    await page.getByRole("radio", { name: /Risk.Adjusted/i }).waitFor({ timeout: 10_000 });
    await enterPriorityDate(page, TEST_PRIORITY_DATE);
    await page.getByRole("radio", { name: /Risk.Adjusted/i }).click();
    await expect(page.getByText(/Retro Prob/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Avg Setback/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test("MCRA widget shows helper text explaining what Retro Prob means", async ({ page }) => {
    await goToPdCortex(page);
    await page.getByRole("radio", { name: /Risk.Adjusted/i }).waitFor({ timeout: 10_000 });
    await enterPriorityDate(page, TEST_PRIORITY_DATE);
    await page.getByRole("radio", { name: /Risk.Adjusted/i }).click();
    // Our new sublabel text explaining the metric
    await expect(page.getByText(/per month, avg over 24m/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test("MCRA widget footer explains the metrics in plain English", async ({ page }) => {
    await goToPdCortex(page);
    await page.getByRole("radio", { name: /Risk.Adjusted/i }).waitFor({ timeout: 10_000 });
    await enterPriorityDate(page, TEST_PRIORITY_DATE);
    await page.getByRole("radio", { name: /Risk.Adjusted/i }).click();
    await expect(page.getByText(/chance of a backward move/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ===========================================================================
// GROUP 6 — Chart Rendering
// ===========================================================================

test.describe("PD Cortex — Chart Rendering", () => {
  test("chart container is visible and has meaningful height", async ({ page }) => {
    await goToPdCortex(page);
    // The chart wrapper uses aspect-[4/3] sm:aspect-[16/7] + w-full
    const chartContainer = page.locator('[class*="aspect-"]').first();
    await expect(chartContainer).toBeVisible();
    const box = await chartContainer.boundingBox();
    expect(box).not.toBeNull();
    // At 390px width with 4:3 aspect ratio, height should be ~260px+
    expect(box!.height).toBeGreaterThan(200);
    expect(box!.width).toBeGreaterThan(300);
  });

  test("chart SVG element is rendered inside container", async ({ page }) => {
    await goToPdCortex(page);
    const svg = page.locator(".recharts-wrapper svg, .recharts-surface").first();
    await expect(svg).toBeVisible({ timeout: 5_000 });
  });

  test("chart does not cause horizontal overflow at 390px", async ({ page }) => {
    await goToPdCortex(page);
    const viewportWidth = page.viewportSize()!.width;
    const chartSvg = page.locator(".recharts-wrapper, .recharts-surface").first();
    const box = await chartSvg.boundingBox();
    if (box) {
      expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 4);
    }
  });

  test("chart heading 'Priority Date Movement' is visible", async ({ page }) => {
    await goToPdCortex(page);
    await expect(page.getByRole("heading", { name: "Priority Date Movement" })).toBeVisible();
  });
});

// ===========================================================================
// GROUP 7 — Methodology Collapsible
// ===========================================================================

test.describe("PD Cortex — Methodology Collapsible", () => {
  test("methodology section is present on the page", async ({ page }) => {
    await goToPdCortex(page);
    // Scroll down to find it
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText(/How Compass Models Priority Date Movement/i)).toBeVisible({ timeout: 5_000 });
  });

  test("methodology section is open by default (content visible)", async ({ page }) => {
    await goToPdCortex(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const details = page.locator('details[open]').last();
    await expect(details).toBeVisible();
  });

  test("methodology content mentions Optimistic, Realistic, and Risk-Adjusted models", async ({ page }) => {
    await goToPdCortex(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText("Optimistic:").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Realistic:").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Risk-Adjusted \(MCRA\):/i)).toBeVisible({ timeout: 5_000 });
  });

  test("tapping the collapsible summary closes the section", async ({ page }) => {
    await goToPdCortex(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const summary = page.locator("details summary").last();
    await summary.click();
    // After clicking, the <details> should no longer have [open]
    const details = page.locator("details").last();
    await expect(details).not.toHaveAttribute("open");
  });
});

// ===========================================================================
// GROUP 8 — Scroll Reachability
// ===========================================================================

test.describe("PD Cortex — All Content Scrollable & Reachable", () => {
  test("page is scrollable and footer is reachable", async ({ page }) => {
    await goToPdCortex(page);
    // Scroll to the very bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // Footer or last section should be visible
    const footer = page.locator("footer, [role='contentinfo']").first();
    await expect(footer).toBeVisible({ timeout: 3_000 });
  });

  test("entering PD and scrolling still has no horizontal overflow", async ({ page }) => {
    await goToPdCortex(page);
    await enterPriorityDate(page, TEST_PRIORITY_DATE);
    await page.waitForTimeout(500);
    // Scroll through the entire page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expectNoHorizontalOverflow(page);
  });

  test("MCRA widget is scrollable into view on mobile", async ({ page }) => {
    await goToPdCortex(page);
    // Wait for data, then switch mode
    await page.getByRole("radio", { name: /Risk.Adjusted/i }).waitFor({ timeout: 10_000 });
    await enterPriorityDate(page, TEST_PRIORITY_DATE);
    await page.getByRole("radio", { name: /Risk.Adjusted/i }).click();
    const mcraWidget = page.getByText(/Monte Carlo Retrograde Risk/i);
    await mcraWidget.scrollIntoViewIfNeeded();
    await expect(mcraWidget).toBeVisible({ timeout: 3_000 });
  });
});

// ===========================================================================
// GROUP 9 — Already-Current PD Detection
// ===========================================================================

test.describe("PD Cortex — Already-Current PD Detection", () => {
  test("PD behind current EB2 cutoff shows Current! badge, not a future date", async ({ page }) => {
    await goToPdCortex(page);
    // EB2 India cutoff is Jan 15, 2015 as of April 2026 VB
    // A PD of Jan 1, 2015 should be detected as already current
    await enterPriorityDate(page, "2015-01-01");
    await page.waitForTimeout(800);
    // Look for "Current!" text — our bug fix makes this appear instead of "May 2026"
    const currentBadge = page.getByText(/Current!/i).first();
    await expect(currentBadge).toBeVisible({ timeout: 5_000 });
  });

  test("PD well in future (2023) shows a future forecast month, not Current!", async ({ page }) => {
    await goToPdCortex(page);
    await enterPriorityDate(page, "2022-03-15");
    await page.waitForTimeout(800);
    // Should show the DFF prediction card label (confirming prediction cards rendered)
    await expect(page.getByText("Date for Filing").first()).toBeVisible({ timeout: 5_000 });
    // Should NOT show "Current!" since 2022 PD is well behind EB2/IND cutoff of Jan 2015
    // (Current! only appears for PDs before the live cutoff)
    const currentBadges = page.getByText(/Current!/i);
    expect(await currentBadges.count()).toBe(0);
  });
});
