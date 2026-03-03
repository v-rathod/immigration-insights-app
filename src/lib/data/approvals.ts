/**
 * Data loaders and helpers for the Approval/Denial Trends dashboard.
 *
 * Consumes 4 P2 Meridian JSON artifacts:
 *   - approval_denial_trends.json       (40 rows, multi-source)
 *   - approval_denial_summary.json      (10-year PERM KPI)
 *   - approval_denial_by_category.json  (3 rows, cross-track)
 *   - perm_trends_detailed.json         (19-year PERM + YoY)
 */

import { loadDashboardData } from "./loader";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Single year row from approval_denial_trends.json */
export interface ApprovalTrendRow {
  fiscal_year: number;
  APPROVED: number;
  DENIED: number;
  total_cases: number;
  approval_rate_pct: number;
  denial_rate_pct: number;
  data_source: string;     // "PERM_Labor_Certification" | "USCIS_Forms" | "Visa_Applications"
  visa_category: string;   // "Employment_Based_EB" | "USCIS_Adjustment" | "Non_Immigrant_Visa"
}

/** Single year in summary yearly_breakdown */
export interface SummaryYearRow {
  fiscal_year: number;
  APPROVED: number;
  DENIED: number;
  total_cases: number;
  approval_rate_pct: number;
  denial_rate_pct: number;
}

/** Top-level summary object */
export interface ApprovalSummary {
  period: string;
  data_source: string;
  total_cases: number;
  total_approved: number;
  total_denied: number;
  avg_approval_rate: number;
  min_approval_rate: number;
  max_approval_rate: number;
  trend: "increasing" | "decreasing";
  yearly_breakdown: SummaryYearRow[];
}

/** Cross-track (PERM vs USCIS vs NIV) row */
export interface CategoryRow {
  data_source: string;
  visa_category: string;
  total_cases: number;
  approved: number;
  denied: number;
  approval_rate_pct: number;
  denial_rate_pct: number;
}

/** Single data point in perm_trends_detailed.json */
export interface PermDetailPoint {
  fiscal_year: number;
  approved: number;
  denied: number;
  total: number;
  approval_rate: number;
  denial_rate: number;
  yoy_total_change_pct?: number;
  yoy_approval_rate_change?: number;
}

/** Wrapper for perm_trends_detailed.json */
export interface PermTrendsDetailed {
  title: string;
  subtitle: string;
  source: string;
  fiscal_years: string;
  last_fiscal_year: number;
  data_points: PermDetailPoint[];
}

// ---------------------------------------------------------------------------
// Administration bands for policy overlay
// ---------------------------------------------------------------------------

export interface AdminBand {
  label: string;
  start: number; // inclusive FY
  end: number;   // inclusive FY
  color: string;
}

export const ADMIN_BANDS: AdminBand[] = [
  { label: "Obama",   start: 2009, end: 2016, color: "rgba(59,130,246,0.08)" },
  { label: "Trump I", start: 2017, end: 2020, color: "rgba(244,63,94,0.08)" },
  { label: "Biden",   start: 2021, end: 2024, color: "rgba(16,185,129,0.08)" },
  { label: "Trump II",start: 2025, end: 2028, color: "rgba(245,158,11,0.08)" },
];

// ---------------------------------------------------------------------------
// Data loaders
// ---------------------------------------------------------------------------

const DASH = "approvals";

/** Load all trends (40 rows, multi-source) */
export async function loadApprovalTrends(): Promise<ApprovalTrendRow[]> {
  return loadDashboardData<ApprovalTrendRow>(DASH, "approval_denial_trends");
}

/** Load 10-year PERM summary */
export async function loadApprovalSummary(): Promise<ApprovalSummary> {
  const res = await fetch(`/data/dashboards/${DASH}/approval_denial_summary.json`);
  if (!res.ok) throw new Error(`Failed to load approval summary (${res.status})`);
  const raw = await res.text();
  const sanitized = raw.replace(/\bNaN\b|-?\bInfinity\b/g, "null");
  return JSON.parse(sanitized) as ApprovalSummary;
}

/** Load cross-track comparison (3 rows) */
export async function loadCategoryComparison(): Promise<CategoryRow[]> {
  return loadDashboardData<CategoryRow>(DASH, "approval_denial_by_category");
}

/** Load 19-year PERM detailed with YoY */
export async function loadPermDetailed(): Promise<PermTrendsDetailed> {
  const res = await fetch(`/data/dashboards/${DASH}/perm_trends_detailed.json`);
  if (!res.ok) throw new Error(`Failed to load PERM detailed (${res.status})`);
  const raw = await res.text();
  const sanitized = raw.replace(/\bNaN\b|-?\bInfinity\b/g, "null");
  return JSON.parse(sanitized) as PermTrendsDetailed;
}

// ---------------------------------------------------------------------------
// Computed helpers
// ---------------------------------------------------------------------------

/** Filter trends to PERM only, sorted by fiscal year */
export function getPermTrends(rows: ApprovalTrendRow[]): ApprovalTrendRow[] {
  return rows
    .filter((r) => r.data_source === "PERM_Labor_Certification")
    .sort((a, b) => a.fiscal_year - b.fiscal_year);
}

/** Get admin band for a given fiscal year */
export function getAdminBand(fy: number): AdminBand | undefined {
  return ADMIN_BANDS.find((b) => fy >= b.start && fy <= b.end);
}

/** Compute average approval rate for an admin band across trend data */
export function getAdminAvg(band: AdminBand, data: PermDetailPoint[]): number | null {
  const years = data.filter((d) => d.fiscal_year >= band.start && d.fiscal_year <= band.end);
  if (years.length === 0) return null;
  const sum = years.reduce((acc, d) => acc + d.approval_rate, 0);
  return sum / years.length;
}

/** Source display label mapping */
export function sourceLabel(source: string): string {
  switch (source) {
    case "PERM_Labor_Certification": return "PERM";
    case "USCIS_Forms": return "USCIS";
    case "Visa_Applications": return "Visa Apps";
    default: return source;
  }
}

/** Human-readable category label */
export function categoryLabel(cat: string): string {
  switch (cat) {
    case "Employment_Based_EB": return "Employment-Based (EB)";
    case "USCIS_Adjustment": return "USCIS Petitions (I-140/I-485)";
    case "Non_Immigrant_Visa": return "Non-Immigrant Visas (NIV)";
    default: return cat;
  }
}

/** Check if a fiscal year is partial (< 50K cases typically) */
export function isPartialYear(fy: number, total: number): boolean {
  return fy >= new Date().getFullYear() && total < 50000;
}
