/**
 * Processing Speed Dashboard
 *
 * I-485 quarterly processing trends, throughput, approval rates,
 * pending backlog, and USCIS form-level approval data.
 *
 * Route: /dashboard/processing/
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, BarChart, Bar, Cell, ComposedChart, Line,
} from "recharts";
import { Clock, TrendingUp, AlertTriangle, Activity, FileCheck, Layers } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui";
import { GlassCard } from "@/components/ui";
import {
  loadProcessingTrends,
  loadUscisApprovals,
  sortProcessingTrends,
  computeProcessingKpis,
  aggregateByForm,
} from "@/lib/data/processing";
import type { ProcessingTimesTrend, FactUscisApproval } from "@/types/p2-artifacts";
import { formatNumber } from "@/lib/utils/format";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProcessingDashboardPage() {
  const [trends, setTrends] = useState<ProcessingTimesTrend[]>([]);
  const [uscis, setUscis] = useState<FactUscisApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadProcessingTrends(), loadUscisApprovals()])
      .then(([t, u]) => {
        setTrends(t);
        setUscis(u);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load data")
      )
      .finally(() => {
        setLoading(false);
        analytics.dashboardViewed("processing");
      });
  }, []);

  const sorted = useMemo(() => sortProcessingTrends(trends), [trends]);
  const kpis = useMemo(() => computeProcessingKpis(trends), [trends]);
  const formSummary = useMemo(() => aggregateByForm(uscis), [uscis]);

  // Chart data: EB pending + throughput
  const chartData = useMemo(
    () =>
      sorted.map((r) => ({
        period: r.reporting_period,
        ebPending: r.eb_pending,
        ebApproved: r.eb_approved,
        ebReceived: r.eb_received,
        approvalRate: r.approval_rate !== null ? r.approval_rate * 100 : null,
        throughput: r.throughput,
        backlogMonths: r.backlog_months,
      })),
    [sorted]
  );

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-center py-32">
          <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full" />
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
            <span className="text-[var(--foreground)]">Processing Speed</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Processing Speed
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
            Track USCIS I-485 processing velocity, approval rates, and pending
            case backlog. Covering {kpis.totalQuarters} quarterly reporting
            periods.
          </p>
        </div>

        {/* KPIs */}
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: FileCheck,
              label: "Latest Approval Rate",
              value:
                kpis.latestApprovalRate !== null
                  ? `${formatNumber(kpis.latestApprovalRate * 100, 1)}%`
                  : "—",
              color: "text-emerald-400",
            },
            {
              icon: Layers,
              label: "EB Pending Cases",
              value:
                kpis.latestPending !== null
                  ? formatNumber(kpis.latestPending)
                  : "—",
              color: "text-amber-400",
            },
            {
              icon: Clock,
              label: "Backlog (Months)",
              value:
                kpis.latestBacklogMonths !== null
                  ? formatNumber(kpis.latestBacklogMonths, 1)
                  : "—",
              color: "text-rose-400",
            },
            {
              icon: Activity,
              label: "Avg Quarterly Throughput",
              value:
                kpis.avgThroughput !== null
                  ? formatNumber(kpis.avgThroughput)
                  : "—",
              sub: "cases/qtr",
              color: "text-blue-400",
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
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    {kpi.sub}
                  </p>
                )}
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* EB Pending + Approval Rate Chart */}
        <FadeIn>
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-teal-400" />
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                I-485 EB Processing Trends
              </h2>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mb-5">
              Employment-based I-485 cases: pending balance (area) and approval
              rate (line) over quarterly reporting periods.
            </p>

            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart
                data={chartData}
                margin={{ top: 5, right: 30, bottom: 5, left: 0 }}
              >
                <defs>
                  <linearGradient id="pendingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => `${formatNumber(v / 1000)}K`}
                  label={{
                    value: "Pending Cases",
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => `${v}%`}
                  domain={[80, 100]}
                  label={{
                    value: "Approval %",
                    angle: 90,
                    position: "insideRight",
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
                  formatter={(value: string | number, name: string) => {
                    if (typeof value !== "number") return ["—", name];
                    if (name === "approvalRate" || name === "Approval Rate")
                      return [`${formatNumber(value, 1)}%`, "Approval Rate"];
                    return [formatNumber(value), name === "ebPending" ? "EB Pending" : name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="ebPending"
                  name="EB Pending"
                  stroke="#f59e0b"
                  fill="url(#pendingGradient)"
                  strokeWidth={2}
                  connectNulls
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="approvalRate"
                  name="Approval Rate %"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </GlassCard>
        </FadeIn>

        {/* Throughput Chart */}
        <FadeIn>
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Quarterly Throughput
              </h2>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mb-5">
              EB cases approved + denied per quarter — higher throughput reduces
              the pending backlog.
            </p>

            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => `${formatNumber(v / 1000)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(0,0,0,0.85)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    fontSize: 12,
                  }}
                  formatter={(value: string | number) => [
                    typeof value === "number" ? formatNumber(value) : "—",
                    "Throughput",
                  ]}
                />
                <Bar
                  dataKey="throughput"
                  name="Throughput"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </FadeIn>

        {/* USCIS Form Summary */}
        <FadeIn>
          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
              USCIS Form-Level Approvals
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left py-2 px-3 text-[var(--muted-foreground)] font-medium">
                      Form
                    </th>
                    <th className="text-right py-2 px-3 text-[var(--muted-foreground)] font-medium">
                      Total Approvals
                    </th>
                    <th className="text-right py-2 px-3 text-[var(--muted-foreground)] font-medium">
                      Total Denials
                    </th>
                    <th className="text-right py-2 px-3 text-[var(--muted-foreground)] font-medium">
                      Approval Rate
                    </th>
                    <th className="text-right py-2 px-3 text-[var(--muted-foreground)] font-medium">
                      FY Range
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {formSummary.map((f) => (
                    <tr
                      key={f.form}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                    >
                      <td className="py-2 px-3 text-[var(--foreground)] font-medium font-mono">
                        {f.form}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--foreground)]">
                        {formatNumber(f.totalApprovals)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--foreground)]">
                        {formatNumber(f.totalDenials)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--foreground)]">
                        {formatNumber(f.approvalRate * 100, 1)}%
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--muted-foreground)] whitespace-nowrap">
                        {f.fyMin === f.fyMax ? f.fyMin : `${f.fyMin}–${f.fyMax}`}
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
                  Processing speed data tracks I-485 (Adjustment of Status)
                  quarterly reporting from USCIS, focusing on employment-based
                  (EB) cases.
                </p>
                <p>
                  <strong>Backlog Months:</strong> Current EB pending cases
                  divided by average quarterly throughput — an estimate of how
                  long it would take to clear the backlog at current processing
                  rates.
                </p>
                <p>
                  <strong>Throughput:</strong> Total EB cases adjudicated
                  (approved + denied) per quarter.
                </p>
                <p>
                  <strong>Net Intake:</strong> EB received minus EB adjudicated.
                  Negative values mean the backlog is shrinking.
                </p>
                <p className="pt-2 border-t border-white/[0.06]">
                  Sources: USCIS I-485 quarterly reports, USCIS form-level
                  approval data. Processed by P2 Meridian
                  (make_processing_times_trends.py, build_fact_uscis_approvals.py).{" "}
                  {kpis.totalQuarters} quarterly data points,{" "}
                  {formatNumber(uscis.length)} form-level records.
                </p>
              </div>
            </details>
          </GlassCard>
        </FadeIn>
      </div>
    </main>
  );
}
