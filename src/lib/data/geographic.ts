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
  competitiveness: number | null;
  dataset: string;
}

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

/** State name mapping (abbrev → full name) */
export const STATE_NAMES: Record<string, string> = {
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
  WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
  PR: "Puerto Rico", GU: "Guam", VI: "Virgin Islands",
  AS: "American Samoa", MP: "Northern Mariana Islands",
  FM: "Micronesia", MH: "Marshall Islands", PW: "Palau",
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
  avgCompetitiveness: number;
} {
  const states = getStateAggregates(data, dataset);
  const totalFilings = states.reduce((s, r) => s + r.filings, 0);
  const totalApprovals = states.reduce((s, r) => s + r.approvals, 0);
  const totalEmployers = states.reduce((s, r) => s + r.employers, 0);
  const compRatios = states.filter((r) => r.competitiveness !== null);
  const avgCompetitiveness =
    compRatios.length > 0
      ? compRatios.reduce((s, r) => s + (r.competitiveness ?? 0), 0) / compRatios.length
      : 0;
  return { totalFilings, totalApprovals, totalEmployers, stateCount: states.length, avgCompetitiveness };
}
