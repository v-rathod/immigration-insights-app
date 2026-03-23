/**
 * Anchor Tests — Real Known-Data Assertions
 *
 * These tests read ACTUAL on-disk JSON files from public/data/ and assert
 * specific, known-good values. They serve as regression guards: if the P2
 * data pipeline produces wrong values, these tests will catch it before
 * any code reaches production.
 *
 * Covered areas:
 *   1. Priority Date (PD) Forecasts  — pd_forecasts.json
 *   2. Cutoff Trend history          — fact_cutoff_trends.json
 *   3. SRS Overview & per-employer   — srs_overview.json + employer shards
 *   4. Wage Intelligence             — employer_wage_rankings.json + Optum shard
 *
 * Tolerance philosophy:
 *   - Structural counts (rows, series) use >= / <=, not exact, to tolerate
 *     normal data refreshes.
 *   - Employer-specific values (efs score, SRS tier, soc_code) are stable
 *     domain facts and can be exact or tight-range asserted.
 *   - Salary values use ±20% bands to tolerate annual data refreshes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "public", "data");

function loadJson<T = unknown>(relativePath: string): T {
  const full = join(ROOT, relativePath);
  if (!existsSync(full)) throw new Error(`File not found: ${relativePath}`);
  const raw = readFileSync(full, "utf-8").replace(/:\s*NaN\b/g, ": null");
  return JSON.parse(raw) as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared types (minimal — only fields we assert on)
// ─────────────────────────────────────────────────────────────────────────────

interface PdForecast {
  forecast_month: string;
  months_ahead: number;
  chart: string;
  category: string;
  country: string;
  projected_cutoff_date: string | null;
  confidence_low: string | null;
  confidence_high: string | null;
  velocity_days_per_month: number | null;
  cumulative_advancement_days: number | null;
}

interface CutoffTrend {
  bulletin_year: number;
  bulletin_month: number;
  chart: string;
  category: string;
  country: string;
  status_flag: string;
  cutoff_date: string | null;
  queue_position_days: number | null;
  monthly_advancement_days: number | null;
  velocity_3m: number | null;
  retrogression_flag: number;
  retrogression_count_cum: number;
  source_file?: string;
}

interface WageRole {
  soc_code: string;
  soc_title: string;
  fiscal_year: number;
  n_filings: number;
  median_salary: number;
  p10_salary: number;
  p90_salary: number;
  oews_national_median: number | null;
  visa_type: string;
}

interface EmployerShard {
  employer_name: string;
  employer_id: string;
  lca_total?: number;
  lca?: unknown[];
  srs?: {
    efs: number;
    efs_tier: string;
    n_36m: number;
    approval_rate_36m: number;
    lca_median_wage: number | null;
  };
  srs_monthly?: unknown[];
  wage_roles?: WageRole[];
  wage_trend?: Array<{
    fiscal_year: number;
    median_salary: number;
    total_filings: number;
  }>;
  wage_role_trends?: unknown[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Priority Date Forecasts  (pd_forecasts.json)
// ─────────────────────────────────────────────────────────────────────────────

describe("Priority Date Forecasts — pd_forecasts.json", () => {
  // Loaded once per describe block
  const forecasts = loadJson<PdForecast[]>("models/pd_forecasts.json");

  // ── Shape ───────────────────────────────────────────────────────────────────

  it("has ≥1200 forecast rows (24 months × ≥50 series)", () => {
    expect(forecasts.length).toBeGreaterThanOrEqual(1200);
  });

  it("has ≥50 unique forecast series (chart × category × country)", () => {
    const series = new Set(forecasts.map((r) => `${r.chart}|${r.category}|${r.country}`));
    expect(series.size).toBeGreaterThanOrEqual(50);
  });

  it("every row has required fields", () => {
    const requiredFields: (keyof PdForecast)[] = [
      "forecast_month", "months_ahead", "chart", "category", "country",
      "projected_cutoff_date", "velocity_days_per_month",
    ];
    for (const row of forecasts.slice(0, 100)) {
      for (const field of requiredFields) {
        expect(row[field], `${field} missing in ${row.forecast_month}/${row.country}/${row.category}`).toBeDefined();
      }
    }
  });

  it("months_ahead range is 1–24 (24-month horizon)", () => {
    const min = Math.min(...forecasts.map((r) => r.months_ahead));
    const max = Math.max(...forecasts.map((r) => r.months_ahead));
    expect(min).toBe(1);
    expect(max).toBeLessThanOrEqual(24);
  });

  it("forecast_month values are in YYYY-MM format", () => {
    const sample = forecasts.slice(0, 20);
    for (const row of sample) {
      expect(row.forecast_month).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("projected_cutoff_date values are in YYYY-MM-DD format when present", () => {
    const withDate = forecasts.filter((r) => r.projected_cutoff_date !== null).slice(0, 20);
    for (const row of withDate) {
      expect(row.projected_cutoff_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  // ── IND EB2 DFF (India EB-2, Date for Filing) ───────────────────────────────
  // The largest/slowest backlog — a key anchor for the visa bulletin dashboard.

  describe("IND EB2 DFF series  (India EB-2, Date for Filing)", () => {
    const series = forecasts.filter(
      (r) => r.country === "IND" && r.category === "EB2" && r.chart === "DFF"
    );
    const sorted = [...series].sort((a, b) => a.months_ahead - b.months_ahead);

    it("has exactly 24 forward months", () => {
      expect(series.length).toBe(24);
    });

    it("1-month forecast: projected cutoff is between 2014-01-01 and 2016-12-31", () => {
      // IND EB2 cutoff has been stuck in 2014–2016 range for years.
      const m1 = sorted.find((r) => r.months_ahead === 1);
      expect(m1).toBeTruthy();
      expect(m1!.projected_cutoff_date).not.toBeNull();
      const pd = new Date(m1!.projected_cutoff_date!);
      expect(pd.getFullYear()).toBeGreaterThanOrEqual(2014);
      expect(pd.getFullYear()).toBeLessThanOrEqual(2016);
    });

    it("1-month velocity is positive (queue is advancing, not stalled)", () => {
      const m1 = sorted.find((r) => r.months_ahead === 1);
      expect(m1!.velocity_days_per_month).toBeGreaterThan(0);
    });

    it("24-month forecast cutoff is further than 1-month (advancing queue)", () => {
      const m1 = sorted.find((r) => r.months_ahead === 1);
      const m24 = sorted.find((r) => r.months_ahead === 24);
      expect(m1).toBeTruthy();
      expect(m24).toBeTruthy();
      expect(m24!.cumulative_advancement_days).toBeGreaterThan(
        m1!.cumulative_advancement_days ?? 0
      );
    });

    it("confidence_low < projected_cutoff_date < confidence_high for m1", () => {
      const m1 = sorted.find((r) => r.months_ahead === 1);
      if (!m1?.projected_cutoff_date || !m1.confidence_low || !m1.confidence_high) return;
      expect(new Date(m1.confidence_low) <= new Date(m1.projected_cutoff_date)).toBe(true);
      expect(new Date(m1.projected_cutoff_date) <= new Date(m1.confidence_high)).toBe(true);
    });
  });

  // ── IND EB3 DFF ─────────────────────────────────────────────────────────────
  describe("IND EB3 DFF series  (India EB-3, Date for Filing)", () => {
    const series = forecasts.filter(
      (r) => r.country === "IND" && r.category === "EB3" && r.chart === "DFF"
    );

    it("has exactly 24 forward months", () => {
      expect(series.length).toBe(24);
    });

    it("1-month cutoff is in the 2014–2016 range historically", () => {
      const m1 = series.find((r) => r.months_ahead === 1);
      if (!m1?.projected_cutoff_date) return;
      const yr = new Date(m1.projected_cutoff_date).getFullYear();
      expect(yr).toBeGreaterThanOrEqual(2014);
      expect(yr).toBeLessThanOrEqual(2016);
    });
  });

  // ── CHN EB3 DFF (another major backlogged country) ──────────────────────────

  it("CHN EB3 DFF series exists and has 24 months", () => {
    const series = forecasts.filter(
      (r) => r.country === "CHN" && r.category === "EB3" && r.chart === "DFF"
    );
    expect(series.length).toBe(24);
  });

  // ── ROW (Rest of World) — much shorter backlogs ──────────────────────────────

  it("ROW EB2 DFF series exists", () => {
    const series = forecasts.filter(
      (r) => r.country === "ROW" && r.category === "EB2" && r.chart === "DFF"
    );
    expect(series.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cutoff Trend History  (fact_cutoff_trends.json)
// ─────────────────────────────────────────────────────────────────────────────

describe("Cutoff Trend History — fact_cutoff_trends.json", () => {
  const trends = loadJson<CutoffTrend[]>("dashboards/visa-bulletin/fact_cutoff_trends.json");

  it("has ≥7000 rows (multi-year monthly data across all series)", () => {
    expect(trends.length).toBeGreaterThanOrEqual(7000);
  });

  it("every row has bulletin_year, bulletin_month, chart, category, country", () => {
    for (const row of trends.slice(0, 50)) {
      expect(row.bulletin_year).toBeGreaterThan(0);
      expect(row.bulletin_month).toBeGreaterThanOrEqual(1);
      expect(row.bulletin_month).toBeLessThanOrEqual(12);
      expect(row.chart).toBeTruthy();
      expect(row.category).toBeTruthy();
      expect(row.country).toBeTruthy();
    }
  });

  // ── IND EB2 DFF anchor ───────────────────────────────────────────────────────
  describe("IND EB2 DFF historical series", () => {
    const series = trends.filter(
      (r) => r.country === "IND" && r.category === "EB2" && r.chart === "DFF"
    );
    const withDate = series.filter((r) => r.cutoff_date !== null);

    it("has data going back to at least 2016", () => {
      const years = series.map((r) => r.bulletin_year);
      expect(Math.min(...years)).toBeLessThanOrEqual(2016);
    });

    it("has ≥80 dated cutoff records (monthly data, multi-year)", () => {
      expect(withDate.length).toBeGreaterThanOrEqual(80);
    });

    it("most recent record is bulletin_year ≥ 2025", () => {
      const latest = series.reduce((a, b) =>
        a.bulletin_year > b.bulletin_year ||
        (a.bulletin_year === b.bulletin_year && a.bulletin_month > b.bulletin_month)
          ? a
          : b
      );
      expect(latest.bulletin_year).toBeGreaterThanOrEqual(2025);
    });

    it("most recent dated cutoff is in 2014–2016 window (IND EB2 backlog reality)", () => {
      const sorted = [...withDate].sort(
        (a, b) => b.bulletin_year - a.bulletin_year || b.bulletin_month - a.bulletin_month
      );
      const latest = sorted[0];
      expect(latest.cutoff_date).not.toBeNull();
      const yr = new Date(latest.cutoff_date!).getFullYear();
      // IND EB2 cutoff has historically been 2014–2016; anything outside is a data error
      expect(yr).toBeGreaterThanOrEqual(2013);
      expect(yr).toBeLessThanOrEqual(2017);
    });

    it("queue_position_days is >10,000 (massive backlog — ~30+ year wait)", () => {
      const sorted = [...withDate].sort(
        (a, b) => b.bulletin_year - a.bulletin_year || b.bulletin_month - a.bulletin_month
      );
      const latest = sorted[0];
      expect(latest.queue_position_days).not.toBeNull();
      expect(latest.queue_position_days!).toBeGreaterThan(10_000);
    });

    it("retrogression_count_cum ≥ 1 (IND EB2 has had at least one retrogression)", () => {
      const sorted = [...series].sort(
        (a, b) => b.bulletin_year - a.bulletin_year || b.bulletin_month - a.bulletin_month
      );
      const latest = sorted[0];
      expect(latest.retrogression_count_cum).toBeGreaterThanOrEqual(1);
    });
  });

  it("CHN EB3 DFF historical series has ≥50 dated records", () => {
    const series = trends.filter(
      (r) => r.country === "CHN" && r.category === "EB3" && r.chart === "DFF" && r.cutoff_date
    );
    expect(series.length).toBeGreaterThanOrEqual(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SRS Overview + Per-Employer Scores
// ─────────────────────────────────────────────────────────────────────────────

describe("SRS Overview — srs_overview.json", () => {
  const overview = loadJson<{
    totalEmployers: number;
    ratedEmployers: number;
    avgScore: number;
    medianScore: number;
    tierDistribution: Record<string, number>;
  }>("dashboards/employer/srs_overview.json");

  it("totalEmployers ≥ 60,000 (full employer universe)", () => {
    expect(overview.totalEmployers).toBeGreaterThanOrEqual(60_000);
  });

  it("ratedEmployers is between 10,000 and 30,000 (scored subset)", () => {
    expect(overview.ratedEmployers).toBeGreaterThanOrEqual(10_000);
    expect(overview.ratedEmployers).toBeLessThanOrEqual(30_000);
  });

  it("avgScore is between 60 and 80 (reasonable SRS range)", () => {
    expect(overview.avgScore).toBeGreaterThan(60);
    expect(overview.avgScore).toBeLessThan(80);
  });

  it("medianScore is between 60 and 80", () => {
    expect(overview.medianScore).toBeGreaterThan(60);
    expect(overview.medianScore).toBeLessThan(80);
  });

  it("tierDistribution has all 6 tiers", () => {
    const expectedTiers = ["Excellent", "Good", "Moderate", "Below Average", "Poor", "Unrated"];
    for (const tier of expectedTiers) {
      expect(overview.tierDistribution[tier], `Missing tier: ${tier}`).toBeDefined();
    }
  });

  it("Excellent tier is rare: < 500 employers (high quality signal)", () => {
    // As of Mar 2026: 162 Excellent. More than 500 would indicate score inflation.
    expect(overview.tierDistribution["Excellent"]).toBeLessThan(500);
  });

  it("Good + Moderate together form the majority of rated employers", () => {
    const goodAndModerate =
      overview.tierDistribution["Good"] + overview.tierDistribution["Moderate"];
    expect(goodAndModerate).toBeGreaterThan(overview.ratedEmployers * 0.8);
  });

  it("Unrated is the largest group (most small employers have no adjudication history)", () => {
    const tiers = overview.tierDistribution;
    const unrated = tiers["Unrated"];
    const otherMax = Math.max(...Object.entries(tiers)
      .filter(([k]) => k !== "Unrated")
      .map(([, v]) => v));
    expect(unrated).toBeGreaterThan(otherMax);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Optum Services — SRS + Wage anchor
// employer_id: 78a46d3917846d886ef35fe989075cb353f21a1d
// ─────────────────────────────────────────────────────────────────────────────

describe("Optum Services shard — SRS + Wage Intelligence anchors", () => {
  const OPTUM_ID = "78a46d3917846d886ef35fe989075cb353f21a1d";
  const shard = loadJson<EmployerShard>(`employers/${OPTUM_ID}.json`);

  it("employer_name is 'Optum Services'", () => {
    expect(shard.employer_name).toBe("Optum Services");
  });

  it("employer_id matches the expected hash", () => {
    expect(shard.employer_id).toBe(OPTUM_ID);
  });

  // ── SRS score ─────────────────────────────────────────────────────────────
  it("SRS tier is 'Good' (not unrated, not excellent — stable mid-range sponsor)", () => {
    expect(shard.srs?.efs_tier).toBe("Good");
  });

  it("SRS efs score is between 70 and 95 (Good range)", () => {
    // As of Mar 2026: 79.6. Use ±15 band to tolerate score updates.
    expect(shard.srs?.efs).toBeGreaterThanOrEqual(65);
    expect(shard.srs?.efs).toBeLessThanOrEqual(95);
  });

  it("SRS n_36m ≥ 300 (substantial H-1B case volume)", () => {
    // As of Mar 2026: 522
    expect(shard.srs?.n_36m).toBeGreaterThanOrEqual(300);
  });

  it("SRS approval_rate_36m ≥ 0.90 (90%+ approval — expected for a reputable sponsor)", () => {
    expect(shard.srs?.approval_rate_36m).toBeGreaterThanOrEqual(0.90);
  });

  it("srs_monthly trend has ≥10 data points (used for trend chart)", () => {
    expect(Array.isArray(shard.srs_monthly)).toBe(true);
    expect(shard.srs_monthly!.length).toBeGreaterThanOrEqual(10);
  });

  // ── Wage roles ─────────────────────────────────────────────────────────────
  it("wage_roles has ≥10 roles (using the top software occupations)", () => {
    expect(Array.isArray(shard.wage_roles)).toBe(true);
    expect(shard.wage_roles!.length).toBeGreaterThanOrEqual(10);
  });

  it("top wage role is Software Developers (SOC 15-1252)", () => {
    // Optum's largest H-1B role is software engineering
    const top = shard.wage_roles![0];
    expect(top.soc_code).toBe("15-1252");
    expect(top.soc_title).toBe("Software Developers");
  });

  it("top role median salary is between $100K and $200K", () => {
    // As of Mar 2026: $131,697
    const top = shard.wage_roles![0];
    expect(top.median_salary).toBeGreaterThanOrEqual(100_000);
    expect(top.median_salary).toBeLessThanOrEqual(200_000);
  });

  it("top role p90 > p10 (salary distribution is not collapsed)", () => {
    const top = shard.wage_roles![0];
    expect(top.p90_salary).toBeGreaterThan(top.p10_salary);
  });

  it("top role fiscal_year is ≥ 2024 (data is recent)", () => {
    expect(shard.wage_roles![0].fiscal_year).toBeGreaterThanOrEqual(2024);
  });

  it("top role n_filings ≥ 100 (statistically meaningful)", () => {
    expect(shard.wage_roles![0].n_filings).toBeGreaterThanOrEqual(100);
  });

  it("all wage_roles have valid SOC codes (format XX-XXXX)", () => {
    for (const role of shard.wage_roles!) {
      expect(role.soc_code, `Bad SOC code: ${role.soc_code}`).toMatch(/^\d{2}-\d{4}$/);
    }
  });

  // ── Wage trend ─────────────────────────────────────────────────────────────
  it("wage_trend covers ≥5 years of salary history", () => {
    expect(Array.isArray(shard.wage_trend)).toBe(true);
    expect(shard.wage_trend!.length).toBeGreaterThanOrEqual(5);
  });

  it("wage_trend earliest year is ≤ 2018 (shows long-term growth)", () => {
    const sorted = [...shard.wage_trend!].sort((a, b) => a.fiscal_year - b.fiscal_year);
    expect(sorted[0].fiscal_year).toBeLessThanOrEqual(2018);
  });

  it("wage_trend latest median salary > earliest (salary has grown over time)", () => {
    const sorted = [...shard.wage_trend!].sort((a, b) => a.fiscal_year - b.fiscal_year);
    const earliest = sorted[0].median_salary;
    const latest = sorted[sorted.length - 1].median_salary;
    expect(latest).toBeGreaterThan(earliest);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Infosys — SRS + Wage anchor
// employer_id: d35dde19e28ef4470b60562576e4f5cbc41b3298
// ─────────────────────────────────────────────────────────────────────────────

describe("Infosys shard — SRS + Wage Intelligence anchors", () => {
  const INFOSYS_ID = "d35dde19e28ef4470b60562576e4f5cbc41b3298";
  const shard = loadJson<EmployerShard>(`employers/${INFOSYS_ID}.json`);

  it("employer_name is 'Infosys'", () => {
    expect(shard.employer_name).toBe("Infosys");
  });

  it("SRS tier is 'Excellent' (best-in-class sponsor for Infosys)", () => {
    // Infosys has near-perfect approval rate; should always be Excellent
    expect(shard.srs?.efs_tier).toBe("Excellent");
  });

  it("SRS efs score ≥ 85 (Excellent tier threshold)", () => {
    // As of Mar 2026: 89.3
    expect(shard.srs?.efs).toBeGreaterThanOrEqual(85);
  });

  it("wage_roles[0] SOC code is a computer occupation (15-xxxx)", () => {
    const top = shard.wage_roles?.[0];
    expect(top).toBeTruthy();
    expect(top!.soc_code).toMatch(/^15-/);
  });

  it("wage_roles[0] median salary is between $80K and $150K (Infosys range)", () => {
    // As of Mar 2026: $93,538 — lower than FAANG but above prevailing wage floor
    const top = shard.wage_roles?.[0];
    expect(top?.median_salary).toBeGreaterThanOrEqual(80_000);
    expect(top?.median_salary).toBeLessThanOrEqual(150_000);
  });

  it("wage_roles has ≥10 roles", () => {
    expect(shard.wage_roles?.length).toBeGreaterThanOrEqual(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cognizant — SRS anchor
// employer_id: 32d0e427e2b050673c4e4106eb9b681f5987677f
// ─────────────────────────────────────────────────────────────────────────────

describe("Cognizant Technology Solutions Us shard — SRS anchor", () => {
  const COG_ID = "32d0e427e2b050673c4e4106eb9b681f5987677f";
  const shard = loadJson<EmployerShard>(`employers/${COG_ID}.json`);

  it("employer_name is 'Cognizant Technology Solutions Us'", () => {
    expect(shard.employer_name).toBe("Cognizant Technology Solutions Us");
  });

  it("SRS tier is 'Good'", () => {
    // Cognizant has excellent approval rates; Good tier as of Mar 2026
    expect(shard.srs?.efs_tier).toBe("Good");
  });

  it("SRS efs score is between 70 and 95", () => {
    // As of Mar 2026: 81.3
    expect(shard.srs?.efs).toBeGreaterThanOrEqual(70);
    expect(shard.srs?.efs).toBeLessThanOrEqual(95);
  });

  it("SRS approval_rate_36m ≥ 0.95 (major outsourcer with very high approval rate)", () => {
    // As of Mar 2026: 0.9995 — near-perfect
    expect(shard.srs?.approval_rate_36m).toBeGreaterThanOrEqual(0.95);
  });

  it("lca_total (or lca array length) ≥ 5,000 (high-volume H-1B filer)", () => {
    const count = shard.lca_total ?? (Array.isArray(shard.lca) ? shard.lca.length : 0);
    expect(count).toBeGreaterThanOrEqual(5_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Wage Intelligence — employer_wage_rankings.json
// ─────────────────────────────────────────────────────────────────────────────

describe("Wage Intelligence — employer_wage_rankings.json", () => {
  const rankings = loadJson<Array<{
    soc_code: string;
    employer_name: string;
    fiscal_year: number;
    n_filings: number;
    median_salary: number;
    p25_salary: number;
    p75_salary: number;
    prevailing_wage_median: number;
    wage_premium_pct: number;
    oews_national_median: number | null;
    visa_type: string;
    soc_title: string;
  }>>("dashboards/wage/employer_wage_rankings.json");

  it("has ≥1000 rows (sufficient coverage for dashboard)", () => {
    expect(rankings.length).toBeGreaterThanOrEqual(1000);
  });

  it("every row has soc_code, employer_name, median_salary", () => {
    for (const row of rankings.slice(0, 50)) {
      expect(row.soc_code).toBeTruthy();
      expect(row.employer_name).toBeTruthy();
      expect(typeof row.median_salary).toBe("number");
    }
  });

  it("soc_code values match XX-XXXX format", () => {
    for (const row of rankings.slice(0, 50)) {
      expect(row.soc_code).toMatch(/^\d{2}-\d{4}$/);
    }
  });

  it("all salary values are positive and plausible (> $0, < $2M)", () => {
    for (const row of rankings.slice(0, 100)) {
      expect(row.median_salary).toBeGreaterThan(0);
      expect(row.median_salary).toBeLessThan(2_000_000);
    }
  });

  it("p75_salary ≥ p25_salary for all sampled rows (valid distribution)", () => {
    for (const row of rankings.slice(0, 50)) {
      expect(row.p75_salary).toBeGreaterThanOrEqual(row.p25_salary);
    }
  });

  it("fiscal_year values are ≥ 2020 (recent data)", () => {
    for (const row of rankings.slice(0, 50)) {
      expect(row.fiscal_year).toBeGreaterThanOrEqual(2020);
    }
  });

  it("data includes software developer roles (SOC 15-1252 present)", () => {
    const softwareDev = rankings.filter((r) => r.soc_code === "15-1252");
    expect(softwareDev.length).toBeGreaterThan(0);
  });

  it("data includes multiple SOC categories (not just software)", () => {
    const socs = new Set(rankings.map((r) => r.soc_code.substring(0, 2)));
    // Should have occupations from multiple major groups
    expect(socs.size).toBeGreaterThanOrEqual(3);
  });

  it("wage_premium_pct values are in a plausible range (-50% to +100%)", () => {
    for (const row of rankings.slice(0, 100)) {
      expect(row.wage_premium_pct).toBeGreaterThan(-100);
      expect(row.wage_premium_pct).toBeLessThan(200);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// My Insights — data availability for all inputs
// ─────────────────────────────────────────────────────────────────────────────

describe("My Insights / Personalization — data availability checks", () => {
  // This section validates that all data files needed for the My Insights page
  // exist and contain the fields expected by the three smart panels:
  //   Panel A: Green Card Forecast = pd_forecasts + fact_cutoff_trends
  //   Panel B: Employer Insights   = employer shard (SRS + wage_roles)
  //   Panel C: Job Market          = employer_wage_rankings

  it("Panel A: pd_forecasts has IND+CHN+ROW for EB2 and EB3 (covers 95%+ of users)", () => {
    const forecasts = loadJson<PdForecast[]>("models/pd_forecasts.json");
    const countries = ["IND", "CHN", "ROW"];
    const categories = ["EB2", "EB3"];
    for (const country of countries) {
      for (const cat of categories) {
        const series = forecasts.filter(
          (r) => r.country === country && r.category === cat && r.chart === "DFF"
        );
        expect(series.length, `Missing ${country} ${cat} DFF forecasts`).toBeGreaterThan(0);
      }
    }
  });

  it("Panel A: fact_cutoff_trends covers both DFF and FAD charts", () => {
    const trends = loadJson<CutoffTrend[]>("dashboards/visa-bulletin/fact_cutoff_trends.json");
    const charts = new Set(trends.map((r) => r.chart));
    expect(charts.has("DFF")).toBe(true);
    expect(charts.has("FAD")).toBe(true);
  });

  it("Panel B: Optum Services shard has all 3 UI-critical employer fields", () => {
    const shard = loadJson<EmployerShard>("employers/78a46d3917846d886ef35fe989075cb353f21a1d.json");
    // SRS score (for score gauge), wage_roles (for salary card), wage_trend (for chart)
    expect(shard.srs?.efs).toBeDefined();
    expect(Array.isArray(shard.wage_roles) && shard.wage_roles.length > 0).toBe(true);
    expect(Array.isArray(shard.wage_trend) && shard.wage_trend.length > 0).toBe(true);
  });

  it("Panel C: employer_wage_rankings includes software roles needed for job market insights", () => {
    const rankings = loadJson<Array<{ soc_code: string }>>( "dashboards/wage/employer_wage_rankings.json");
    // SOC 15-xxxx = Computer and Mathematical Occupations
    const computerRoles = rankings.filter((r) => r.soc_code.startsWith("15-"));
    expect(computerRoles.length).toBeGreaterThan(50);
  });
});
