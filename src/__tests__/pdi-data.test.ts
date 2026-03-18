import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PdForecast } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Mock fetch before imports
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  getForecastSeries,
  computePdi,
  getVelocitySummary,
  loadPdForecasts,
  loadCutoffTrends,
  getHistoricalSeries,
  extrapolateForChart,
  PDI_CHARTS,
  PDI_CATEGORIES,
  PDI_COUNTRIES,
  COUNTRY_LABELS,
  CHART_LABELS,
} from "@/lib/data/pdi";
import type { CutoffTrendRecord } from "@/lib/data/pdi";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeForecast(overrides: Partial<PdForecast> = {}): PdForecast {
  return {
    forecast_month: "2026-04",
    months_ahead: 1,
    chart: "DFF",
    category: "EB2",
    country: "IND",
    projected_cutoff_date: "2015-01-01",
    confidence_low: "2014-06-01",
    confidence_high: "2015-06-01",
    velocity_days_per_month: 17.5,
    cumulative_advancement_days: 17.5,
    ...overrides,
  };
}

/** Build a 24-month series for EB2/IND/DFF */
function buildSeries(): PdForecast[] {
  return Array.from({ length: 24 }, (_, i) => {
    const month = i + 1;
    const baseDate = new Date("2015-01-01");
    baseDate.setDate(baseDate.getDate() + Math.round(17 * month));
    const cutoff = baseDate.toISOString().slice(0, 10);
    // Generate valid forecast months starting from 2026-04
    const fmBase = new Date(Date.UTC(2026, 3, 1)); // April 2026
    fmBase.setUTCMonth(fmBase.getUTCMonth() + (month - 1));
    const fm = `${fmBase.getUTCFullYear()}-${String(
      fmBase.getUTCMonth() + 1
    ).padStart(2, "0")}`;
    return makeForecast({
      forecast_month: fm,
      months_ahead: month,
      projected_cutoff_date: cutoff,
      confidence_low: cutoff,
      confidence_high: cutoff,
      velocity_days_per_month: 17,
      cumulative_advancement_days: 17 * month,
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PDI Constants", () => {
  it("exports chart types", () => {
    expect(PDI_CHARTS).toEqual(["FAD", "DFF"]);
  });

  it("exports categories", () => {
    expect(PDI_CATEGORIES).toContain("EB1");
    expect(PDI_CATEGORIES).toContain("EB2");
    expect(PDI_CATEGORIES).toContain("EB3");
    expect(PDI_CATEGORIES.length).toBe(6);
  });

  it("exports countries", () => {
    expect(PDI_COUNTRIES).toContain("IND");
    expect(PDI_COUNTRIES).toContain("CHN");
    expect(PDI_COUNTRIES).toContain("ROW");
    expect(PDI_COUNTRIES.length).toBe(6);
  });

  it("has human-readable country labels", () => {
    expect(COUNTRY_LABELS["IND"]).toBe("India");
    expect(COUNTRY_LABELS["CHN"]).toBe("China (mainland)");
    expect(COUNTRY_LABELS["ROW"]).toBe("Rest of World");
  });

  it("has chart labels", () => {
    expect(CHART_LABELS["FAD"]).toBe("Final Action Date");
    expect(CHART_LABELS["DFF"]).toBe("Date for Filing");
  });
});

describe("getForecastSeries", () => {
  const series = buildSeries();
  // Mix in a different series so filtering matters
  const allForecasts = [
    ...series,
    makeForecast({ chart: "FAD", category: "EB1", country: "CHN", months_ahead: 1 }),
    makeForecast({ chart: "FAD", category: "EB1", country: "CHN", months_ahead: 2 }),
  ];

  it("filters by chart/category/country", () => {
    const result = getForecastSeries(allForecasts, "DFF", "EB2", "IND");
    expect(result.length).toBe(24);
    expect(result.every((f) => f.chart === "DFF")).toBe(true);
    expect(result.every((f) => f.category === "EB2")).toBe(true);
    expect(result.every((f) => f.country === "IND")).toBe(true);
  });

  it("sorts by months_ahead ascending", () => {
    const result = getForecastSeries(allForecasts, "DFF", "EB2", "IND");
    for (let i = 1; i < result.length; i++) {
      expect(result[i].months_ahead).toBeGreaterThan(result[i - 1].months_ahead);
    }
  });

  it("returns empty array for non-existent combo", () => {
    const result = getForecastSeries(allForecasts, "DFF", "EB5", "MEX");
    expect(result).toEqual([]);
  });
});

describe("computePdi", () => {
  const series = buildSeries();

  it("finds month when PD becomes current", () => {
    // PD is 2015-03-01, cutoff at month 4 will be ~2015-01-01 + 68 days = ~2015-03-10
    const result = computePdi(series, "DFF", "EB2", "IND", "2015-03-01");
    expect(result.found).toBe(true);
    expect(result.currentMonth).toBeTruthy();
    expect(result.monthsUntilCurrent).toBeGreaterThan(0);
    expect(result.projectedCutoff).toBeTruthy();
    expect(result.series.length).toBe(24);
  });

  it("extrapolates when PD is beyond model window", () => {
    // PD is far in the future — cutoff won't reach it in 24 months
    const result = computePdi(series, "DFF", "EB2", "IND", "2020-01-01");
    expect(result.found).toBe(true);
    expect(result.extrapolated).toBe(true);
    expect(result.monthsUntilCurrent).toBeGreaterThan(24);
    expect(result.currentMonth).toBeTruthy();
    expect(result.avgVelocity).toBe(17);
    expect(result.series.length).toBe(24);
  });

  it("returns found=true immediately when PD is already current", () => {
    // PD is before the first cutoff
    const result = computePdi(series, "DFF", "EB2", "IND", "2014-01-01");
    expect(result.found).toBe(true);
    expect(result.extrapolated).toBe(false);
    expect(result.monthsUntilCurrent).toBe(1);
  });

  it("returns empty series for non-existent combo", () => {
    const result = computePdi(series, "FAD", "EB5", "MEX", "2020-01-01");
    expect(result.found).toBe(false);
    expect(result.series).toEqual([]);
    expect(result.avgVelocity).toBe(0);
  });

  it("includes confidence interval bounds when found", () => {
    const result = computePdi(series, "DFF", "EB2", "IND", "2015-03-01");
    if (result.found) {
      expect(result.confidenceLow).toBeTruthy();
      expect(result.confidenceHigh).toBeTruthy();
    }
  });

  it("realistic velocity multiplier increases months until current", () => {
    // Same PD, but 0.65 multiplier should take longer
    const optimistic = computePdi(series, "DFF", "EB2", "IND", "2020-01-01", 1.0);
    const realistic = computePdi(series, "DFF", "EB2", "IND", "2020-01-01", 0.65);
    expect(optimistic.found).toBe(true);
    expect(realistic.found).toBe(true);
    expect(optimistic.monthsUntilCurrent).not.toBeNull();
    expect(realistic.monthsUntilCurrent).not.toBeNull();
    expect(realistic.monthsUntilCurrent!).toBeGreaterThan(
      optimistic.monthsUntilCurrent!
    );
  });
});

describe("getVelocitySummary", () => {
  it("computes avg/min/max velocity from series", () => {
    const forecasts = [
      makeForecast({ months_ahead: 1, velocity_days_per_month: 10 }),
      makeForecast({ months_ahead: 2, velocity_days_per_month: 20 }),
      makeForecast({ months_ahead: 3, velocity_days_per_month: 30 }),
    ];
    const result = getVelocitySummary(forecasts, "DFF", "EB2", "IND");
    expect(result.avgVelocity).toBe(20);
    expect(result.minVelocity).toBe(10);
    expect(result.maxVelocity).toBe(30);
  });

  it("returns zeros for non-existent combo", () => {
    const result = getVelocitySummary([], "DFF", "EB2", "IND");
    expect(result).toEqual({ avgVelocity: 0, minVelocity: 0, maxVelocity: 0 });
  });
});

describe("extrapolateForChart", () => {
  const series = buildSeries();

  it("returns empty when PD is within forecast window", () => {
    // PD before the last cutoff in 24-month series
    const pdTs = new Date("2015-06-01").getTime();
    const result = extrapolateForChart(series, pdTs);
    expect(result).toEqual([]);
  });

  it("generates extrapolated points when PD is beyond window", () => {
    const pdTs = new Date("2020-01-01").getTime();
    const result = extrapolateForChart(series, pdTs);
    expect(result.length).toBeGreaterThan(0);
    // Last point should have cutoff >= PD
    const lastPoint = result[result.length - 1];
    expect(lastPoint.cutoffTimestamp).toBeGreaterThanOrEqual(pdTs);
  });

  it("each point has valid month format", () => {
    const pdTs = new Date("2020-01-01").getTime();
    const result = extrapolateForChart(series, pdTs);
    for (const p of result) {
      expect(p.month).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("returns empty for empty series", () => {
    expect(extrapolateForChart([], Date.now())).toEqual([]);
  });

  it("generates more points with realistic velocity multiplier", () => {
    const pdTs = new Date("2020-01-01").getTime();
    const optimistic = extrapolateForChart(series, pdTs, 240, 1.0);
    const realistic = extrapolateForChart(series, pdTs, 240, 0.65);
    // Realistic velocity is slower, so needs more months to reach PD
    expect(realistic.length).toBeGreaterThan(optimistic.length);
  });
});

describe("loadPdForecasts", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("fetches pd_forecasts.json and returns data", async () => {
    const mockData = [
      makeForecast({ months_ahead: 1 }),
      makeForecast({ months_ahead: 2 }),
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockData)),
    });

    const result = await loadPdForecasts();
    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("pd_forecasts.json")
    );
  });
});

// ---------------------------------------------------------------------------
// Historical Cutoff Trend Tests
// ---------------------------------------------------------------------------

function makeTrend(overrides: Partial<CutoffTrendRecord> = {}): CutoffTrendRecord {
  return {
    bulletin_year: 2020,
    bulletin_month: 1,
    chart: "DFF",
    category: "EB2",
    country: "IND",
    status_flag: "D",
    cutoff_date: "2012-01-01",
    queue_position_days: null,
    monthly_advancement_days: 15,
    velocity_3m: 14,
    velocity_6m: 13,
    retrogression_flag: 0,
    retrogression_count_cum: 0,
    ...overrides,
  };
}

describe("loadCutoffTrends", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("fetches fact_cutoff_trends.json and returns data", async () => {
    const mockData = [makeTrend(), makeTrend({ bulletin_month: 2 })];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockData)),
    });

    const result = await loadCutoffTrends();
    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("fact_cutoff_trends.json")
    );
  });
});

