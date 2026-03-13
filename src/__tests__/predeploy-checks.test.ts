// Pre-Deployment Check Suite
//
// Validates that the static build output (out/) and data artifacts (public/data/)
// are complete and structurally sound BEFORE deploying to AWS S3 + CloudFront.
//
// WHY THIS EXISTS
// ---------------
// Past incidents caught by these checks:
//   - out/_next/static/ missing: CSS/JS bundles deleted from S3 on next --delete sync,
//     all pages lost styling (fixed Milestone 10.62)
//   - Employer shards not consolidated after sync: 0 records on SRS/Wage pages
//     (fixed Milestone 10.63)
//   - Dashboard JSON files missing: dashboards show blank charts
//
// USAGE
// -----
// Run before every deployment (requires "npm run build" + "npm run sync-data" first):
//   npm test -- predeploy-checks
//
// NOT RUN IN CI
// -------------
// Excluded from ci.yml because CI does not run "npm run build" or "npm run sync-data"
// (they require ~1.3 GB of P2 Parquet artifacts from the dev machine).
// Excluded via: --exclude="**/predeploy-checks*"

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join } from "path";

const ROOT = process.cwd(); // /Users/vrathod1/dev/NorthStar/immigration-insights-app
const OUT = join(ROOT, "out");
const PUBLIC_DATA = join(ROOT, "public", "data");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fileSize(path: string): number {
  try { return statSync(path).size; } catch { return -1; }
}

function dirFileCount(dir: string, ext?: string): number {
  try {
    return readdirSync(dir, { recursive: true })
      .filter((f): f is string => typeof f === "string")
      .filter((f) => !ext || f.endsWith(ext))
      .length;
  } catch { return 0; }
}

/** Find all files (recursive) matching optional extension under a directory */
function findFiles(dir: string, ext?: string): string[] {
  try {
    return readdirSync(dir, { recursive: true })
      .filter((f): f is string => typeof f === "string")
      .filter((f) => !ext || f.endsWith(ext))
      .map((f) => join(dir, f));
  } catch { return []; }
}

const outExists = existsSync(OUT) && existsSync(join(OUT, "index.html"));

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1: Static build output (out/)
// Checks the build artifact that gets synced to S3.
// ═════════════════════════════════════════════════════════════════════════════

