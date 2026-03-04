/**
 * Data loaders and helpers for the Backlog Visualization dashboard.
 *
 * Consumes:
 *   - backlog_estimates.json (8,060 rows)
 *   - queue_depth_estimates.json (2,382 rows)
 * Source: P2 make_backlog_estimates.py, queue_depth_estimates (features)
 */

import { loadDashboardData } from "./loader";
import type { BacklogEstimate, QueueDepthEstimate } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

export async function loadBacklogEstimates(): Promise<BacklogEstimate[]> {
  return loadDashboardData<BacklogEstimate>("backlog", "backlog_estimates");
}

export async function loadQueueDepth(): Promise<QueueDepthEstimate[]> {
  return loadDashboardData<QueueDepthEstimate>("backlog", "queue_depth_estimates");
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BACKLOG_CATEGORIES = ["EB1", "EB2", "EB3"] as const;
export const BACKLOG_COUNTRIES = ["IND", "CHN", "ROW"] as const;

export const COUNTRY_LABELS: Record<string, string> = {
  IND: "India",
  CHN: "China",
  ROW: "Rest of World",
};

// ---------------------------------------------------------------------------
// Backlog Helpers
// ---------------------------------------------------------------------------

/** Filter backlog estimates for a specific combo */
export function filterBacklog(
  data: BacklogEstimate[],
  category: string,
  country: string,
  chart: string = "DFF"
): BacklogEstimate[] {
  return data
    .filter(
      (r) => r.category === category && r.country === country && r.chart === chart
    )
    .sort(
      (a, b) =>
        a.bulletin_year * 100 + a.bulletin_month -
        (b.bulletin_year * 100 + b.bulletin_month)
    );
}

/** Get latest backlog estimate */
export function getLatestBacklog(
  data: BacklogEstimate[],
  category: string,
  country: string,
  chart: string = "DFF"
): BacklogEstimate | null {
  const series = filterBacklog(data, category, country, chart);
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].backlog_months_to_clear_est !== null) {
      return series[i];
    }
  }
  return series[series.length - 1] ?? null;
}

/** Build summary table across categories */
export function buildBacklogSummary(
  data: BacklogEstimate[],
  country: string,
  chart: string = "DFF"
): Array<{
  category: string;
  backlogMonths: number | null;
  backlogYears: number | null;
  inflow12m: number | null;
  advancementDays: number | null;
}> {
  return BACKLOG_CATEGORIES.map((cat) => {
    const latest = getLatestBacklog(data, cat, country, chart);
    const months = latest?.backlog_months_to_clear_est ?? null;
    return {
      category: cat,
      backlogMonths: months,
      backlogYears: months !== null ? Math.round((months / 12) * 10) / 10 : null,
      inflow12m: latest?.inflow_estimate_12m ?? null,
      advancementDays: latest?.blended_velocity ?? latest?.advancement_days_12m_avg ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Queue Depth Helpers
// ---------------------------------------------------------------------------

/** Filter queue depth for a category/country */
export function filterQueueDepth(
  data: QueueDepthEstimate[],
  category: string,
  country: string
): QueueDepthEstimate[] {
  return data
    .filter((r) => r.category === category && r.country === country)
    .sort((a, b) => a.pd_month.localeCompare(b.pd_month));
}

/** Get queue depth stats for  a specific priority date */
export function getQueuePosition(
  data: QueueDepthEstimate[],
  category: string,
  country: string,
  priorityDate: string
): QueueDepthEstimate | null {
  const filtered = filterQueueDepth(data, category, country);
  // Find closest pd_month ≤ priorityDate
  let best: QueueDepthEstimate | null = null;
  for (const r of filtered) {
    if (r.pd_month <= priorityDate) {
      best = r;
    }
  }
  return best;
}

/** Get available categories/countries in queue data */
export function getQueueDimensions(data: QueueDepthEstimate[]): {
  categories: string[];
  countries: string[];
} {
  return {
    categories: Array.from(new Set(data.map((r) => r.category))).sort(),
    countries: Array.from(new Set(data.map((r) => r.country))).sort(),
  };
}
