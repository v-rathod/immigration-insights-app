/**
 * Approval & Denial Trends Dashboard
 *
 * 7-section interactive dashboard with KPI cards, combo chart,
 * administration overlay, YoY velocity, cross-track comparison,
 * personalized risk window, and 19-year approval heatmap.
 *
 * Route: /dashboard/approvals
 */
import type { Metadata } from "next";
import { ApprovalDenialDashboard } from "@/components/approvals";

export const metadata: Metadata = {
  title: "Approval & Denial Trends | NorthStar Compass",
  description:
    "PERM labor certification approval rates, cross-track comparisons (USCIS, NIV), administration-era analysis, and 19-year trend heatmaps.",
};

export default function ApprovalsDashboardPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Page header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span>Dashboards</span>
            <span>/</span>
            <span className="text-[var(--foreground)]">Approval & Denial Trends</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Approval & Denial Trends
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
            Track PERM labor certification outcomes across 19 fiscal years.
            Compare approval rates across immigration tracks, see how
            administrations correlate with outcomes, and find where your
            filing sits in the historical approval climate.
          </p>
        </div>

        {/* Main dashboard — all 7 sections */}
        <ApprovalDenialDashboard />
      </div>
    </main>
  );
}
