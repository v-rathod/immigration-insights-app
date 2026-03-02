/**
 * Wage Competitiveness Dashboard
 *
 * Interactive wage intelligence hub for H-1B and PERM salary benchmarks.
 * Search by SOC code / job title; explore 10-year trends, percentile
 * distributions, top employers, and regional comparisons.
 *
 * Route: /dashboard/wage/
 */
import type { Metadata } from "next";
import { WageIntelligenceHub } from "@/components/wage/WageIntelligenceHub";

export const metadata: Metadata = {
  title: "Wage Competitiveness | NorthStar Compass",
  description:
    "H-1B and PERM salary benchmarks, 10-year wage trends, employer rankings, and regional comparisons powered by BLS OEWS data.",
};

export default function WageDashboardPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Page header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span>Dashboards</span>
            <span>/</span>
            <span className="text-[var(--foreground)]">Wage Competitiveness</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
            Wage Competitiveness
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
            See what employers actually pay — by role, by company, and by
            location. Compare your offer against market salary ranges, track
            10-year pay trends, and find which companies offer the most
            competitive compensation for sponsored workers.
          </p>
        </div>

        {/* Main hub — all interactivity lives here */}
        <WageIntelligenceHub />
      </div>
    </main>
  );
}
