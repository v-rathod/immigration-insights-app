/**
 * PdiQuickLook — Interactive PDI widget for the homepage.
 *
 * Lets users select Category + Country and instantly see:
 * - Projected cutoff advancement over 24 months
 * - Average velocity (days/month)
 * - A mini sparkline of the forecast
 *
 * Loads pd_forecasts.json (342KB) on mount.
 */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Calendar, TrendingUp, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMonthYear } from "@/lib/utils/format";
import {
  loadPdForecasts,
  getForecastSeries,
  COUNTRY_LABELS,
  CHART_LABELS,
} from "@/lib/data/pdi";
import type { PdForecast } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORY = "EB2";
const DEFAULT_COUNTRY = "IND";
const DEFAULT_CHART = "DFF";

// Categories shown in the quick-look (most common EB categories)
const QUICK_CATEGORIES = ["EB1", "EB2", "EB3"] as const;
// Countries shown in the quick-look (most common chargeability areas)
const QUICK_COUNTRIES = ["IND", "CHN", "ROW", "PHL", "MEX"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdiQuickLook({ className }: { className?: string }) {
  const [forecasts, setForecasts] = useState<PdForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [chart, setChart] = useState(DEFAULT_CHART);

  // Load forecasts on mount
  useEffect(() => {
    loadPdForecasts()
      .then(setForecasts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Get current series
  const series = useMemo(
    () => getForecastSeries(forecasts, chart, category, country),
    [forecasts, chart, category, country]
  );

  // Compute derived stats
  const stats = useMemo(() => {
    if (series.length === 0) return null;

    const velocities = series.map((f) => f.velocity_days_per_month);
    const avgVelocity =
      velocities.reduce((a, b) => a + b, 0) / velocities.length;

    const first = series[0];
    const last = series[series.length - 1];
    const totalAdvancementDays = last.cumulative_advancement_days;

    return {
      avgVelocity: Math.round(avgVelocity * 10) / 10,
      totalAdvancementDays: Math.round(totalAdvancementDays),
      firstCutoff: first.projected_cutoff_date,
      lastCutoff: last.projected_cutoff_date,
      firstMonth: first.forecast_month,
      lastMonth: last.forecast_month,
      monthsCount: series.length,
    };
  }, [series]);

  const handleCategoryChange = useCallback((cat: string) => {
    setCategory(cat);
  }, []);

  const handleCountryChange = useCallback((c: string) => {
    setCountry(c);
  }, []);

  // Sparkline rendering
  const sparklinePath = useMemo(() => {
    if (series.length === 0) return "";

    // Map cumulative_advancement_days to y-coordinates
    const values = series.map((f) => f.cumulative_advancement_days);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values, 0);
    const range = maxVal - minVal || 1;

    const width = 200;
    const height = 48;
    const padding = 2;

    const points = values.map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (width - 2 * padding);
      const y =
        height - padding - ((v - minVal) / range) * (height - 2 * padding);
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  }, [series]);

  if (loading) {
    return (
      <div className={cn("animate-pulse rounded-2xl bg-white/[0.03] h-[320px]", className)} />
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="p-5 pb-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
            <Calendar className="h-3.5 w-3.5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Priority Date Cortex
            </h3>
            <p className="text-[10px] text-[var(--muted-foreground)] font-mono uppercase tracking-wider">
              PDI
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)] leading-relaxed">
          24-month cutoff advancement forecast. When will your priority date
          become current?
        </p>
      </div>

      {/* Selectors */}
      <div className="px-5 pt-4 space-y-3">
        {/* Category pills */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5 block">
            Category
          </label>
          <div className="flex gap-1.5">
            {QUICK_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                  category === cat
                    ? "bg-[var(--accent-blue)] text-white shadow-sm shadow-blue-500/25"
                    : "bg-white/[0.05] text-[var(--muted-foreground)] hover:bg-white/[0.08] hover:text-[var(--foreground)]"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Country pills */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5 block">
            Country
          </label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_COUNTRIES.map((c) => (
              <button
                key={c}
                onClick={() => handleCountryChange(c)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                  country === c
                    ? "bg-[var(--accent-purple)] text-white shadow-sm shadow-purple-500/25"
                    : "bg-white/[0.05] text-[var(--muted-foreground)] hover:bg-white/[0.08] hover:text-[var(--foreground)]"
                )}
              >
                {COUNTRY_LABELS[c] ?? c}
              </button>
            ))}
          </div>
        </div>

        {/* Chart type toggle */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            Chart
          </label>
          <div className="flex rounded-lg bg-white/[0.04] p-0.5">
            {(["DFF", "FAD"] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChart(ch)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[10px] font-medium transition-all duration-200",
                  chart === ch
                    ? "bg-white/[0.1] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {CHART_LABELS[ch]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {stats && (
        <div className="px-5 pt-4 pb-2">
          {/* Mini sparkline */}
          <div className="mb-3 rounded-xl bg-white/[0.02] p-3">
            <svg
              viewBox="0 0 200 48"
              className="w-full h-12"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="pdi-spark-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {sparklinePath && (
                <>
                  {/* Area fill */}
                  <path
                    d={`${sparklinePath} L 198,48 L 2,48 Z`}
                    fill="url(#pdi-spark-grad)"
                  />
                  {/* Line */}
                  <motion.path
                    d={sparklinePath}
                    fill="none"
                    stroke="var(--accent-blue)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
                  />
                </>
              )}
            </svg>
            <div className="flex justify-between text-[9px] text-[var(--muted-foreground)] mt-1 font-mono">
              <span>{stats.firstMonth}</span>
              <span>{stats.lastMonth}</span>
            </div>
          </div>

          {/* Key stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] text-[var(--muted-foreground)] mb-0.5">Velocity</div>
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-400" strokeWidth={2} />
                <span className="text-sm font-semibold font-mono text-[var(--foreground)]">
                  {stats.avgVelocity}
                </span>
              </div>
              <div className="text-[9px] text-[var(--muted-foreground)]">days/mo</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--muted-foreground)] mb-0.5">Advancement</div>
              <div className="text-sm font-semibold font-mono text-[var(--foreground)]">
                {stats.totalAdvancementDays}
              </div>
              <div className="text-[9px] text-[var(--muted-foreground)]">days in 24mo</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--muted-foreground)] mb-0.5">Cutoff by</div>
              <div className="text-sm font-semibold font-mono text-[var(--foreground)]">
                {formatMonthYear(stats.lastCutoff)}
              </div>
              <div className="text-[9px] text-[var(--muted-foreground)]">{stats.lastMonth}</div>
            </div>
          </div>
        </div>
      )}

      {/* No data fallback */}
      {!stats && !loading && (
        <div className="px-5 py-6 text-center">
          <Clock className="h-8 w-8 text-white/10 mx-auto mb-2" strokeWidth={1} />
          <p className="text-xs text-[var(--muted-foreground)]">
            No forecast data for this combination
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="p-4 pt-3">
        <Link
          href="/dashboard/visa-bulletin/"
          className="group flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] py-2.5 text-xs font-medium text-[var(--muted-foreground)] transition-all duration-200 hover:bg-white/[0.08] hover:text-[var(--foreground)]"
        >
          <span>Full forecast & analysis</span>
          <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
