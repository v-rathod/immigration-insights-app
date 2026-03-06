/**
 * Data normalization integrity tests for P3 Compass.
 *
 * These tests read the actual synced JSON files in public/data/ and verify
 * that employer name normalization from P2 has been applied correctly:
 *
 * - No ALL-CAPS raw employer names (e.g., "GOOGLE INC", "GOOGLE LLC")
 * - Known duplicate variants are collapsed into one canonical entry
 * - Canonical names follow Title Case format
 *
 * Run after `npm run sync-data` to catch regressions when P2 artifacts change.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Resolve from project root (vitest runs from package.json directory)
const PUBLIC_DATA = join(process.cwd(), "public", "data");

function loadJson(relativePath: string): unknown[] {
  const fullPath = join(PUBLIC_DATA, relativePath);
  try {
    const raw = readFileSync(fullPath, "utf-8");
    // JSON spec doesn't support NaN — replace bare NaN tokens with null
    const sanitized = raw.replace(/:\s*NaN\b/g, ": null");
    return JSON.parse(sanitized) as unknown[];
  } catch {
    return []; // File doesn't exist yet — skip by returning empty
  }
}

/** Names known to be raw/un-normalized Google variants. */
const RAW_GOOGLE_VARIANTS = new Set([
  "GOOGLE INC",
  "Google Inc.",
  "GOOGLE INC.",
  "GOOGLE INC,",
  "Google LLC",
  "GOOGLE LLC",
  "GOOGLE LLC,",
]);

/** Checks if a string is ALL-CAPS (len > 3, no lowercase). */
function isAllCaps(name: string): boolean {
  return name.length > 3 && name === name.toUpperCase() && /[A-Z]/.test(name);
}

/**
 * Checks if a string is a "dirty" all-caps name that should have been normalized.
 * Excludes:
 * - Spaced initials like "C C T S" (each word is 1 char — legitimate abbreviation)
 * - Sentinel "UNKNOWN"
 * - Short strings (≤ 3 chars)
 */
function isDirtyAllCaps(name: string): boolean {
  if (!name || name === "UNKNOWN" || name.length <= 3) return false;
  if (name !== name.toUpperCase()) return false;
  if (!/[A-Z]/.test(name)) return false;
  // Spaced initials: every word is a single character
  const words = name.trim().split(/\s+/);
  const longestWord = Math.max(...words.map((w) => w.length));
  return longestWord > 2; // "GOOGLE INC" has "GOOGLE" (6 chars) → dirty
}

// ─── employer_salary_trend.json ──────────────────────────────────────────────

describe("public/data/dashboards/wage/employer_salary_trend.json", () => {
  const data = loadJson("dashboards/wage/employer_salary_trend.json") as Array<{
    employer_name?: string;
  }>;

  it("has data (sync has been run)", () => {
    expect(data.length).toBeGreaterThan(0);
  });

  it("does not contain raw Google variants", () => {
    const googleEntries = data
      .map((r) => r.employer_name ?? "")
      .filter((n) => n.toLowerCase().includes("google"));
    const rawVariants = googleEntries.filter((n) => RAW_GOOGLE_VARIANTS.has(n));
    expect(rawVariants).toStrictEqual([]);
  });

  it("contains the canonical 'Google' entry", () => {
    const names = data.map((r) => r.employer_name ?? "");
    const hasGoogle = names.includes("Google");
    // Only assert if any google entry exists at all
    if (names.some((n) => n.toLowerCase().includes("google"))) {
      expect(hasGoogle).toBe(true);
    }
  });

  it("top 50 employers by filings are not ALL-CAPS", () => {
    // Group by employer_name and find the top 50
    const counts: Record<string, number> = {};
    for (const row of data) {
      const name = row.employer_name ?? "";
      counts[name] = (counts[name] ?? 0) + 1;
    }
    const top50 = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([name]) => name);

    const allCapsNames = top50.filter(isAllCaps);
    expect(allCapsNames).toStrictEqual([]);
  });
});

// ─── employer_wage_rankings.json ─────────────────────────────────────────────

