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

  it("wage_annual values are positive numbers (not NaN/null)", () => {
    const valid = lcaRecords.every((r) => {
      const wage = r.wage_annual ?? 0;
      return typeof wage === "number" && wage > 0;
    });
    expect(valid).toBe(true);
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

function isNormalized(name: string): boolean {
  if (!name || name.length <= 3) return true;
  if (name !== name.toUpperCase()) return true;
  if (!/[A-Z]/.test(name)) return true;
  const words = name.trim().split(/\s+/);
  const longestWord = Math.max(...words.map((w) => w.length), 0);
  return longestWord <= 2; // Only single-letter initials are ALL-CAPS
}
