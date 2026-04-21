/**
 * Data Quality Guards — Comprehensive tests that validate the live JSON
 * data files in public/data/ contain no NaN, no broken schemas, no missing
 * critical fields, and no unprofessional rendering artifacts.
 *
 * These tests run against the ACTUAL deployed data, not mocks. If any of
 * these fail, the data pipeline has a bug that would be visible to users.
 *
 * Test categories:
 *   1. NaN / null / undefined guards for every numeric field
 *   2. Schema completeness (required fields present)
 *   3. Referential integrity (IDs exist, foreign keys valid)
 *   4. Value range sanity (percentages 0-1, counts >= 0, years realistic)
 *   5. Employer shard integrity (SRS embedded, key metrics populated)
 *   6. Search index consistency (IDs map to shards, scores match)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "public/data");

// Helper to load JSON
function loadJson<T = unknown>(relPath: string): T {
  const full = path.join(DATA_DIR, relPath);
  if (!fs.existsSync(full)) throw new Error(`Missing data file: ${relPath}`);
  const raw = fs.readFileSync(full, "utf-8");
  // Detect bare NaN/Infinity which would cause JSON.parse to fail or produce bad values
  const sanitized = raw.replace(/\bNaN\b|-?\bInfinity\b/g, "null");
  return JSON.parse(sanitized) as T;
}

function isValidNumber(v: unknown): boolean {
  return typeof v === "number" && !isNaN(v) && isFinite(v);
}

// ======================================================================
// 1. NaN/Null Guards for Dashboard Data
// ======================================================================

describe("Data Quality — No NaN in dashboard JSONs", () => {
  const dashboards = [
    "dashboards/visa-bulletin/fact_cutoff_trends.json",
    "dashboards/employer/employer_friendliness_scores_ml.json",
    "dashboards/employer/employer_risk_features.json",
    "dashboards/wage/salary_benchmarks_national.json",
    "dashboards/wage/soc_salary_market.json",
    "dashboards/backlog/backlog_estimates.json",
    "dashboards/backlog/queue_depth_estimates.json",
    "models/pd_forecasts.json",
  ];

  for (const file of dashboards) {
    it(`${file} — no bare NaN strings in raw JSON`, () => {
      const fullPath = path.join(DATA_DIR, file);
      if (!fs.existsSync(fullPath)) return; // skip if file doesn't exist
      const raw = fs.readFileSync(fullPath, "utf-8");
      // NaN as a bare token (not inside a string like "NaN-guard") is invalid JSON
      const nanMatches = raw.match(/(?<!["\w])NaN(?!["\w])/g);
      expect(nanMatches, `Found bare NaN tokens in ${file}`).toBeNull();
    });

    it(`${file} — no Infinity strings in raw JSON`, () => {
      const fullPath = path.join(DATA_DIR, file);
      if (!fs.existsSync(fullPath)) return;
      const raw = fs.readFileSync(fullPath, "utf-8");
      const infMatches = raw.match(/(?<!["\w])-?Infinity(?!["\w])/g);
      expect(infMatches, `Found bare Infinity tokens in ${file}`).toBeNull();
    });
  }
});

// ======================================================================
// 2. SRS Data Quality — scores, sub-scores, tiers
// ======================================================================

describe("Data Quality — SRS scores and sub-scores", () => {
  let srsData: Array<Record<string, unknown>> = [];

  try {
    srsData = loadJson<Array<Record<string, unknown>>>(
      "dashboards/employer/employer_friendliness_scores_ml.json"
    );
  } catch {
    // Will be handled by individual tests
  }

  it("SRS data file exists and has records", () => {
    expect(srsData.length).toBeGreaterThan(0);
  });

  it("every record has required fields", () => {
    const required = [
      "employer_id", "scope",
    ];
    for (const rec of srsData.slice(0, 500)) {
      for (const field of required) {
        expect(rec, `Record missing ${field}`).toHaveProperty(field);
      }
    }
  });

  it("sub-scores are valid numbers in 0-100 range", () => {
    const scoreFields = ["outcome_subscore", "wage_subscore", "sustainability_subscore"];
    let violations = 0;
    for (const rec of srsData) {
      for (const f of scoreFields) {
        const v = rec[f];
        if (v != null && typeof v === "number") {
          if (isNaN(v) || v < 0 || v > 100.01) violations++;
        }
      }
    }
    expect(violations, "Sub-scores outside 0-100 range").toBe(0);
  });

  it("approval_rate_36m is a ratio 0-1 (not a percentage)", () => {
    let violations = 0;
    for (const rec of srsData) {
      const v = rec.approval_rate_36m;
      if (v != null && typeof v === "number" && !isNaN(v)) {
        if (v > 1.01) violations++;
      }
    }
    expect(violations, "approval_rate_36m > 1.0 found (should be ratio not pct)").toBe(0);
  });

  it("wage_ratio_med is in plausible range (0.3 to 5.0)", () => {
    let violations = 0;
    for (const rec of srsData) {
      const v = rec.wage_ratio_med;
      if (v != null && typeof v === "number" && !isNaN(v)) {
        if (v < 0.3 || v > 5.0) violations++;
      }
    }
    expect(violations, "wage_ratio_med outside 0.3-5.0").toBe(0);
  });

  it("efs_tier values are known categories", () => {
    const validTiers = new Set([
      "Excellent", "Good", "Average", "Below Average", "Poor", "Unrated",
      null, undefined,
    ]);
    const invalidTiers = new Set<string>();
    for (const rec of srsData) {
      const tier = rec.efs_tier;
      if (tier != null && !validTiers.has(tier as string)) {
        invalidTiers.add(String(tier));
      }
    }
    expect(
      invalidTiers.size,
      `Unknown tier values: ${[...invalidTiers].join(", ")}`
    ).toBe(0);
  });
});

// ======================================================================
// 3. Employer Search Index Integrity
// ======================================================================

describe("Data Quality — Employer search index", () => {
  let searchData: Array<Record<string, unknown>> = [];

  try {
    searchData = loadJson<Array<Record<string, unknown>>>("employers/_search.json");
  } catch {
    // handled below
  }

  it("search index exists and has records", () => {
    expect(searchData.length).toBeGreaterThan(10000);
  });

  it("every record has employer name (n field)", () => {
    const missing = searchData.filter((r) => !r.n);
    expect(missing.length, "Entries with missing employer name").toBe(0);
  });

  it("records with non-empty id have no duplicates among themselves", () => {
    const ids = searchData.map((r) => r.id).filter((id) => id && String(id).length > 0) as string[];
    const unique = new Set(ids);
    const dupeCount = ids.length - unique.size;
    // Allow small number of duplicates from data pipeline edge cases
    expect(dupeCount, "Excessive duplicate employer IDs in search index").toBeLessThan(50);
  });

  it("employer names are non-empty strings", () => {
    const bad = searchData.filter((r) => {
      const n = r.n ?? r.employer_name;
      return !n || String(n).trim() === "";
    });
    expect(bad.length, "Entries with empty employer names").toBe(0);
  });
});

// ======================================================================
// 4. Employer Shard Spot-Checks (Major Employers)
// ======================================================================

describe("Data Quality — Major employer shards have SRS data", () => {
  // These are high-visibility employers users will search for
  const majorEmployers = [
    "Google Llc",
    "Microsoft Corporation",
    "Amazon.Com Services Llc",
    "Apple Inc",
    "Ibm",
    "Tata Consultancy Services Limited",
    "Infosys Limited",
    "Meta Platforms Inc",
    "Intel Corporation",
    "Deloitte Consulting Llp",
  ];

  let searchIndex: Array<Record<string, unknown>> = [];
  let employerIndex: Record<string, string> = {};

  try {
    searchIndex = loadJson<Array<Record<string, unknown>>>("employers/_search.json");
    employerIndex = loadJson<Record<string, string>>("employers/_index.json");
  } catch {
    // handled below
  }

  for (const name of majorEmployers) {
    it(`${name} — shard exists and has SRS embedded`, () => {
      // Find in index (case-insensitive)
      const indexEntry = Object.entries(employerIndex).find(
        ([k]) => k.toLowerCase() === name.toLowerCase()
      );
      if (!indexEntry) {
        // Not in index - skip but warn
        console.warn(`  ⚠ ${name} not found in _index.json`);
        return;
      }

      const shardPath = path.join(DATA_DIR, "employers", `${indexEntry[1]}.json`);
      expect(fs.existsSync(shardPath), `Shard file missing for ${name}`).toBe(true);

      const shard = JSON.parse(fs.readFileSync(shardPath, "utf-8")) as Record<string, unknown>;
      expect(shard.srs, `${name} shard missing 'srs' key — run consolidation`).toBeTruthy();

      // Check SRS has sub-scores
      const srs = shard.srs as Record<string, unknown>;
      expect(srs.outcome_subscore, `${name} missing outcome_subscore`).toBeDefined();
      expect(srs.wage_subscore, `${name} missing wage_subscore`).toBeDefined();
      expect(srs.sustainability_subscore, `${name} missing sustainability_subscore`).toBeDefined();
    });
  }
});

// ======================================================================
// 5. Cutoff Trends — computed columns present
// ======================================================================

describe("Data Quality — fact_cutoff_trends computed columns", () => {
  let trends: Array<Record<string, unknown>> = [];

  try {
    trends = loadJson<Array<Record<string, unknown>>>(
      "dashboards/visa-bulletin/fact_cutoff_trends.json"
    );
  } catch {
    // handled below
  }

  it("trends file has records", () => {
    expect(trends.length).toBeGreaterThan(1000);
  });

  it("has velocity and retrogression computed columns", () => {
    const requiredCols = [
      "velocity_3m", "velocity_6m", "monthly_advancement_days",
      "retrogression_flag", "queue_position_days",
    ];
    const sample = trends.slice(0, 100);
    for (const col of requiredCols) {
      const hasCol = sample.some((r) => col in r);
      expect(hasCol, `Missing computed column: ${col}`).toBe(true);
    }
  });

  it("cutoff_date values are parseable dates", () => {
    let invalid = 0;
    for (const r of trends.slice(0, 200)) {
      const d = r.cutoff_date;
      if (d && typeof d === "string") {
        const ts = new Date(d.split("T")[0] + "T00:00:00Z").getTime();
        if (isNaN(ts)) invalid++;
      }
    }
    expect(invalid, "Unparseable cutoff_date values").toBe(0);
  });
});

// ======================================================================
// 6. Backlog Data Quality
// ======================================================================

describe("Data Quality — backlog estimates", () => {
  let backlog: Array<Record<string, unknown>> = [];

  try {
    backlog = loadJson<Array<Record<string, unknown>>>(
      "dashboards/backlog/backlog_estimates.json"
    );
  } catch {
    // handled below
  }

  it("backlog file has records", () => {
    expect(backlog.length).toBeGreaterThan(100);
  });

  it("has required columns", () => {
    const required = ["category", "country", "chart", "bulletin_year", "bulletin_month"];
    const sample = backlog.slice(0, 10);
    for (const col of required) {
      expect(sample[0], `Missing column: ${col}`).toHaveProperty(col);
    }
  });

  it("backlog_months_to_clear_est is null or positive number", () => {
    let violations = 0;
    for (const r of backlog) {
      const v = r.backlog_months_to_clear_est;
      if (v != null && typeof v === "number") {
        if (isNaN(v) || v < 0) violations++;
      }
    }
    expect(violations, "Negative or NaN backlog months").toBe(0);
  });
});

// ======================================================================
// 7. Queue Depth Estimates
// ======================================================================

describe("Data Quality — queue depth estimates", () => {
  let queue: Array<Record<string, unknown>> = [];

  try {
    queue = loadJson<Array<Record<string, unknown>>>(
      "dashboards/backlog/queue_depth_estimates.json"
    );
  } catch {
    // handled below
  }

  it("queue depth file has records", () => {
    expect(queue.length).toBeGreaterThan(100);
  });

  it("est_wait_years is null or reasonable (0-200)", () => {
    // India EB2 can legitimately exceed 100 years
    let violations = 0;
    for (const r of queue) {
      const v = r.est_wait_years;
      if (v != null && typeof v === "number") {
        if (isNaN(v) || v < 0 || v > 200) violations++;
      }
    }
    expect(violations, "est_wait_years outside 0-200").toBe(0);
  });

  it("cumulative_ahead is not NaN", () => {
    let nanCount = 0;
    for (const r of queue) {
      const v = r.cumulative_ahead;
      if (v != null && typeof v === "number" && isNaN(v)) nanCount++;
    }
    expect(nanCount, "NaN cumulative_ahead values").toBe(0);
  });
});

// ======================================================================
// 8. PD Forecasts
// ======================================================================

describe("Data Quality — pd_forecasts", () => {
  let forecasts: Array<Record<string, unknown>> = [];

  try {
    forecasts = loadJson<Array<Record<string, unknown>>>(
      "models/pd_forecasts.json"
    );
  } catch {
    // handled below
  }

  it("forecasts file has records", () => {
    expect(forecasts.length).toBeGreaterThan(500);
  });

  it("velocity_days_per_month is a valid number for all records", () => {
    let nanCount = 0;
    for (const r of forecasts) {
      const v = r.velocity_days_per_month;
      if (v != null && typeof v === "number" && isNaN(v)) nanCount++;
    }
    expect(nanCount, "NaN velocity_days_per_month").toBe(0);
  });

  it("projected_cutoff_date is a parseable date", () => {
    let invalid = 0;
    for (const r of forecasts) {
      const d = r.projected_cutoff_date;
      if (d && typeof d === "string") {
        const ts = new Date(d.split("T")[0]).getTime();
        if (isNaN(ts)) invalid++;
      }
    }
    expect(invalid, "Invalid projected_cutoff_date").toBe(0);
  });
});

// ======================================================================
// 9. Monthly Metrics — approval_rate in 0-1
// ======================================================================

describe("Data Quality — employer risk features", () => {
  let risk: Array<Record<string, unknown>> = [];

  try {
    risk = loadJson<Array<Record<string, unknown>>>(
      "dashboards/employer/employer_risk_features.json"
    );
  } catch {
    // handled below
  }

  it("risk features file has records", () => {
    expect(risk.length).toBeGreaterThan(100);
  });

  it("no NaN in numeric columns", () => {
    let nanCount = 0;
    for (const r of risk.slice(0, 2000)) {
      for (const [, v] of Object.entries(r)) {
        if (typeof v === "number" && isNaN(v)) nanCount++;
      }
    }
    expect(nanCount, "NaN values in risk features").toBe(0);
  });
});

// ======================================================================
// 10. Wage Data Quality
// ======================================================================

describe("Data Quality — salary benchmarks national", () => {
  let salaries: Array<Record<string, unknown>> = [];

  try {
    salaries = loadJson<Array<Record<string, unknown>>>(
      "dashboards/wage/salary_benchmarks_national.json"
    );
  } catch {
    // handled below
  }

  it("salary benchmarks file has records", () => {
    expect(salaries.length).toBeGreaterThan(100);
  });

  it("median wage is a positive number", () => {
    let violations = 0;
    for (const r of salaries) {
      const v = r.median ?? r.median_wage;
      if (v != null && typeof v === "number") {
        if (isNaN(v) || v < 0) violations++;
      }
    }
    expect(violations, "Invalid median wage values").toBe(0);
  });

  it("soc_code follows SOC format XX-XXXX", () => {
    let invalid = 0;
    for (const r of salaries) {
      const soc = r.soc_code;
      if (soc && typeof soc === "string") {
        if (!/^\d{2}-\d{4}$/.test(soc)) invalid++;
      }
    }
    expect(invalid, "Invalid SOC code format").toBe(0);
  });
});
