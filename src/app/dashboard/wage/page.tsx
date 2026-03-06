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
  title: "Wage Competitiveness: H-1B & PERM Salary Data",
  description:
    "Research H-1B and PERM salary benchmarks by employer and job title. Compare 5-year wage growth trends, salary percentile bands (p10 to p90), and benchmark against BLS national medians for your occupation.",
  keywords: [
    "H-1B salary data",
    "PERM wage benchmark",
    "employer salary comparison",
    "H-1B wage by employer",
    "immigration salary percentile",
    "LCA wage disclosure",
    "software engineer H-1B salary",
    "data scientist immigration wage",
    "prevailing wage",
  ],
  openGraph: {
    title: "Wage Competitiveness: H-1B & PERM Salary Data | Compass",
    description:
      "Research H-1B and PERM salaries by employer and job title. 5-year trends, p10-p90 percentile bands, BLS benchmarks.",
    url: "https://d10immmzyp7xgr.cloudfront.net/dashboard/wage/",
  },
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
            See what employers actually pay by role, by company, and by
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