describe("getHistoricalSeries", () => {
  const trends: CutoffTrendRecord[] = [
    makeTrend({ bulletin_year: 2020, bulletin_month: 1, chart: "DFF", status_flag: "D", cutoff_date: "2012-01-01" }),
    makeTrend({ bulletin_year: 2020, bulletin_month: 2, chart: "DFF", status_flag: "D", cutoff_date: "2012-02-01" }),
    makeTrend({ bulletin_year: 2020, bulletin_month: 3, chart: "DFF", status_flag: "C", cutoff_date: null }), // Current, no date
    makeTrend({ bulletin_year: 2020, bulletin_month: 4, chart: "DFF", status_flag: "U", cutoff_date: null }), // Unavailable
    makeTrend({ bulletin_year: 2020, bulletin_month: 1, chart: "FAD", status_flag: "D", cutoff_date: "2011-06-01" }),
    makeTrend({ bulletin_year: 2020, bulletin_month: 1, chart: "DFF", category: "EB1", status_flag: "D", cutoff_date: "2019-01-01" }),
    makeTrend({ bulletin_year: 2020, bulletin_month: 1, chart: "DFF", country: "CHN", status_flag: "D", cutoff_date: "2018-01-01" }),
  ];

  it("filters by chart/category/country and status_flag=D", () => {
    const result = getHistoricalSeries(trends, "DFF", "EB2", "IND");
    expect(result.length).toBe(2);
    expect(result.every((r) => r.chart === "DFF")).toBe(true);
    expect(result.every((r) => r.category === "EB2")).toBe(true);
    expect(result.every((r) => r.country === "IND")).toBe(true);
    expect(result.every((r) => r.status_flag === "D")).toBe(true);
  });

  it("sorts chronologically by bulletin_year/month", () => {
    const result = getHistoricalSeries(trends, "DFF", "EB2", "IND");
    expect(result[0].bulletin_month).toBe(1);
    expect(result[1].bulletin_month).toBe(2);
  });

  it("excludes C and U status records", () => {
    const result = getHistoricalSeries(trends, "DFF", "EB2", "IND");
    expect(result.every((r) => r.status_flag === "D")).toBe(true);
  });

  it("returns empty array for non-existent combo", () => {
    const result = getHistoricalSeries(trends, "FAD", "EB5", "MEX");
    expect(result).toEqual([]);
  });

  it("returns records for FAD chart", () => {
    const result = getHistoricalSeries(trends, "FAD", "EB2", "IND");
    expect(result.length).toBe(1);
    expect(result[0].cutoff_date).toBe("2011-06-01");
  });
});

