/**
 * Approval & Denial Trends Dashboard
 *
 * 7 visual sections:
 *   1. KPI Hero Row — 4 animated stat cards
 *   2. Approval Pulse — combo chart (stacked bars + approval rate line)
 *   3. Administration Effect — policy timeline overlay (toggle)
 *   4. YoY Velocity — delta column chart
 *   5. Cross-Track Comparison — horizontal bar chart
 *   6. Your Risk Window — personalized context (input-gated)
 *   7. Heat Grid — 19-year approval heatmap
 *
 * Route: /dashboard/approvals
 */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  ShieldCheck,
  Target,
  Info,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Cell,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from "recharts";

import { cn } from "@/lib/utils";
import { formatNumber, formatCompact } from "@/lib/utils/format";
import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import {
  loadApprovalSummary,
  loadPermDetailed,
  loadCategoryComparison,
  getAdminAvg,
  sourceLabel,
  categoryLabel,
  isPartialYear,
  ADMIN_BANDS,
} from "@/lib/data/approvals";
import type {
  ApprovalSummary,
  PermDetailPoint,
  CategoryRow,
  AdminBand,
} from "@/lib/data/approvals";
import { secureGet } from "@/lib/security";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EASING: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

// Color palette for the dashboard
const COLORS = {
  approved: "#10b981",      // emerald
  denied: "#f43f5e",        // rose
  total: "#3b82f6",         // blue
  rateLine: "#fbbf24",      // amber
  yoyPositive: "#10b981",
  yoyNegative: "#f43f5e",
  grid: "rgba(255,255,255,0.04)",
  axis: "rgba(255,255,255,0.35)",
  tooltipBg: "rgba(9,9,11,0.95)",
};

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const partial = isPartialYear(row.fiscal_year, row.total);
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[rgba(9,9,11,0.95)] px-4 py-3 shadow-2xl">
      <p className="text-sm font-bold text-white mb-2">
        FY{row.fiscal_year}{partial ? " (partial)" : ""}
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-6">
          <span className="text-emerald-400">Approved</span>
          <span className="font-mono font-semibold text-white">{formatNumber(row.approved)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-rose-400">Denied</span>
          <span className="font-mono font-semibold text-white">{formatNumber(row.denied)}</span>
        </div>
        <div className="flex justify-between gap-6 border-t border-white/[0.06] pt-1 mt-1">
          <span className="text-blue-400">Total</span>
          <span className="font-mono font-semibold text-white">{formatNumber(row.total)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-amber-400">Approval Rate</span>
          <span className="font-mono font-semibold text-white">{row.approval_rate?.toFixed(1)}%</span>
        </div>
        {row.yoy_approval_rate_change != null && (
          <div className="flex justify-between gap-6">
            <span className="text-[var(--muted-foreground)]">YoY Change</span>
            <span className={cn("font-mono font-semibold", row.yoy_approval_rate_change >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {row.yoy_approval_rate_change >= 0 ? "+" : ""}{row.yoy_approval_rate_change?.toFixed(2)}pp
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function VelocityTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[rgba(9,9,11,0.95)] px-4 py-3 shadow-2xl">
      <p className="text-sm font-bold text-white mb-1">FY{row.fiscal_year}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-6">
          <span className="text-[var(--muted-foreground)]">Approval Rate Change</span>
          <span className={cn("font-mono font-semibold", (row.yoy_approval_rate_change ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {(row.yoy_approval_rate_change ?? 0) >= 0 ? "+" : ""}{(row.yoy_approval_rate_change ?? 0).toFixed(2)}pp
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-[var(--muted-foreground)]">Volume Change</span>
          <span className={cn("font-mono font-semibold", (row.yoy_total_change_pct ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {(row.yoy_total_change_pct ?? 0) >= 0 ? "+" : ""}{(row.yoy_total_change_pct ?? 0).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function CategoryTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[rgba(9,9,11,0.95)] px-4 py-3 shadow-2xl">
      <p className="text-sm font-bold text-white mb-2">{row.label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-6">
          <span className="text-emerald-400">Approved</span>
          <span className="font-mono font-semibold text-white">{formatNumber(row.approved)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-rose-400">Denied</span>
          <span className="font-mono font-semibold text-white">{formatNumber(row.denied)}</span>
        </div>
        <div className="flex justify-between gap-6 border-t border-white/[0.06] pt-1 mt-1">
          <span className="text-[var(--muted-foreground)]">Approval Rate</span>
          <span className="font-mono font-semibold text-amber-400">{row.approval_rate_pct?.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1: KPI Hero Row
// ---------------------------------------------------------------------------

function KpiHeroRow({ summary }: { summary: ApprovalSummary }) {
  const bestYear = summary.yearly_breakdown.reduce((best, y) =>
    y.approval_rate_pct > (best?.approval_rate_pct ?? 0) ? y : best
  );
  const lastYear = summary.yearly_breakdown[summary.yearly_breakdown.length - 2]; // skip partial
  const yoyDelta = lastYear && summary.yearly_breakdown.length > 2
    ? lastYear.approval_rate_pct - summary.yearly_breakdown[summary.yearly_breakdown.length - 3].approval_rate_pct
    : null;

  return (
    <StaggerContainer>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StaggerItem>
          <StatCard
            label="PERM Cases (10yr)"
            value={summary.total_cases}
            format={formatCompact}
            icon={BarChart3}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Avg Approval Rate"
            value={summary.avg_approval_rate}
            displayValue={`${summary.avg_approval_rate.toFixed(1)}%`}
            icon={CheckCircle}
            trend={summary.trend === "increasing" ? { value: 1, label: "Improving" } : { value: -1, label: "Declining" }}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Best Year"
            value={bestYear.approval_rate_pct}
            displayValue={`FY${bestYear.fiscal_year}`}
            icon={TrendingUp}
            trend={{ value: bestYear.approval_rate_pct, label: `${bestYear.approval_rate_pct.toFixed(1)}%` }}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Total Denied"
            value={summary.total_denied}
            format={formatCompact}
            icon={XCircle}
            trend={yoyDelta != null ? { value: -yoyDelta, label: `${Math.abs(yoyDelta).toFixed(1)}pp` } : undefined}
          />
        </StaggerItem>
      </div>
    </StaggerContainer>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Approval Pulse — Combo Chart
// ---------------------------------------------------------------------------

function ApprovalPulseChart({
  data,
  showAdmin,
}: {
  data: PermDetailPoint[];
  showAdmin: boolean;
}) {
  // Last 12 years for the main chart
  const chartData = data.filter((d) => d.fiscal_year >= 2014);

  return (
    <GlassCard variant="elevated" padding="lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-[var(--foreground)]">
            PERM Approval Pulse
          </h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            Cases decided + approval rate · FY2014–FY2026
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.approved }} />
            Approved
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.denied }} />
            Denied
          </span>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-4 rounded-full" style={{ background: COLORS.rateLine }} />
            Rate %
          </span>
        </div>
      </div>

      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} barGap={0} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />

            {/* Admin bands (optional) */}
            {showAdmin &&
              ADMIN_BANDS.filter(
                (b) => b.end >= 2014
              ).map((band) => (
                <ReferenceArea
                  key={band.label}
                  x1={Math.max(band.start, 2014)}
                  x2={Math.min(band.end, 2026)}
                  fill={band.color}
                  fillOpacity={1}
                  label={{
                    value: band.label,
                    position: "insideTopLeft",
                    fill: "rgba(255,255,255,0.25)",
                    fontSize: 10,
                  }}
                />
              ))}

            <XAxis
              dataKey="fiscal_year"
              tickFormatter={(v: number) => `FY${String(v).slice(2)}`}
              tick={{ fill: COLORS.axis, fontSize: 11 }}
              axisLine={{ stroke: COLORS.grid }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(v: number) => formatCompact(v)}
              tick={{ fill: COLORS.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[75, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fill: COLORS.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />

            <Bar yAxisId="left" dataKey="approved" stackId="cases" fill={COLORS.approved} radius={[0, 0, 0, 0]} />
            <Bar yAxisId="left" dataKey="denied" stackId="cases" fill={COLORS.denied} radius={[4, 4, 0, 0]} />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="approval_rate"
              stroke={COLORS.rateLine}
              strokeWidth={2.5}
              dot={{ fill: COLORS.rateLine, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 6, stroke: "rgba(251,191,36,0.3)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Administration Effect (stats bar)
// ---------------------------------------------------------------------------

function AdminStatsBar({ data }: { data: PermDetailPoint[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {ADMIN_BANDS.map((band) => {
        const avg = getAdminAvg(band, data);
        if (avg == null) return null;
        const years = data.filter(
          (d) => d.fiscal_year >= band.start && d.fiscal_year <= band.end
        );
        const totalCases = years.reduce((s, d) => s + d.total, 0);
        return (
          <motion.div
            key={band.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASING }}
          >
            <GlassCard padding="md" className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
                {band.label}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mb-2">
                FY{band.start}–FY{Math.min(band.end, new Date().getFullYear())}
              </p>
              <p className="text-2xl font-mono font-bold text-[var(--foreground)]">
                {avg.toFixed(1)}%
              </p>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                {formatCompact(totalCases)} cases
              </p>
            </GlassCard>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 4: YoY Velocity — Delta Chart
// ---------------------------------------------------------------------------

function VelocityChart({ data }: { data: PermDetailPoint[] }) {
  const velocityData = data
    .filter((d) => d.yoy_approval_rate_change != null && d.fiscal_year >= 2009)
    .map((d) => ({
      ...d,
      fillColor: (d.yoy_approval_rate_change ?? 0) >= 0 ? COLORS.yoyPositive : COLORS.yoyNegative,
    }));

  return (
    <GlassCard variant="elevated" padding="lg">
      <div className="mb-4">
        <h3 className="text-base font-bold text-[var(--foreground)]">
          YoY Approval Rate Velocity
        </h3>
        <p className="text-xs text-[var(--muted-foreground)]">
          Year-over-year change in approval rate (percentage points) · Green = improving, Red = declining
        </p>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={velocityData} barCategoryGap="15%">
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="fiscal_year"
              tickFormatter={(v: number) => `FY${String(v).slice(2)}`}
              tick={{ fill: COLORS.axis, fontSize: 10 }}
              axisLine={{ stroke: COLORS.grid }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`}
              tick={{ fill: COLORS.axis, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
            <Tooltip content={<VelocityTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="yoy_approval_rate_change" radius={[4, 4, 0, 0]}>
              {velocityData.map((entry, i) => (
                <Cell key={i} fill={entry.fillColor} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Section 5: Cross-Track Comparison — Horizontal Bars
// ---------------------------------------------------------------------------

function CrossTrackChart({ categories }: { categories: CategoryRow[] }) {
  const chartData = categories.map((c) => ({
    ...c,
    label: sourceLabel(c.data_source),
    fullLabel: categoryLabel(c.visa_category),
  }));

  return (
    <GlassCard variant="elevated" padding="lg">
      <div className="mb-4">
        <h3 className="text-base font-bold text-[var(--foreground)]">
          Cross-Track Comparison
        </h3>
        <p className="text-xs text-[var(--muted-foreground)]">
          Approval rates across 3 immigration tracks · All-time totals
        </p>
      </div>

      <div className="space-y-4">
        {chartData.map((row, i) => {
          const approvalWidth = Math.max(row.approval_rate_pct, 0);
          const denialWidth = Math.max(row.denial_rate_pct, 0);
          return (
            <motion.div
              key={row.data_source}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4, ease: EASING }}
              className="space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {row.label}
                  </span>
                  <span className="ml-2 text-[10px] text-[var(--muted-foreground)]">
                    {row.fullLabel}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[var(--muted-foreground)]">
                    {formatCompact(row.total_cases)} cases
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    {row.approval_rate_pct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex h-6 w-full overflow-hidden rounded-lg">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${approvalWidth}%` }}
                  transition={{ duration: 0.8, ease: EASING, delay: i * 0.1 }}
                  className="bg-emerald-500/80 flex items-center justify-end pr-2"
                >
                  {approvalWidth > 30 && (
                    <span className="text-[10px] font-mono font-bold text-white">
                      {row.approval_rate_pct.toFixed(1)}%
                    </span>
                  )}
                </motion.div>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${denialWidth}%` }}
                  transition={{ duration: 0.8, ease: EASING, delay: i * 0.1 + 0.1 }}
                  className="bg-rose-500/80 flex items-center justify-start pl-1"
                >
                  {denialWidth > 5 && (
                    <span className="text-[10px] font-mono font-bold text-white">
                      {row.denial_rate_pct.toFixed(1)}%
                    </span>
                  )}
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-4 text-[10px] text-[var(--muted-foreground)] text-center flex items-center justify-center gap-1">
        <Info className="h-3 w-3" />
        Visa Applications show 100% due to incomplete refusal tracking in recent fiscal years
      </p>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Section 6: Your Risk Window — Personalized Context
// ---------------------------------------------------------------------------

function RiskWindow({ data }: { data: PermDetailPoint[] }) {
  const [priorityDate, setPriorityDate] = useState<string | null>(null);

  useEffect(() => {
    const profile = secureGet("user_profile");
    if (profile) {
      try {
        const p = JSON.parse(profile);
        if (p.priorityDate) setPriorityDate(p.priorityDate);
      } catch { /* ignore */ }
    }
  }, []);

  if (!priorityDate) {
    return (
      <GlassCard padding="lg" className="border-dashed border-blue-500/[0.15]">
        <div className="flex flex-col items-center py-4 text-center">
          <Target className="h-6 w-6 text-blue-400/70 mb-2" />
          <p className="text-sm font-medium text-[var(--foreground)] mb-1">
            See your personal approval climate
          </p>
          <p className="text-xs text-[var(--muted-foreground)] max-w-md">
            Visit <span className="underline underline-offset-2">/setup</span> and enter your priority date to see what the approval environment looked like when you filed—and how it compares to today.
          </p>
        </div>
      </GlassCard>
    );
  }

  const filedYear = new Date(priorityDate).getFullYear();
  const filedFy = filedYear; // rough approximation
  const filedData = data.find((d) => d.fiscal_year === filedFy);
  const latestFull = data.filter((d) => !isPartialYear(d.fiscal_year, d.total)).slice(-1)[0];

  if (!filedData || !latestFull) return null;

  const delta = latestFull.approval_rate - filedData.approval_rate;
  const improving = delta >= 0;

  return (
    <FadeIn>
      <GlassCard variant="elevated" padding="lg" glow>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border",
              improving
                ? "bg-emerald-400/10 border-emerald-400/20"
                : "bg-rose-400/10 border-rose-400/20"
            )}>
              {improving
                ? <ArrowUpRight className="h-5 w-5 text-emerald-400" />
                : <ArrowDownRight className="h-5 w-5 text-rose-400" />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Your Filing Year
              </p>
              <p className="text-2xl font-mono font-bold text-[var(--foreground)]">
                FY{filedFy}
              </p>
            </div>
          </div>

          <div className="sm:border-l sm:border-white/[0.08] sm:pl-4 flex flex-wrap gap-4 items-center">
            <div className="text-center sm:text-left">
              <p className="text-[10px] text-[var(--muted-foreground)]">When you filed</p>
              <p className="text-lg font-mono font-bold text-[var(--foreground)]">
                {filedData.approval_rate.toFixed(1)}%
              </p>
            </div>
            <div className="text-[var(--muted-foreground)]">→</div>
            <div className="text-center sm:text-left">
              <p className="text-[10px] text-[var(--muted-foreground)]">Today (FY{latestFull.fiscal_year})</p>
              <p className="text-lg font-mono font-bold text-emerald-400">
                {latestFull.approval_rate.toFixed(1)}%
              </p>
            </div>
            <span className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold border",
              improving
                ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                : "bg-rose-400/10 text-rose-400 border-rose-400/20"
            )}>
              {improving ? "+" : ""}{delta.toFixed(1)}pp since filing
            </span>
          </div>
        </div>
      </GlassCard>
    </FadeIn>
  );
}

// ---------------------------------------------------------------------------
// Section 7: Heat Grid — 19-year Approval Calendar
// ---------------------------------------------------------------------------

function HeatGrid({ data }: { data: PermDetailPoint[] }) {
  // Color interpolation: low(red) → mid(amber) → high(green)
  function rateColor(rate: number): string {
    if (rate >= 96) return "bg-emerald-500/80 border-emerald-500/30";
    if (rate >= 94) return "bg-emerald-500/50 border-emerald-500/20";
    if (rate >= 91) return "bg-blue-500/50 border-blue-500/20";
    if (rate >= 88) return "bg-amber-500/50 border-amber-500/20";
    if (rate >= 85) return "bg-amber-500/70 border-amber-500/30";
    return "bg-rose-500/60 border-rose-500/30";
  }

  const maxTotal = Math.max(...data.map((d) => d.total));

  return (
    <GlassCard variant="elevated" padding="lg">
      <div className="mb-4">
        <h3 className="text-base font-bold text-[var(--foreground)]">
          19-Year Approval Heatmap
        </h3>
        <p className="text-xs text-[var(--muted-foreground)]">
          Each cell = 1 fiscal year · Color = approval rate · Size = case volume
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {data.map((d, i) => {
          const partial = isPartialYear(d.fiscal_year, d.total);
          // Scale cell size between 52 and 80 based on total
          const size = 52 + ((d.total / maxTotal) * 28);
          return (
            <motion.div
              key={d.fiscal_year}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03, duration: 0.3, ease: EASING }}
              title={`FY${d.fiscal_year}: ${d.approval_rate.toFixed(1)}% approved | ${formatNumber(d.total)} cases${partial ? " (partial)" : ""}`}
              className={cn(
                "rounded-xl border flex flex-col items-center justify-center transition-all cursor-default group hover:scale-110 hover:z-10",
                rateColor(d.approval_rate),
                partial && "opacity-60 border-dashed"
              )}
              style={{ width: size, height: size }}
            >
              <span className="text-[10px] font-mono font-semibold text-white/90">
                FY{String(d.fiscal_year).slice(2)}
              </span>
              <span className="text-[13px] font-mono font-bold text-white">
                {d.approval_rate.toFixed(0)}%
              </span>
              <span className="text-[8px] font-mono text-white/60">
                {formatCompact(d.total)}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-4 text-[10px] text-[var(--muted-foreground)]">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500/60" /> &lt;85%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/50" /> 85–93%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/50" /> 91–93%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/50" /> 94–95%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/80" /> 96%+
        </span>
        <span className="ml-2 flex items-center gap-1">
          <span className="h-2.5 w-4 rounded-sm border border-dashed border-white/30 bg-transparent" /> Partial
        </span>
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Component (exported)
// ---------------------------------------------------------------------------

export function ApprovalDenialDashboard() {
  const [summary, setSummary] = useState<ApprovalSummary | null>(null);
  const [permDetailed, setPermDetailed] = useState<PermDetailPoint[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sum, perm, cats] = await Promise.all([
          loadApprovalSummary(),
          loadPermDetailed(),
          loadCategoryComparison(),
        ]);
        if (cancelled) return;
        setSummary(sum);
        setPermDetailed(perm.data_points);
        setCategories(cats);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <GlassCard padding="lg">
        <p className="text-sm text-rose-400">
          Failed to load approval/denial data{error ? `: ${error}` : ""}
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-8" data-testid="approval-denial-dashboard">
      {/* ── Section 1: KPI Hero Row ────────────────────────────────────── */}
      <KpiHeroRow summary={summary} />

      {/* ── Section 2: Approval Pulse (combo chart) ────────────────────── */}
      <FadeIn>
        <div className="space-y-2">
          <ApprovalPulseChart data={permDetailed} showAdmin={showAdmin} />
          {/* Admin toggle */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowAdmin((s) => !s)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                showAdmin
                  ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] border-white/[0.08] hover:border-white/[0.15]"
              )}
            >
              <Calendar className="h-3 w-3" />
              {showAdmin ? "Hide" : "Show"} Administration Bands
            </button>
          </div>
        </div>
      </FadeIn>

      {/* ── Section 3: Administration Effect (stats bar) ────────────── */}
      <AnimatePresence>
        {showAdmin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: EASING }}
          >
            <FadeIn>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                  Average Approval Rate by Administration
                </h3>
                <AdminStatsBar data={permDetailed} />
              </div>
            </FadeIn>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section 4: YoY Velocity ────────────────────────────────────── */}
      <FadeIn>
        <VelocityChart data={permDetailed} />
      </FadeIn>

      {/* ── Section 5: Cross-Track Comparison ──────────────────────────── */}
      <FadeIn>
        <CrossTrackChart categories={categories} />
      </FadeIn>

      {/* ── Section 6: Your Risk Window (personalized) ─────────────────── */}
      <RiskWindow data={permDetailed} />

      {/* ── Section 7: Heat Grid ───────────────────────────────────────── */}
      <FadeIn>
        <HeatGrid data={permDetailed} />
      </FadeIn>

      {/* ── Methodology ─────────────────────────────────────────────────── */}
      <FadeIn>
        <GlassCard padding="md">
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2">
              <Info className="h-3.5 w-3.5" />
              About this data
              <span className="ml-auto text-[10px] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-3 space-y-2 text-xs text-[var(--muted-foreground)] leading-relaxed">
              <p>
                <strong className="text-[var(--foreground)]">PERM Labor Certification:</strong>{" "}
                1.67M cases across 19 fiscal years (FY2008–FY2026). Approval rates are calculated on
                decided cases only (CERTIFIED + DENIED), excluding withdrawn applications. CERTIFIED-EXPIRED
                cases are counted as CERTIFIED since the employer obtained initial certification.
              </p>
              <p>
                <strong className="text-[var(--foreground)]">USCIS Forms:</strong>{" "}
                3.6M petitions (I-140, I-485) across 12 fiscal years. Approval rates reflect form-level
                adjudications, not per-beneficiary outcomes.
              </p>
              <p>
                <strong className="text-[var(--foreground)]">Visa Applications:</strong>{" "}
                444K non-immigrant visa applications. Recent FY2024–2025 lack detailed refusal tracking,
                resulting in an estimated 100% issuance rate which may not reflect actual refusals.
              </p>
              <p>
                <strong className="text-[var(--foreground)]">Administration bands:</strong>{" "}
                Fiscal years are assigned by inauguration (Jan 20). Policies typically take effect
                1–2 FY after inauguration due to rulemaking lag. Correlation ≠ causation.
              </p>
            </div>
          </details>
        </GlassCard>
      </FadeIn>
    </div>
  );
}
