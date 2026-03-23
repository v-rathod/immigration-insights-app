/**
 * Optum Services Live-Data Regression Test
 *
 * This test suite loads the actual Optum Services employer shard from
 * public/data/employers/ and verifies data integrity after P2 sync + normalization.
 *
 * Baseline: Optum Services shard contains 1,928 LCA records as of FY2023.
 * Purpose: Catch regressions in sync/normalization that would reduce data quality.
 *
 * Runs automatically on every `npm test` to ensure no silent data loss.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PUBLIC_DATA = join(process.cwd(), "public", "data");

interface LcaRecord {
  case_number?: string;
  job_title?: string;
  soc_title?: string;
  worksite_state?: string;
  wage_annual?: number;
  fiscal_year?: number;
  [key: string]: unknown;
}

interface OptumShard {
  employer_name?: string;
  employer_id?: string;
  lca?: LcaRecord[];
  lca_total?: number;
  lca_fy_range?: string;
  [key: string]: unknown;
}

function loadOptumShard(): OptumShard {
  const shardPath = join(PUBLIC_DATA, "employers", "78a46d3917846d886ef35fe989075cb353f21a1d.json");
  try {
    const raw = readFileSync(shardPath, "utf-8");
    return JSON.parse(raw) as OptumShard;
  } catch {
    return {};
  }
}

describe("Optum Services (78a46d3917846d886ef35fe989075cb353f21a1d) — Live-Data Regression", () => {
  const optumShard = loadOptumShard();
  const lcaRecords = optumShard.lca ?? [];

  // ───────────────────────────────────────────────────────────────────────
  // 1. BASELINE COUNT: Verify ≥1,928 records (prevent data loss)
  // ───────────────────────────────────────────────────────────────────────

  it("has data (shard loaded successfully)", () => {
    expect(Object.keys(optumShard).length).toBeGreaterThan(0);
  });

  it("shard has lca array", () => {
    expect(Array.isArray(lcaRecords)).toBe(true);
  });

  it("maintains minimum baseline: ≥1,928 Optum LCA records", () => {
    const OPTUM_BASELINE = 1928;
    expect(lcaRecords.length).toBeGreaterThanOrEqual(OPTUM_BASELINE);
  });

  it("shard size is realistic (1,500–2,500 records, not corrupted)", () => {
    // If sync failed, might have 0, 1, or wildly inflated numbers
    expect(lcaRecords.length).toBeGreaterThanOrEqual(1500);
    expect(lcaRecords.length).toBeLessThanOrEqual(2500);
  });

  // ───────────────────────────────────────────────────────────────────────
  // 2. NAME NORMALIZATION: Verify ALL-CAPS names are title-cased
  // ───────────────────────────────────────────────────────────────────────

  it("employer_name field exists and is a string", () => {
    expect(typeof optumShard.employer_name).toBe("string");
    expect((optumShard.employer_name ?? "").length).toBeGreaterThan(0);
  });

  it("no ALL-CAPS employer name (normalization applied)", () => {
    const name = optumShard.employer_name ?? "";
    if (!name || name.length <= 3) {
      expect(true).toBe(true); // Skip if empty or too short
      return;
    }
    const isAllCaps = name === name.toUpperCase() && /[A-Z]/.test(name);
    expect(isAllCaps).toBe(false);
  });

  it("employer_name is 'Optum Services' or similar (normalized form)", () => {
    const name = optumShard.employer_name ?? "";
    expect(name.toLowerCase()).toBe("optum services");
  });

  // ───────────────────────────────────────────────────────────────────────
  // 3. FIELD INTEGRITY: Verify root-level employer metadata
  // ───────────────────────────────────────────────────────────────────────

  it("employer_id field exists and is correct", () => {
    expect(optumShard.employer_id).toBe("78a46d3917846d886ef35fe989075cb353f21a1d");
  });

  it("lca_total metadata matches lca array length", () => {
    const total = optumShard.lca_total ?? 0;
    expect(total).toBe(lcaRecords.length);
  });

  it("no null/undefined values in root employer fields", () => {
    expect(optumShard.employer_name).not.toBeNull();
    expect(optumShard.employer_name).not.toBeUndefined();
    expect(optumShard.employer_id).not.toBeNull();
    expect(optumShard.employer_id).not.toBeUndefined();
  });

  // ───────────────────────────────────────────────────────────────────────
  // 4. LCA RECORD INTEGRITY: Check nested records are not corrupted
  // ───────────────────────────────────────────────────────────────────────

  it("all LCA records are valid objects", () => {
    const invalid = lcaRecords.filter((r) => typeof r !== "object" || r === null).length;
    expect(invalid).toBe(0);
  });

  it("all LCA records have required case_number field", () => {
    const missing = lcaRecords.filter((r) => !r.case_number).length;
    expect(missing).toBe(0);
  });

  it("all LCA records have job_title and soc_title", () => {
    const missing = lcaRecords.filter((r) => !r.job_title || !r.soc_title).length;
    expect(missing).toBe(0);
  });

  it("sample of LCA records have expected wage/state/year fields", () => {
    // Check first 5 non-empty records
    for (let i = 0; i < Math.min(5, lcaRecords.length); i++) {
      const record = lcaRecords[i];
      expect(record).toHaveProperty("wage_annual");
      expect(record).toHaveProperty("worksite_state");
      expect(record).toHaveProperty("fiscal_year");
    }
  });

  it("fiscal_year values are reasonable (2015–2026)", () => {
    const validYears = lcaRecords.every((r) => {
      const year = r.fiscal_year ?? 0;
      return year >= 2015 && year <= 2026;
    });
    expect(validYears).toBe(true);
  });

  it("wage_annual values are non-negative numbers (not NaN/null); 0 means capped outlier", () => {
    const valid = lcaRecords.every((r) => {
      const wage = r.wage_annual ?? 0;
      return typeof wage === "number" && wage >= 0;
    });
    expect(valid).toBe(true);
    // Majority should still have positive wages
    const positive = lcaRecords.filter((r) => (r.wage_annual ?? 0) > 0);
    expect(positive.length / lcaRecords.length).toBeGreaterThan(0.95);
  });

  // ───────────────────────────────────────────────────────────────────────
  // 5. DATA REGRESSION SUMMARY
  // ───────────────────────────────────────────────────────────────────────

  it("shard has not shrunk by >10% from baseline", () => {
    const OPTUM_BASELINE = 1928;
    const MIN_ALLOWED = Math.floor(OPTUM_BASELINE * 0.9); // 90% of baseline
    expect(lcaRecords.length).toBeGreaterThanOrEqual(MIN_ALLOWED);
  });

  it("comprehensive regression summary", () => {
    const summary = {
      lcaRecordCount: lcaRecords.length,
      employerName: optumShard.employer_name,
      employerId: optumShard.employer_id,
      nameNormalized: isNormalized(optumShard.employer_name ?? ""),
      allFieldsPresent:
        !!optumShard.employer_name &&
        !!optumShard.employer_id &&
        Array.isArray(lcaRecords) &&
        lcaRecords.length >= 1928,
      sampleRecordValid:
        lcaRecords.length > 0 &&
        !!lcaRecords[0].case_number &&
        typeof lcaRecords[0].wage_annual === "number",
    };
    console.log("\n  📊 Optum Regression Summary:", summary);
    expect(summary.lcaRecordCount).toBeGreaterThanOrEqual(1928);
    expect(summary.nameNormalized).toBe(true);
    expect(summary.allFieldsPresent).toBe(true);
    expect(summary.sampleRecordValid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SRS DATA IN ENRICHED SHARD
// Validates the srs object embedded by run_consolidation.py.
// If the shard was not consolidated (only has LCA data),
// these tests will fail — fix: python3 scripts/run_consolidation.py
// ═══════════════════════════════════════════════════════════════════════════

describe("Optum Services — SRS data in enriched shard", () => {
  const optumShard = loadOptumShard();
  const srsData = optumShard.srs as Record<string, unknown> | undefined;

  it("shard has srs object (consolidated, not LCA-only)", () => {
    expect(srsData).toBeDefined();
    expect(typeof srsData).toBe("object");
    expect(srsData).not.toBeNull();
  });

  it("Optum Services has 500+ H-1B cases in past 36 months (n_36m)", () => {
    // n_36m = number of H-1B petition adjudications over the most recent 36 months.
    // Optum is a ~35,000+ employee healthcare tech firm and one of the largest
    // H-1B users. 500 is a conservative lower-bound; actual value is typically
    // several thousand.
    const n36m = srsData?.n_36m as number | undefined;
    expect(typeof n36m).toBe("number");
    expect(n36m).toBeGreaterThanOrEqual(500);
  });

  it("srs.approval_rate_36m is a valid rate (0–1)", () => {
    const rate = srsData?.approval_rate_36m as number | undefined;
    expect(typeof rate).toBe("number");
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(1);
  });

  it("srs.denial_rate_36m is a valid rate (0–1)", () => {
    const rate = srsData?.denial_rate_36m as number | undefined;
    expect(typeof rate).toBe("number");
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(1);
  });

  it("srs has required wage ratio field", () => {
    // wage_ratio_med confirms LCA wage vs prevailing wage comparison is present
    const wage = srsData?.wage_ratio_med as number | undefined;
    expect(typeof wage).toBe("number");
  });

  it("srs has a valid efs/srs score (Optum is typically rated)", () => {
    // Optum is a large, frequent filer and should have a computed SRS score.
    // efs is P2's raw field name; extractSrsFromShard remaps it to srs.
    const efs = srsData?.efs as number | null | undefined;
    // Allow for null (unrated is valid), but if present must be in range
    if (efs != null) {
      expect(typeof efs).toBe("number");
      expect(efs).toBeGreaterThan(0);
      expect(efs).toBeLessThanOrEqual(100);
    }
    // Just ensure the field is defined (even null is a valid "unrated" signal)
    expect("efs" in (srsData ?? {})).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OPTUM IN SEARCH INDEX (_search.json)
// Validates that Optum Services appears in the employer search index with
// non-zero case volumes so: (a) it shows up in autocomplete, and
// (b) smart-sort can rank it by volume rather than alphabetically.
// ═══════════════════════════════════════════════════════════════════════════

interface SearchEntry {
  n?: string;           // compact: employer_name
  employer_name?: string; // full format
  f?: number;           // compact: total_filings
  total_filings?: number; // full format
  ss?: number | null;   // srs_score
  st?: string;          // srs_tier
}

function loadSearchIndex(): SearchEntry[] {
  const indexPath = join(PUBLIC_DATA, "employers", "_search.json");
  try {
    const raw = readFileSync(indexPath, "utf-8");
    const sanitized = raw.replace(/\bNaN\b|-?\bInfinity\b/g, "null");
    return JSON.parse(sanitized) as SearchEntry[];
  } catch {
    return [];
  }
}

describe("Optum Services — employer search index (_search.json)", () => {
  const searchIndex = loadSearchIndex();

  it("search index loaded (not empty)", () => {
    expect(searchIndex.length).toBeGreaterThan(0);
  });

  it("Optum Services appears in _search.json", () => {
    const optumEntry = searchIndex.find((e) => {
      const name = (e.n ?? e.employer_name ?? "").toLowerCase();
      return name === "optum services";
    });
    expect(optumEntry).toBeDefined();
  });

  it("Optum Services has 500+ total filings in search index", () => {
    // total_filings (field 'f' in compact format) is used as the case-count
    // proxy for smart-sort volume ranking and for the '_ cases' display in
    // employer-search.tsx. If this is 0 or missing, every employer shows
    // "0 cases" and sort degrades to alphabetical order.
    const optumEntry = searchIndex.find((e) => {
      const name = (e.n ?? e.employer_name ?? "").toLowerCase();
      return name === "optum services";
    });
    const filings = optumEntry?.f ?? optumEntry?.total_filings ?? 0;
    expect(typeof filings).toBe("number");
    expect(filings).toBeGreaterThanOrEqual(500);
  });

  it("Optum Services entry has employer_id (non-empty)", () => {
    const optumEntry = searchIndex.find((e) => {
      const name = (e.n ?? e.employer_name ?? "").toLowerCase();
      return name === "optum services";
    });
    // compact format uses short key 'id', full format 'employer_id'
    const idField = (optumEntry as Record<string, unknown>)?.id
      ?? (optumEntry as Record<string, unknown>)?.employer_id;
    expect(typeof idField).toBe("string");
    expect((idField as string).length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WAGE DATA IN ENRICHED SHARD
//
// This is the CORE scenario that caused "wage details not showing for any
// employer" (Milestone 11.6 regression). The consolidation step embeds
// wage_roles, wage_trend, and wage_role_trends into each shard from the
// monolithic wage JSON files. If consolidation didn't run, these fields are
// absent and the Wage Intelligence Hub shows empty results for every employer.
//
// Fix if these fail: python3 scripts/consolidate_all.py
// ═══════════════════════════════════════════════════════════════════════════

interface WageRole {
  soc_code?: string;
  soc_title?: string;
  fiscal_year?: number;
  n_filings?: number;
  mean_salary?: number;
  median_salary?: number;
  p10_salary?: number;
  p25_salary?: number;
  p75_salary?: number;
  p90_salary?: number;
  prevailing_wage_median?: number;
  wage_premium_pct?: number;
  [key: string]: unknown;
}

interface WageTrend {
  fiscal_year?: number;
  median_salary?: number;
  total_filings?: number;
  [key: string]: unknown;
}

describe("Optum Services — wage data in enriched shard (CRITICAL consolidation check)", () => {
  const optumShard = loadOptumShard();

  // ── 1. wage_roles must exist ────────────────────────────────────────────────
  // wage_roles powers the "Top Roles" collapsible section in EmployerProfile.
  // If missing, the "Top Roles" button is hidden and no salary breakdowns show.

  it("shard has wage_roles array (consolidated, not LCA-only)", () => {
    expect(Array.isArray(optumShard.wage_roles)).toBe(true);
    expect((optumShard.wage_roles as unknown[]).length).toBeGreaterThan(0);
  });

  it("Optum Services has ≥10 wage roles (top H-1B filer has many SOCs)", () => {
    const roles = (optumShard.wage_roles ?? []) as WageRole[];
    expect(roles.length).toBeGreaterThanOrEqual(10);
  });

  it("wage_roles[0] has all required salary fields", () => {
    const roles = (optumShard.wage_roles ?? []) as WageRole[];
    const role = roles[0];
    expect(role).toBeDefined();
    // Required for role card display
    expect(typeof role.soc_code).toBe("string");
    expect(typeof role.soc_title).toBe("string");
    expect(typeof role.n_filings).toBe("number");
    expect(typeof role.median_salary).toBe("number");
    expect(typeof role.mean_salary).toBe("number");
    // Percentile fields for the salary distribution widget
    expect(typeof role.p10_salary).toBe("number");
    expect(typeof role.p25_salary).toBe("number");
    expect(typeof role.p75_salary).toBe("number");
    expect(typeof role.p90_salary).toBe("number");
  });

  it("wage_roles[0] has valid salary values (> $30K and < $1M)", () => {
    const roles = (optumShard.wage_roles ?? []) as WageRole[];
    const role = roles[0];
    expect((role.median_salary ?? 0)).toBeGreaterThan(30_000);
    expect((role.median_salary ?? 0)).toBeLessThan(1_000_000);
  });

  it("wage_roles have valid SOC codes (format XX-XXXX)", () => {
    const roles = (optumShard.wage_roles ?? []) as WageRole[];
    const invalidSocs = roles.filter((r) => !/^\d{2}-\d{4}$/.test(r.soc_code ?? ""));
    expect(invalidSocs.length).toBe(0);
  });

  it("all wage_roles have positive n_filings", () => {
    const roles = (optumShard.wage_roles ?? []) as WageRole[];
    const noFilings = roles.filter((r) => !r.n_filings || r.n_filings <= 0);
    expect(noFilings.length).toBe(0);
  });

  // ── 2. wage_trend must exist ────────────────────────────────────────────────
  // wage_trend powers the salary trend chart (LineChart in EmployerProfile).
  // If missing, the salary trend chart shows a blank area.

  it("shard has wage_trend array", () => {
    expect(Array.isArray(optumShard.wage_trend)).toBe(true);
    expect((optumShard.wage_trend as unknown[]).length).toBeGreaterThan(0);
  });

  it("Optum Services has ≥5 years of salary trend data", () => {
    const trend = (optumShard.wage_trend ?? []) as WageTrend[];
    expect(trend.length).toBeGreaterThanOrEqual(5);
  });

  it("wage_trend[0] has median_salary and total_filings", () => {
    const trend = (optumShard.wage_trend ?? []) as WageTrend[];
    const entry = trend[0];
    expect(typeof entry.fiscal_year).toBe("number");
    expect(typeof entry.median_salary).toBe("number");
    expect(typeof entry.total_filings).toBe("number");
  });

  it("wage_trend covers recent fiscal years (≥ FY2020)", () => {
    const trend = (optumShard.wage_trend ?? []) as WageTrend[];
    const years = trend.map((t) => t.fiscal_year ?? 0);
    const maxYear = Math.max(...years);
    expect(maxYear).toBeGreaterThanOrEqual(2020);
  });

  // ── 3. wage_role_trends must exist ─────────────────────────────────────────
  // wage_role_trends powers the 5-year percentile chart shown when clicking
  // a specific role in the Top Roles section. If missing, clicking a role
  // shows nothing (no trend chart appears).

  it("shard has wage_role_trends array", () => {
    expect(Array.isArray(optumShard.wage_role_trends)).toBe(true);
    expect((optumShard.wage_role_trends as unknown[]).length).toBeGreaterThan(0);
  });

  it("Optum Services has ≥30 role trend rows (multiple roles × multiple years)", () => {
    const roleTrends = (optumShard.wage_role_trends ?? []) as unknown[];
    expect(roleTrends.length).toBeGreaterThanOrEqual(30);
  });

  // ── 4. Consolidated shard coverage summary ──────────────────────────────────

  it("consolidated shard has all 4 wage+SRS data sections", () => {
    const has_wage_roles = Array.isArray(optumShard.wage_roles) && (optumShard.wage_roles as unknown[]).length > 0;
    const has_wage_trend = Array.isArray(optumShard.wage_trend) && (optumShard.wage_trend as unknown[]).length > 0;
    const has_wage_role_trends = Array.isArray(optumShard.wage_role_trends) && (optumShard.wage_role_trends as unknown[]).length > 0;
    const has_srs = typeof optumShard.srs === "object" && optumShard.srs !== null;

    const summary = { has_wage_roles, has_wage_trend, has_wage_role_trends, has_srs };
    console.log("\n  💰 Optum Wage+SRS Consolidation:", summary);

    expect(has_wage_roles).toBe(true);
    expect(has_wage_trend).toBe(true);
    expect(has_wage_role_trends).toBe(true);
    expect(has_srs).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COGNIZANT TECHNOLOGY SOLUTIONS US (second anchor — largest IT outsourcer)
// employer_id: 32d0e427e2b050673c4e4106eb9b681f5987677f
// Tests that a DIFFERENT major employer also has wage + SRS data.
// This catches scenarios where only the "Optum" shard is fixed but the
// broader consolidation pipeline is still broken.
// ═══════════════════════════════════════════════════════════════════════════

function loadCognizantShard(): Record<string, unknown> {
  const shardPath = join(PUBLIC_DATA, "employers", "32d0e427e2b050673c4e4106eb9b681f5987677f.json");
  try {
    const raw = readFileSync(shardPath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

describe("Cognizant Technology Solutions Us — enriched shard cross-check", () => {
  const shard = loadCognizantShard();

  it("shard loaded and has employer_name", () => {
    expect(shard.employer_name).toBeDefined();
  });

  it("has ≥5,000 LCA records (major H-1B filer)", () => {
    const total = shard.lca_total as number ?? (shard.lca as unknown[] ?? []).length;
    expect(total).toBeGreaterThanOrEqual(5_000);
  });

  it("has wage_roles (consolidation ran for large IT firms too)", () => {
    const roles = shard.wage_roles as unknown[] ?? [];
    expect(roles.length).toBeGreaterThan(0);
  });

  it("has wage_trend (salary chart has data)", () => {
    const trend = shard.wage_trend as unknown[] ?? [];
    expect(trend.length).toBeGreaterThan(0);
  });

  it("has srs object (SRS score dashboard populated)", () => {
    expect(typeof shard.srs).toBe("object");
    expect(shard.srs).not.toBeNull();
  });
});

function isNormalized(name: string): boolean {
  if (!name || name.length <= 3) return true;
  if (name !== name.toUpperCase()) return true;
  if (!/[A-Z]/.test(name)) return true;
  const words = name.trim().split(/\s+/);
  const longestWord = Math.max(...words.map((w) => w.length), 0);
  return longestWord <= 2; // Only single-letter initials are ALL-CAPS
}
