/**
 * Data loaders and helpers for the Processing Speed dashboard.
 *
 * Consumes:
 *   - processing_times_trends.json (35 rows, I-485 quarterly)
 *   - fact_uscis_approvals.json (1,036 rows, form-level)
 * Source: P2 make_processing_times_trends.py, build_fact_uscis_approvals.py
 */

import { loadDashboardData } from "./loader";
import type { ProcessingTimesTrend, FactUscisApproval } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

export async function loadProcessingTrends(): Promise<ProcessingTimesTrend[]> {
  return loadDashboardData<ProcessingTimesTrend>("processing", "processing_times_trends");
}

export async function loadUscisApprovals(): Promise<FactUscisApproval[]> {
  return loadDashboardData<FactUscisApproval>("processing", "fact_uscis_approvals");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sort processing trends chronologically */
export function sortProcessingTrends(
  data: ProcessingTimesTrend[]
): ProcessingTimesTrend[] {
  return [...data].sort(
    (a, b) => a.fiscal_year * 10 + a.quarter - (b.fiscal_year * 10 + b.quarter)
  );
}

/** Get latest processing data point */
export function getLatestProcessing(
  data: ProcessingTimesTrend[]
): ProcessingTimesTrend | null {
  const sorted = sortProcessingTrends(data);
  return sorted[sorted.length - 1] ?? null;
}

/** Compute summary KPIs from processing data */
export function computeProcessingKpis(data: ProcessingTimesTrend[]): {
  latestApprovalRate: number | null;
  latestPending: number | null;
  latestBacklogMonths: number | null;
  avgThroughput: number | null;
  latestPeriod: string;
  totalQuarters: number;
} {
  const sorted = sortProcessingTrends(data);
  const latest = sorted[sorted.length - 1];
  const validThroughput = sorted.filter(
    (r) => r.throughput !== null && r.throughput !== undefined
  );
  return {
    latestApprovalRate: latest?.approval_rate ?? null,
    latestPending: latest?.eb_pending ?? null,
    latestBacklogMonths: latest?.backlog_months ?? null,
    avgThroughput:
      validThroughput.length > 0
        ? validThroughput.reduce((s, r) => s + (r.throughput ?? 0), 0) /
          validThroughput.length
        : null,
    latestPeriod: latest?.reporting_period ?? "",
    totalQuarters: sorted.length,
  };
}

/** Aggregate USCIS approvals by form type */
export function aggregateByForm(
  data: FactUscisApproval[]
): Array<{
  form: string;
  totalApprovals: number;
  totalDenials: number;
  approvalRate: number;
  fyMin: string;
  fyMax: string;
  fyCount: number;
}> {
  const groups = new Map<
    string,
    { approvals: number; denials: number; years: Set<string> }
  >();

  for (const r of data) {
    const existing = groups.get(r.form);
    if (existing) {
      existing.approvals += r.approvals;
      existing.denials += r.denials;
      existing.years.add(r.fiscal_year);
    } else {
      groups.set(r.form, {
        approvals: r.approvals,
        denials: r.denials,
        years: new Set([r.fiscal_year]),
      });
    }
  }

  return Array.from(groups.entries())
    .map(([form, g]) => {
      const sortedFy = [...g.years]
        .filter((fy) => fy !== "FY_UNKNOWN")
        .sort();
      return {
        form,
        totalApprovals: g.approvals,
        totalDenials: g.denials,
        approvalRate:
          g.approvals + g.denials > 0
            ? g.approvals / (g.approvals + g.denials)
            : 0,
        fyMin: sortedFy[0] ?? "—",
        fyMax: sortedFy[sortedFy.length - 1] ?? "—",
        fyCount: g.years.size,
      };
    })
    .sort((a, b) => b.totalApprovals - a.totalApprovals);
}
