/**
 * Priority Date Cortex Dashboard
 *
 * Interactive timeline explorer for EB visa cutoff forecasts.
 * Users select category + country + priority date via reactive pill selectors
 * (no submit button). Chart always shows both DFF + FAD projections.
 * Optimistic/Realistic toggle controls velocity assumption for predictions.
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
import { FadeIn } from "@/components/ui";
import { PriorityDateChart } from "@/components/pdi/priority-date-chart";
import {
  loadPdForecasts,
  loadCutoffTrends,
  getForecastSeries,
  getHistoricalSeries,
  computePdi,
  extrapolateForChart,
  COUNTRY_LABELS,
} from "@/lib/data/pdi";
import type { PdForecast } from "@/types/p2-artifacts";
import type { PdiResult, CutoffTrendRecord } from "@/lib/data/pdi";

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

/** Velocity multiplier for realistic mode (65% of data-driven velocity) */
const REALISTIC_VELOCITY_MULTIPLIER = 0.65;

/** Easing for all animations */
const EASE = [0.25, 0.1, 0.25, 1] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VisaBulletinPage() {
  // Data
  const [forecasts, setForecasts] = useState<PdForecast[]>([]);
  const [trends, setTrends] = useState<CutoffTrendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User selections — reactive, no submit
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [priorityDate, setPriorityDate] = useState("");
  const [showExtended, setShowExtended] = useState(false);
  const [isOptimistic, setIsOptimistic] = useState(true);

  // Current velocity multiplier based on toggle
  const velocityMultiplier = isOptimistic ? 1.0 : REALISTIC_VELOCITY_MULTIPLIER;

  // Load forecasts + historical trends on mount
  useEffect(() => {
    Promise.all([loadPdForecasts(), loadCutoffTrends()])
      .then(([fc, tr]) => {
        setForecasts(fc);
        setTrends(tr);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load data")
      )
      .finally(() => setLoading(false));
  }, []);

  // Compute DFF + FAD series for selected category/country
  const dffSeries = useMemo(
    () => getForecastSeries(forecasts, "DFF", category, country),
    [forecasts, category, country]
  );
  const fadSeries = useMemo(
    () => getForecastSeries(forecasts, "FAD", category, country),
    [forecasts, category, country]
  );

  // Compute predictions (only when PD is entered)
  const dffPdi = useMemo<PdiResult | null>(() => {
    if (!priorityDate || dffSeries.length === 0) return null;
    return computePdi(
      forecasts, "DFF", category, country, priorityDate, velocityMultiplier
    );
  }, [forecasts, category, country, priorityDate, dffSeries.length, velocityMultiplier]);

  const fadPdi = useMemo<PdiResult | null>(() => {
    if (!priorityDate || fadSeries.length === 0) return null;
    return computePdi(
      forecasts, "FAD", category, country, priorityDate, velocityMultiplier
    );
  }, [forecasts, category, country, priorityDate, fadSeries.length, velocityMultiplier]);

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
            <div className="relative max-w-[200px]">
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
            <p className="mt-1 text-xs text-[var(--muted-foreground)]/60">
              Try a different category or country combination
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
              isOptimistic={isOptimistic}
              onToggle={() => setIsOptimistic(!isOptimistic)}
            />
          </div>
        </FadeIn>
      )}

      {/* Prediction Cards */}
      {hasData && (
        <div className="grid gap-3 sm:grid-cols-2">
          <PredictionCard
            type="dff"
            label="Date for Filing"
            sublabel="File I-485 (Adjustment of Status)"
            pdi={dffPdi}
            velocity={velocityStats.dff}
            hasPriorityDate={!!priorityDate}
            isOptimistic={isOptimistic}
            delay={0.15}
          />
          <PredictionCard
            type="fad"
            label="Final Action"
            sublabel="Green Card Approval"
            pdi={fadPdi}
            velocity={velocityStats.fad}
            hasPriorityDate={!!priorityDate}
            isOptimistic={isOptimistic}
            delay={0.2}
          />
        </div>
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

      {/* Methodology — collapsible */}
      <FadeIn delay={0.3}>
        <details className="group rounded-2xl border border-white/[0.06] bg-white/[0.01] text-xs text-[var(--muted-foreground)]">
          <summary className="cursor-pointer select-none list-none p-4 flex items-center justify-between gap-2 font-semibold text-[var(--foreground)] text-sm hover:text-blue-400 transition-colors [&::-webkit-details-marker]:hidden">
            How It Works
            <svg className="w-4 h-4 shrink-0 text-[var(--muted-foreground)]/60 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <div className="px-4 pb-4 space-y-2">
            <p>
              The <strong>Priority Date Cortex</strong> forecasts EB visa cutoff
              date movement using historical Visa Bulletin data (Oct
              2015&ndash;present). Two projected timelines are always shown:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Date for Filing (DFF)</strong> &mdash; When you can submit
                Form I-485 (Adjustment of Status). Typically advances faster.
              </li>
              <li>
                <strong>Final Action Date (FAD)</strong> &mdash; When your green
                card is actually approved. Typically lags behind DFF.
              </li>
            </ul>
            <p className="text-[10px] text-[var(--muted-foreground)]/60 pt-1">
              Source: DOS Visa Bulletin (FY2015&ndash;FY2025) &middot; P2 Meridian
              forecast model
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
  isOptimistic: boolean;
  delay: number;
}

function PredictionCard({
  type,
  label,
  sublabel,
  pdi,
  hasPriorityDate,
  isOptimistic,
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
            isOptimistic
              ? "bg-blue-500/10 text-blue-400"
              : "bg-amber-500/10 text-amber-400"
          )}
        >
          {isOptimistic ? "Optimistic" : "Realistic"}
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
          <div className="py-3 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">
              No forecast data available
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