// ---------------------------------------------------------------------------
// MCRA Retrograde Loader Tests
// ---------------------------------------------------------------------------

import { getRetrogradeSeries, getRetrogradeRiskSummary } from "@/lib/data/pdi";
import type { PdForecastRetrograde } from "@/types/p2-artifacts";

function makeMcraForecast(overrides: Partial<PdForecastRetrograde> = {}): PdForecastRetrograde {
  return {
    forecast_month: "2026-04",
    months_ahead: 1,
    chart: "DFF",
    category: "EB2",
    country: "IND",
    projected_cutoff_date: "2014-11-19",
    confidence_low: "2014-06-01",
    confidence_high: "2015-05-01",
    velocity_days_per_month: 17.5,
    cumulative_advancement_days: 17.5,
    retrograde_prob: 0.019,
    expected_setback_days: 45.2,
    risk_adjusted_velocity: 16.9,
    ...overrides,
  };
}

describe("getRetrogradeSeries", () => {
  const mcraForecasts: PdForecastRetrograde[] = [
    makeMcraForecast({ months_ahead: 2, forecast_month: "2026-05" }),
    makeMcraForecast({ months_ahead: 1, forecast_month: "2026-04" }),
    makeMcraForecast({ months_ahead: 3, forecast_month: "2026-06", chart: "FAD" }),
  ];

  it("filters by chart/category/country and sorts by months_ahead", () => {
    const result = getRetrogradeSeries(mcraForecasts, "DFF", "EB2", "IND");
    expect(result.length).toBe(2);
    expect(result[0].months_ahead).toBe(1);
    expect(result[1].months_ahead).toBe(2);
  });

  it("returns empty for non-existent combo", () => {
    const result = getRetrogradeSeries(mcraForecasts, "DFF", "EB5", "CHN");
    expect(result).toEqual([]);
  });

  it("includes retrograde-specific fields", () => {
    const result = getRetrogradeSeries(mcraForecasts, "DFF", "EB2", "IND");
    expect(result[0]).toHaveProperty("retrograde_prob");
    expect(result[0]).toHaveProperty("expected_setback_days");
    expect(result[0]).toHaveProperty("risk_adjusted_velocity");
  });
});

