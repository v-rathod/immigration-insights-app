/**
 * Data loaders and helpers for the EB Category Comparison dashboard.
 *
 * Consumes: category_movement_metrics.json (8,060 rows)
 * Source: P2 make_category_movement_metrics.py
 */

import { loadDashboardData } from "./loader";
import type { CategoryMovementMetric } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

export async function loadCategoryMovement(): Promise<CategoryMovementMetric[]> {
  return loadDashboardData<CategoryMovementMetric>("eb-category", "category_movement_metrics");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Unique categories in the dataset */
export const EB_CATEGORIES = ["EB1", "EB2", "EB3"] as const;

/** Countries used for comparison */
export const EB_COUNTRIES = ["IND", "CHN", "ROW"] as const;

/** Country display labels */
export const COUNTRY_LABELS: Record<string, string> = {
  IND: "India",
  CHN: "China",
  ROW: "Rest of World",
  MEX: "Mexico",
  PHL: "Philippines",
  VIETNAM: "Vietnam",
  "EL SALVADOR GUATEMALA HONDURAS": "Central America",
};

/** Filter movement data for a specific category/country/chart combo */
export function filterMovementSeries(
  data: CategoryMovementMetric[],
  category: string,
  country: string,
  chart: string = "DFF"
): CategoryMovementMetric[] {
  return data
    .filter(
      (r) =>
        r.category === category &&
        r.country === country &&
        r.chart === chart
    )
    .sort(
      (a, b) =>
        a.bulletin_year * 100 + a.bulletin_month -
        (b.bulletin_year * 100 + b.bulletin_month)
    );
}

/** Get latest metrics for a category/country pair */
export function getLatestMovement(
  data: CategoryMovementMetric[],
  category: string,
  country: string,
  chart: string = "DFF"
): CategoryMovementMetric | null {
  const series = filterMovementSeries(data, category, country, chart);
  // Prefer the last row with blended_velocity; fall back to avg_monthly_advancement_days
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].blended_velocity !== null && series[i].blended_velocity !== undefined) {
      return series[i];
    }
  }
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].avg_monthly_advancement_days !== null) {
      return series[i];
    }
  }
  return series[series.length - 1] ?? null;
}

/** Build a comparison summary across categories for a given country */
export function buildCategorySummary(
  data: CategoryMovementMetric[],
  country: string,
  chart: string = "DFF"
): Array<{
  category: string;
  blendedVelocity: number | null;
  netVelocity: number | null;
  avgAdvancement: number | null;
  medianAdvancement: number | null;
  volatility: number | null;
  retrogressions: number;
  prediction: string;
}> {
  return EB_CATEGORIES.map((cat) => {
    const latest = getLatestMovement(data, cat, country, chart);
    return {
      category: cat,
      blendedVelocity: latest?.blended_velocity ?? null,
      netVelocity: latest?.net_velocity ?? null,
      avgAdvancement: latest?.avg_monthly_advancement_days ?? null,
      medianAdvancement: latest?.median_advancement_days ?? null,
      volatility: latest?.volatility_score ?? null,
      retrogressions: latest?.retrogression_events_12m ?? 0,
      prediction: latest?.next_movement_prediction ?? "Unknown",
    };
  });
}

/** Get unique countries in the dataset */
export function getAvailableCountries(
  data: CategoryMovementMetric[]
): string[] {
  const set = new Set(data.map((r) => r.country));
  // Sort with IND/CHN/ROW first
  const priority = ["IND", "CHN", "ROW"];
  return [...priority.filter((c) => set.has(c)), ...Array.from(set).filter((c) => !priority.includes(c)).sort()];
}