describe.skipIf(!outExists)("Pre-deploy: out/ build output", () => {
  // ── Root HTML ──────────────────────────────────────────────────────────────

  it("out/ directory exists", () => {
    expect(existsSync(OUT)).toBe(true);
  });

  it("out/index.html exists and is not empty (> 1 KB)", () => {
    const path = join(OUT, "index.html");
    expect(existsSync(path)).toBe(true);
    expect(fileSize(path)).toBeGreaterThan(1024);
  });

  it("404 page exists", () => {
    // Either out/404.html or out/404/index.html
    const html = existsSync(join(OUT, "404.html"));
    const dir  = existsSync(join(OUT, "404", "index.html"));
    expect(html || dir).toBe(true);
  });

  // ── All 9 dashboard pages ──────────────────────────────────────────────────

  const DASHBOARD_PAGES = [
    "dashboard/visa-bulletin",
    "dashboard/employer",
    "dashboard/wage",
    "dashboard/eb-category",
    "dashboard/geographic",
    "dashboard/job-demand",
    "dashboard/processing",
    "dashboard/backlog",
    "dashboard/approvals",
  ];

  it.each(DASHBOARD_PAGES)("dashboard page exists: %s/index.html", (page) => {
    const path = join(OUT, page, "index.html");
    expect(existsSync(path)).toBe(true);
    expect(fileSize(path)).toBeGreaterThan(1024);
  });

  // ── Non-dashboard pages ────────────────────────────────────────────────────

  const OTHER_PAGES = ["insights", "ask", "about", "privacy", "terms"];

  it.each(OTHER_PAGES)("page exists: %s/index.html", (page) => {
    const path = join(OUT, page, "index.html");
    expect(existsSync(path)).toBe(true);
    expect(fileSize(path)).toBeGreaterThan(1024);
  });

  // ── HTML page count ────────────────────────────────────────────────────────

  it("at least 15 HTML files in out/ (catches missing pages)", () => {
    const htmlFiles = findFiles(OUT, ".html");
    expect(htmlFiles.length).toBeGreaterThanOrEqual(15);
  });

  it("no HTML file is smaller than 1 KB (catches blank/broken builds)", () => {
    // Exclude 404.html which may be intentionally minimal
    const htmlFiles = findFiles(OUT, ".html")
      .filter(f => !f.endsWith("404.html"));
    const tooSmall = htmlFiles.filter(f => fileSize(f) < 1024);
    if (tooSmall.length > 0) {
      throw new Error(`These HTML files are too small (<1 KB) — build may be broken:\n${tooSmall.join("\n")}`);
    }
    expect(tooSmall.length).toBe(0);
  });

  // ── CSS + JS bundles (_next/static/) ──────────────────────────────────────

  it("out/_next/static/ directory exists (CSS/JS bundles present)", () => {
    // CRITICAL: if this directory is missing and you run `aws s3 sync --delete`,
    // it will DELETE _next/static/ from S3, breaking all styling and JS for users.
    const path = join(OUT, "_next", "static");
    expect(existsSync(path)).toBe(true);
  });

  it("at least 1 CSS file in out/_next/ (prevents styling-less deployment)", () => {
    const cssFiles = findFiles(join(OUT, "_next"), ".css");
    expect(cssFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("every CSS file is non-empty (> 0 bytes)", () => {
    const cssFiles = findFiles(join(OUT, "_next"), ".css");
    const empty = cssFiles.filter(f => fileSize(f) === 0);
    if (empty.length > 0) {
      throw new Error(`Empty CSS files found — build may be broken:\n${empty.join("\n")}`);
    }
    expect(empty.length).toBe(0);
  });

  it("at least 10 JS files in out/_next/static/chunks/ (catches broken JS build)", () => {
    const jsFiles = findFiles(join(OUT, "_next", "static", "chunks"), ".js");
    expect(jsFiles.length).toBeGreaterThanOrEqual(10);
  });

  it("every JS file in _next/static/chunks/ is non-empty (> 0 bytes)", () => {
    const jsFiles = findFiles(join(OUT, "_next", "static", "chunks"), ".js");
    const empty = jsFiles.filter(f => fileSize(f) === 0);
    if (empty.length > 0) {
      throw new Error(`Empty JS files found — build may be broken:\n${empty.join("\n")}`);
    }
    expect(empty.length).toBe(0);
  });

  // ── Data files in build output ─────────────────────────────────────────────

  it("out/data/_freshness.json exists (data was synced)", () => {
    const path = join(OUT, "data", "_freshness.json");
    expect(existsSync(path)).toBe(true);
  });

  it("out/data/employers/_search.json exists in build output", () => {
    const path = join(OUT, "data", "employers", "_search.json");
    expect(existsSync(path)).toBe(true);
  });

  it("out/data/employers/_search.json is at least 1 MB (not truncated)", () => {
    const path = join(OUT, "data", "employers", "_search.json");
    expect(fileSize(path)).toBeGreaterThan(1_000_000);
  });

  it("out/data/employers/ contains > 50,000 shard files", () => {
    const dir = join(OUT, "data", "employers");
    const count = dirFileCount(dir, ".json");
    expect(count).toBeGreaterThan(50_000);
  });

  it("out/data/dashboards/employer/srs_overview.json exists", () => {
    const path = join(OUT, "data", "dashboards", "employer", "srs_overview.json");
    expect(existsSync(path)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2: public/data/ — data sync artifacts
// Checks the source data BEFORE npm run build copies it into out/.
// If any of these fail, run: npm run sync-data (python3 scripts/sync_p2_data.py)
// ═════════════════════════════════════════════════════════════════════════════

const dataExists = existsSync(join(PUBLIC_DATA, "_freshness.json"));

describe.skipIf(!dataExists)("Pre-deploy: public/data/ artifacts", () => {
  // ── Freshness marker ────────────────────────────────────────────────────────

  it("public/data/_freshness.json exists (P2 data has been synced)", () => {
    expect(existsSync(join(PUBLIC_DATA, "_freshness.json"))).toBe(true);
  });

  it("public/data/_freshness.json has synced_at field", () => {
    const raw = readFileSync(join(PUBLIC_DATA, "_freshness.json"), "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    expect(typeof data.synced_at).toBe("string");
    expect((data.synced_at as string).length).toBeGreaterThan(0);
  });

  // ── Employer search index ──────────────────────────────────────────────────

  it("public/data/employers/_search.json exists", () => {
    expect(existsSync(join(PUBLIC_DATA, "employers", "_search.json"))).toBe(true);
  });

  it("public/data/employers/_search.json is at least 1 MB", () => {
    expect(fileSize(join(PUBLIC_DATA, "employers", "_search.json"))).toBeGreaterThan(1_000_000);
  });

  it("public/data/employers/_index.json exists", () => {
    expect(existsSync(join(PUBLIC_DATA, "employers", "_index.json"))).toBe(true);
  });

  // ── Employer shards ────────────────────────────────────────────────────────

  it("public/data/employers/ has > 50,000 shard JSON files", () => {
    const count = dirFileCount(join(PUBLIC_DATA, "employers"), ".json");
    // 94,843 shards + 3 meta files (_search, _index, _freshness inside root)
    expect(count).toBeGreaterThan(50_000);
  });

  // ── Optum Services shard (regression anchor) ───────────────────────────────

  it("Optum Services shard (78a46d...) exists in public/data/employers/", () => {
    const path = join(PUBLIC_DATA, "employers", "78a46d3917846d886ef35fe989075cb353f21a1d.json");
    expect(existsSync(path)).toBe(true);
  });

  it("Optum Services shard is enriched (> 500 KB — contains wage + SRS data)", () => {
    // Base shard (LCA only) ≈ 735 KB; enriched shard ≈ 775 KB.
    // If file is < 500 KB, run_consolidation.py was not run after the last sync.
    const path = join(PUBLIC_DATA, "employers", "78a46d3917846d886ef35fe989075cb353f21a1d.json");
    expect(fileSize(path)).toBeGreaterThan(500_000);
  });

  // ── Dashboard JSON directories ─────────────────────────────────────────────

  const REQUIRED_DASHBOARD_FILES: Array<[string, string]> = [
    ["employer/srs_overview.json",                         "SRS overview (totalEmployers, tiers)"],
    ["employer/employer_friendliness_scores_ml.json",      "SRS ML scores"],
    ["employer/employer_risk_features.json",               "Employer risk features"],
    ["visa-bulletin/fact_cutoff_trends.json",              "Visa bulletin cutoff trends"],
    ["visa-bulletin/fact_cutoffs_all.json",                "All visa cutoffs (historical)"],
    ["eb-category/category_movement_metrics.json",         "EB category movement metrics"],
    ["geographic/worksite_geo_metrics.json",               "Geographic worksite metrics"],
    ["soc-demand/soc_demand_metrics.json",                 "SOC demand metrics"],
    ["processing/processing_times_trends.json",            "Processing time trends"],
    ["backlog/backlog_estimates.json",                     "Backlog estimates"],
    ["wage/salary_benchmarks_national.json",               "National salary benchmarks"],
    ["wage/employer_wage_rankings.json",                   "Employer wage rankings"],
  ];

  it.each(REQUIRED_DASHBOARD_FILES)("dashboard file exists: dashboards/%s", (filePath) => {
    const fullPath = join(PUBLIC_DATA, "dashboards", filePath);
    expect(existsSync(fullPath)).toBe(true);
    expect(fileSize(fullPath)).toBeGreaterThan(0);
  });

  // ── Dimension files ────────────────────────────────────────────────────────

  const DIMENSION_FILES = [
    "dim_country.json",
    "dim_soc.json",
    "dim_visa_ceiling.json",
    "dim_visa_class.json",
  ];

  it.each(DIMENSION_FILES)("dimension file exists: dims/%s", (file) => {
    const fullPath = join(PUBLIC_DATA, "dims", file);
    expect(existsSync(fullPath)).toBe(true);
    expect(fileSize(fullPath)).toBeGreaterThan(0);
  });

  // ── SRS overview data integrity ────────────────────────────────────────────

  it("srs_overview.json has totalEmployers > 0 (not stale/empty)", () => {
    const path = join(PUBLIC_DATA, "dashboards", "employer", "srs_overview.json");
    if (!existsSync(path)) return; // already covered above
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    expect(data.totalEmployers).toBeDefined();
    expect(typeof data.totalEmployers).toBe("number");
    expect(data.totalEmployers as number).toBeGreaterThan(0);
  });

  it("srs_overview.json has ratedEmployers > 0 (consolidation ran successfully)", () => {
    const path = join(PUBLIC_DATA, "dashboards", "employer", "srs_overview.json");
    if (!existsSync(path)) return;
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    // If ratedEmployers === 0 it means consolidate_employer_shards() did not run
    expect(data.ratedEmployers as number).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3: _search.json content integrity
// Validates the employer search index has correct content for smart sort.
// ═════════════════════════════════════════════════════════════════════════════

interface SearchEntry {
  n?: string;           // compact: employer_name
  employer_name?: string;
  id?: string;          // compact: employer_id
  employer_id?: string;
  f?: number;           // compact: total_filings
  total_filings?: number;
  ss?: number | null;
  st?: string;
}

const searchIndexPath = join(PUBLIC_DATA, "employers", "_search.json");
const searchIndexExists = existsSync(searchIndexPath);

let searchIndex: SearchEntry[] = [];
if (searchIndexExists) {
  try {
    const raw = readFileSync(searchIndexPath, "utf-8");
    const sanitized = raw.replace(/\bNaN\b|-?\bInfinity\b/g, "null");
    searchIndex = JSON.parse(sanitized) as SearchEntry[];
  } catch { /* handled by test */ }
}

describe.skipIf(!searchIndexExists)("Pre-deploy: _search.json content (smart-sort data)", () => {
  it("search index has > 1,000 entries", () => {
    expect(searchIndex.length).toBeGreaterThan(1_000);
  });

  it("first entry has employer name field (compact key 'n' or full 'employer_name')", () => {
    const first = searchIndex[0];
    const name = first?.n ?? first?.employer_name;
    expect(typeof name).toBe("string");
    expect((name ?? "").length).toBeGreaterThan(0);
  });

  it("at least 80% of entries have numeric total_filings (key 'f') for smart sort", () => {
    const sample = searchIndex.slice(0, 200);
    const withVolume = sample.filter(e => typeof (e.f ?? e.total_filings) === "number").length;
    expect(withVolume / sample.length).toBeGreaterThanOrEqual(0.8);
  });

  it("entries are NOT in A-Z order (confirms volume-weighted data, not alphabetical)", () => {
    const names = searchIndex.slice(0, 50).map(e => e.n ?? e.employer_name ?? "");
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    const isAlphabetical = names.every((n, i) => n === sortedNames[i]);
    expect(isAlphabetical).toBe(false);
  });

  it("Optum Services appears in search index", () => {
    const entry = searchIndex.find(e =>
      (e.n ?? e.employer_name ?? "").toLowerCase() === "optum services"
    );
    expect(entry).toBeDefined();
  });

  it("Optum Services has >= 500 total_filings in search index", () => {
    const entry = searchIndex.find(e =>
      (e.n ?? e.employer_name ?? "").toLowerCase() === "optum services"
    );
    const filings = entry?.f ?? entry?.total_filings ?? 0;
    expect(filings).toBeGreaterThanOrEqual(500);
  });

  it("searching 'Optum': Optum Services has the highest filings among all Optum variants", () => {
    // When user searches "Optum" in the SRS/Wage autocomplete, all entries starting
    // with "optum" get the same prefix-match bonus (0.7) in smart-sort. Among them,
    // the one with the most filings wins the volume tiebreaker (20% weight).
    // This test ensures the DATA supports the expected UX behavior:
    //   "Optum Services" must appear first when you type "Optum".
    const optumVariants = searchIndex.filter(e =>
      (e.n ?? e.employer_name ?? "").toLowerCase().startsWith("optum")
    );
    expect(optumVariants.length).toBeGreaterThan(0);

    const optumServices = optumVariants.find(e =>
      (e.n ?? e.employer_name ?? "").toLowerCase() === "optum services"
    );
    expect(optumServices).toBeDefined();

    const optumServicesFilings = optumServices?.f ?? optumServices?.total_filings ?? 0;
    const maxFilings = Math.max(...optumVariants.map(e => e.f ?? e.total_filings ?? 0));
    expect(optumServicesFilings).toBe(maxFilings);
  });

  it("top 100 entries include known major H-1B filers (data quality check)", () => {
    // The search index is sorted by total_filings DESC (from sync_p2_data.py).
    // Well-known large H-1B filers should appear near the top of the list.
    const top100Names = searchIndex
      .slice(0, 100)
      .map(e => (e.n ?? e.employer_name ?? "").toLowerCase());

    const MAJOR_FILERS = [
      "infosys",        // top H-1B filer
      "cognizant",      // top H-1B filer
      "tata",           // top H-1B filer
      "capgemini",      // top H-1B filer
      "wipro",          // top H-1B filer
    ];
    // At least 3 of the 5 major filers must appear in the top 100
    const found = MAJOR_FILERS.filter(filer =>
      top100Names.some(n => n.includes(filer))
    );
    expect(found.length).toBeGreaterThanOrEqual(3);
  });
});