describe("getRetrogradeRiskSummary", () => {
  const mcraForecasts: PdForecastRetrograde[] = [
    makeMcraForecast({ retrograde_prob: 0.05, expected_setback_days: 30 }),
    makeMcraForecast({ months_ahead: 2, forecast_month: "2026-05", retrograde_prob: 0.15, expected_setback_days: 60 }),
    makeMcraForecast({ months_ahead: 3, forecast_month: "2026-06", retrograde_prob: 0.25, expected_setback_days: 90 }),
  ];

  it("computes average retrograde probability", () => {
    const summary = getRetrogradeRiskSummary(mcraForecasts, "DFF", "EB2", "IND");
    expect(summary.avgRetroProb).toBeCloseTo(0.15, 2);
  });

  it("computes average setback days", () => {
    const summary = getRetrogradeRiskSummary(mcraForecasts, "DFF", "EB2", "IND");
    expect(summary.avgSetbackDays).toBeCloseTo(60, 0);
  });

  it("computes max retrograde probability", () => {
    const summary = getRetrogradeRiskSummary(mcraForecasts, "DFF", "EB2", "IND");
    expect(summary.maxRetroProb).toBe(0.25);
  });

  it("assigns correct regime based on avgRetroProb", () => {
    expect(getRetrogradeRiskSummary(mcraForecasts, "DFF", "EB2", "IND").regime).toBe("moderate");
    // Low regime
    const lowForecasts = [makeMcraForecast({ retrograde_prob: 0.02, expected_setback_days: 10 })];
    expect(getRetrogradeRiskSummary(lowForecasts, "DFF", "EB2", "IND").regime).toBe("low");
    // Elevated regime
    const highForecasts = [makeMcraForecast({ retrograde_prob: 0.30, expected_setback_days: 120 })];
    expect(getRetrogradeRiskSummary(highForecasts, "DFF", "EB2", "IND").regime).toBe("elevated");
  });

  it("returns zeroes for non-existent combo", () => {
    const summary = getRetrogradeRiskSummary(mcraForecasts, "FAD", "EB5", "ROW");
    expect(summary.avgRetroProb).toBe(0);
    expect(summary.avgSetbackDays).toBe(0);
    expect(summary.maxRetroProb).toBe(0);
    expect(summary.regime).toBe("unknown");
  });
});
