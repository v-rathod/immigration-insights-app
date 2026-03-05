/**
 * Data loaders and helpers for the SOC Demand (Occupation Demand) dashboard.
 *
 * Consumes: soc_demand_metrics.json (4,241 rows)
 * Source: P2 make_soc_demand_metrics.py
 */

/** BLS standard major occupation group names (2-digit SOC prefix → readable label) */
export const BLS_MAJOR_GROUPS: Record<string, string> = {
  "11": "Management",
  "13": "Business & Financial Operations",
  "15": "Computer & Mathematical",
  "17": "Architecture & Engineering",
  "19": "Life, Physical & Social Science",
  "21": "Community & Social Service",
  "23": "Legal",
  "25": "Educational Instruction & Library",
  "27": "Arts, Design & Entertainment",
  "29": "Healthcare Practitioners & Technical",
  "31": "Healthcare Support",
  "33": "Protective Service",
  "35": "Food Preparation & Serving",
  "37": "Building & Grounds Maintenance",
  "39": "Personal Care & Service",
  "41": "Sales & Related",
  "43": "Office & Administrative Support",
  "45": "Farming, Fishing & Forestry",
  "47": "Construction & Extraction",
  "49": "Installation, Maintenance & Repair",
  "51": "Production",
  "53": "Transportation & Material Moving",
  "55": "Military Specific",
};

import { loadDashboardData } from "./loader";
import { loadDimension } from "./loader";
import type { SocDemandMetric, DimSoc } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

export async function loadSocDemand(): Promise<SocDemandMetric[]> {
  return loadDashboardData<SocDemandMetric>("soc-demand", "soc_demand_metrics");
}

export async function loadDimSoc(): Promise<DimSoc[]> {
  return loadDimension<DimSoc>("dim_soc");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichedSocDemand extends SocDemandMetric {
  soc_title: string;
  soc_major: string;
  top_employers: Array<{ employer_id: string; filings: number }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Enrich SOC demand data with titles.
 * P2 now embeds soc_title + soc_major_title directly in soc_demand_metrics;
 * socDim is kept as a fallback for any stale JSON without embedded titles.
 */
export function enrichWithTitles(
  demand: SocDemandMetric[],
  socDim: DimSoc[]
): EnrichedSocDemand[] {
  // Build fallback map from dim_soc (used only when embedded title is absent)
  const socMap = new Map(socDim.map((s) => [s.soc_code, s]));
  return demand.map((r) => {
    const majorCode = r.soc_code.substring(0, 2);
    let topEmployers: Array<{ employer_id: string; filings: number }> = [];
    try {
      topEmployers = JSON.parse(r.top_employers_json || "[]");
    } catch {
      /* ignore parse errors */
    }
    // Prefer embedded title (added by P2), then dim_soc fallback, then code itself
    const dim = socMap.get(r.soc_code);
    const resolvedTitle = r.soc_title || dim?.soc_title || r.soc_code;
    const resolvedMajor =
      r.soc_major_title ||
      dim?.soc_major_title ||
      BLS_MAJOR_GROUPS[majorCode] ||
      "";
    return {
      ...r,
      soc_title: resolvedTitle,
      soc_major: resolvedMajor,
      top_employers: topEmployers,
    };
  });
}

/** Filter by window and dataset */
export function filterDemand(
  data: EnrichedSocDemand[],
  window: string = "12m",
  dataset: string = "PERM"
): EnrichedSocDemand[] {
  return data
    .filter((r) => r.window === window && r.dataset === dataset)
    .sort((a, b) => b.filings_count - a.filings_count);
}

/** Get top N occupations by filings */
export function getTopOccupations(
  data: EnrichedSocDemand[],
  window: string = "12m",
  dataset: string = "PERM",
  n: number = 20
): EnrichedSocDemand[] {
  return filterDemand(data, window, dataset).slice(0, n);
}

/** Get unique windows */
export function getAvailableWindows(data: SocDemandMetric[]): string[] {
  return Array.from(new Set(data.map((r) => r.window))).sort();
}

/** Get unique datasets */
export function getAvailableDatasetsForDemand(data: SocDemandMetric[]): string[] {
  return Array.from(new Set(data.map((r) => r.dataset))).sort();
}

/** Build major-group summary (2-digit SOC) */
export function getMajorGroupSummary(
  data: EnrichedSocDemand[],
  window: string = "12m",
  dataset: string = "PERM"
): Array<{
  majorCode: string;
  majorTitle: string;
  totalFilings: number;
  avgApprovalRate: number;
  avgWage: number;
  occupationCount: number;
}> {
  const filtered = filterDemand(data, window, dataset);
  const groups = new Map<string, {
    majorTitle: string;
    filings: number;
    approvals: number;
    totalApprovalRate: number;
    totalWage: number;
    count: number;
  }>();

  for (const r of filtered) {
    const majorCode = r.soc_code.substring(0, 2);
    const existing = groups.get(majorCode);
    if (existing) {
      existing.filings += r.filings_count;
      existing.approvals += r.approvals_count;
      existing.totalApprovalRate += r.approval_rate * r.filings_count;
      existing.totalWage += r.offered_median * r.filings_count;
      existing.count++;
    } else {
      groups.set(majorCode, {
          majorTitle: BLS_MAJOR_GROUPS[majorCode] ?? (r.soc_major || `Group ${majorCode}`),
        filings: r.filings_count,
        approvals: r.approvals_count,
        totalApprovalRate: r.approval_rate * r.filings_count,
        totalWage: r.offered_median * r.filings_count,
        count: 1,
      });
    }
  }

  return Array.from(groups.entries())
    .map(([majorCode, g]) => ({
      majorCode,
      majorTitle: g.majorTitle,
      totalFilings: g.filings,
      avgApprovalRate: g.filings > 0 ? g.totalApprovalRate / g.filings : 0,
      avgWage: g.filings > 0 ? g.totalWage / g.filings : 0,
      occupationCount: g.count,
    }))
    .sort((a, b) => b.totalFilings - a.totalFilings);
}
