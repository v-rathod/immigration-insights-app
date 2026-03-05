/**
 * Occupation Demand (SOC Demand) Dashboard
 *
 * High-demand occupations, filing volumes by occupation type, approval rates,
 * and wage premiums. Searchable with major-group aggregation.
 *
 * Route: /dashboard/job-demand/
 */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, PieChart, Pie,
} from "recharts";
import { Briefcase, TrendingUp, DollarSign, AlertTriangle, Search, ChevronDown, ChevronUp } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui";
import { GlassCard } from "@/components/ui";
import {
  loadSocDemand,
  loadDimSoc,
  enrichWithTitles,
  filterDemand,
  getTopOccupations,
  getAvailableWindows,
  getAvailableDatasetsForDemand,
  getMajorGroupSummary,
  type EnrichedSocDemand,
} from "@/lib/data/soc-demand";
import type { SocDemandMetric, DimSoc } from "@/types/p2-artifacts";
import { formatNumber, formatCurrency } from "@/lib/utils/format";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const BAR_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e",
  "#6366f1", "#14b8a6", "#ec4899", "#84cc16", "#06b6d4",
  "#a855f7", "#ef4444", "#22c55e", "#eab308", "#0ea5e9",
  "#d946ef", "#f97316", "#64748b", "#2dd4bf", "#fb923c",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SocDemandDashboardPage() {
  const [rawData, setRawData] = useState<SocDemandMetric[]>([]);
  const [socDim, setSocDim] = useState<DimSoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [window, setWindow] = useState("12m");
  const [dataset, setDataset] = useState("PERM");
  const [search, setSearch] = useState("");
  const [chartSearch, setChartSearch] = useState("");
  const [showMajorGroups, setShowMajorGroups] = useState(false);

  useEffect(() => {
    Promise.all([loadSocDemand(), loadDimSoc()])
      .then(([demand, soc]) => {
        setRawData(demand);
        setSocDim(soc);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load data")
      )
      .finally(() => {
        setLoading(false);
        analytics.dashboardViewed("job-demand");
      });
  }, []);

  const enrichedData = useMemo(
    () => enrichWithTitles(rawData, socDim),
    [rawData, socDim]
  );

  const windows = useMemo(() => getAvailableWindows(rawData), [rawData]);
  const datasets = useMemo(() => getAvailableDatasetsForDemand(rawData), [rawData]);

  const topOccupations = useMemo(
    () => getTopOccupations(enrichedData, window, dataset, 25),
    [enrichedData, window, dataset]
  );

  const majorGroups = useMemo(
    () => getMajorGroupSummary(enrichedData, window, dataset),
    [enrichedData, window, dataset]
  );

  // Filtered view
  const filtered = useMemo(() => {
    const all = filterDemand(enrichedData, window, dataset);
    if (!search.trim()) return all.slice(0, 50);
    const q = search.toLowerCase();
    return all.filter((r) => r.soc_title.toLowerCase().includes(q));
  }, [enrichedData, window, dataset, search]);

  // KPIs
  const totalFilings = useMemo(
    () => filterDemand(enrichedData, window, dataset).reduce((s, r) => s + r.filings_count, 0),
    [enrichedData, window, dataset]
  );
  const avgApprovalRate = useMemo(() => {
    const all = filterDemand(enrichedData, window, dataset);
    if (!all.length) return 0;
    const weighted = all.reduce((s, r) => s + r.approval_rate * r.filings_count, 0);
    return weighted / totalFilings;
  }, [enrichedData, window, dataset, totalFilings]);
  const avgWage = useMemo(() => {
    const all = filterDemand(enrichedData, window, dataset);
    if (!all.length) return 0;
    const weighted = all.reduce((s, r) => s + r.offered_median * r.filings_count, 0);
    return weighted / totalFilings;
  }, [enrichedData, window, dataset, totalFilings]);

  // Chart data — filtered by chartSearch, capped at 25
  const filteredChartOccupations = useMemo(() => {
    if (!chartSearch.trim()) return topOccupations.slice(0, 25);
    const q = chartSearch.toLowerCase();
    return topOccupations
      .filter((r) => r.soc_title.toLowerCase().includes(q))
      .slice(0, 25);
  }, [topOccupations, chartSearch]);

  const chartData = useMemo(
    () =>
      filteredChartOccupations.map((r) => ({
        code: r.soc_code,
        title: r.soc_title.length > 30 ? r.soc_title.slice(0, 28) + "…" : r.soc_title,
        filings: r.filings_count,
      })),
    [filteredChartOccupations]
  );

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-center py-32">
          <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
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
            <span className="text-[var(--foreground)]">Occupation Demand</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Occupation Demand
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
            Discover the most in-demand occupations for immigration sponsorship.
            Compare filing volumes, approval rates, and salary levels across
            {" "}{formatNumber(filterDemand(enrichedData, window, dataset).length)} occupations.
          </p>
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Window:</span>
            <div className="flex gap-1">
              {windows.map((w) => (
                <button
                  key={w}
                  onClick={() => setWindow(w)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                    window === w
                      ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40"
                      : "bg-white/5 text-[var(--muted-foreground)] hover:bg-white/10"
                  }`}
                >
                  {w === "12m" ? "1 Year" : w === "24m" ? "2 Years" : "3 Years"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Source:</span>
            <div className="flex gap-1">
              {datasets.map((ds) => (
                <button
                  key={ds}
                  onClick={() => setDataset(ds)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                    dataset === ds
                      ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40"
                      : "bg-white/5 text-[var(--muted-foreground)] hover:bg-white/10"
                  }`}
                >
                  {ds}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: Briefcase,
              label: "Occupations",
              value: formatNumber(filterDemand(enrichedData, window, dataset).length),
              color: "text-indigo-400",
            },
            {
              icon: TrendingUp,
              label: "Total Filings",
              value: formatNumber(totalFilings),
              color: "text-blue-400",
            },
            {
              icon: DollarSign,
              label: "Avg Median Wage",
              value: formatCurrency(avgWage),
              color: "text-emerald-400",
            },
            {
              icon: TrendingUp,
              label: "Avg Approval Rate",
              value: `${formatNumber(avgApprovalRate * 100, 1)}%`,
              color: "text-purple-400",
            },
          ].map((kpi) => (
            <StaggerItem key={kpi.label}>
              <GlassCard className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {kpi.label}
                  </span>
                </div>
                <p className="text-xl font-bold font-mono text-[var(--foreground)]">
                  {kpi.value}
                </p>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Top Occupations Chart */}
        <FadeIn>
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2 className="text-lg font-semibold text-[var(--foreground)] shrink-0">
                Top 25 Occupations by Filing Volume
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  value={chartSearch}
                  onChange={(e) => setChartSearch(e.target.value)}
                  placeholder="Filter chart occupations…"
                  className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-indigo-500/40 w-52"
                />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={600}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, bottom: 5, left: 180 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => formatNumber(v)}
                />
                <YAxis
                  type="category"
                  dataKey="title"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  width={175}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(0,0,0,0.85)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "#94a3b8" }}
                  formatter={(value: string | number) => [
                    typeof value === "number" ? formatNumber(value) : String(value),
                    "Sponsorship Filings",
                  ]}
                />
                <Bar dataKey="filings" radius={[0, 6, 6, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </FadeIn>

        {/* Major Group Summary (collapsible) */}
        <FadeIn>
          <GlassCard className="p-6">
            <button
              onClick={() => setShowMajorGroups((v) => !v)}
              className="flex items-center gap-2 w-full text-left"
            >
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Major Occupation Groups
              </h2>
              {showMajorGroups ? (
                <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
              )}
            </button>
            {showMajorGroups && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      <th className="text-left py-2 px-2 text-[var(--muted-foreground)] font-medium">
                        Occupation Category
                      </th>
                      <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                        Occupations
                      </th>
                      <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                        Total Filings
                      </th>
                      <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                        Avg Approval
                      </th>
                      <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                        Avg Wage
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {majorGroups.map((g) => (
                      <tr
                        key={g.majorCode}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                      >
                        <td className="py-2 px-2 text-[var(--foreground)]">
                          {g.majorTitle}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                          {g.occupationCount}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                          {formatNumber(g.totalFilings)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                          {formatNumber(g.avgApprovalRate * 100, 1)}%
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                          {formatCurrency(g.avgWage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </FadeIn>

        {/* Search + Detailed Table */}
        <FadeIn>
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Occupation Details
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by occupation name…"
                  className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-indigo-500/40 w-64"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      Occupation
                    </th>
                    <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      Filings
                    </th>
                    <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      Approvals
                    </th>
                    <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      Rate
                    </th>
                    <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      Median Wage
                    </th>
                    <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      Demand %ile
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={`${r.soc_code}-${r.window}-${r.dataset}`}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                    >
                      <td className="py-2 px-2 text-[var(--foreground)]">
                        <div className="font-medium">{r.soc_title}</div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                        {formatNumber(r.filings_count)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                        {formatNumber(r.approvals_count)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                        {formatNumber(r.approval_rate * 100, 1)}%
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                        {formatCurrency(r.offered_median)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                        {formatNumber(r.competitiveness_percentile * 100, 0)}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-[var(--muted-foreground)]"
                      >
                        No occupations match &quot;{search}&quot;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                  Occupation demand metrics aggregate PERM and LCA filings by
                  occupation type within rolling time windows (12m, 24m, 36m).
                </p>
                <p>
                  <strong>Competitiveness Percentile:</strong> Rank of this
                  occupation&apos;s filing count relative to all other occupations.
                  Higher percentile = more popular for sponsorship.
                </p>
                <p>
                  <strong>Offered Median:</strong> Median annualized wage
                  offered by employers in certified applications.
                </p>
                <p className="pt-2 border-t border-white/[0.06]">
                  Source: DOL PERM & LCA certified applications, processed by
                  P2 Meridian (make_soc_demand_metrics.py).{" "}
                  {formatNumber(rawData.length)} data points across{" "}
                  {new Set(rawData.map((r) => r.soc_code)).size} occupations.
                </p>
              </div>
            </details>
          </GlassCard>
        </FadeIn>
      </div>
    </main>
  );
}
