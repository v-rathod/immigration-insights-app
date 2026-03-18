/**
 * Priority Date Cortex data loaders and forecast helpers.
 *
 * Loads pre-computed 24-month priority date forecasts from P2 Meridian.
 * 56 series (chart × category × country), 1,344 total records.
 */

import { loadModelData, loadDashboardData } from "./loader";
import type { PdForecast, PdForecastRetrograde } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Chart types available in forecasts */
export const PDI_CHARTS = ["FAD", "DFF"] as const;
export type PdiChart = (typeof PDI_CHARTS)[number];

/** EB categories available in forecasts */
export const PDI_CATEGORIES = [
  "EB1",
  "EB2",
  "EB3",
  "EB3-Other",
  "EB4",
  "EB5",
] as const;
export type PdiCategory = (typeof PDI_CATEGORIES)[number];

/** Countries / chargeability regions */
export const PDI_COUNTRIES = [
  "CHN",
  "IND",
  "MEX",
  "PHL",
  "ROW",
  "EL SALVADOR GUATEMALA HONDURAS",
] as const;
export type PdiCountry = (typeof PDI_COUNTRIES)[number];

/** Human-readable country labels */
export const COUNTRY_LABELS: Record<string, string> = {
  CHN: "China (mainland)",
  IND: "India",
  MEX: "Mexico",
  PHL: "Philippines",
  ROW: "Rest of World",
  "EL SALVADOR GUATEMALA HONDURAS": "El Salv. / Guat. / Hond.",
};

/** Human-readable chart labels */
export const CHART_LABELS: Record<string, string> = {
  FAD: "Final Action Date",
  DFF: "Date for Filing",
};

// ---------------------------------------------------------------------------
// Raw data loader
// ---------------------------------------------------------------------------

/** Load all 1,344 forecast records (optimistic model — base v2.1) */
export async function loadPdForecasts(): Promise<PdForecast[]> {
  return loadModelData<PdForecast>("pd_forecasts");
}

/** Load MCRA retrograde-adjusted forecasts (1,320 records, same series as base) */
export async function loadPdForecastsRetrograde(): Promise<PdForecastRetrograde[]> {
  return loadModelData<PdForecastRetrograde>("pd_forecasts_retrograde");
}

/** Get the retrograde-specific data for a series (prob, severity, risk velocity) */
export function getRetrogradeSeries(
  forecasts: PdForecastRetrograde[],
  chart: string,
  category: string,
  country: string
): PdForecastRetrograde[] {
  return forecasts
    .filter(
      (f) =>
        f.chart === chart &&
        f.category === category &&
        f.country === country
    )
    .sort((a, b) => a.months_ahead - b.months_ahead);
}

/** Compute average retrograde probability and severity for a series */
export function getRetrogradeRiskSummary(
  forecasts: PdForecastRetrograde[],
  chart: string,
  category: string,
  country: string
): { avgRetroProb: number; avgSetbackDays: number; maxRetroProb: number; regime: string } {
  const series = getRetrogradeSeries(forecasts, chart, category, country);
  if (series.length === 0) {
    return { avgRetroProb: 0, avgSetbackDays: 0, maxRetroProb: 0, regime: "unknown" };
  }
  const probs = series.map((f) => f.retrograde_prob);
  const sevs = series.map((f) => f.expected_setback_days);
  const avgProb = probs.reduce((a, b) => a + b, 0) / probs.length;
  const avgSev = sevs.reduce((a, b) => a + b, 0) / sevs.length;
  const maxProb = Math.max(...probs);
  const regime = avgProb >= 0.20 ? "elevated" : avgProb >= 0.10 ? "moderate" : "low";
  return {
    avgRetroProb: Math.round(avgProb * 1000) / 1000,
    avgSetbackDays: Math.round(avgSev * 10) / 10,
    maxRetroProb: Math.round(maxProb * 1000) / 1000,
    regime,
  };
}

// ---------------------------------------------------------------------------
// Historical cutoff trend data (fact_cutoff_trends)
// ---------------------------------------------------------------------------

/**
 * Raw record from fact_cutoff_trends.json.
 * NB: JSON field is `chart` (not `chart_type` as in the TS interface).
 */
export interface CutoffTrendRecord {
  bulletin_year: number;
  bulletin_month: number;
  chart: string; // "DFF" | "FAD"
  category: string;
  country: string;
  status_flag: string; // "C" = Current, "D" = Date, "U" = Unavailable
  cutoff_date: string | null; // ISO date or null/NaN
  queue_position_days: number | null;
  monthly_advancement_days: number | null;
  velocity_3m: number | null;
  velocity_6m: number | null;
  retrogression_flag: number;
  retrogression_count_cum: number;
}

