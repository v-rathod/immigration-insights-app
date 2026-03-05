/**
 * Data loaders and helpers for the Geographic Heatmaps dashboard.
 *
 * Consumes: worksite_geo_metrics.json (156,171 rows)
 * Source: P2 make_worksite_geo_metrics.py
 */

import { loadDashboardData } from "./loader";
import type { WorksiteGeoMetric } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

export async function loadGeoMetrics(): Promise<WorksiteGeoMetric[]> {
  return loadDashboardData<WorksiteGeoMetric>("geographic", "worksite_geo_metrics");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** State-level aggregate for map display */
export interface StateAggregate {
  state: string;
  filings: number;
  approvals: number;
  employers: number;
  medianWage: number | null;
  /** Real approval rate: approvals / filings. Always ≤ 1.0. */
  approvalRate: number | null;
  /** Wage vs OEWS market benchmark: offered_median ÷ OEWS median. Can exceed 1.0. */
  competitiveness: number | null;
  dataset: string;
}

/** 50 US states (excludes DC, territories, and Compact of Free Association nations) */
export const US_50_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

/** Get state-level aggregates for a given dataset */
export function getStateAggregates(
  data: WorksiteGeoMetric[],
  dataset: string = "PERM"
): StateAggregate[] {
  return data
    .filter((r) => r.grain === "state" && r.dataset === dataset)
    .map((r) => ({
      state: r.state,
      filings: r.filings_count,
      approvals: r.approvals_count,
      employers: r.distinct_employers,
      medianWage: r.offered_median,
      // Prefer the P2-computed approval_rate if present, otherwise derive from counts
      approvalRate: r.approval_rate != null
        ? r.approval_rate
        : r.filings_count > 0
          ? Math.min(1, r.approvals_count / r.filings_count)
          : null,
      competitiveness: r.competitiveness_ratio,
      dataset,
    }))
    .sort((a, b) => b.filings - a.filings);
}

/** Get top N states by filings */
export function getTopStates(
  data: WorksiteGeoMetric[],
  dataset: string = "PERM",
  n: number = 10
): StateAggregate[] {
  return getStateAggregates(data, dataset).slice(0, n);
}

/**
 * Display names for all jurisdictions in the data.
 * Non-state entries are labeled with their type to avoid presenting
 * them as equivalent to US states in the UI.
 */
export const STATE_NAMES: Record<string, string> = {
  // 50 US States
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming",
  // Federal District
  DC: "Washington, D.C. (Fed. District)",
  // US Territories
  PR: "Puerto Rico (Territory)",
  GU: "Guam (Territory)",
  VI: "U.S. Virgin Islands (Territory)",
  AS: "American Samoa (Territory)",
  MP: "N. Mariana Islands (Territory)",
  // Compact of Free Association nations (independent but use US immigration process)
  FM: "Micronesia (Compact)",
  MH: "Marshall Islands (Compact)",
  PW: "Palau (Compact)",
};

/** Get available datasets in the data */
export function getAvailableDatasets(data: WorksiteGeoMetric[]): string[] {
  return Array.from(new Set(data.filter((r) => r.grain === "state").map((r) => r.dataset))).sort();
}

/** Compute national aggregates */
export function getNationalSummary(
  data: WorksiteGeoMetric[],
  dataset: string = "PERM"
): {
  totalFilings: number;
  totalApprovals: number;
  totalEmployers: number;
  stateCount: number;
  territoryCount: number;
  avgApprovalRate: number;
  avgCompetitiveness: number;
} {
  const all = getStateAggregates(data, dataset);
  const states = all.filter((r) => US_50_STATE_CODES.has(r.state));
  const territories = all.filter((r) => !US_50_STATE_CODES.has(r.state));
  const totalFilings = all.reduce((s, r) => s + r.filings, 0);
  const totalApprovals = all.reduce((s, r) => s + r.approvals, 0);
  const totalEmployers = all.reduce((s, r) => s + r.employers, 0);
  const withRate = all.filter((r) => r.approvalRate !== null);
  const avgApprovalRate =
    withRate.length > 0
      ? withRate.reduce((s, r) => s + (r.approvalRate ?? 0), 0) / withRate.length
      : 0;
  const compRatios = all.filter((r) => r.competitiveness !== null);
  const avgCompetitiveness =
    compRatios.length > 0
      ? compRatios.reduce((s, r) => s + (r.competitiveness ?? 0), 0) / compRatios.length
      : 0;
  return {
    totalFilings, totalApprovals, totalEmployers,
    stateCount: states.length,
    territoryCount: territories.length,
    avgApprovalRate,
    avgCompetitiveness,
  };
}
