/**
 * Geographic Heatmaps Dashboard
 *
 * Interactive USA choropleth map + bar chart + sortable data table.
 * Click any state on the map to drill down into detailed metrics.
 *
 * Route: /dashboard/geographic/
 */
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";
import { MapPin, Building2, AlertTriangle, TrendingUp, Users, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui";
import { GlassCard } from "@/components/ui";
import { UsaChoropleth, type MapMetric } from "@/components/geo";
import {
  loadGeoMetrics,
  getStateAggregates,
  getTopStates,
  getNationalSummary,
  getAvailableDatasets,
  STATE_NAMES,
  US_50_STATE_CODES,
  type StateAggregate,
} from "@/lib/data/geographic";
import type { WorksiteGeoMetric } from "@/types/p2-artifacts";
import { formatNumber, formatCurrency } from "@/lib/utils/format";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type SortField = "filings" | "approvals" | "employers" | "medianWage" | "approvalRate" | "competitiveness";

const METRIC_OPTIONS: Array<{ key: SortField; label: string }> = [
  { key: "filings",         label: "Total Filings" },
  { key: "approvals",       label: "Approvals" },
  { key: "employers",       label: "Unique Employers" },
  { key: "medianWage",      label: "Median Wage" },
  { key: "approvalRate",    label: "Approval Rate" },
  { key: "competitiveness", label: "Wage vs Market" },
];

// ---------------------------------------------------------------------------
// State Detail Panel — appears on drill-down
// ---------------------------------------------------------------------------

function StateDetailPanel({
  stateData,
  allStates,
  onClose,
}: {
  stateData: StateAggregate;
  allStates: StateAggregate[];
  onClose: () => void;
}) {
  // Compute rank among all states
  const ranks = useMemo(() => {
    const byFilings = [...allStates].sort((a, b) => b.filings - a.filings);
    const byWage = [...allStates].sort((a, b) => (b.medianWage ?? 0) - (a.medianWage ?? 0));
    const byApproval = [...allStates].sort((a, b) => (b.approvalRate ?? 0) - (a.approvalRate ?? 0));
    const byEmployers = [...allStates].sort((a, b) => b.employers - a.employers);
    return {
      filings: byFilings.findIndex((s) => s.state === stateData.state) + 1,
      wage: byWage.findIndex((s) => s.state === stateData.state) + 1,
      approval: byApproval.findIndex((s) => s.state === stateData.state) + 1,
      employers: byEmployers.findIndex((s) => s.state === stateData.state) + 1,
      total: allStates.length,
    };
  }, [allStates, stateData]);

  const stateName = STATE_NAMES[stateData.state] ?? stateData.state;
  const isTerritory = !US_50_STATE_CODES.has(stateData.state);

  const metrics = [
    {
      label: "Total Filings",
      value: formatNumber(stateData.filings),
      rank: ranks.filings,
      color: "text-blue-400",
      barColor: "bg-blue-500/30",
      barWidth: stateData.filings / (allStates[0]?.filings || 1),
    },
    {
      label: "Approvals",
      value: formatNumber(stateData.approvals),
      rank: null,
      color: "text-emerald-400",
      barColor: "bg-emerald-500/30",
      barWidth: stateData.approvals / (allStates[0]?.filings || 1),
    },
    {
      label: "Unique Employers",
      value: formatNumber(stateData.employers),
      rank: ranks.employers,
      color: "text-purple-400",
      barColor: "bg-purple-500/30",
      barWidth: stateData.employers / Math.max(...allStates.map((s) => s.employers)),
    },
    {
      label: "Median Offered Wage",
      value: stateData.medianWage != null ? formatCurrency(stateData.medianWage) : "N/A",
      rank: ranks.wage,
      color: "text-amber-400",
      barColor: "bg-amber-500/30",
      barWidth: stateData.medianWage ? stateData.medianWage / Math.max(...allStates.map((s) => s.medianWage ?? 0)) : 0,
    },
    {
      label: "Approval Rate",
      value: stateData.approvalRate != null ? `${formatNumber(stateData.approvalRate * 100, 1)}%` : "N/A",
      rank: ranks.approval,
      color: "text-cyan-400",
      barColor: "bg-cyan-500/30",
      barWidth: stateData.approvalRate ?? 0,
    },
    {
      label: "Wage vs Market",
      value: stateData.competitiveness != null ? `${formatNumber(stateData.competitiveness * 100, 1)}%` : "N/A",
      rank: null,
      color: "text-rose-400",
      barColor: "bg-rose-500/30",
      barWidth: stateData.competitiveness ? Math.min(1, stateData.competitiveness / 2) : 0,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <GlassCard variant="elevated" className="p-5 sm:p-6 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">
                {stateName.replace(/ \(.*\)$/, "")}
              </h3>
              <span className="text-xs font-mono text-[var(--muted-foreground)] bg-white/5 px-2 py-0.5 rounded-md">
                {stateData.state}
              </span>
              {isTerritory && (
                <span className="text-[10px] font-medium text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  {stateData.state === "DC" ? "Federal District" : "Territory"}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              {stateData.dataset} filing metrics
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 active:bg-white/15 transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label="Close state details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[var(--muted-foreground)]">{m.label}</span>
                {m.rank && (
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                    #{m.rank}/{ranks.total}
                  </span>
                )}
              </div>
              <p className={`text-lg font-bold font-mono ${m.color}`}>
                {m.value}
              </p>
              {/* Mini bar */}
              <div className="mt-2 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${m.barColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(2, m.barWidth * 100)}%` }}
                  transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
                  style={{ background: `linear-gradient(90deg, ${m.barColor.replace("bg-", "").replace("/30", "")}, transparent)` }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function GeographicDashboardPage() {
  const [data, setData] = useState<WorksiteGeoMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataset, setDataset] = useState("PERM");
  const [metric, setMetric] = useState<SortField>("filings");
  const [showAll, setShowAll] = useState(false);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "table">("map");
  const detailRef = useRef<HTMLDivElement>(null);

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

  // Scroll to detail panel when state is selected
  const handleStateSelect = (stateCode: string | null) => {
    setSelectedState(stateCode);
    if (stateCode && detailRef.current) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  };

  // Selected state data
  const selectedStateData = useMemo(
    () => (selectedState ? allStates.find((s) => s.state === selectedState) ?? null : null),
    [allStates, selectedState]
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
            Click any state to see detailed metrics.
          </p>
        </div>

        {/* Controls Row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Dataset selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted-foreground)]">Dataset:</span>
              <div className="flex gap-1">
                {datasets.map((ds) => (
                  <button
                    key={ds}
                    onClick={() => setDataset(ds)}
                    className={`px-3 py-2 sm:py-1.5 text-xs rounded-full transition-all ${
                      dataset === ds
                        ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                        : "bg-white/5 text-[var(--muted-foreground)] hover:bg-white/10 active:bg-white/15"
                    }`}
                  >
                    {ds}
                  </button>
                ))}
              </div>
            </div>

            {/* Metric selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted-foreground)]">Color by:</span>
              <div className="relative">
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as SortField)}
                  className="appearance-none bg-white/5 border border-white/10 rounded-lg px-3 pr-7 py-2 sm:py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                >
                  {METRIC_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--muted-foreground)] pointer-events-none" />
              </div>
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.06] self-start">
            <button
              onClick={() => setViewMode("map")}
              className={`px-3 py-2 sm:py-1.5 text-xs rounded-md transition-all ${
                viewMode === "map"
                  ? "bg-amber-500/20 text-amber-300 shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5"
              }`}
            >
              <MapPin className="h-3.5 w-3.5 inline-block mr-1 -mt-0.5" />
              Map
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-2 sm:py-1.5 text-xs rounded-md transition-all ${
                viewMode === "table"
                  ? "bg-amber-500/20 text-amber-300 shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5"
              }`}
            >
              <Building2 className="h-3.5 w-3.5 inline-block mr-1 -mt-0.5" />
              Table
            </button>
          </div>
        </div>

        {/* National Summary KPIs */}
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: MapPin,
              label: "States",
              value: String(national.stateCount),
              sub: national.territoryCount > 0 ? `+ ${national.territoryCount} territories` : undefined,
              color: "text-amber-400",
            },
            {
              icon: TrendingUp,
              label: `${dataset} Filings`,
              value: formatNumber(national.totalFilings),
              sub: undefined,
              color: "text-blue-400",
            },
            {
              icon: Building2,
              label: "Employers",
              value: formatNumber(national.totalEmployers),
              sub: undefined,
              color: "text-emerald-400",
            },
            {
              icon: Users,
              label: "Avg Approval Rate",
              value: `${formatNumber(national.avgApprovalRate * 100, 1)}%`,
              sub: undefined,
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
                {kpi.sub && (
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{kpi.sub}</p>
                )}
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* ====== Map View ====== */}
        {viewMode === "map" && (
          <FadeIn>
            <GlassCard variant="elevated" className="p-4 sm:p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  Filing Density by State
                </h2>
                {selectedState && (
                  <button
                    onClick={() => setSelectedState(null)}
                    className="text-xs text-amber-400 hover:text-amber-300 active:text-amber-200 transition-colors flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Clear selection
                  </button>
                )}
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mb-4">
                Hover for details, click to drill down
              </p>
              <UsaChoropleth
                states={allStates}
                metric={metric as MapMetric}
                selectedState={selectedState}
                onStateSelect={handleStateSelect}
              />
            </GlassCard>
          </FadeIn>
        )}

        {/* ====== State Detail Drill-Down ====== */}
        <div ref={detailRef}>
          <AnimatePresence>
            {selectedStateData && (
              <StateDetailPanel
                stateData={selectedStateData}
                allStates={allStates}
                onClose={() => setSelectedState(null)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ====== Bar Chart ====== */}
        {viewMode === "map" && (
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
                        : metric === "approvalRate" || metric === "competitiveness"
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
                      backgroundColor: "rgba(9,9,11,0.95)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "12px",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.9)", fontWeight: 600, marginBottom: 2 }}
                    itemStyle={{ color: "rgba(255,255,255,0.75)" }}
                    formatter={(value: string | number) => [
                      typeof value !== "number" ? String(value) :
                      metric === "medianWage"
                        ? formatCurrency(value)
                        : metric === "approvalRate" || metric === "competitiveness"
                        ? `${formatNumber(value * 100, 1)}%`
                        : formatNumber(value),
                      METRIC_OPTIONS.find((m) => m.key === metric)?.label ?? metric,
                    ]}
                    labelFormatter={(label: string) =>
                      STATE_NAMES[label] ?? label
                    }
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 6, 6, 0]}
                    cursor="pointer"
                    onClick={(_: unknown, index: number) => {
                      const entry = chartData[index];
                      if (entry) handleStateSelect(entry.state);
                    }}
                  >
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.state === selectedState
                          ? "#f59e0b"
                          : `hsl(${35 + i * 4}, 80%, ${60 - i * 2}%)`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </FadeIn>
        )}

        {/* ====== Table View ====== */}
        {viewMode === "table" && (
          <FadeIn>
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  State Rankings
                </h2>
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs text-amber-400 hover:text-amber-300 active:text-amber-200 transition-colors"
                >
                  {showAll ? "Show Top 15" : `Show All ${allStates.filter((s) => US_50_STATE_CODES.has(s.state)).length} States + ${allStates.filter((s) => !US_50_STATE_CODES.has(s.state)).length} Territories`}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      <th className="text-left py-2 px-2 text-[var(--muted-foreground)] font-medium">#</th>
                      <th className="text-left py-2 px-2 text-[var(--muted-foreground)] font-medium">State</th>
                      <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">Filings</th>
                      <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">Approvals</th>
                      <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">Employers</th>
                      <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">Median Wage</th>
                      <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">Approval Rate</th>
                      <th className="text-right py-2 px-2 text-[var(--muted-foreground)] font-medium">Wage vs Market</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStates.map((s, i) => (
                      <tr
                        key={s.state}
                        onClick={() => handleStateSelect(s.state)}
                        className={`border-b border-white/[0.04] transition-colors cursor-pointer ${
                          s.state === selectedState
                            ? "bg-amber-500/[0.08] hover:bg-amber-500/[0.12]"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="py-2 px-2 font-mono text-[var(--muted-foreground)]">
                          {i + 1}
                        </td>
                        <td className="py-2 px-2 text-[var(--foreground)] font-medium">
                          {(STATE_NAMES[s.state] ?? s.state).replace(/ \(.*\)$/, "")}
                          <span className="text-[var(--muted-foreground)] ml-1.5 font-mono text-[10px]">
                            {s.state}
                          </span>
                          {!US_50_STATE_CODES.has(s.state) && (
                            <span className="ml-1.5 text-[10px] text-amber-400/70 font-normal">
                              {["DC"].includes(s.state) ? "Fed. District" :
                               ["PR", "GU", "VI", "AS", "MP"].includes(s.state) ? "Territory" :
                               "Compact"}
                            </span>
                          )}
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
                          {s.medianWage !== null ? formatCurrency(s.medianWage) : "N/A"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                          {s.approvalRate !== null
                            ? `${formatNumber(s.approvalRate * 100, 1)}%`
                            : "N/A"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-[var(--foreground)]">
                          {s.competitiveness !== null
                            ? `${formatNumber(s.competitiveness * 100, 1)}%`
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </FadeIn>
        )}

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
                  <strong>Approval Rate:</strong> Cases approved divided by
                  total filings for the state, always between 0% and 100%.
                </p>
                <p>
                  <strong>Wage vs Market:</strong> Median offered salary compared
                  to the OEWS occupational wage benchmark for that state. Values
                  above 100% mean employers pay above the regional median.
                </p>
                <p>
                  <strong>Employer Count:</strong> Distinct sponsoring employers
                  with filings in the state across the dataset window.
                </p>
                <p className="pt-2 border-t border-white/[0.06]">
                  Source: DOL PERM & LCA data, processed by P2 Meridian
                  (make_worksite_geo_metrics.py). {formatNumber(data.length)} data
                  points across {national.stateCount} states and {national.territoryCount} territories/other jurisdictions.
                </p>
              </div>
            </details>
          </GlassCard>
        </FadeIn>
      </div>
    </main>
  );
}
