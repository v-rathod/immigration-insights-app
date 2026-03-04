/**
 * Backlog Visualization Dashboard
 *
 * Queue position estimates, years-to-clear projections by category,
 * backlog trends, and personal queue depth lookup.
 *
 * Route: /dashboard/backlog/
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, BarChart, Bar, Cell,
} from "recharts";
import { Users, Clock, AlertTriangle, TrendingUp, Target, Calendar } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui";
import { GlassCard } from "@/components/ui";
import {
  loadBacklogEstimates,
  loadQueueDepth,
  filterBacklog,
  buildBacklogSummary,
  filterQueueDepth,
  getQueuePosition,
  getQueueDimensions,
  BACKLOG_CATEGORIES,
  BACKLOG_COUNTRIES,
  COUNTRY_LABELS,
} from "@/lib/data/backlog";
import type { BacklogEstimate, QueueDepthEstimate } from "@/types/p2-artifacts";
import { formatNumber, formatWaitTime } from "@/lib/utils/format";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  EB1: "#3b82f6",
  EB2: "#8b5cf6",
  EB3: "#10b981",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BacklogDashboardPage() {
  const [backlog, setBacklog] = useState<BacklogEstimate[]>([]);
  const [queueDepth, setQueueDepth] = useState<QueueDepthEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("IND");
  const [selectedChart, setSelectedChart] = useState("DFF");
  const [pdInput, setPdInput] = useState("");
  const [pdCategory, setPdCategory] = useState("EB2");

  useEffect(() => {
    Promise.all([loadBacklogEstimates(), loadQueueDepth()])
      .then(([b, q]) => {
        setBacklog(b);
        setQueueDepth(q);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load data")
      )
      .finally(() => {
        setLoading(false);
        analytics.dashboardViewed("backlog");
      });
  }, []);

  const summary = useMemo(
    () => buildBacklogSummary(backlog, selectedCountry, selectedChart),
    [backlog, selectedCountry, selectedChart]
  );

  // Build time-series for years-to-clear
  const backlogChartData = useMemo(() => {
    if (!backlog.length) return [];
    const seriesMap = new Map<string, BacklogEstimate[]>();
    for (const cat of BACKLOG_CATEGORIES) {
      seriesMap.set(
        cat,
        filterBacklog(backlog, cat, selectedCountry, selectedChart)
      );
    }
    const timeline = new Map<string, Record<string, number | null | string>>();
    for (const [cat, series] of seriesMap) {
      for (const r of series) {
        const key = `${r.bulletin_year}-${String(r.bulletin_month).padStart(2, "0")}`;
        const existing = timeline.get(key) ?? { date: key };
        const months = r.backlog_months_to_clear_est;
        existing[cat] = months !== null ? Math.round((months / 12) * 10) / 10 : null;
        timeline.set(key, existing);
      }
    }
    return Array.from(timeline.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  }, [backlog, selectedCountry, selectedChart]);

  // Queue depth lookup
  const queueResult = useMemo(() => {
    if (!pdInput) return null;
    return getQueuePosition(queueDepth, pdCategory, selectedCountry, pdInput);
  }, [queueDepth, pdCategory, selectedCountry, pdInput]);

  const queueDims = useMemo(() => getQueueDimensions(queueDepth), [queueDepth]);

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-center py-32">
          <div className="animate-spin h-8 w-8 border-2 border-fuchsia-500 border-t-transparent rounded-full" />
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
            <span className="text-[var(--foreground)]">Backlog Visualization</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-fuchsia-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
            Backlog Visualization
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
            Explore immigration backlog estimates and queue depth projections.
            See years-to-clear by category, look up your estimated position,
            and understand how the backlog evolves over time.
          </p>
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Country:</span>
            <div className="flex gap-1">
              {BACKLOG_COUNTRIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCountry(c)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                    selectedCountry === c
                      ? "bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/40"
                      : "bg-white/5 text-[var(--muted-foreground)] hover:bg-white/10"
                  }`}
                >
                  {COUNTRY_LABELS[c] ?? c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Chart:</span>
            <div className="flex gap-1">
              {["DFF", "FAD"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setSelectedChart(ch)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                    selectedChart === ch
                      ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40"
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
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[s.category] }}
                  />
                  <span className="font-semibold text-[var(--foreground)]">
                    {s.category}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[var(--muted-foreground)]">Years to Clear</p>
                    <p className="text-2xl font-bold font-mono text-[var(--foreground)]">
                      {s.backlogYears !== null ? s.backlogYears : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)]">Months</p>
                    <p className="text-2xl font-bold font-mono text-[var(--foreground)]">
                      {s.backlogMonths !== null
                        ? formatNumber(s.backlogMonths, 0)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)]">12m Inflow Est.</p>
                    <p className="font-mono text-sm text-[var(--foreground)]">
                      {s.inflow12m !== null ? formatNumber(s.inflow12m) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)]">Advancement</p>
                    <p className="font-mono text-sm text-[var(--foreground)]">
                      {s.advancementDays !== null
                        ? `${formatNumber(s.advancementDays, 1)} d/mo`
                        : "—"}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Years-to-Clear Trend Chart */}
        <FadeIn>
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-fuchsia-400" />
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Years to Clear Backlog
              </h2>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mb-5">
              Estimated years to clear the priority date backlog over time —
              {" "}{COUNTRY_LABELS[selectedCountry] ?? selectedCountry},{" "}
              {selectedChart === "DFF" ? "Dates for Filing" : "Final Action Dates"}.
              Spikes indicate major retrogression or slowdown events.
            </p>

            {backlogChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart
                  data={backlogChartData}
                  margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                >
                  <defs>
                    {BACKLOG_CATEGORIES.map((cat) => (
                      <linearGradient
                        key={cat}
                        id={`bl-gradient-${cat}`}
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
                      value: "Years",
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
                      typeof value === "number" ? `${value} years` : "—",
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={36} />
                  {BACKLOG_CATEGORIES.map((cat) => (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stroke={CATEGORY_COLORS[cat]}
                      fill={`url(#bl-gradient-${cat})`}
                      strokeWidth={2}
                      connectNulls
                      dot={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-[var(--muted-foreground)] py-16">
                No backlog data available for this selection.
              </p>
            )}
          </GlassCard>
        </FadeIn>

        {/* Queue Depth Lookup */}
        <FadeIn>
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Queue Position Lookup
              </h2>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mb-5">
              Enter your priority date to estimate your position in the queue.
              Based on certified PERM filings and visa availability.
            </p>

            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--muted-foreground)]">
                  Category:
                </label>
                <div className="flex gap-1">
                  {queueDims.categories
                    .filter((c) => BACKLOG_CATEGORIES.includes(c as typeof BACKLOG_CATEGORIES[number]))
                    .map((c) => (
                      <button
                        key={c}
                        onClick={() => setPdCategory(c)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                          pdCategory === c
                            ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40"
                            : "bg-white/5 text-[var(--muted-foreground)] hover:bg-white/10"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)] mr-2">
                  Priority Date:
                </label>
                <input
                  type="date"
                  value={pdInput}
                  onChange={(e) => setPdInput(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                />
              </div>
            </div>

            {queueResult ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">
                    Est. Wait
                  </p>
                  <p className="text-lg font-bold font-mono text-[var(--foreground)]">
                    {queueResult.est_wait_years !== null
                      ? `${formatNumber(queueResult.est_wait_years, 1)} yr`
                      : "—"}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">
                    Applications Ahead
                  </p>
                  <p className="text-lg font-bold font-mono text-[var(--foreground)]">
                    {formatNumber(queueResult.cumulative_ahead)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">
                    Annual Allocation
                  </p>
                  <p className="text-lg font-bold font-mono text-[var(--foreground)]">
                    {formatNumber(queueResult.annual_visa_allocation)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">
                    Confidence
                  </p>
                  <p className="text-lg font-bold font-mono text-[var(--foreground)] capitalize">
                    {queueResult.confidence}
                  </p>
                </div>
              </div>
            ) : pdInput ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
                No queue data available for {pdCategory} / {selectedCountry} with
                PD {pdInput}.
              </p>
            ) : (
              <div className="rounded-xl border border-dashed border-purple-500/[0.15] py-6 text-center">
                <Calendar className="h-5 w-5 text-purple-400/70 mx-auto mb-2" />
                <p className="text-sm text-[var(--muted-foreground)]">
                  Enter your priority date to see your estimated queue position
                </p>
              </div>
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
                  Backlog estimates are computed from Visa Bulletin cutoff date
                  trends, using a <strong>blended velocity</strong> that combines
                  full-history net advancement (50%), capped 24-month rolling
                  average (25%), and capped 12-month rolling average (25%).
                  This smooths out short-term spillover spikes while staying
                  responsive to recent trends.
                </p>
                <p>
                  <strong>Years to Clear:</strong> Estimated time to clear the
                  current backlog based on the blended advancement velocity.
                  Capped at 50 years (600 months).
                </p>
                <p>
                  <strong>Queue Depth:</strong> Estimates the number of
                  applicants with priority dates ahead of a given date, using
                  certified PERM filings as a proxy. Confidence levels reflect
                  data density.
                </p>
                <p>
                  <strong>Limitations:</strong> PERM filings underestimate
                  true demand (EB1 often skips PERM). Dependents are estimated
                  using a 1.5× multiplier. Queue depth assumes FIFO processing.
                </p>
                <p className="pt-2 border-t border-white/[0.06]">
                  Sources: DOS Visa Bulletin history, DOL PERM data, USCIS visa
                  allocation ceilings. Processed by P2 Meridian
                  (make_backlog_estimates.py, queue_depth_estimates).{" "}
                  {formatNumber(backlog.length)} backlog estimates,{" "}
                  {formatNumber(queueDepth.length)} queue depth estimates.
                </p>
              </div>
            </details>
          </GlassCard>
        </FadeIn>
      </div>
    </main>
  );
}
