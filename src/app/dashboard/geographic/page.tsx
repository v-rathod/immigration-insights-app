/**
 * Geographic Heatmaps Dashboard
 *
 * Sponsorship hotspots, filing density, wage competitiveness by state.
 * Bar chart rankings + data table with sortable columns.
 *
 * Route: /dashboard/geographic/
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";
import { MapPin, Building2, DollarSign, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui";
import { GlassCard } from "@/components/ui";
import {
  loadGeoMetrics,
  getStateAggregates,
  getTopStates,
  getNationalSummary,
  getAvailableDatasets,
  STATE_NAMES,
  type StateAggregate,
} from "@/lib/data/geographic";
import type { WorksiteGeoMetric } from "@/types/p2-artifacts";
import { formatNumber, formatCurrency } from "@/lib/utils/format";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type SortField = "filings" | "approvals" | "employers" | "medianWage" | "competitiveness";

const METRIC_OPTIONS: Array<{ key: SortField; label: string }> = [
  { key: "filings",         label: "Total Filings" },
  { key: "approvals",       label: "Approvals" },
  { key: "employers",       label: "Unique Employers" },
  { key: "medianWage",      label: "Median Wage" },
  { key: "competitiveness", label: "Approval Rate" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GeographicDashboardPage() {
  const [data, setData] = useState<WorksiteGeoMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataset, setDataset] = useState("PERM");
  const [metric, setMetric] = useState<SortField>("filings");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadGeoMetrics()
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load data")
      )
      .finally(() => {
        setLoading(false);
        analytics.dashboardViewed("geographic");
      });
  }, []);

  const datasets = useMemo(() => getAvailableDatasets(data), [data]);
  const national = useMemo(
    () => getNationalSummary(data, dataset),
    [data, dataset]
  );
  const topStates = useMemo(
    () => getTopStates(data, dataset, 15),
    [data, dataset]
  );
  const allStates = useMemo(
    () => getStateAggregates(data, dataset),
    [data, dataset]
  );

  // Sort by selected metric
  const sortedStates = useMemo(() => {
    const list = showAll ? allStates : topStates;
    return [...list].sort((a, b) => {
      const av = a[metric] ?? 0;
      const bv = b[metric] ?? 0;
      return (bv as number) - (av as number);
    });
  }, [allStates, topStates, metric, showAll]);

  // Chart data (top 15)
  const chartData = useMemo(
    () =>
      sortedStates.slice(0, 15).map((s) => ({
        state: s.state,
        name: STATE_NAMES[s.state] ?? s.state,
        value: s[metric] ?? 0,
      })),
    [sortedStates, metric]
  );

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-center py-32">
          <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
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
            <span className="text-[var(--foreground)]">Geographic Heatmaps</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
            Geographic Heatmaps
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
            Explore immigration sponsorship hotspots across the United States.
            Compare filing density, employer concentration, wage levels, and
            approval rates by state.
          </p>
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Dataset:</span>
            <div className="flex gap-1">
              {datasets.map((ds) => (
                <button
                  key={ds}
                  onClick={() => setDataset(ds)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                    dataset === ds
                      ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                      : "bg-white/5 text-[var(--muted-foreground)] hover:bg-white/10"
                  }`}
                >
                  {ds}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Rank by:</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as SortField)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-amber-500/40"
            >
              {METRIC_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* National Summary KPIs */}
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: MapPin,
              label: "States",
              value: formatNumber(national.stateCount),
              color: "text-amber-400",
            },
            {
              icon: TrendingUp,
              label: `${dataset} Filings`,
              value: formatNumber(national.totalFilings),
              color: "text-blue-400",
            },
            {
              icon: Building2,
              label: "Employers",
              value: formatNumber(national.totalEmployers),
              color: "text-emerald-400",
            },
            {
              icon: Users,
              label: "Avg Approval Rate",
              value: `${formatNumber(national.avgCompetitiveness * 100, 1)}%`,
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

        {/* Bar Chart */}
        <FadeIn>
          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
              Top States by {METRIC_OPTIONS.find((m) => m.key === metric)?.label}
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, bottom: 5, left: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) =>
                    metric === "medianWage"
                      ? `$${formatNumber(v / 1000, 0)}K`
                      : metric === "competitiveness"
                      ? `${formatNumber(v * 100, 0)}%`
                      : formatNumber(v)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="state"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(0,0,0,0.85)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    fontSize: 12,
                  }}
                  formatter={(value: string | number) => [
                    typeof value !== "number" ? String(value) :
                    metric === "medianWage"
                      ? formatCurrency(value)
                      : metric === "competitiveness"
                      ? `${formatNumber(value * 100, 1)}%`
                      : formatNumber(value),
                    METRIC_OPTIONS.find((m) => m.key === metric)?.label ?? metric,
                  ]}
                  labelFormatter={(label: string) =>
                    STATE_NAMES[label] ?? label
                  }
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`hsl(${35 + i * 4}, 80%, ${60 - i * 2}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </FadeIn>

        {/* Data Table */}
        <FadeIn>
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                State Rankings
              </h2>
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                {showAll ? "Show Top 15" : `Show All ${allStates.length}`}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      #
                    </th>
                    <th className="text-left py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      State
                    </th>
                    <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      Filings
                    </th>
                    <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      Approvals
                    </th>
                    <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      Employers
                    </th>
                    <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      Median Wage
                    </th>
                    <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">
                      Approval Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStates.map((s, i) => (
                    <tr
                      key={s.state}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2 px-2 font-mono text-[var(--muted-foreground)]">
                        {i + 1}
                      </td>
                      <td className="py-2 px-2 text-[var(--foreground)] font-medium">
                        {STATE_NAMES[s.state] ?? s.state}
                        <span className="text-[var(--muted-foreground)] ml-1.5">
                          {s.state}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                        {formatNumber(s.filings)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                        {formatNumber(s.approvals)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                        {formatNumber(s.employers)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                        {s.medianWage !== null ? formatCurrency(s.medianWage) : "—"}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                        {s.competitiveness !== null
                          ? `${formatNumber(s.competitiveness * 100, 1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
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
                  Geographic metrics aggregate PERM and LCA filings by worksite
                  state. Wage data reflects the median offered salary from
                  certified applications.
                </p>
                <p>
                  <strong>Competitiveness Ratio:</strong> Approvals divided by
                  total filings for the state — indicates the overall success
                  rate of immigration sponsorship in each location.
                </p>
                <p>
                  <strong>Employer Count:</strong> Distinct sponsoring employers
                  with filings in the state across the dataset window.
                </p>
                <p className="pt-2 border-t border-white/[0.06]">
                  Source: DOL PERM & LCA data, processed by P2 Meridian
                  (make_worksite_geo_metrics.py). {formatNumber(data.length)} data
                  points across {national.stateCount} states.
                </p>
              </div>
            </details>
          </GlassCard>
        </FadeIn>
      </div>
    </main>
  );
}