describe("public/data/dashboards/wage/employer_wage_rankings.json", () => {
  const data = loadJson("dashboards/wage/employer_wage_rankings.json") as Array<{
    employer_name?: string;
  }>;

  it("has data (sync has been run)", () => {
    expect(data.length).toBeGreaterThan(0);
  });

  it("does not contain raw Google variants", () => {
    const googleEntries = data
      .map((r) => r.employer_name ?? "")
      .filter((n) => n.toLowerCase().includes("google"));
    const rawVariants = googleEntries.filter((n) => RAW_GOOGLE_VARIANTS.has(n));
    expect(rawVariants).toStrictEqual([]);
  });

  it("top 100 employer names are not ALL-CAPS", () => {
    const allCapsNames = data
      .slice(0, 100)
      .map((r) => r.employer_name ?? "")
      .filter(isAllCaps);
    expect(allCapsNames).toStrictEqual([]);
  });
});

// ─── dim_employer.json ───────────────────────────────────────────────────────

describe("public/data/dims/dim_employer.json", () => {
  const data = loadJson(
    "dims/dim_employer.json"
  ) as Array<{ employer_name?: string; employer_id?: string }>;

  it("has data", () => {
    // dim_employer is large (240K+ entries) — just verify it loaded
    expect(data.length).toBeGreaterThan(100);
  });

  it("contains canonical Google entry", () => {
    const names = data.map((r) => r.employer_name ?? "");
    expect(names).toContain("Google");
  });

  it("sample of first 200 names are not ALL-CAPS", () => {
    const sample = data.slice(0, 200).map((r) => r.employer_name ?? "");
    const allCapsNames = sample.filter(isAllCaps);
    expect(allCapsNames).toStrictEqual([]);
  });

  it("employer_id values are unique strings", () => {
    const ids = data.map((r) => r.employer_id ?? "");
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(data.length);
  });
});

// ─── Canonical name contract: no known raw variants in any wage file ─────────

describe("Cross-file canonical employer name contract", () => {
  const salaryTrend = loadJson(
    "dashboards/wage/employer_salary_trend.json"
  ) as Array<{ employer_name?: string }>;
  const wageRankings = loadJson(
    "dashboards/wage/employer_wage_rankings.json"
  ) as Array<{ employer_name?: string }>;
  // employer_features.json removed — not consumed by any P3 component
  const monthly = loadJson(
    "dashboards/employer/employer_monthly_metrics.json"
  ) as Array<{ employer_name?: string }>;

  /** Returns all employer names across all provided datasets. */
  function allNames(
    datasets: Array<Array<{ employer_name?: string }>>
  ): string[] {
    return datasets.flatMap((d) => d.map((r) => r.employer_name ?? ""));
  }

  it("no dataset contains 'INFOSYS LIMITED' — should be 'Infosys'", () => {
    const names = allNames([salaryTrend, wageRankings, monthly]);
    expect(names).not.toContain("INFOSYS LIMITED");
  });

  it("no dataset contains 'TATA CONSULTANCY SERVICES LIMITED'", () => {
    const names = allNames([salaryTrend, wageRankings, monthly]);
    expect(names).not.toContain("TATA CONSULTANCY SERVICES LIMITED");
  });

  it("no dataset contains 'COGNIZANT TECHNOLOGY SOLUTIONS'", () => {
    const names = allNames([salaryTrend, wageRankings, monthly]);
    const allCapsVariant = names.filter(
      (n) => n.toUpperCase() === "COGNIZANT TECHNOLOGY SOLUTIONS"
    );
    expect(allCapsVariant).toStrictEqual([]);
  });

  it("no dataset contains 'AMAZON WEB SERVICES INC'", () => {
    const names = allNames([salaryTrend, wageRankings, monthly]);
    expect(names).not.toContain("AMAZON WEB SERVICES INC");
  });
});

// ─── employer_friendliness_scores.json ──────────────────────────────────────

