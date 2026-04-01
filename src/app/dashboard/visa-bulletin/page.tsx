/**
 * Priority Date Cortex Dashboard
 *
 * Interactive timeline explorer for EB visa cutoff forecasts.
 * Users select category + country + priority date via reactive pill selectors
 * (no submit button). Chart always shows both DFF + FAD projections.
 * Optimistic/Risk-Adjusted toggle controls velocity assumption for predictions.
 *
 * Route: /dashboard/visa-bulletin/
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  TrendingUp,
  Target,
  Clock,
  Zap,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMonthYear } from "@/lib/utils/format";
import { secureGet, secureSet } from "@/lib/security";
import { FadeIn } from "@/components/ui";
import { PriorityDateChart } from "@/components/pdi/priority-date-chart";
import type { ForecastMode } from "@/components/pdi/priority-date-chart";
import {
  loadPdForecasts,
  loadPdForecastsRetrograde,
  loadCutoffTrends,
  getForecastSeries,
  getRetrogradeSeries,
  getRetrogradeRiskSummary,
  getHistoricalSeries,
  computePdi,
  extrapolateForChart,
  COUNTRY_LABELS,
} from "@/lib/data/pdi";
import type { PdForecast, PdForecastRetrograde } from "@/types/p2-artifacts";
import type { PdiResult, CutoffTrendRecord } from "@/lib/data/pdi";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Primary EB categories (shown prominently) */
const PRIMARY_CATEGORIES = ["EB1", "EB2", "EB3"] as const;
/** Extended categories (shown in secondary row) */
const EXTENDED_CATEGORIES = ["EB3-Other", "EB4", "EB5"] as const;
/** Countries displayed as pill selectors */
const DISPLAY_COUNTRIES = ["IND", "CHN", "ROW", "PHL", "MEX"] as const;

const DEFAULT_CATEGORY = "EB2";
const DEFAULT_COUNTRY = "IND";

