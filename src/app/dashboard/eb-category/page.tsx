/**
 * EB Category Comparison Dashboard
 *
 * Compare EB1/EB2/EB3 movement patterns — velocity, volatility,
 * retrogression events, and predictions across countries.
 *
 * Route: /dashboard/eb-category/
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend, Cell,
} from "recharts";
import { TrendingUp, AlertTriangle, Activity, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui";
import { GlassCard } from "@/components/ui";
import {
  loadCategoryMovement,
  filterMovementSeries,
  buildCategorySummary,
  getAvailableCountries,
  COUNTRY_LABELS,
  EB_CATEGORIES,
} from "@/lib/data/eb-category";
import type { CategoryMovementMetric } from "@/types/p2-artifacts";
import { formatNumber } from "@/lib/utils/format";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  EB1: "#3b82f6",
  EB2: "#8b5cf6",
  EB3: "#10b981",
  "EB3-Other": "#f59e0b",
  EB4: "#f43f5e",
  EB5: "#6366f1",
};

const PREDICTION_ICONS: Record<string, React.ReactNode> = {
  Advancing: <ArrowUpRight className="h-4 w-4 text-emerald-400" />,
  Retreating: <ArrowDownRight className="h-4 w-4 text-rose-400" />,
  Flat: <Minus className="h-4 w-4 text-amber-400" />,
  Unknown: <Activity className="h-4 w-4 text-[var(--muted-foreground)]" />,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EbCategoryDashboardPage() {
  const [data, setData] = useState<CategoryMovementMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("IND");
  const [selectedChart, setSelectedChart] = useState("DFF");

  useEffect(() => {
    loadCategoryMovement()
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load data")
      )
      .finally(() => {
        setLoading(false);
        analytics.dashboardViewed("eb-category");
      });
  }, []);

  const countries = useMemo(() => getAvailableCountries(data), [data]);
  const summary = useMemo(
    () => buildCategorySummary(data, selectedCountry, selectedChart),
    [data, selectedCountry, selectedChart]
  );

  // Build time-series for the velocity comparison chart using 12m rolling avg
  // (avg_monthly_advancement_days). This shows current momentum per category,
  // not the full-history blended metric which is biased by historical catch-up.
  const velocityChartData = useMemo(() => {
    if (!data.length) return [];
    const seriesMap = new Map<string, CategoryMovementMetric[]>();
    for (const cat of EB_CATEGORIES) {
      seriesMap.set(cat, filterMovementSeries(data, cat, selectedCountry, selectedChart));
    }

    // Build merged timeline
    const timeline = new Map<string, Record<string, string | number | null>>();
    for (const [cat, series] of seriesMap) {
      for (const r of series) {
        const key = `${r.bulletin_year}-${String(r.bulletin_month).padStart(2, "0")}`;
        const existing = timeline.get(key) ?? { date: key };
        existing[cat] = r.avg_monthly_advancement_days ?? null;
        timeline.set(key, existing);
      }
    }
    return Array.from(timeline.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  }, [data, selectedCountry, selectedChart]);

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-center py-32">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <GlassCard className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
            <p className="text-[var(--muted-foreground)]">{error}</p>
          </GlassCard>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span>Dashboards</span>
            <span>/</span>
            <span className="text-[var(--foreground)]">EB Category Comparison</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            EB Category Comparison
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
            Compare priority date movement across EB categories. See which
            categories advance fastest, track volatility patterns, and
            understand retrogression risk for your chargeability country.
          </p>
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap gap-3">
          {/* Country pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Country:</span>
            <div className="flex gap-1">
              {countries.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCountry(c)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                    selectedCountry === c
                      ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40"
                      : "bg-white/5 text-[var(--muted-foreground)] hover:bg-white/10"
                  }`}
                >
                  {COUNTRY_LABELS[c] ?? c}
                </button>
              ))}
            </div>
          </div>
          {/* Chart type toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Chart:</span>
            <div className="flex gap-1">
              {["DFF", "FAD"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setSelectedChart(ch)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                    selectedChart === ch
                      ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40"
                      : "bg-white/5 text-[var(--muted-foreground)] hover:bg-white/10"
                  }`}
                >
                  {ch === "DFF" ? "Dates for Filing" : "Final Action"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summary.map((s) => (
            <StaggerItem key={s.category}>
              <GlassCard className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[s.category] }}
                    />
                    <span className="font-semibold text-[var(--foreground)]">
                      {s.category}
                    </span>
                  </div>
                  {PREDICTION_ICONS[s.prediction] ?? PREDICTION_ICONS.Unknown}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[var(--muted-foreground)]">Recent (12m avg)</p>
                    <p className="font-mono text-sm text-[var(--foreground)]">
                      {s.avgAdvancement !== null
                        ? `${formatNumber(s.avgAdvancement, 1)} days/mo`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)]">Blended Avg</p>
                    <p className="font-mono text-sm text-[var(--foreground)]">
                      {s.blendedVelocity !== null
                        ? `${formatNumber(s.blendedVelocity, 1)} days/mo`
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-1.5 pt-1 border-t border-white/[0.06]">
                  <span>Prediction:</span>
                  <span
                    className={
                      s.prediction === "Advancing"
                        ? "text-emerald-400"
                        : s.prediction === "Retreating"
                        ? "text-rose-400"
                        : "text-amber-400"
                    }
                  >
                    {s.prediction}
                  </span>
                </div>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Velocity Comparison Chart */}
        <FadeIn>
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Priority Date Velocity (12-Month Rolling Avg)
              </h2>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mb-5">
              Trailing 12-month average calendar days advanced per bulletin month per EB category.
              Reflects current momentum, not long-term averages.
              Country: {COUNTRY_LABELS[selectedCountry] ?? selectedCountry},{" "}
              {selectedChart === "DFF" ? "Dates for Filing" : "Final Action Dates"}
            </p>

            {velocityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart
                  data={velocityChartData}
                  margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                >
                  <defs>
                    {EB_CATEGORIES.map((cat) => (
                      <linearGradient
                        key={cat}
                        id={`gradient-${cat}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={CATEGORY_COLORS[cat]}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={CATEGORY_COLORS[cat]}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    interval="preserveStartEnd"
                    tickFormatter={(v: string) => {
                      const [y, m] = v.split("-");
                      return `${m}/${y.slice(2)}`;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    label={{
                      value: "days/mo",
                      angle: -90,
                      position: "insideLeft",
                      fill: "var(--muted-foreground)",
                      fontSize: 10,
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.85)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      fontSize: 12,
                    }}
                    formatter={(value: string | number) => [
                      typeof value === "number" ? `${formatNumber(value, 1)} days/mo` : "—",
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    verticalAlign="top"
                    height={36}
                  />
                  {EB_CATEGORIES.map((cat) => (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stroke={CATEGORY_COLORS[cat]}
                      fill={`url(#gradient-${cat})`}
                      strokeWidth={2}
                      connectNulls
                      dot={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-[var(--muted-foreground)] py-16">
                No velocity data available for this selection.
              </p>
            )}
          </GlassCard>
        </FadeIn>

        {/* Methodology */}
        <FadeIn>
          <GlassCard className="p-6">
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                Methodology & Data Sources
              </summary>
              <div className="mt-4 text-xs text-[var(--muted-foreground)] space-y-2">
                <p>
                  Category movement metrics are computed from the Visa Bulletin
                  historical cutoff dates using a blended velocity formula
                  consistent across all NorthStar artifacts.
                </p>
                <p>
                  <strong>Recent (12m avg):</strong> Trailing 12-month rolling
                  average of calendar days the cutoff date advanced per bulletin
                  month. This is the primary metric for comparing which category
                  is advancing faster right now.
                </p>
                <p>
                  <strong>Blended Avg:</strong> Weighted combination of
                  50% full-history net + 25% capped rolling-24m + 25% capped
                  rolling-12m velocity. Useful for long-range wait-time
                  estimation but can be skewed by historical catch-up patterns
                  (e.g., India EB3 had faster movement 2015–2020 closing a
                  larger backlog, which inflates its blended figure).
                </p>
                <p>
                  <strong>Prediction:</strong> Based on recent velocity trend
                  direction: Forward, Flat, or Backward.
                </p>
                <p className="pt-2 border-t border-white/[0.06]">
                  Source: Department of State Visa Bulletin, processed by P2
                  Meridian (make_category_movement_metrics.py). {formatNumber(data.length)} data points
                  across {new Set(data.map((r) => r.category)).size} categories
                  and {new Set(data.map((r) => r.country)).size} countries.
                </p>
              </div>
            </details>
          </GlassCard>
        </FadeIn>
      </div>
    </main>
  );
}
