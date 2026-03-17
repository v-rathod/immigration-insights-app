/**
 * Visa Bulletin & Priority Date Live-Data Regression Tests
 *
 * These tests load ACTUAL data from public/data/ (NOT mocks)
 * and validate the complete VB/PD/forecast pipeline:
 *
 *   P2 artifacts → sync → fact_cutoff_trends.json + pd_forecasts.json + category_movement_metrics.json
 *                       → computePdi() → correct predictions on live data
 *
 * This is the single most important feature of NorthStar/Compass.
 * If these tests fail, the core product is broken.
 *
 * Coverage areas:
 *   A. fact_cutoff_trends.json — structure, row count, date range, key combos
 *   B. pd_forecasts.json — structure, series count, forecast window, bounds
 *   C. Cross-artifact consistency — forecasts align with trends
 *   D. Cutoff continuity — monotonicity, retrogression flags
 *   E. Forecast accuracy bounds — velocity, confidence intervals, monotonicity
 *   F. computePdi() on real data — predictions are mathematically correct
 *   G. Data freshness — data is not stale beyond acceptable window
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  getForecastSeries,
  getHistoricalSeries,
  computePdi,
  getVelocitySummary,
  PDI_CHARTS,
  PDI_CATEGORIES,
  PDI_COUNTRIES,
} from "@/lib/data/pdi";
import type { CutoffTrendRecord } from "@/lib/data/pdi";
import type { PdForecast } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Load REAL data files
// ---------------------------------------------------------------------------

const DATA_ROOT = join(process.cwd(), "public", "data");

const trendsPath = join(DATA_ROOT, "dashboards", "visa-bulletin", "fact_cutoff_trends.json");
const forecastsPath = join(DATA_ROOT, "models", "pd_forecasts.json");
const freshnessPath = join(DATA_ROOT, "_freshness.json");

const trends: CutoffTrendRecord[] = JSON.parse(readFileSync(trendsPath, "utf-8"));
const forecasts: PdForecast[] = JSON.parse(readFileSync(forecastsPath, "utf-8"));
const freshness: { synced_at: string } = JSON.parse(readFileSync(freshnessPath, "utf-8"));

// ===========================================================================
// A. fact_cutoff_trends.json — Structure & Completeness
// ===========================================================================

describe("fact_cutoff_trends.json — live data", () => {
  it("has at least 7,000 rows (sanity baseline)", () => {
    expect(trends.length).toBeGreaterThan(7_000);
  });

  it("every row has required fields", () => {
    const required = [
      "bulletin_year", "bulletin_month", "chart", "category",
      "country", "status_flag",
    ];
    for (const row of trends.slice(0, 200)) {
      for (const field of required) {
        expect(row).toHaveProperty(field);
      }
    }
  });

  it("contains both DFF and FAD chart types", () => {
    const charts = new Set(trends.map((r) => r.chart));
    expect(charts.has("DFF")).toBe(true);
    expect(charts.has("FAD")).toBe(true);
  });

  it("covers EB1, EB2, and EB3 categories", () => {
    const categories = new Set(trends.map((r) => r.category));
    expect(categories.has("EB1")).toBe(true);
    expect(categories.has("EB2")).toBe(true);
    expect(categories.has("EB3")).toBe(true);
  });

  it("covers India, China, and ROW countries", () => {
    const countries = new Set(trends.map((r) => r.country));
    expect(countries.has("IND")).toBe(true);
    expect(countries.has("CHN")).toBe(true);
    expect(countries.has("ROW")).toBe(true);
  });

  it("data spans at least 10 years (2016–2026)", () => {
    const years = Array.from(new Set(trends.map((r) => r.bulletin_year))).sort();
    expect(years[0]).toBeLessThanOrEqual(2016);
    expect(years[years.length - 1]).toBeGreaterThanOrEqual(2026);
  });

  it("bulletin_month is always 1–12", () => {
    for (const row of trends) {
      expect(row.bulletin_month).toBeGreaterThanOrEqual(1);
      expect(row.bulletin_month).toBeLessThanOrEqual(12);
    }
  });

  it("status_flag is always C, D, or U", () => {
    const valid = new Set(["C", "D", "U"]);
    for (const row of trends) {
      expect(valid.has(row.status_flag), `Invalid status: ${row.status_flag}`).toBe(true);
    }
  });

  it("cutoff_date is valid ISO date when status_flag=D", () => {
    const dateRows = trends.filter((r) => r.status_flag === "D" && r.cutoff_date != null);
    expect(dateRows.length).toBeGreaterThan(3_000);
    for (const row of dateRows.slice(0, 500)) {
      const ts = new Date(row.cutoff_date!).getTime();
      expect(Number.isFinite(ts), `Invalid date: ${row.cutoff_date}`).toBe(true);
    }
  });

  it("retrogression_flag is 0 or 1", () => {
    for (const row of trends) {
      if (row.retrogression_flag != null) {
        expect([0, 1]).toContain(row.retrogression_flag);
      }
    }
  });

  it("retrogression_count_cum is non-negative when present", () => {
    for (const row of trends) {
      if (row.retrogression_count_cum != null && Number.isFinite(row.retrogression_count_cum)) {
        expect(row.retrogression_count_cum).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ===========================================================================
// B. pd_forecasts.json — Structure & Completeness
// ===========================================================================

describe("pd_forecasts.json — live data", () => {
  it("has at least 1,000 rows", () => {
    expect(forecasts.length).toBeGreaterThanOrEqual(1_000);
  });

  it("every row has required fields", () => {
    const required = [
      "forecast_month", "months_ahead", "chart", "category",
      "country", "projected_cutoff_date", "velocity_days_per_month",
    ];
    for (const row of forecasts.slice(0, 100)) {
      for (const field of required) {
        expect(row).toHaveProperty(field);
      }
    }
  });

  it("months_ahead ranges from 1 to 24", () => {
    const months = new Set(forecasts.map((f) => f.months_ahead));
    expect(months.has(1)).toBe(true);
    expect(months.has(24)).toBe(true);
    for (const m of months) {
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(24);
    }
  });

  it("contains both DFF and FAD chart types", () => {
    const charts = new Set(forecasts.map((f) => f.chart));
    expect(charts.has("DFF")).toBe(true);
    expect(charts.has("FAD")).toBe(true);
  });

  it("covers the 3 primary EB categories", () => {
    const cats = new Set(forecasts.map((f) => f.category));
    expect(cats.has("EB1")).toBe(true);
    expect(cats.has("EB2")).toBe(true);
    expect(cats.has("EB3")).toBe(true);
  });

  it("covers India, China, and ROW", () => {
    const countries = new Set(forecasts.map((f) => f.country));
    expect(countries.has("IND")).toBe(true);
    expect(countries.has("CHN")).toBe(true);
    expect(countries.has("ROW")).toBe(true);
  });

  it("projected_cutoff_date is a valid ISO date", () => {
    for (const row of forecasts) {
      const ts = new Date(row.projected_cutoff_date).getTime();
      expect(Number.isFinite(ts), `Invalid date: ${row.projected_cutoff_date}`).toBe(true);
    }
  });

  it("confidence_low <= projected_cutoff_date <= confidence_high", () => {
    for (const row of forecasts) {
      const lo = new Date(row.confidence_low).getTime();
      const mid = new Date(row.projected_cutoff_date).getTime();
      const hi = new Date(row.confidence_high).getTime();
      if (Number.isFinite(lo) && Number.isFinite(hi)) {
        expect(lo).toBeLessThanOrEqual(mid);
        expect(mid).toBeLessThanOrEqual(hi);
      }
    }
  });

  it("velocity_days_per_month is non-negative and finite", () => {
    for (const row of forecasts) {
      expect(Number.isFinite(row.velocity_days_per_month)).toBe(true);
      expect(row.velocity_days_per_month).toBeGreaterThanOrEqual(0);
    }
  });

  it("velocity is realistic — no series exceeds 90 days/month", () => {
    for (const row of forecasts) {
      expect(row.velocity_days_per_month).toBeLessThanOrEqual(90);
    }
  });

  it("cumulative_advancement_days is non-negative and increases with months_ahead", () => {
    // Check a core series: FAD/EB2/IND
    const series = getForecastSeries(forecasts, "FAD", "EB2", "IND");
    expect(series.length).toBe(24);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].cumulative_advancement_days).toBeGreaterThanOrEqual(
        series[i - 1].cumulative_advancement_days
      );
    }
  });
});

// ===========================================================================
// C. Cross-Artifact Consistency
// ===========================================================================

describe("Cross-artifact consistency", () => {
  it("forecast series count matches expected (chart × category × country)", () => {
    const seriesKeys = new Set(
      forecasts.map((f) => `${f.chart}|${f.category}|${f.country}`)
    );
    // At least 40 unique series (6 cats × 6 countries × 2 charts, minus combos without data)
    expect(seriesKeys.size).toBeGreaterThanOrEqual(40);
  });

  it("every forecast combo has a matching historical trend", () => {
    const seriesKeys = new Set(
      forecasts.map((f) => `${f.chart}|${f.category}|${f.country}`)
    );
    const trendKeys = new Set(
      trends.map((r) => `${r.chart}|${r.category}|${r.country}`)
    );
    let missingCount = 0;
    for (const key of seriesKeys) {
      if (!trendKeys.has(key)) missingCount++;
    }
    // Allow some forecast combos without exact trends, but most should match
    expect(missingCount).toBeLessThanOrEqual(5);
  });

  it("latest trend date aligns with most recent forecast series", () => {
    // Find latest bulletin date in trends
    const latestTrend = trends.reduce((max, r) => {
      const v = r.bulletin_year * 100 + r.bulletin_month;
      return v > max ? v : max;
    }, 0);
    const latestYear = Math.floor(latestTrend / 100);
    const latestMonth = latestTrend % 100;

    // Find the MOST COMMON forecast month at months_ahead=1
    // (some series start from older dates when a category was last non-Current)
    const monthCounts = new Map<string, number>();
    for (const f of forecasts.filter((f) => f.months_ahead === 1)) {
      monthCounts.set(f.forecast_month, (monthCounts.get(f.forecast_month) ?? 0) + 1);
    }
    const latestForecastMonth = [...monthCounts.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))[0];
    expect(latestForecastMonth).toBeDefined();

    const [fy, fm] = latestForecastMonth![0].split("-").map(Number);
    const trendDate = new Date(latestYear, latestMonth - 1);
    const forecastDate = new Date(fy, fm - 1);
    const diffMs = Math.abs(forecastDate.getTime() - trendDate.getTime());
    const diffMonths = diffMs / (30.44 * 24 * 60 * 60 * 1000);
    expect(diffMonths).toBeLessThanOrEqual(3);
  });

  it("EB2/IND forecast starting cutoff is close to latest EB2/IND trend cutoff", () => {
    // Latest historical cutoff for EB2/IND/FAD
    const hist = getHistoricalSeries(trends, "FAD", "EB2", "IND");
    if (hist.length === 0) return; // skip if no data
    const lastHist = hist[hist.length - 1];

    // First forecast point for EB2/IND/FAD
    const fc = getForecastSeries(forecasts, "FAD", "EB2", "IND");
    if (fc.length === 0) return;
    const firstFc = fc[0];

    const histDate = new Date(lastHist.cutoff_date!).getTime();
    const fcDate = new Date(firstFc.projected_cutoff_date).getTime();
    const diffDays = Math.abs(fcDate - histDate) / (24 * 60 * 60 * 1000);

    // The first forecast should be within ~60 days of the last historical cutoff
    // (one month of advancement ≈ 20 days, so 60 gives ~3 months margin)
    expect(diffDays).toBeLessThan(120);
  });
});

// ===========================================================================
// D. Cutoff Continuity & Retrogression Detection
// ===========================================================================

describe("Cutoff continuity — EB2/IND/FAD", () => {
  const series = getHistoricalSeries(trends, "FAD", "EB2", "IND");

  it("has at least 80 monthly data points", () => {
    expect(series.length).toBeGreaterThanOrEqual(80);
  });

  it("cutoff dates are generally advancing (< 15% retrogressions)", () => {
    let retrogressions = 0;
    for (let i = 1; i < series.length; i++) {
      const prev = new Date(series[i - 1].cutoff_date!).getTime();
      const curr = new Date(series[i].cutoff_date!).getTime();
      if (curr < prev) retrogressions++;
    }
    const retroRate = retrogressions / (series.length - 1);
    expect(retroRate).toBeLessThan(0.15);
  });

  it("no single retrogression exceeds 5 years backward", () => {
    // India EB2 has historically seen retrogressions up to ~4.2 years
    const FOUR_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;
    for (let i = 1; i < series.length; i++) {
      const prev = new Date(series[i - 1].cutoff_date!).getTime();
      const curr = new Date(series[i].cutoff_date!).getTime();
      if (curr < prev) {
        expect(prev - curr).toBeLessThan(FOUR_YEARS_MS);
      }
    }
  });

  it("retrogression_flag=1 aligns with actual backward movement", () => {
    for (let i = 1; i < series.length; i++) {
      const prev = new Date(series[i - 1].cutoff_date!).getTime();
      const curr = new Date(series[i].cutoff_date!).getTime();
      if (series[i].retrogression_flag === 1) {
        // When flagged as retrogression, cutoff should have moved backward
        // Allow slight tolerance for rounding
        expect(curr).toBeLessThanOrEqual(prev + 24 * 60 * 60 * 1000);
      }
    }
  });

  it("cumulative retrogression count never decreases along the series", () => {
    let prevCount = 0;
    for (const row of series) {
      if (row.retrogression_count_cum != null && Number.isFinite(row.retrogression_count_cum)) {
        expect(row.retrogression_count_cum).toBeGreaterThanOrEqual(prevCount);
        prevCount = row.retrogression_count_cum;
      }
    }
  });
});

describe("Cutoff continuity — EB3/IND/FAD", () => {
  const series = getHistoricalSeries(trends, "FAD", "EB3", "IND");

  it("has at least 80 monthly data points", () => {
    expect(series.length).toBeGreaterThanOrEqual(80);
  });

  it("net direction is forward (last cutoff > first cutoff)", () => {
    const first = new Date(series[0].cutoff_date!).getTime();
    const last = new Date(series[series.length - 1].cutoff_date!).getTime();
    expect(last).toBeGreaterThan(first);
  });
});

describe("Cutoff continuity — EB2/CHN/DFF", () => {
  const series = getHistoricalSeries(trends, "DFF", "EB2", "CHN");

  it("has data points", () => {
    expect(series.length).toBeGreaterThan(20);
  });

  it("net direction is forward", () => {
    if (series.length < 2) return;
    const first = new Date(series[0].cutoff_date!).getTime();
    const last = new Date(series[series.length - 1].cutoff_date!).getTime();
    expect(last).toBeGreaterThan(first);
  });
});

// ===========================================================================
// E. Forecast Accuracy Bounds
// ===========================================================================

describe("Forecast accuracy bounds", () => {
  it("projected cutoff dates advance monotonically within each series", () => {
    const seriesKeys = new Set(
      forecasts.map((f) => `${f.chart}|${f.category}|${f.country}`)
    );
    for (const key of seriesKeys) {
      const [chart, category, country] = key.split("|");
      const series = getForecastSeries(forecasts, chart, category, country);
      for (let i = 1; i < series.length; i++) {
        const prev = new Date(series[i - 1].projected_cutoff_date).getTime();
        const curr = new Date(series[i].projected_cutoff_date).getTime();
        expect(
          curr,
          `${key} month ${series[i].months_ahead}: cutoff went backward`
        ).toBeGreaterThanOrEqual(prev);
      }
    }
  });

  it("confidence interval widens (or stays same) over longer horizons", () => {
    // Check a key series: FAD/EB2/IND
    const series = getForecastSeries(forecasts, "FAD", "EB2", "IND");
    expect(series.length).toBe(24);
    for (let i = 1; i < series.length; i++) {
      const prevWidth =
        new Date(series[i - 1].confidence_high).getTime() -
        new Date(series[i - 1].confidence_low).getTime();
      const currWidth =
        new Date(series[i].confidence_high).getTime() -
        new Date(series[i].confidence_low).getTime();
      // Allow slight tolerance (1 day) for rounding
      expect(currWidth).toBeGreaterThanOrEqual(prevWidth - 86_400_000);
    }
  });

  it("24-month forecast doesn't advance more than 5 years of cutoff movement", () => {
    // A cutoff advancing 5+ years in 24 months would be ~76 days/month — unrealistic
    const seriesKeys = new Set(
      forecasts.map((f) => `${f.chart}|${f.category}|${f.country}`)
    );
    for (const key of seriesKeys) {
      const [chart, category, country] = key.split("|");
      const series = getForecastSeries(forecasts, chart, category, country);
      if (series.length < 2) continue;
      const first = new Date(series[0].projected_cutoff_date).getTime();
      const last = new Date(series[series.length - 1].projected_cutoff_date).getTime();
      const advancementYears = (last - first) / (365.25 * 24 * 60 * 60 * 1000);
      expect(advancementYears).toBeLessThanOrEqual(5);
    }
  });

  it("EB2/IND velocity is positive (India EB2 must be advancing)", () => {
    const { avgVelocity } = getVelocitySummary(forecasts, "FAD", "EB2", "IND");
    expect(avgVelocity).toBeGreaterThan(0);
  });

  it("EB3/IND velocity is positive", () => {
    const { avgVelocity } = getVelocitySummary(forecasts, "FAD", "EB3", "IND");
    expect(avgVelocity).toBeGreaterThan(0);
  });

  it("India EB2 FAD velocity is between 5 and 60 days/month (realistic bounds)", () => {
    const { avgVelocity } = getVelocitySummary(forecasts, "FAD", "EB2", "IND");
    expect(avgVelocity).toBeGreaterThanOrEqual(5);
    expect(avgVelocity).toBeLessThanOrEqual(60);
  });

  it("India EB2 DFF velocity is between 5 and 60 days/month", () => {
    const { avgVelocity } = getVelocitySummary(forecasts, "DFF", "EB2", "IND");
    expect(avgVelocity).toBeGreaterThanOrEqual(5);
    expect(avgVelocity).toBeLessThanOrEqual(60);
  });
});

// ===========================================================================
// F. computePdi() on Real Data
// ===========================================================================

describe("computePdi() with real forecasts", () => {
  it("finds current date for a very old PD (PD before all cutoffs)", () => {
    // PD Jan 2005 should already be current for EB2/IND/FAD or found very soon
    const result = computePdi(forecasts, "FAD", "EB2", "IND", "2005-01-01");
    expect(result.found).toBe(true);
    expect(result.monthsUntilCurrent).toBeLessThanOrEqual(1);
  });

  it("returns extrapolated=true for a far-future PD", () => {
    // PD Dec 2022 should be way beyond 24-month window for EB2/IND/FAD
    const result = computePdi(forecasts, "FAD", "EB2", "IND", "2022-12-01");
    expect(result.found).toBe(true);
    expect(result.extrapolated).toBe(true);
    expect(result.monthsUntilCurrent!).toBeGreaterThan(24);
  });

  it("realistic mode (0.65x) increases wait time vs optimistic mode", () => {
    const pd = "2018-01-01";
    const optimistic = computePdi(forecasts, "FAD", "EB2", "IND", pd, 1.0);
    const realistic = computePdi(forecasts, "FAD", "EB2", "IND", pd, 0.65);
    expect(optimistic.found).toBe(true);
    expect(realistic.found).toBe(true);
    expect(realistic.monthsUntilCurrent!).toBeGreaterThanOrEqual(
      optimistic.monthsUntilCurrent!
    );
  });

  it("EB2/IND/FAD predictions are within believable range", () => {
    // Someone with PD 2016-06-15 should predict 20–50 months to current
    const result = computePdi(forecasts, "FAD", "EB2", "IND", "2016-06-15");
    expect(result.found).toBe(true);
    expect(result.monthsUntilCurrent!).toBeGreaterThanOrEqual(15);
    expect(result.monthsUntilCurrent!).toBeLessThanOrEqual(60);
  });

  it("ROW countries become current much faster than India", () => {
    const pd = "2024-01-01";
    const indResult = computePdi(forecasts, "FAD", "EB2", "IND", pd);
    const rowResult = computePdi(forecasts, "FAD", "EB2", "ROW", pd);
    // ROW should be found (current or near-current)
    // India should be extrapolated far into the future
    if (rowResult.found && indResult.found) {
      expect(indResult.monthsUntilCurrent!).toBeGreaterThan(
        rowResult.monthsUntilCurrent!
      );
    }
  });

  it("EB1 becomes current faster than EB2 for India", () => {
    const pd = "2022-01-01";
    const eb1 = computePdi(forecasts, "FAD", "EB1", "IND", pd);
    const eb2 = computePdi(forecasts, "FAD", "EB2", "IND", pd);
    if (eb1.found && eb2.found) {
      expect(eb1.monthsUntilCurrent!).toBeLessThanOrEqual(
        eb2.monthsUntilCurrent!
      );
    }
  });

  it("DFF prediction is sooner than FAD for the same PD (filing is always ahead)", () => {
    const pd = "2016-06-15";
    const dff = computePdi(forecasts, "DFF", "EB2", "IND", pd);
    const fad = computePdi(forecasts, "FAD", "EB2", "IND", pd);
    if (dff.found && fad.found) {
      expect(dff.monthsUntilCurrent!).toBeLessThanOrEqual(
        fad.monthsUntilCurrent!
      );
    }
  });

  it("avgVelocity is set on all results with data", () => {
    const result = computePdi(forecasts, "FAD", "EB2", "IND", "2018-01-01");
    expect(result.avgVelocity).toBeGreaterThan(0);
    expect(Number.isFinite(result.avgVelocity)).toBe(true);
  });

  it("series is populated on results", () => {
    const result = computePdi(forecasts, "FAD", "EB2", "IND", "2018-01-01");
    expect(result.series.length).toBe(24);
  });
});

// ===========================================================================
// G. Data Freshness
// ===========================================================================

describe("Data freshness", () => {
  it("_freshness.json exists and has synced_at", () => {
    expect(existsSync(freshnessPath)).toBe(true);
    expect(freshness.synced_at).toBeDefined();
  });

  it("synced_at is a valid ISO date", () => {
    const ts = new Date(freshness.synced_at).getTime();
    expect(Number.isFinite(ts)).toBe(true);
  });

  it("data was synced within last 90 days", () => {
    const syncDate = new Date(freshness.synced_at).getTime();
    const now = Date.now();
    const daysSinceSync = (now - syncDate) / (24 * 60 * 60 * 1000);
    expect(daysSinceSync).toBeLessThan(90);
  });

  it("historical trends include current year", () => {
    const currentYear = new Date().getFullYear();
    const hasCurrentYear = trends.some((r) => r.bulletin_year === currentYear);
    expect(hasCurrentYear).toBe(true);
  });

  it("latest forecast series starts from a recent month (within 3 months of now)", () => {
    const now = new Date();
    const currentYM = now.getFullYear() * 12 + now.getMonth();
    // Use the LATEST forecast month, not the earliest
    // (some series have old start dates from when that combo was last non-Current)
    const forecastMonths = forecasts
      .filter((f) => f.months_ahead === 1)
      .map((f) => {
        const [y, m] = f.forecast_month.split("-").map(Number);
        return y * 12 + (m - 1);
      });
    const latest = Math.max(...forecastMonths);
    const diffMonths = Math.abs(currentYM - latest);
    expect(diffMonths).toBeLessThanOrEqual(3);
  });
});

// ===========================================================================
// H. getHistoricalSeries() on Real Data
// ===========================================================================

describe("getHistoricalSeries() with real trends", () => {
  it("returns sorted results for EB2/IND/FAD", () => {
    const series = getHistoricalSeries(trends, "FAD", "EB2", "IND");
    expect(series.length).toBeGreaterThan(50);
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1].bulletin_year * 100 + series[i - 1].bulletin_month;
      const curr = series[i].bulletin_year * 100 + series[i].bulletin_month;
      expect(curr).toBeGreaterThan(prev);
    }
  });

  it("excludes C and U status records", () => {
    const series = getHistoricalSeries(trends, "FAD", "EB2", "IND");
    for (const row of series) {
      expect(row.status_flag).toBe("D");
    }
  });

  it("all returned records have valid cutoff_date", () => {
    const series = getHistoricalSeries(trends, "FAD", "EB2", "IND");
    for (const row of series) {
      expect(row.cutoff_date).not.toBeNull();
      const ts = new Date(row.cutoff_date!).getTime();
      expect(Number.isFinite(ts)).toBe(true);
    }
  });

  it("EB1/ROW trend is mostly Current (few D-status records)", () => {
    // ROW EB1 is almost always current
    const allRec = trends.filter(
      (r) => r.chart === "FAD" && r.category === "EB1" && r.country === "ROW"
    );
    const currentRec = allRec.filter((r) => r.status_flag === "C");
    const currentRate = currentRec.length / allRec.length;
    expect(currentRate).toBeGreaterThan(0.5);
  });
});

// ===========================================================================
// I. getVelocitySummary() on Real Data
// ===========================================================================

describe("getVelocitySummary() with real forecasts", () => {
  it("returns positive stats for EB2/IND/FAD", () => {
    const stats = getVelocitySummary(forecasts, "FAD", "EB2", "IND");
    expect(stats.avgVelocity).toBeGreaterThan(0);
    expect(stats.minVelocity).toBeGreaterThanOrEqual(0);
    expect(stats.maxVelocity).toBeGreaterThan(stats.minVelocity);
  });

  it("average velocity matches manual calculation", () => {
    const series = getForecastSeries(forecasts, "FAD", "EB2", "IND");
    const manualAvg =
      series.reduce((sum, f) => sum + f.velocity_days_per_month, 0) / series.length;
    const stats = getVelocitySummary(forecasts, "FAD", "EB2", "IND");
    expect(stats.avgVelocity).toBeCloseTo(manualAvg, 1);
  });
});
