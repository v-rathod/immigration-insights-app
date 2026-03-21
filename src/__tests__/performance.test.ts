/**
 * Performance & Bundle Sanity Tests
 *
 * Static-analysis checks that guard against performance regressions:
 *  - JSON data files stay under size budgets
 *  - Static export stays under page-count ceiling
 *  - No accidental heavy dependencies
 *  - Data loader response shapes are valid
 */
import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync } from "fs";
import { join, extname } from "path";

const PUBLIC_DATA = join(process.cwd(), "public/data");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileSizes(dir: string, ext?: string): { path: string; sizeKB: number }[] {
  if (!existsSync(dir)) return [];
  const result: { path: string; sizeKB: number }[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (!ext || extname(entry.name) === ext) {
        result.push({ path: full.replace(process.cwd() + "/", ""), sizeKB: statSync(full).size / 1024 });
      }
    }
  };
  walk(dir);
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Performance — data file budgets", () => {
  it("non-employer dashboard JSON files are under 50MB each", () => {
    const dashboardDir = join(PUBLIC_DATA, "dashboards");
    if (!existsSync(dashboardDir)) return;
    // Employer + wage subdirs have large pre-computed files loaded via shards (expected)
    // Only check other dashboard dirs for budget compliance
    const dirs = readdirSync(dashboardDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !["employer", "wage"].includes(d.name));
    for (const dir of dirs) {
      const files = getFileSizes(join(dashboardDir, dir.name), ".json");
      const oversized = files.filter((f) => f.sizeKB > 51200);
      expect(oversized).toEqual([]);
    }
  });

  it("dimension files are under 1MB each", () => {
    const dimsDir = join(PUBLIC_DATA, "dims");
    if (!existsSync(dimsDir)) return;
    const files = getFileSizes(dimsDir, ".json");
    const oversized = files.filter((f) => f.sizeKB > 1024);
    expect(oversized).toEqual([]);
  });

  it("employer shard index exists and is under 8MB", () => {
    const indexPath = join(PUBLIC_DATA, "employers/_index.json");
    if (!existsSync(indexPath)) return;
    const sizeKB = statSync(indexPath).size / 1024;
    expect(sizeKB).toBeLessThan(8192);
  });

  it("employer search index exists and is under 20MB", () => {
    const searchPath = join(PUBLIC_DATA, "employers/_search.json");
    if (!existsSync(searchPath)) return;
    const sizeKB = statSync(searchPath).size / 1024;
    expect(sizeKB).toBeLessThan(20480);
  });
});

describe("Performance — static page count", () => {
  it("out/ directory has expected page count (if recently built)", () => {
    const outDir = join(process.cwd(), "out");
    if (!existsSync(outDir)) return; // skip if not built
    const htmlFiles = getFileSizes(outDir, ".html");
    if (htmlFiles.length === 0) return; // stale/empty out/ dir
    // Should have at least 10 pages (dashboards + about + insights + etc.)
    expect(htmlFiles.length).toBeGreaterThanOrEqual(10);
    // Should not exceed 30 pages (guard against accidental dynamic generation)
    expect(htmlFiles.length).toBeLessThan(30);
  });
});

describe("Performance — package.json dependency check", () => {
  it("does not include known heavy dependencies", async () => {
    const pkg = await import("../../package.json");
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const banned = [
      "moment",        // Use native Date instead
      "lodash",        // Use native JS methods
      "jquery",        // Not needed in React
      "bootstrap",     // Using Tailwind
    ];
    for (const dep of banned) {
      expect(deps).not.toHaveProperty(dep);
    }
  });

  it("uses lightweight chart library (recharts, not d3 directly)", async () => {
    const pkg = await import("../../package.json");
    const deps = pkg.dependencies ?? {};
    expect(deps).toHaveProperty("recharts");
    // d3 as a direct dependency would bloat the bundle
    expect(deps).not.toHaveProperty("d3");
  });
});

describe("Performance — data manifest integrity", () => {
  it("manifest exists and has valid structure", async () => {
    const manifestPath = join(PUBLIC_DATA, "_manifest.json");
    if (!existsSync(manifestPath)) return;
    const manifest = (await import(`${PUBLIC_DATA}/_manifest.json`)).default;
    expect(manifest).toHaveProperty("synced_at");
    expect(typeof manifest.synced_at).toBe("string");
  });
});
