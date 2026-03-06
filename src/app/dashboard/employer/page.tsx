/**
 * SRS Dashboard — Sponsor Reliability Score
 *
 * Interactive dashboard letting users search 70K+ employers and view
 * their SRS (approval rates, wage competitiveness, risk signals, trends).
 *
 * Route: /dashboard/employer/
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Building2, Shield } from "lucide-react";
import { FadeIn } from "@/components/ui";
import {
  EmployerSearch,
  SrsScoreGauge,
  EmployerDetailCard,
  SrsTrendChart,
  SrsOverview,
} from "@/components/srs";
import {
  loadSrsScores,
  loadSrsScoresML,
  loadEmployerMonthlyMetrics,
  loadEmployerRiskFeatures,
  filterOverallScores,
  getEmployerMetrics,
  getEmployerRisk,
  computeSrsStats,
} from "@/lib/data/srs";
import type {
  SponsorReliabilityScore,
  SponsorReliabilityScoreML,
  EmployerMonthlyMetric,
  EmployerRiskFeature,
} from "@/types/p2-artifacts";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SrsDashboardPage() {
  // Data state
  const [scores, setScores] = useState<SponsorReliabilityScore[]>([]);
  const [overallScores, setOverallScores] = useState<SponsorReliabilityScore[]>([]);
  const [mlScores, setMlScores] = useState<SponsorReliabilityScoreML[]>([]);
  const [monthlyMetrics, setMonthlyMetrics] = useState<EmployerMonthlyMetric[]>([]);
  const [riskFeatures, setRiskFeatures] = useState<EmployerRiskFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedEmployer, setSelectedEmployer] = useState<
    (SponsorReliabilityScore & { srs_ml?: number }) | null
  >(null);
  const [selectedMetrics, setSelectedMetrics] = useState<EmployerMonthlyMetric[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<EmployerRiskFeature | undefined>();

  // Load data on mount
  useEffect(() => {
    async function load() {
      try {
        const [scoresData, mlData, metricsData, risksData] = await Promise.all([
          loadSrsScores(),
          loadSrsScoresML(),
          loadEmployerMonthlyMetrics(),
          loadEmployerRiskFeatures(),
        ]);

        setScores(scoresData);
        setOverallScores(filterOverallScores(scoresData));
        setMlScores(mlData);
        setMonthlyMetrics(metricsData);
        setRiskFeatures(risksData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load SRS data"
        );
      } finally {
        setLoading(false);
        analytics.dashboardViewed("employer");
      }
    }
    load();
  }, []);

  // Handle employer selection
  const handleSelect = useCallback(
    (employer: SponsorReliabilityScore) => {
      // Merge ML score if available
      const mlMatch = mlScores.find(
        (m) => m.employer_id === employer.employer_id
      );
      const merged = {
        ...employer,
        srs_ml: mlMatch?.srs_ml,
      };

      setSelectedEmployer(merged);
      setSelectedMetrics(
        getEmployerMetrics(monthlyMetrics, employer.employer_id)
      );
      setSelectedRisk(
        getEmployerRisk(riskFeatures, employer.employer_id)
      );
      analytics.employerSelected({
        tier: employer.srs_tier ?? "Unrated",
        score: employer.srs ?? null,
        hasMLScore: !!mlMatch?.srs_ml,
      });
    },
    [mlScores, monthlyMetrics, riskFeatures]
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="h-8 w-8 rounded-full border-2 border-t-transparent border-[var(--accent-blue)]"
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
          <p className="text-sm text-rose-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = computeSrsStats(scores, riskFeatures);

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <FadeIn>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400">
            <Shield className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Sponsor Reliability Score
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Evaluate any employer&apos;s immigration sponsorship track record
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Overview Stats */}
      <SrsOverview stats={stats} />

      {/* Search Section — z-10 ensures the autocomplete dropdown stacks above
           the employer detail section below (sibling motion.div stacking contexts
           default to DOM order; explicit z-index wins). */}
      <FadeIn delay={0.2} className="relative z-10">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2
              className="h-4 w-4 text-[var(--accent-blue)]"
              strokeWidth={1.5}
            />
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Search Employers
            </h2>
          </div>
          <EmployerSearch
            employers={overallScores}
            onSelect={handleSelect}
            selectedId={selectedEmployer?.employer_id}
          />
        </div>
      </FadeIn>

      {/* Selected Employer Detail */}
      {selectedEmployer && (
        <motion.div
          key={selectedEmployer.employer_id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Employer Name Banner */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <h2 className="text-xl font-bold text-[var(--foreground)]">
              {selectedEmployer.employer_name}
            </h2>
            <div className="flex items-center gap-2">
              {selectedEmployer.srs_ml != null && (
                <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                  ML Verified
                </span>
              )}
              <span className="text-xs text-[var(--muted-foreground)]">
                {selectedEmployer.n_36m} cases in 36 months
              </span>
            </div>
          </div>

          {/* Score + Details Grid */}
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* Score Gauge */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-6">
              <SrsScoreGauge
                score={selectedEmployer.srs ?? null}
                tier={selectedEmployer.srs_tier}
                subscores={{
                  outcome: selectedEmployer.outcome_subscore,
                  wage: selectedEmployer.wage_subscore,
                  sustainability: selectedEmployer.sustainability_subscore,
                }}
                mlScore={selectedEmployer.srs_ml}
              />
            </div>

            {/* Detail Card */}
            <EmployerDetailCard
              employer={selectedEmployer}
              risk={selectedRisk}
              mlScore={selectedEmployer.srs_ml}
            />
          </div>

          {/* Trend Chart */}
          <SrsTrendChart
            metrics={selectedMetrics}
            employerName={selectedEmployer.employer_name}
          />
        </motion.div>
      )}

      {/* Empty state when no employer selected */}
      {!selectedEmployer && (
        <FadeIn delay={0.3}>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
            <Building2 className="h-12 w-12 text-white/10 mb-4" strokeWidth={1} />
            <p className="text-sm text-[var(--muted-foreground)]">
              Search for an employer above to see their Sponsor Reliability Score
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]/60">
              70,000+ employers with green card sponsorship history
            </p>
          </div>
        </FadeIn>
      )}

      {/* Methodology — collapsible */}
      <FadeIn delay={0.4}>
        <details className="group rounded-2xl border border-white/[0.06] bg-white/[0.01] text-xs text-[var(--muted-foreground)]">
          <summary className="cursor-pointer select-none list-none p-4 flex items-center justify-between gap-2 font-semibold text-[var(--foreground)] text-sm hover:text-blue-400 transition-colors [&::-webkit-details-marker]:hidden">
            Methodology
            <svg className="w-4 h-4 shrink-0 text-[var(--muted-foreground)]/60 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <div className="px-4 pb-4 space-y-2">
            <p>
              The <strong>Sponsor Reliability Score (SRS)</strong> evaluates employers based on
              their green card sponsorship history. Scores range from 0–100 with three
              sub-components:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Approval Outcomes (50%):</strong> Bayesian-adjusted approval rate
                accounting for case volume and national baseline
              </li>
              <li>
                <strong>Wage Competitiveness (30%):</strong> Offered wage vs. national median
                wage for matched job categories
              </li>
              <li>
                <strong>Sustainability (20%):</strong> Consistency over time: months
                active, job category breadth, site diversity, trend stability
              </li>
            </ul>
            <p className="pt-1">
              Employers with 10+ cases in 36 months also receive an
              <strong> ML-verified score</strong> from a machine learning classifier trained on
              1.67M green card application outcomes.
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)]/60 pt-2">
              Source: Dept. of Labor employer filings (FY2015–2025) · Bureau of Labor Statistics
            </p>
          </div>
        </details>
      </FadeIn>
    </div>
  );
}