/** Easing for all animations */
const EASE = [0.25, 0.1, 0.25, 1] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VisaBulletinPage() {
  // Load saved values from localStorage or use defaults
  const [category, setCategory] = useState(() => {
    try {
      const saved = secureGet<{ category?: string }>("session_pdi_filters");
      return saved?.category || DEFAULT_CATEGORY;
    } catch {
      return DEFAULT_CATEGORY;
    }
  });
  const [country, setCountry] = useState(() => {
    try {
      const saved = secureGet<{ country?: string }>("session_pdi_filters");
      return saved?.country || DEFAULT_COUNTRY;
    } catch {
      return DEFAULT_COUNTRY;
    }
  });
  const [priorityDate, setPriorityDate] = useState(() => {
    try {
      const saved = secureGet<{ priorityDate?: string }>("session_pdi_filters");
      return saved?.priorityDate || "";
    } catch {
      return "";
    }
  });

  // Data
  const [forecasts, setForecasts] = useState<PdForecast[]>([]);
  const [retrogradeForecasts, setRetrogradeForecasts] = useState<PdForecastRetrograde[]>([]);
  const [trends, setTrends] = useState<CutoffTrendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Save category to localStorage whenever it changes
  useEffect(() => {
    try {
      const current = secureGet<{ category?: string; country?: string; priorityDate?: string }>("session_pdi_filters") || {};
      secureSet("session_pdi_filters", { ...current, category });
      analytics.filterChanged({ dashboard: "visa-bulletin", filter: "category", value: category });
    } catch {}
  }, [category]);

  // Save country to localStorage whenever it changes
  useEffect(() => {
    try {
      const current = secureGet<{ category?: string; country?: string; priorityDate?: string }>("session_pdi_filters") || {};
      secureSet("session_pdi_filters", { ...current, country });
      analytics.filterChanged({ dashboard: "visa-bulletin", filter: "country", value: country });
    } catch {}
  }, [country]);

  // Save priorityDate to localStorage whenever it changes
  useEffect(() => {
    try {
      const current = secureGet<{ category?: string; country?: string; priorityDate?: string }>("session_pdi_filters") || {};
      secureSet("session_pdi_filters", { ...current, priorityDate });
      if (priorityDate) {
        analytics.priorityDateEntered({ category, country });
      }
    } catch {}
  }, [priorityDate, category, country]);

  // Extended charts and forecast mode state
  const [showExtended, setShowExtended] = useState(false);
  const [forecastMode, setForecastMode] = useState<ForecastMode>("optimistic");

  // Velocity multiplier: Optimistic 1.0; MCRA uses its own velocity data
  const velocityMultiplier = 1.0;

  // For MCRA mode, use retrograde forecasts; otherwise use base
  const activeForecastSource = forecastMode === "mcra" ? retrogradeForecasts : forecasts;

  // Load forecasts (base + MCRA) + historical trends on mount
  useEffect(() => {
    Promise.all([loadPdForecasts(), loadPdForecastsRetrograde(), loadCutoffTrends()])
      .then(([fc, mcra, tr]) => {
        setForecasts(fc);
        setRetrogradeForecasts(mcra);
        setTrends(tr);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load data")
      )
      .finally(() => {
        setLoading(false);
        analytics.dashboardViewed("visa-bulletin");
      });
  }, []);

  // Compute DFF + FAD series for selected category/country using active source
  const dffSeries = useMemo(
    () => getForecastSeries(activeForecastSource, "DFF", category, country),
    [activeForecastSource, category, country]
  );
  const fadSeries = useMemo(
    () => getForecastSeries(activeForecastSource, "FAD", category, country),
    [activeForecastSource, category, country]
  );

  // Retrograde risk summary (for MCRA mode info card)
  const retroRisk = useMemo(() => {
    if (retrogradeForecasts.length === 0) return null;
    return {
      dff: getRetrogradeRiskSummary(retrogradeForecasts, "DFF", category, country),
      fad: getRetrogradeRiskSummary(retrogradeForecasts, "FAD", category, country),
    };
  }, [retrogradeForecasts, category, country]);

  // Compute predictions (only when PD is entered)
  const dffPdi = useMemo<PdiResult | null>(() => {
    if (!priorityDate || dffSeries.length === 0) return null;
    return computePdi(
      activeForecastSource, "DFF", category, country, priorityDate, velocityMultiplier
    );
  }, [activeForecastSource, category, country, priorityDate, dffSeries.length, velocityMultiplier]);

  const fadPdi = useMemo<PdiResult | null>(() => {
    if (!priorityDate || fadSeries.length === 0) return null;
    return computePdi(
      activeForecastSource, "FAD", category, country, priorityDate, velocityMultiplier
    );
  }, [activeForecastSource, category, country, priorityDate, fadSeries.length, velocityMultiplier]);

  // Extrapolation for chart extension (when PD is beyond model window)
  const dffExtrapolation = useMemo(() => {
    if (!priorityDate || dffSeries.length === 0) return [];
    const pdTs = new Date(priorityDate).getTime();
    if (isNaN(pdTs)) return [];
    return extrapolateForChart(dffSeries, pdTs, 120, velocityMultiplier);
  }, [priorityDate, dffSeries, velocityMultiplier]);

  const fadExtrapolation = useMemo(() => {
    if (!priorityDate || fadSeries.length === 0) return [];
    const pdTs = new Date(priorityDate).getTime();
    if (isNaN(pdTs)) return [];
    return extrapolateForChart(fadSeries, pdTs, 120, velocityMultiplier);
  }, [priorityDate, fadSeries, velocityMultiplier]);

  // Velocity stats (always computed, no PD needed; scales with toggle)
  const velocityStats = useMemo(() => {
    const compute = (series: PdForecast[]) => {
      if (series.length === 0) return null;
      const vels = series.map((f) => f.velocity_days_per_month);
      const rawAvg = vels.reduce((a, b) => a + b, 0) / vels.length;
      return {
        avg: Math.round(rawAvg * velocityMultiplier * 10) / 10,
        max: Math.round(Math.max(...vels) * velocityMultiplier * 10) / 10,
        total: Math.round(
          series[series.length - 1].cumulative_advancement_days * velocityMultiplier
        ),
      };
    };
    return { dff: compute(dffSeries), fad: compute(fadSeries) };
  }, [dffSeries, fadSeries, velocityMultiplier]);

  // Historical cutoff trend series
  const dffTrends = useMemo(
    () => getHistoricalSeries(trends, "DFF", category, country),
    [trends, category, country]
  );
  const fadTrends = useMemo(
    () => getHistoricalSeries(trends, "FAD", category, country),
    [trends, category, country]
  );

  // Has data for selected combo?
  const hasData = dffSeries.length > 0 || fadSeries.length > 0;
  const hasHistoricalData = dffTrends.length > 0 || fadTrends.length > 0;

  // Loading spinner
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

  return (
    <div className="space-y-4 pb-12">
      {/* Page Header */}
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shrink-0">
            <Calendar className="h-4.5 w-4.5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
              Priority Date Cortex
            </h1>
            <p className="text-xs text-[var(--muted-foreground)]">
              When will your priority date become current?
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Compact Config Strip */}
      <FadeIn delay={0.05}>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-4 space-y-3">
          {/* Row 1: Category + Country inline */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            {/* Category */}
            <div className="flex-1 min-w-0">
              <label className="text-[9px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5 block">
                Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRIMARY_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                      category === cat
                        ? "bg-[var(--accent-blue)] text-white shadow-lg shadow-blue-500/25"
                        : "bg-white/[0.05] text-[var(--muted-foreground)] hover:bg-white/[0.1] hover:text-[var(--foreground)]"
                    )}
                  >
                    {cat}
                  </button>
                ))}
                <button
                  onClick={() => setShowExtended(!showExtended)}
                  className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-[var(--muted-foreground)] bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-200 border border-white/[0.06]"
                >
                  {showExtended ? "Less" : "More"}
                </button>
                <AnimatePresence>
                  {showExtended &&
                    EXTENDED_CATEGORIES.map((cat) => (
                      <motion.button
                        key={cat}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setCategory(cat)}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                          category === cat
                            ? "bg-[var(--accent-blue)] text-white shadow-lg shadow-blue-500/25"
                            : "bg-white/[0.05] text-[var(--muted-foreground)] hover:bg-white/[0.1] hover:text-[var(--foreground)]"
                        )}
                      >
                        {cat}
                      </motion.button>
                    ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-12 bg-white/[0.06] self-center" />

            {/* Country */}
            <div className="flex-1 min-w-0">
              <label className="text-[9px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1.5 block">
                Country
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DISPLAY_COUNTRIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCountry(c)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                      country === c
                        ? "bg-[var(--accent-purple)] text-white shadow-lg shadow-purple-500/25"
                        : "bg-white/[0.05] text-[var(--muted-foreground)] hover:bg-white/[0.1] hover:text-[var(--foreground)]"
                    )}
                  >
                    {COUNTRY_LABELS[c] ?? c}
                  </button>
                ))}
                <button
                  onClick={() =>
                    setCountry("EL SALVADOR GUATEMALA HONDURAS")
                  }
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                    country === "EL SALVADOR GUATEMALA HONDURAS"
                      ? "bg-[var(--accent-purple)] text-white shadow-lg shadow-purple-500/25"
                      : "bg-white/[0.05] text-[var(--muted-foreground)] hover:bg-white/[0.1] hover:text-[var(--foreground)]"
                  )}
                >
                  {COUNTRY_LABELS["EL SALVADOR GUATEMALA HONDURAS"]}
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Priority Date input */}
          <div className="flex items-center gap-3 pt-1 border-t border-white/[0.04]">
            <label className="text-[9px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] shrink-0">
              Your PD
            </label>
            <div className="relative w-full sm:max-w-[200px]">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--accent-blue)]" />
              <input
                type="date"
                value={priorityDate}
                onChange={(e) => setPriorityDate(e.target.value)}
                max="2026-03-01"
                min="2000-01-01"
                className={cn(
                  "w-full rounded-lg border bg-white/[0.05] pl-8 pr-3 py-1.5",
                  "text-xs font-mono text-[var(--foreground)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/50 focus:border-[var(--accent-blue)]/30",
                  "transition-all duration-200",
                  priorityDate
                    ? "border-[var(--accent-blue)]/30"
                    : "border-white/[0.08]",
                  "[&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                )}
              />
            </div>
            {!priorityDate && (
              <span className="text-[10px] text-[var(--muted-foreground)]/50 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Enter PD for predictions
              </span>
            )}
          </div>
        </div>
      </FadeIn>

      {/* No Data State */}
      {!hasData && !hasHistoricalData && (
        <FadeIn delay={0.1}>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] py-12 text-center">
            <Clock
              className="h-10 w-10 text-white/10 mb-3"
              strokeWidth={1}
            />
            <p className="text-sm text-[var(--muted-foreground)]">
              No data for {category} /{" "}
              {COUNTRY_LABELS[country] ?? country}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]/60 max-w-sm mx-auto">
              This combination may not have separate visa bulletin tracking. Some categories are &quot;current&quot; for certain countries or have no historical cutoff dates published by USCIS.
            </p>
          </div>
        </FadeIn>
      )}

      {/* Unified Priority Date Movement Chart */}
      {(hasData || hasHistoricalData) && (
        <FadeIn delay={0.1}>
          <div>
            <PriorityDateChart
              dffTrends={dffTrends}
              fadTrends={fadTrends}
              dffForecast={dffSeries}
              fadForecast={fadSeries}
              dffExtrapolation={dffExtrapolation}
              fadExtrapolation={fadExtrapolation}
              priorityDate={priorityDate || undefined}
              forecastMode={forecastMode}
              onModeChange={(mode) => {
                setForecastMode(mode);
                analytics.filterChanged({ dashboard: "visa-bulletin", filter: "forecastMode", value: mode });
              }}
              showConfidenceBands={forecastMode === "mcra"}
            />
          </div>
        </FadeIn>
      )}

      {/* MCRA Retrograde Risk Summary — only in Risk-Adjusted mode */}
      {forecastMode === "mcra" && retroRisk && (retroRisk.dff.avgRetroProb > 0 || retroRisk.fad.avgRetroProb > 0) && (
        <FadeIn delay={0.12}>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] backdrop-blur-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400">
                <Zap className="h-3 w-3 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-xs font-semibold text-[var(--foreground)]">
                Monte Carlo Retrograde Risk
              </h3>
              <span className="ml-auto text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">
                MCRA v3
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-lg font-bold font-mono text-blue-400">{(retroRisk.dff.avgRetroProb * 100).toFixed(1)}%</div>
                <div className="text-[9px] text-[var(--muted-foreground)]">
                  DFF Retro Prob
                  <span className="block text-[8px] text-[var(--muted-foreground)]/50 mt-0.5">per month, avg over 24m</span>
                </div>
              </div>
              <div>
                <div className="text-lg font-bold font-mono text-blue-400">{retroRisk.dff.avgSetbackDays.toFixed(0)}d</div>
                <div className="text-[9px] text-[var(--muted-foreground)]">
                  DFF Avg Setback
                  <span className="block text-[8px] text-[var(--muted-foreground)]/50 mt-0.5">days lost if retro occurs</span>
                </div>
              </div>
              <div>
                <div className="text-lg font-bold font-mono text-amber-400">{(retroRisk.fad.avgRetroProb * 100).toFixed(1)}%</div>
                <div className="text-[9px] text-[var(--muted-foreground)]">
                  FAD Retro Prob
                  <span className="block text-[8px] text-[var(--muted-foreground)]/50 mt-0.5">per month, avg over 24m</span>
                </div>
              </div>
              <div>
                <div className="text-lg font-bold font-mono text-amber-400">{retroRisk.fad.avgSetbackDays.toFixed(0)}d</div>
                <div className="text-[9px] text-[var(--muted-foreground)]">
                  FAD Avg Setback
                  <span className="block text-[8px] text-[var(--muted-foreground)]/50 mt-0.5">days lost if retro occurs</span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[9px] text-[var(--muted-foreground)]/60">
              Retro Prob = chance of a backward move in any given month, averaged across the 24-month forecast window.
              Avg Setback = how many days the cutoff typically rolls back when a retrogression happens.
              Based on 2,000 Monte Carlo simulations calibrated against 10 years of Visa Bulletin history.
            </p>
          </div>
        </FadeIn>
      )}

      {/* Prediction Cards — only meaningful once a priority date is provided.
           Smart-visibility rule: never render a widget whose only output is
           "enter your data above". Show a CTA instead until input exists. */}
      {hasData && !priorityDate && (
        <FadeIn delay={0.15}>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-blue-500/[0.15] bg-blue-500/[0.02] py-8 text-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 mb-1">
              <Target className="h-5 w-5 text-blue-400/70" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Enter your priority date to see predictions
            </p>
            <p className="text-xs text-[var(--muted-foreground)]/70 max-w-xs">
              You&apos;ll see exactly when your Filing and Final Action dates are
              expected to become current
            </p>
          </div>
        </FadeIn>
      )}
      {hasData && !!priorityDate && (
        <AnimatePresence mode="wait">
          <motion.div
            key="prediction-cards"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <PredictionCard
              type="dff"
              label="Date for Filing"
              sublabel="File I-485 (Adjustment of Status)"
              pdi={dffPdi}
              velocity={velocityStats.dff}
              hasPriorityDate={!!priorityDate}
              forecastMode={forecastMode}
              delay={0}
            />
            <PredictionCard
              type="fad"
              label="Final Action"
              sublabel="Green Card Approval"
              pdi={fadPdi}
              velocity={velocityStats.fad}
              hasPriorityDate={!!priorityDate}
              forecastMode={forecastMode}
              delay={0.05}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Velocity Stats Strip */}
      {hasData && (
        <FadeIn delay={0.25}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat
              label="DFF Velocity"
              value={velocityStats.dff?.avg}
              unit="days/mo"
              icon={<Zap className="h-3.5 w-3.5" />}
              color="blue"
            />
            <MiniStat
              label="DFF Total Gain"
              value={velocityStats.dff?.total}
              unit="days"
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              color="blue"
            />
            <MiniStat
              label="FAD Velocity"
              value={velocityStats.fad?.avg}
              unit="days/mo"
              icon={<Zap className="h-3.5 w-3.5" />}
              color="amber"
            />
            <MiniStat
              label="FAD Total Gain"
              value={velocityStats.fad?.total}
              unit="days"
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              color="amber"
            />
          </div>
        </FadeIn>
      )}

      {/* Methodology + model context - open by default */}
      <FadeIn delay={0.3}>
        <details open className="group rounded-2xl border border-white/[0.06] bg-white/[0.01] text-xs text-[var(--muted-foreground)]">
          <summary className="cursor-pointer select-none list-none p-4 flex items-center justify-between gap-2 font-semibold text-[var(--foreground)] text-sm hover:text-blue-400 transition-colors [&::-webkit-details-marker]:hidden">
            How Compass Models Priority Date Movement
            <svg className="w-4 h-4 shrink-0 text-[var(--muted-foreground)]/60 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <div className="px-4 pb-4 space-y-3">
            <p>
              Compass ingests every Visa Bulletin since 2011 and builds per-category,
              per-country time series tracking how each EB1&ndash;EB5 cutoff moves month
              to month. From that base it computes movement velocity, detects retrogression
              patterns, and projects three 24-month forward trajectories:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Optimistic:</strong> Full observed velocity from a blended
                time-series model (50% full-history, 25% 24-month rolling, 25% 12-month
                rolling).
              </li>
              <li>
                <strong>Risk-Adjusted (MCRA):</strong> 2,000 Monte Carlo simulations
                where each month carries a calibrated retrograde probability from 10 years
                of weighted Visa Bulletin history. The P50 path is the central forecast;
                shaded bands show P10&ndash;P90.
              </li>
            </ul>
            <p>
              Two timelines are always shown:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Date for Filing (DFF):</strong> When you can submit Form I-485
                (Adjustment of Status). Typically advances faster than FAD.
              </li>
              <li>
                <strong>Final Action Date (FAD):</strong> When your green card is
                actually approved. Typically lags 1&ndash;3 years behind DFF.
              </li>
            </ul>
            <p>
              Coverage spans EB1, EB2, and EB3 across all chargeable countries.
              For EB2 India, historical velocity averages 15&ndash;25 days per month
              with periodic setbacks.
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)]/50 pt-1">
              Data: U.S. Department of State Visa Bulletin (travel.state.gov).
              NorthStar forecast models v2.1 (blended) and v3.0 (MCRA).
              Not affiliated with USCIS or the Department of State. Not legal advice.
            </p>
          </div>
        </details>
      </FadeIn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prediction Card Sub-Component
