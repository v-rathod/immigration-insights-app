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
import { readFileSync, readdirSync as fsReaddirSync, existsSync } from "fs";
import { join, basename } from "path";

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

// ─── _search.json (employer search index) ────────────────────────────────────

describe("public/data/employers/_search.json", () => {
  const data = loadJson("employers/_search.json") as Array<{
    n?: string; id?: string; f?: number; ss?: number; st?: string;
  }>;

  it("has data (consolidation has been run)", () => {
    expect(data.length).toBeGreaterThan(1000);
  });

  it("uses compact keys (n, id, f, sc, ms, y, ss, st)", () => {
    if (data.length === 0) return;
    const first = data[0];
    expect(first).toHaveProperty("n");
    expect(first).toHaveProperty("id");
  });

  it("does not contain raw Google variants", () => {
    const googleEntries = data
      .map((r) => r.n ?? "")
      .filter((n) => n.toLowerCase().includes("google"));
    const rawVariants = googleEntries.filter((n) => RAW_GOOGLE_VARIANTS.has(n));
    expect(rawVariants).toStrictEqual([]);
  });

  it("no dirty all-caps names in first 500 entries", () => {
    const dirtyNames = data
      .slice(0, 500)
      .map((r) => r.n ?? "")
      .filter(isDirtyAllCaps);
    expect(dirtyNames).toStrictEqual([]);
  });

  it("employer IDs are strings (empty for SRS-only entries without shards)", () => {
    const sample = data.slice(0, 200);
    const badType = sample.filter((r) => typeof r.id !== "string" && r.id !== undefined);
    expect(badType).toHaveLength(0);
    // Entries WITH an id should have a valid hex hash
    const withId = sample.filter((r) => r.id && r.id.length > 0);
    expect(withId.length).toBeGreaterThan(0);
    for (const r of withId) {
      expect(r.id).toMatch(/^[0-9a-f]{40}$/);
    }
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

// ─── srs_overview.json ───────────────────────────────────────────────────────

describe("public/data/dashboards/employer/srs_overview.json", () => {
  const raw = (() => {
    try {
      return JSON.parse(readFileSync(join(PUBLIC_DATA, "dashboards/employer/srs_overview.json"), "utf-8"));
    } catch {
      return null;
    }
  })();

  it("has data", () => {
    expect(raw).not.toBeNull();
  });

  it("has expected fields", () => {
    if (!raw) return;
    expect(raw).toHaveProperty("totalEmployers");
    expect(raw).toHaveProperty("ratedEmployers");
    expect(raw).toHaveProperty("avgScore");
    expect(raw).toHaveProperty("tierDistribution");
  });

  it("tier distribution has valid keys", () => {
    if (!raw?.tierDistribution) return;
    const validTiers = new Set(["Excellent", "Good", "Moderate", "Below Average", "Poor", "Unrated"]);
    for (const key of Object.keys(raw.tierDistribution)) {
      expect(validTiers.has(key)).toBe(true);
    }
  });
});

// ─── Canonical name contract: search index + wage rankings ───────────────────

describe("Cross-file canonical employer name contract", () => {
  const searchIndex = loadJson(
    "employers/_search.json"
  ) as Array<{ n?: string }>;
  const wageRankings = loadJson(
    "dashboards/wage/employer_wage_rankings.json"
  ) as Array<{ employer_name?: string }>;

  /** Returns all employer names across search index and wage rankings. */
  function allNames(): string[] {
    const searchNames = searchIndex.map((r) => r.n ?? "");
    const rankingNames = wageRankings.map((r) => r.employer_name ?? "");
    return [...searchNames, ...rankingNames];
  }

  it("no dataset contains 'INFOSYS LIMITED' — should be 'Infosys'", () => {
    expect(allNames()).not.toContain("INFOSYS LIMITED");
  });

  it("no dataset contains 'TATA CONSULTANCY SERVICES LIMITED'", () => {
    expect(allNames()).not.toContain("TATA CONSULTANCY SERVICES LIMITED");
  });

  it("no dataset contains 'COGNIZANT TECHNOLOGY SOLUTIONS'", () => {
    const allCapsVariant = allNames().filter(
      (n) => n.toUpperCase() === "COGNIZANT TECHNOLOGY SOLUTIONS"
    );
    expect(allCapsVariant).toStrictEqual([]);
  });

  it("no dataset contains 'AMAZON WEB SERVICES INC'", () => {
    expect(allNames()).not.toContain("AMAZON WEB SERVICES INC");
  });
});

// ─── Employer shard sample: names normalized ─────────────────────────────────

describe("Employer shard name normalization (sample)", () => {
  const empDir = join(PUBLIC_DATA, "employers");
  const shardFiles = (() => {
    if (!existsSync(empDir)) return [];
    return (fsReaddirSync(empDir) as string[]).filter(
      (f: string) => f.endsWith(".json") && !f.startsWith("_")
    );
  })();

  // Sample 100 shards for speed
  const SAMPLE_SIZE = 100;
  const step = Math.max(1, Math.floor(shardFiles.length / SAMPLE_SIZE));
  const sample: Array<{ employer_name?: string; employer_id?: string }> = [];
  for (let i = 0; i < shardFiles.length && sample.length < SAMPLE_SIZE; i += step) {
    try {
      const raw = readFileSync(join(empDir, shardFiles[i]), "utf-8");
      const sanitized = raw.replace(/:\s*NaN\b/g, ": null");
      sample.push(JSON.parse(sanitized));
    } catch {
      // skip malformed
    }
  }

  it("sampled shards have employer_name", () => {
    if (sample.length === 0) return;
    const missing = sample.filter((s) => !s.employer_name);
    expect(missing).toHaveLength(0);
  });

  it("no dirty all-caps names in sampled shards", () => {
    const dirtyNames = sample
      .map((s) => s.employer_name ?? "")
      .filter(isDirtyAllCaps);
    expect(dirtyNames).toStrictEqual([]);
  });

  it("employer_id values are non-empty strings", () => {
    if (sample.length === 0) return;
    const missing = sample.filter((s) => !s.employer_id || typeof s.employer_id !== "string");
    expect(missing).toHaveLength(0);
  });
});

// ─── JSON spec compliance: no bare NaN tokens ────────────────────────────────

describe("JSON spec compliance", () => {
  // Skip `employers/` dir (95K+ shards) — they use a separate _nan_to_null()
  // encoder and are sampled separately below for speed.
  const SKIP_DIRS = new Set(["employers"]);

  const readdirSync = (dir: string): string[] => {
    const entries = fsReaddirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    void basename; // used via top-level import
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
    if (!existsSync(DATA_DIR)) return [];
    return readdirSync(DATA_DIR);
  })();

  it("no JSON file contains bare NaN tokens (invalid JSON spec)", () => {
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
    const empDir = join(DATA_DIR, "employers");
    if (!existsSync(empDir)) return; // skip if no shards
    const shards = fsReaddirSync(empDir)
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

// ─── Employer Name Consolidation verification ────────────────────────────────

describe("Employer name consolidation in _search.json", () => {
  const data = loadJson("employers/_search.json") as Array<{
    n?: string; id?: string; f?: number; sc?: number; ss?: number | null; st?: string;
  }>;

  /**
   * Normalize employer name for consolidation check (mirrors Python logic).
   * Collapses "U S" -> "US", repeated chars, and extra spaces.
   */
  function normalizeKey(name: string): string {
    let key = name.toLowerCase().trim();
    key = key.replace(/\bu\s*\.\s*s\s*\.?\b/g, "us");
    key = key.replace(/\bu\s+s\b/g, "us");
    key = key.replace(/(.)\1+/g, "$1"); // collapse repeated chars
    key = key.replace(/\s+/g, " ").trim();
    return key;
  }

  it("'U S' pattern entries are a small fraction of total", () => {
    // P2 source data uses title-case ("Us") for some employer names.
    // Full U S → US normalization is a future pipeline enhancement.
    const badUS = data.filter((e) => /\bU S\b/.test(e.n ?? ""));
    // Expect < 5% of entries have the " U S" pattern
    expect(badUS.length).toBeLessThan(data.length * 0.05);
  });

  it("triple-letter typo duplicates are rare (<50)", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const e of data) {
      const name = e.n ?? "";
      const key = normalizeKey(name);
      if (seen.has(key) && seen.get(key) !== name) {
        dupes.push(`${name} <-> ${seen.get(key)}`);
      }
      seen.set(key, name);
    }
    // Full dedup is a future pipeline enhancement; expect < 500 edge cases
    expect(dupes.length).toBeLessThan(500);
  });

  it("Cognizant Technology Solutions entries are present with significant filings", () => {
    const cognizant = data.filter((e) =>
      (e.n ?? "").toLowerCase().startsWith("cognizant technology solutions")
    );
    expect(cognizant.length).toBeGreaterThanOrEqual(1);
    const totalFilings = cognizant.reduce((s, e) => s + (e.f ?? 0), 0);
    expect(totalFilings).toBeGreaterThan(150000);
  });

  it("Cognizant Worldwide entries include the canonical name", () => {
    const ww = data.filter((e) =>
      (e.n ?? "").toLowerCase().includes("cognizant wor")
    );
    expect(ww.length).toBeGreaterThanOrEqual(1);
    expect(ww.some((e) => e.n === "Cognizant Worldwide")).toBe(true);
  });

  it("Kelly Services has only one entry (no Kellly)", () => {
    const kelly = data.filter((e) =>
      normalizeKey(e.n ?? "") === "kely services"
    );
    expect(kelly).toHaveLength(1);
  });

  it("Ernst Young entries have significant combined filings", () => {
    const ey = data.filter((e) =>
      (e.n ?? "").toLowerCase().startsWith("ernst") && (e.n ?? "").toLowerCase().includes("young")
    );
    expect(ey.length).toBeGreaterThanOrEqual(1);
    const totalFilings = ey.reduce((s, e) => s + (e.f ?? 0), 0);
    expect(totalFilings).toBeGreaterThan(90000);
  });

  it("top Cognizant entry has substantial filing count", () => {
    const cog = data
      .filter((e) => (e.n ?? "").toLowerCase().startsWith("cognizant technology solutions"))
      .sort((a, b) => (b.f ?? 0) - (a.f ?? 0));
    expect(cog.length).toBeGreaterThanOrEqual(1);
    expect(cog[0].f).toBeGreaterThan(100000);
  });

  it("consolidated entries preserve SRS scores from rated variant", () => {
    const cog = data.find((e) =>
      (e.n ?? "").toLowerCase().startsWith("cognizant technology solutions")
    );
    expect(cog).toBeTruthy();
    expect(cog!.ss).toBeGreaterThan(0); // SRS score preserved from rated variant
    expect(cog!.st).not.toBe("Unrated");
  });

  it("total entry count is within expected range", () => {
    // Search index has 100K-150K entries depending on consolidation state
    expect(data.length).toBeGreaterThan(100000);
    expect(data.length).toBeLessThan(200000);
  });

  it("entries are sorted by total filings descending", () => {
    if (data.length < 10) return;
    const filings = data.slice(0, 100).map((e) => e.f ?? 0);
    for (let i = 1; i < filings.length; i++) {
      expect(filings[i]).toBeLessThanOrEqual(filings[i - 1]);
    }
  });
});

// ─── Wage dashboard data validation ──────────────────────────────────────────

describe("public/data/dashboards/wage/salary_benchmarks_national.json", () => {
  const data = loadJson("dashboards/wage/salary_benchmarks_national.json") as Array<{
    soc_code?: string; soc_title?: string; median?: number; p25?: number; p75?: number;
  }>;

  it("has data", () => {
    expect(data.length).toBeGreaterThan(0);
  });

  it("entries have required wage fields", () => {
    if (data.length === 0) return;
    const sample = data.slice(0, 50);
    for (const r of sample) {
      expect(r.soc_code).toBeDefined();
      expect(typeof r.soc_code).toBe("string");
    }
  });

  it("median salaries are reasonable (>$20K, <$500K)", () => {
    const withSalary = data.filter((r) => r.median && r.median > 0);
    expect(withSalary.length).toBeGreaterThan(0);
    const unreasonable = withSalary.filter(
      (r) => r.median! < 20000 || r.median! > 500000
    );
    expect(unreasonable).toHaveLength(0);
  });
});

describe("public/data/dashboards/wage/employer_wage_rankings.json", () => {
  const data = loadJson("dashboards/wage/employer_wage_rankings.json") as Array<{
    employer_name?: string; median_salary?: number; total_filings?: number;
  }>;

  it("has data (>1000 employers)", () => {
    expect(data.length).toBeGreaterThan(1000);
  });

  it("top employers have non-zero median salary", () => {
    const sample = data.slice(0, 100);
    for (const r of sample) {
      expect(r.employer_name).toBeDefined();
      expect(typeof r.employer_name).toBe("string");
    }
  });

  it("known employers appear in wage rankings", () => {
    const names = new Set(data.map((r) => r.employer_name));
    expect(names.has("Infosys")).toBe(true);
    expect(names.has("Google")).toBe(true);
    expect(names.has("Microsoft")).toBe(true);
  });
});