/** Load all historical cutoff trend records (~8.3K rows) */
export async function loadCutoffTrends(): Promise<CutoffTrendRecord[]> {
  return loadDashboardData<CutoffTrendRecord>(
    "visa-bulletin",
    "fact_cutoff_trends"
  );
}

/**
 * Filter historical trends for a specific chart/category/country combo.
 * Returns records sorted chronologically by bulletin_year + bulletin_month.
 * Excludes records where cutoff_date is null/NaN/"nan" or status_flag is "C"/"U".
 */
export function getHistoricalSeries(
  trends: CutoffTrendRecord[],
  chart: string,
  category: string,
  country: string
): CutoffTrendRecord[] {
  return trends
    .filter(
      (r) =>
        r.chart === chart &&
        r.category === category &&
        r.country === country &&
        r.status_flag === "D" &&
        r.cutoff_date != null &&
        String(r.cutoff_date) !== "nan"
    )
    .sort(
      (a, b) =>
        a.bulletin_year * 100 + a.bulletin_month -
        (b.bulletin_year * 100 + b.bulletin_month)
    );
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Get the 24-month forecast series for a specific chart/category/country combo */
export function getForecastSeries(
  forecasts: PdForecast[],
  chart: string,
  category: string,
  country: string
): PdForecast[] {
  return forecasts
    .filter(
      (f) =>
        f.chart === chart &&
        f.category === category &&
        f.country === country
    )
    .sort((a, b) => a.months_ahead - b.months_ahead);
}

/** Result of a PDI lookup — when will the user's PD become current? */
export interface PdiResult {
  /** Whether a currency date was found (within model window or extrapolated) */
  found: boolean;
  /** Whether the prediction is extrapolated beyond the model's 24-month window */
  extrapolated: boolean;
  /** The forecast month when PD becomes current (e.g. "2027-09") */
  currentMonth: string | null;
  /** How many months from now until current */
  monthsUntilCurrent: number | null;
  /** The projected cutoff date at that month */
  projectedCutoff: string | null;
  /** Confidence interval bounds */
  confidenceLow: string | null;
  confidenceHigh: string | null;
  /** Average velocity (days/month) across the series */
  avgVelocity: number;
  /** The full 24-month series for charting */
  series: PdForecast[];
}

/**
 * Compute PDI — when will a given priority date become current?
 *
 * Compares the user's PD against the projected cutoff dates in the
 * 24-month forecast series. Returns the first month where the
 * projected cutoff >= PD, plus the full series for charting.
 */
export function computePdi(
  forecasts: PdForecast[],
  chart: string,
  category: string,
  country: string,
  priorityDate: string, // ISO date: "2020-03-15"
  velocityMultiplier: number = 1.0
): PdiResult {
  const series = getForecastSeries(forecasts, chart, category, country);

  if (series.length === 0) {
    return {
      found: false,
      extrapolated: false,
      currentMonth: null,
      monthsUntilCurrent: null,
      projectedCutoff: null,
      confidenceLow: null,
      confidenceHigh: null,
      avgVelocity: 0,
      series: [],
    };
  }

  const pdTime = new Date(priorityDate).getTime();
  const velocities = series.map((f) => f.velocity_days_per_month);
  const rawAvgVelocity =
    velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const avgVelocity = rawAvgVelocity * velocityMultiplier;

  // When multiplier < 1 (realistic mode), we need to recalculate projected
  // cutoff positions using adjusted velocity from the series start.
  if (velocityMultiplier === 1.0) {
    // Optimistic: use model projections directly
    for (const forecast of series) {
      const cutoffTime = new Date(forecast.projected_cutoff_date).getTime();
      if (cutoffTime >= pdTime) {
        return {
          found: true,
          extrapolated: false,
          currentMonth: forecast.forecast_month,
          monthsUntilCurrent: forecast.months_ahead,
          projectedCutoff: forecast.projected_cutoff_date,
          confidenceLow: forecast.confidence_low,
          confidenceHigh: forecast.confidence_high,
          avgVelocity: Math.round(avgVelocity * 10) / 10,
          series,
        };
      }
    }
  } else {
    // Realistic: recompute cutoff positions using discounted velocity
    const firstCutoffTime = new Date(
      series[0].projected_cutoff_date
    ).getTime();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    for (const forecast of series) {
      const adjustedCutoffTime =
        firstCutoffTime +
        forecast.months_ahead * avgVelocity * MS_PER_DAY;
      if (adjustedCutoffTime >= pdTime) {
        const adjustedCutoff = new Date(adjustedCutoffTime)
          .toISOString()
          .slice(0, 10);
        return {
          found: true,
          extrapolated: false,
          currentMonth: forecast.forecast_month,
          monthsUntilCurrent: forecast.months_ahead,
          projectedCutoff: adjustedCutoff,
          confidenceLow: null,
          confidenceHigh: null,
          avgVelocity: Math.round(avgVelocity * 10) / 10,
          series,
        };
      }
    }
  }

  // PD is beyond the 24-month model window — extrapolate using average velocity
  const lastForecast = series[series.length - 1];
  const lastCutoffTime =
    velocityMultiplier === 1.0
      ? new Date(lastForecast.projected_cutoff_date).getTime()
      : new Date(series[0].projected_cutoff_date).getTime() +
        lastForecast.months_ahead *
          avgVelocity *
          24 *
          60 *
          60 *
          1000;

  if (avgVelocity > 0 && pdTime > lastCutoffTime) {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const remainingDays = (pdTime - lastCutoffTime) / MS_PER_DAY;
    const additionalMonths = Math.ceil(remainingDays / avgVelocity);
    const totalMonths = lastForecast.months_ahead + additionalMonths;

    // Calculate estimated forecast month
    const base = new Date(lastForecast.forecast_month + "-01T00:00:00Z");
    let estimatedMonth: string | null = null;
    if (!isNaN(base.getTime())) {
      base.setUTCMonth(base.getUTCMonth() + additionalMonths);
      estimatedMonth = `${base.getUTCFullYear()}-${String(
        base.getUTCMonth() + 1
      ).padStart(2, "0")}`;
    }

    return {
      found: true,
      extrapolated: true,
      currentMonth: estimatedMonth,
      monthsUntilCurrent: totalMonths,
      projectedCutoff: priorityDate,
      confidenceLow: null,
      confidenceHigh: null,
      avgVelocity: Math.round(avgVelocity * 10) / 10,
      series,
    };
  }

  // Velocity is zero or negative — cannot predict
  return {
    found: false,
    extrapolated: false,
    currentMonth: null,
    monthsUntilCurrent: null,
    projectedCutoff: null,
    confidenceLow: null,
    confidenceHigh: null,
    avgVelocity: Math.round(avgVelocity * 10) / 10,
    series,
  };
}

/**
 * Get a quick summary stat: how many days/month is the cutoff advancing?
 * Useful for homepage stat display.
 */
export function getVelocitySummary(
  forecasts: PdForecast[],
  chart: string,
  category: string,
  country: string
): { avgVelocity: number; minVelocity: number; maxVelocity: number } {
  const series = getForecastSeries(forecasts, chart, category, country);
  if (series.length === 0) {
    return { avgVelocity: 0, minVelocity: 0, maxVelocity: 0 };
  }

  const velocities = series.map((f) => f.velocity_days_per_month);
  return {
    avgVelocity:
      Math.round(
        (velocities.reduce((a, b) => a + b, 0) / velocities.length) * 10
      ) / 10,
    minVelocity: Math.round(Math.min(...velocities) * 10) / 10,
    maxVelocity: Math.round(Math.max(...velocities) * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Chart extrapolation
// ---------------------------------------------------------------------------

/** Point in an extrapolated chart extension beyond the model's forecast window */
export interface ExtrapolatedPoint {
  month: string; // "YYYY-MM"
  cutoffTimestamp: number; // ms since epoch
}

/**
 * Generate extrapolated data points beyond the 24-month model forecast.
 * Uses the series' average velocity (optionally scaled by multiplier)
 * to project cutoff date advancement until the cutoff reaches the target
 * priority date.
 */
export function extrapolateForChart(
  series: PdForecast[],
  targetPdTimestamp: number,
  maxExtraMonths: number = 120,
  velocityMultiplier: number = 1.0
): ExtrapolatedPoint[] {
  if (series.length === 0) return [];

  const last = series[series.length - 1];
  const lastCutoffTs = new Date(last.projected_cutoff_date).getTime();
  if (lastCutoffTs >= targetPdTimestamp) return [];

  const rawAvgVelocity =
    series.reduce((s, f) => s + f.velocity_days_per_month, 0) / series.length;
  const avgVelocity = rawAvgVelocity * velocityMultiplier;
  if (avgVelocity <= 0) return [];

  const base = new Date(last.forecast_month + "-01T00:00:00Z");
  if (isNaN(base.getTime())) return [];

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const points: ExtrapolatedPoint[] = [];

  for (let i = 1; i <= maxExtraMonths; i++) {
    const d = new Date(base);
    d.setUTCMonth(d.getUTCMonth() + i);
    const month = `${d.getUTCFullYear()}-${String(
      d.getUTCMonth() + 1
    ).padStart(2, "0")}`;
    const cutoffTimestamp = lastCutoffTs + i * avgVelocity * MS_PER_DAY;
    points.push({ month, cutoffTimestamp });
    if (cutoffTimestamp >= targetPdTimestamp) break;
  }

  return points;
}