// ---------------------------------------------------------------------------

interface PredictionCardProps {
  type: "dff" | "fad";
  label: string;
  sublabel: string;
  pdi: PdiResult | null;
  velocity: { avg: number; max: number; total: number } | null;
  hasPriorityDate: boolean;
  forecastMode: ForecastMode;
  delay: number;
}

const PREDICTION_MODE_STYLE: Record<ForecastMode, { bg: string; text: string }> = {
  optimistic: { bg: "bg-blue-500/10", text: "text-blue-400" },
  mcra: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
};

const PREDICTION_MODE_LABEL: Record<ForecastMode, string> = {
  optimistic: "Optimistic",
  mcra: "Risk-Adjusted",
};

function PredictionCard({
  type,
  label,
  sublabel,
  pdi,
  hasPriorityDate,
  forecastMode,
  delay,
}: PredictionCardProps) {
  const isDFF = type === "dff";

  // Determine display state
  const alreadyCurrent = pdi?.found && pdi.monthsUntilCurrent === 0;
  const foundInWindow = pdi?.found && !alreadyCurrent && !pdi.extrapolated;
  const foundExtrapolated = pdi?.found && pdi.extrapolated;
  const notPredictable = pdi && !pdi.found;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay }}
      className={cn(
        "relative overflow-hidden rounded-xl border backdrop-blur-xl p-4",
        isDFF
          ? "border-blue-500/20 bg-blue-500/[0.04]"
          : "border-amber-500/20 bg-amber-500/[0.04]"
      )}
    >
      {/* Subtle corner glow */}
      <div
        className={cn(
          "absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-20 blur-2xl",
          isDFF ? "bg-blue-500" : "bg-amber-500"
        )}
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2 relative">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-lg",
            isDFF
              ? "bg-gradient-to-br from-blue-500 to-cyan-400"
              : "bg-gradient-to-br from-amber-500 to-orange-400"
          )}
        >
          {isDFF ? (
            <ArrowUpRight
              className="h-3 w-3 text-white"
              strokeWidth={2.5}
            />
          ) : (
            <Target className="h-3 w-3 text-white" strokeWidth={2.5} />
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)] leading-tight">
            {label}
          </h3>
          <p className="text-[9px] text-[var(--muted-foreground)]">
            {sublabel}
          </p>
        </div>
        {/* Mode badge */}
        <span
          className={cn(
            "ml-auto text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md",
            PREDICTION_MODE_STYLE[forecastMode].bg,
            PREDICTION_MODE_STYLE[forecastMode].text
          )}
        >
          {PREDICTION_MODE_LABEL[forecastMode]}
        </span>
      </div>

      {/* Content */}
      <div className="relative">
        {!hasPriorityDate ? (
          <div className="py-3 text-center">
            <Calendar
              className="h-7 w-7 mx-auto mb-1.5 text-white/10"
              strokeWidth={1}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Enter your priority date above
            </p>
          </div>
        ) : alreadyCurrent ? (
          <div className="py-1.5">
            <div className="text-xl font-bold text-emerald-400 mb-0.5">
              Current!
            </div>
            <p className="text-[10px] text-emerald-400/80">
              Your priority date is already current for {label}
            </p>
          </div>
        ) : foundInWindow ? (
          <div className="py-1.5 space-y-2">
            <div>
              <div
                className={cn(
                  "text-xl font-bold font-mono tracking-tight",
                  isDFF ? "text-blue-400" : "text-amber-400"
                )}
              >
                {formatMonthYear(pdi!.currentMonth!)}
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  {pdi!.monthsUntilCurrent} month
                  {pdi!.monthsUntilCurrent !== 1 ? "s" : ""} away
                </span>
                <span className="text-[9px] text-[var(--muted-foreground)]/50">
                  &middot; {pdi!.avgVelocity} days/mo
                </span>
              </div>
            </div>
            {pdi!.confidenceLow && pdi!.confidenceHigh && (
              <div className="text-[9px] text-[var(--muted-foreground)]/60">
                Confidence: {formatMonthYear(pdi!.confidenceLow)} &ndash;{" "}
                {formatMonthYear(pdi!.confidenceHigh)}
              </div>
            )}
          </div>
        ) : foundExtrapolated ? (
          <div className="py-1.5 space-y-2">
            <div>
              <span className="inline-block text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[var(--muted-foreground)] mb-1">
                Estimated
              </span>
              <div
                className={cn(
                  "text-xl font-bold font-mono tracking-tight",
                  isDFF ? "text-blue-400" : "text-amber-400"
                )}
              >
                {pdi!.currentMonth
                  ? formatMonthYear(pdi!.currentMonth!)
                  : `~${pdi!.monthsUntilCurrent} months`}
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  ~{pdi!.monthsUntilCurrent} months away
                </span>
                <span className="text-[9px] text-[var(--muted-foreground)]/50">
                  &middot; {pdi!.avgVelocity} days/mo
                </span>
              </div>
            </div>
            <p className="text-[9px] text-[var(--muted-foreground)]/50">
              Extrapolated beyond model forecast
            </p>
          </div>
        ) : notPredictable ? (
          <div className="py-1.5 space-y-1">
            <div className="text-base font-bold text-[var(--muted-foreground)]">
              Unable to estimate
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)]/60">
              Cutoff dates are not advancing for this category
            </p>
          </div>
        ) : (
          <div className="py-3 text-center space-y-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              No forecast data available
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)]/50">
              Forecasts require sufficient historical movement data for this category/country combination
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Mini Stat Sub-Component
// ---------------------------------------------------------------------------

interface MiniStatProps {
  label: string;
  value: number | null | undefined;
  unit: string;
  icon: React.ReactNode;
  color: "blue" | "amber";
}

function MiniStat({ label, value, unit, icon, color }: MiniStatProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={cn(
            color === "blue" ? "text-blue-400" : "text-amber-400"
          )}
        >
          {icon}
        </span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold font-mono text-[var(--foreground)]">
          {value != null ? value : "\u2014"}
        </span>
        <span className="text-[9px] text-[var(--muted-foreground)]">
          {unit}
        </span>
      </div>
    </div>
  );
}
