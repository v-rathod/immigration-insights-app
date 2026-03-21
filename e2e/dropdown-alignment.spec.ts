/**
 * Dropdown alignment diagnostic test.
 * Measures exact pixel positions of the search input bottom edge
 * vs the dropdown top edge to diagnose vertical misalignment.
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Employer search dropdown vertical alignment", () => {
  /**
   * Helper: returns { inputBottom, dropdownTop, gap } so we can assert the
   * dropdown appears just below the input field, not in the middle of it.
   */
  async function measureAlignment(page: import("@playwright/test").Page, url: string, compact: boolean) {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Find the search input
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible();

    // Type to trigger dropdown
    await input.click();
    await input.fill("Google");
    await page.waitForTimeout(300);

    // Wait for dropdown to appear
    const dropdown = page.locator('ul[role="listbox"]').first();
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Measure bounding boxes
    const inputBox = await input.boundingBox();
    const dropdownBox = await dropdown.boundingBox();

    if (!inputBox || !dropdownBox) throw new Error("Could not get bounding boxes");

    const inputBottom = inputBox.y + inputBox.height;
    const dropdownTop = dropdownBox.y;
    const gap = dropdownTop - inputBottom;

    console.log(`\n[${compact ? "COMPACT" : "NORMAL"} mode — ${url}]`);
    console.log(`  Input:        y=${inputBox.y.toFixed(1)}, height=${inputBox.height.toFixed(1)}, bottom=${inputBottom.toFixed(1)}`);
    console.log(`  Dropdown:     y=${dropdownTop.toFixed(1)}`);
    console.log(`  Gap:          ${gap.toFixed(1)}px (expected ~2–8px)`);
    console.log(`  ALIGNED?      ${gap >= 0 && gap <= 12 ? "✓ YES" : "✗ NO — misaligned by " + gap.toFixed(1) + "px"}`);

    // Take a screenshot for visual inspection
    await page.screenshot({
      path: `/tmp/dropdown-align-${compact ? "compact" : "normal"}.png`,
      clip: {
        x: Math.max(0, inputBox.x - 20),
        y: Math.max(0, inputBox.y - 20),
        width: inputBox.width + 40,
        height: Math.min(500, dropdownBox.height + inputBox.height + 80),
      },
    });

    return { inputBox, inputBottom, dropdownTop, gap };
  }

  test("SRS dashboard — normal mode (absolute positioning)", async ({ page }) => {
    const { inputBottom, dropdownTop, gap } = await measureAlignment(
      page,
      `${BASE}/dashboard/employer`,
      false
    );
    // Dropdown top should be within 12px below the input bottom
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(12);
  });

  test("Insights page — compact mode (fixed positioning)", async ({ page }) => {
    const { inputBottom, dropdownTop, gap } = await measureAlignment(
      page,
      `${BASE}/insights`,
      true
    );
    // Dropdown top should be within 12px below the input bottom
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(12);
  });

  test("Wage page — employer search alignment", async ({ page }) => {
    const { inputBottom, dropdownTop, gap } = await measureAlignment(
      page,
      `${BASE}/dashboard/wage`,
      false
    );
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(12);
  });
});