describe("public/data/dashboards/employer/employer_friendliness_scores.json", () => {
  const data = loadJson(
    "dashboards/employer/employer_friendliness_scores.json"
  ) as Array<{ employer_name?: string; srs?: number }>;

  it("has data (sync has been run)", () => {
    expect(data.length).toBeGreaterThan(0);
  });

  it("no dirty all-caps names in first 500 rows", () => {
    const dirtyNames = data
      .slice(0, 500)
      .map((r) => r.employer_name ?? "")
      .filter(isDirtyAllCaps);
    expect(dirtyNames).toStrictEqual([]);
  });
});

// ─── employer_monthly_metrics.json ──────────────────────────────────────────

describe("public/data/dashboards/employer/employer_monthly_metrics.json", () => {
  const data = loadJson(
    "dashboards/employer/employer_monthly_metrics.json"
  ) as Array<{ employer_name?: string; employer_id?: string }>;

  it("has data (sync has been run)", () => {
    expect(data.length).toBeGreaterThan(0);
  });

  it("does not contain raw Google variants", () => {
    const googleEntries = data
      .map((r) => r.employer_name ?? "")
      .filter((n) => n.toLowerCase().includes("google"));
    const rawVariants = googleEntries.filter((n) => RAW_GOOGLE_VARIANTS.has(n));
    expect(rawVariants).toStrictEqual([]);
  });

  it("no dirty all-caps employer names (multi-word, non-abbreviation)", () => {
    // Previously had 6,965 dirty all-caps names — after dim_employer fix should be ~0
    const dirtyNames = data
      .map((r) => r.employer_name ?? "")
      .filter(isDirtyAllCaps);
    // Allow a small threshold of residual edge cases but not the thousands we had
    expect(dirtyNames.length).toBeLessThan(100);
  });

  it("has employer_id on each row", () => {
    const missing = data.filter((r) => !r.employer_id).length;
    expect(missing).toBe(0);
  });
});

// ─── JSON spec compliance: no bare NaN tokens ────────────────────────────────

describe("JSON spec compliance", () => {
  // Skip `employers/` dir (95K+ shards) — they use a separate _nan_to_null()
  // encoder and are sampled separately below for speed.
  const SKIP_DIRS = new Set(["employers"]);

  const readdirSync = (dir: string): string[] => {
    const { readdirSync: rd } = require("fs");
    const { join, basename } = require("path");
    const entries = rd(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) files.push(...readdirSync(full));
      } else if (e.name.endsWith(".json")) {
        files.push(full);
      }
    }
    return files;
  };

  const DATA_DIR = join(process.cwd(), "public", "data");
  const allJsonFiles = (() => {
    const { existsSync } = require("fs");
    if (!existsSync(DATA_DIR)) return [];
    return readdirSync(DATA_DIR);
  })();

  it("no JSON file contains bare NaN tokens (invalid JSON spec)", () => {
    const { readFileSync } = require("fs");
    const BAD_NAN = /(?<=[:\[,])\s*NaN\b/;
    const violators: string[] = [];
    for (const file of allJsonFiles) {
      const raw = readFileSync(file, "utf-8");
      if (BAD_NAN.test(raw)) {
        const rel = file.replace(process.cwd() + "/", "");
        violators.push(rel);
      }
    }
    expect(violators).toStrictEqual([]);
  });

  it("employer shard sample has no bare NaN tokens", () => {
    const { readFileSync, readdirSync: rd, existsSync } = require("fs");
    const { join } = require("path");
    const empDir = join(DATA_DIR, "employers");
    if (!existsSync(empDir)) return; // skip if no shards
    const shards = rd(empDir)
      .filter((f: string) => f.endsWith(".json") && f !== "_index.json");
    // Sample up to 200 shards for speed
    const SAMPLE = 200;
    const step = Math.max(1, Math.floor(shards.length / SAMPLE));
    const BAD_NAN = /(?<=[:\[,])\s*NaN\b/;
    const violators: string[] = [];
    for (let i = 0; i < shards.length && violators.length === 0; i += step) {
      const fp = join(empDir, shards[i]);
      if (BAD_NAN.test(readFileSync(fp, "utf-8"))) {
        violators.push(shards[i]);
      }
    }
    expect(violators).toStrictEqual([]);
  });
});

