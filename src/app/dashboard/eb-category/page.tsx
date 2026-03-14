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
  CartesianGrid, Legend,
} from "recharts";
import { TrendingUp, AlertTriangle, Activity, ArrowUpRight, ArrowDownRight, Minus, History } from "lucide-react";
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
// ---------------------------------------------------------------------------
// Helpers & Sub-components (module-level to satisfy react-hooks/static-components)
// ---------------------------------------------------------------------------

/**
 * Build a merged monthly time-series of avg_monthly_advancement_days
 * for EB1/EB2/EB3. If lastN is provided, only the most recent N bulletin
 * months are returned (default: full history).
 */
function buildVelocityTimeline(
  data: CategoryMovementMetric[],
  country: string,
  chartType: string,
  lastN?: number
): Record<string, string | number | null>[] {
  const timeline = new Map<string, Record<string, string | number | null>>();
  for (const cat of EB_CATEGORIES) {
    const series = filterMovementSeries(data, cat, country, chartType);
    for (const r of series) {
      const key = `${r.bulletin_year}-${String(r.bulletin_month).padStart(2, "0")}`;
      const existing = timeline.get(key) ?? { date: key };
      existing[cat] = r.avg_monthly_advancement_days ?? null;
      timeline.set(key, existing);
    }
  }
  const sorted = Array.from(timeline.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
  return lastN ? sorted.slice(-lastN) : sorted;
}

type SummaryData = ReturnType<typeof buildCategorySummary>;

function VelocityChart({
  chartData,
  idSuffix,
}: {
  chartData: Record<string, string | number | null>[];
  idSuffix: string;
}) {
  if (chartData.length === 0) {
    return (
      <p className="text-center text-[var(--muted-foreground)] py-12 text-xs">
        No data for this selection.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <defs>
          {EB_CATEGORIES.map((cat) => (
            <linearGradient key={cat} id={`grad-${idSuffix}-${cat}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CATEGORY_COLORS[cat]} stopOpacity={0.25} />
              <stop offset="95%" stopColor={CATEGORY_COLORS[cat]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
          interval="preserveStartEnd"
          tickFormatter={(v: string) => {
            const [y, m] = v.split("-");
            return `${m}/${y.slice(2)}`;
          }}
        />
        <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} width={36} />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(0,0,0,0.85)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            fontSize: 11,
          }}
          formatter={(value: string | number) => [
            typeof value === "number" ? `${formatNumber(value, 1)} d/mo` : "—",
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" height={28} />
        {EB_CATEGORIES.map((cat) => (
          <Area
            key={cat}
            type="monotone"
            dataKey={cat}
            stroke={CATEGORY_COLORS[cat]}
            fill={`url(#grad-${idSuffix}-${cat})`}
            strokeWidth={2}
            connectNulls
            dot={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SummaryRow({
  label,
  badge,
  summary,
}: {
  label: string;
  badge: string;
  summary: SummaryData;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          {label}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--muted-foreground)] border border-white/[0.08]">
          {badge}
        </span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summary.map((s) => (
          <StaggerItem key={s.category}>
            <GlassCard className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[s.category as keyof typeof CATEGORY_COLORS] ?? "#888" }}
                  />
                  <span className="font-semibold text-[var(--foreground)]">{s.category}</span>
                </div>
                {PREDICTION_ICONS[s.prediction as keyof typeof PREDICTION_ICONS] ?? PREDICTION_ICONS.Unknown}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[var(--muted-foreground)]">12m avg velocity</p>
                  <p className="font-mono text-sm text-[var(--foreground)]">
                    {s.avgAdvancement !== null ? `${formatNumber(s.avgAdvancement, 1)} d/mo` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--muted-foreground)]">Retrogressions (12m)</p>
                  <p className={`font-mono text-sm ${s.retrogressions > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {s.retrogressions > 0 ? `${s.retrogressions} mo` : "None"}
                  </p>
                </div>
              </div>
              <div className="text-xs flex items-center gap-1.5 pt-1 border-t border-white/[0.06]">
                <span className="text-[var(--muted-foreground)]">Trend:</span>
                <span className={
                  s.prediction === "Advancing" ? "text-emerald-400"
                  : s.prediction === "Retreating" ? "text-rose-400"
                  : "text-amber-400"
                }>
                  {s.prediction}
                </span>
              </div>
            </GlassCard>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function EbCategoryDashboardPage() {
  const [data, setData] = useState<CategoryMovementMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("IND");
  // Default to last 36 months so the chart shows current momentum,
  // not the 2016–2018 retrogression era where EB2 India was temporarily slower.
  const [showFullHistory, setShowFullHistory] = useState(false);

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

  // Summary cards for both chart types — shown simultaneously
  const summaryDFF = useMemo(
    () => buildCategorySummary(data, selectedCountry, "DFF"),
    [data, selectedCountry]
  );
  const summaryFAD = useMemo(
    () => buildCategorySummary(data, selectedCountry, "FAD"),
    [data, selectedCountry]
  );

  const historyN = showFullHistory ? undefined : 36;
  const dffChartData = useMemo(
    () => buildVelocityTimeline(data, selectedCountry, "DFF", historyN),
    [data, selectedCountry, historyN]
  );
  const fadChartData = useMemo(
    () => buildVelocityTimeline(data, selectedCountry, "FAD", historyN),
    [data, selectedCountry, historyN]
  );

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
            <span>Dashboards</span><span>/</span>
            <span className="text-[var(--foreground)]">EB Category Comparison</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            EB Category Comparison
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
            Compare priority date velocity across all EB categories — both Dates for Filing (DFF)
            and Final Action Dates (FAD) — for your chargeability country.
          </p>
        </div>

        {/* Country selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted-foreground)]">Country:</span>
          <div className="flex gap-1 flex-wrap">
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

        {/* DFF Summary Row */}
        <SummaryRow
          label="Dates for Filing"
          badge="DFF"
          summary={summaryDFF}
        />

        {/* FAD Summary Row */}
        <SummaryRow
          label="Final Action Dates"
          badge="FAD"
          summary={summaryFAD}
        />

        {/* Velocity Charts — DFF and FAD side by side */}
        <FadeIn>
          <GlassCard className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-400" />
                <h2 className="text-base font-semibold text-[var(--foreground)]">
                  Velocity Charts — EB1 / EB2 / EB3
                </h2>
              </div>
              {/* History window toggle */}
              <div className="flex items-center gap-1">
                <History className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <span className="text-xs text-[var(--muted-foreground)] mr-1">Window:</span>
                <div className="flex gap-1">
                  {[
                    { label: "Recent 3yr", full: false },
                    { label: "Full History", full: true },
                  ].map(({ label, full }) => (
                    <button
                      key={label}
                      onClick={() => setShowFullHistory(full)}
                      className={`px-2.5 py-1 text-[11px] rounded-full transition-all ${
                        showFullHistory === full
                          ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40"
                          : "bg-white/5 text-[var(--muted-foreground)] hover:bg-white/10"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs text-[var(--muted-foreground)]">
              Trailing 12-month rolling average of calendar days advanced per bulletin month.
              Country: <strong className="text-[var(--foreground)]">{COUNTRY_LABELS[selectedCountry] ?? selectedCountry}</strong>.{" "}
              {!showFullHistory && "Showing last 3 years — use \"Full History\" to see all data since 2016."}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 inline-block" />
                  Dates for Filing (DFF)
                </p>
                <VelocityChart chartData={dffChartData} idSuffix="dff" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 inline-block" />
                  Final Action Dates (FAD)
                </p>
                <VelocityChart chartData={fadChartData} idSuffix="fad" />
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Methodology */}
        <FadeIn>
          <GlassCard className="p-6">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                Methodology & Data Sources
              </summary>
              <div className="mt-4 text-xs text-[var(--muted-foreground)] space-y-2">
                <p>
                  Category movement metrics are computed from Visa Bulletin historical
                  cutoff dates (Oct 2015 – present). Each row tracks how far each
                  category&apos;s priority date cutoff advanced or retreated each month.
                </p>
                <p>
                  <strong className="text-[var(--foreground)]">12m avg velocity:</strong>{" "}
                  Trailing 12-month rolling average of calendar days the cutoff date
                  advanced per bulletin. This is the primary metric shown in the summary
                  cards and charts — it reflects current momentum, not all-time averages.
                </p>
                <p>
                  <strong className="text-[var(--foreground)]">Why EB2 &gt; EB3 now</strong>{" "}
                  (despite appearing slower in some historical charts): EB2 India experienced
                  significant retrogressions in 2016–2018, dragging its multi-year average down.
                  Since 2022, EB2 India has been advancing faster than EB3 on a trailing 12-month
                  basis. The &quot;Recent 3yr&quot; view shows this clearly.
                </p>
                <p>
                  <strong className="text-[var(--foreground)]">Retrogressions:</strong>{" "}
                  Count of bulletin months in the last 12 where the cutoff date moved backward.
                  A value of 0 means the category advanced or stayed flat every month.
                </p>
                <p className="pt-2 border-t border-white/[0.06]">
                  Source: Department of State Visa Bulletin, processed by P2 Meridian
                  (make_category_movement_metrics.py).{" "}
                  {formatNumber(data.length)} data points across{" "}
                  {new Set(data.map((r) => r.category)).size} categories and{" "}
                  {new Set(data.map((r) => r.country)).size} countries.
                </p>
              </div>
            </details>
          </GlassCard>
        </FadeIn>
      </div>
    </main>
  );
}
