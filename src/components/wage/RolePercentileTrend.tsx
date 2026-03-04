/**
 * RolePercentileTrend — 5-year salary distribution chart for an employer × role.
 *
 * Displays stacked area bands for p10→p25→p50→p75→p90 salary percentiles,
 * with filing count annotations and optional OEWS national median reference line.
 *
 * Data source: employer_role_trends.json (pre-computed in P2 Meridian).
 */
"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { motion } from "framer-motion";
import { BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCompact } from "@/lib/utils/format";
import { GlassCard } from "@/components/ui/glass-card";
import { FadeIn } from "@/components/ui/animations";
import type { EmployerRoleTrend } from "@/lib/data/wage";

// ---------------------------------------------------------------------------
// Band definitions
// ---------------------------------------------------------------------------

const BANDS = [
  { key: "p90_salary", label: "90th", color: "#8b5cf6", opacity: 0.12 },
  { key: "p75_salary", label: "75th", color: "#6366f1", opacity: 0.18 },
  { key: "median_salary", label: "Median", color: "#3b82f6", opacity: 0.25 },
  { key: "p25_salary", label: "25th", color: "#06b6d4", opacity: 0.18 },
  { key: "p10_salary", label: "10th", color: "#14b8a6", opacity: 0.12 },
] as const;

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function PercentileTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: Record<string, number> }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="bg-[var(--card)] border border-white/[0.12] rounded-xl px-4 py-3 text-xs shadow-xl min-w-[180px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[var(--muted-foreground)] font-semibold">FY {label}</span>
        <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
          <Users className="h-3 w-3" />
          {formatCompact(row.n_filings)} filings
        </span>
      </div>
      <div className="space-y-1">
        {BANDS.map(({ key, label: bandLabel, color }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[var(--muted-foreground)]">{bandLabel}</span>
            </div>
            <span className="font-mono font-bold text-white">
              {formatCurrency(row[key])}
            </span>
          </div>
        ))}
      </div>
      {row.oews_national_median > 0 && (
        <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[var(--muted-foreground)]">OEWS National</span>
          <span className="font-mono text-emerald-400">{formatCurrency(row.oews_national_median)}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

function TrendSummary({ series }: { series: EmployerRoleTrend[] }) {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];

  const medianGrowth =
    first.median_salary > 0
      ? Math.round(((last.median_salary - first.median_salary) / first.median_salary) * 1000) / 10
      : null;

  const spreadLatest = last.p90_salary - last.p10_salary;
  const spreadFirst = first.p90_salary - first.p10_salary;
  const spreadChange =
    spreadFirst > 0 ? Math.round(((spreadLatest - spreadFirst) / spreadFirst) * 1000) / 10 : null;

  const totalFilings = series.reduce((s, r) => s + r.n_filings, 0);

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {medianGrowth !== null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex flex-col gap-0.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Median Growth
          </span>
          <span
            className={cn(
              "text-sm font-bold font-mono",
              medianGrowth >= 0 ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {medianGrowth > 0 ? "+" : ""}
            {medianGrowth}%
          </span>
          <span className="text-[10px] text-[var(--muted-foreground)]">
            FY{first.fiscal_year}–{last.fiscal_year}
          </span>
        </motion.div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="flex flex-col gap-0.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Salary Range
        </span>
        <span className="text-sm font-bold font-mono text-white">
          {formatCurrency(last.p10_salary)} – {formatCurrency(last.p90_salary)}
        </span>
        <span className="text-[10px] text-[var(--muted-foreground)]">
          p10 to p90 (FY{last.fiscal_year})
        </span>
      </motion.div>
      {spreadChange !== null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="flex flex-col gap-0.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {totalFilings > 0 ? "Total Filings" : "Spread Δ"}
          </span>
          <span className="text-sm font-bold font-mono text-white">
            {totalFilings > 0 ? formatCompact(totalFilings) : `${spreadChange > 0 ? "+" : ""}${spreadChange}%`}
          </span>
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {totalFilings > 0
              ? `FY${first.fiscal_year}–${last.fiscal_year}`
              : "p90–p10 spread change"}
          </span>
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface RolePercentileTrendProps {
  series: EmployerRoleTrend[];
  employerName: string;
  socTitle: string;
  socCode: string;
}

export function RolePercentileTrend({
  series,
  employerName,
  socTitle,
  socCode,
}: RolePercentileTrendProps) {
  // Pre-process: compute band ranges for area chart stacking
  const chartData = useMemo(
    () =>
      series.map((row) => ({
        ...row,
        // Recharts needs these for independent area rendering (not stacked)
        // We'll render each band as a standalone area
      })),
    [series]
  );

  const latestOews = useMemo(() => {
    const withOews = series.filter((r) => r.oews_national_median > 0);
    return withOews.length > 0 ? withOews[withOews.length - 1].oews_national_median : null;
  }, [series]);

  const yMin = useMemo(() => {
    const mins = series.map((r) => r.p10_salary);
    return Math.floor((Math.min(...mins) * 0.9) / 10000) * 10000;
  }, [series]);

  const yMax = useMemo(() => {
    const maxes = series.map((r) => r.p90_salary);
    return Math.ceil((Math.max(...maxes) * 1.05) / 10000) * 10000;
  }, [series]);

  if (series.length === 0) {
    return (
      <GlassCard variant="elevated" padding="md">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)] py-4">
          <BarChart3 className="h-4 w-4" />
          <p className="text-sm">No multi-year trend data for this role.</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <FadeIn>
      <GlassCard variant="elevated" padding="lg">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Salary Distribution Trend
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              {socTitle}
              <span className="font-mono ml-1">({socCode})</span>
              <span className="mx-1">·</span>
              {employerName}
              <span className="mx-1">·</span>
              FY{series[0].fiscal_year}–FY{series[series.length - 1].fiscal_year}
            </p>
          </div>
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
            {BANDS.map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <TrendSummary series={series} />

        {/* Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
              <defs>
                {BANDS.map(({ key, color, opacity }) => (
                  <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={opacity} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(128,128,160,0.12)"
                vertical={false}
              />
              <XAxis
                dataKey="fiscal_year"
                tick={{
                  fill: "#9ca3af",
                  fontSize: 11,
                  fontFamily: "var(--font-geist-mono)",
                }}
                axisLine={{ stroke: "rgba(128,128,160,0.2)" }}
                tickLine={false}
                label={{
                  value: "Fiscal Year",
                  position: "insideBottom",
                  offset: -12,
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{
                  fill: "#9ca3af",
                  fontSize: 11,
                  fontFamily: "var(--font-geist-mono)",
                }}
                axisLine={{ stroke: "rgba(128,128,160,0.2)" }}
                tickLine={false}
                width={72}
                tickFormatter={(v) => `$${Math.round(v / 1000)}K`}
              />
              <Tooltip
                content={<PercentileTooltip />}
                cursor={{ stroke: "rgba(255,255,255,0.08)" }}
              />

              {/* OEWS national median reference line */}
              {latestOews && (
                <ReferenceLine
                  y={latestOews}
                  stroke="#10b981"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: `OEWS ${formatCurrency(latestOews)}`,
                    fill: "#10b981",
                    fontSize: 10,
                    position: "right",
                  }}
                />
              )}

              {/* Render bands from widest (p90) to narrowest (p10) */}
              {BANDS.map(({ key, color }) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={key === "median_salary" ? 2.5 : 1}
                  fill={`url(#grad-${key})`}
                  dot={false}
                  activeDot={
                    key === "median_salary"
                      ? {
                          r: 5,
                          fill: color,
                          stroke: `${color}66`,
                          strokeWidth: 8,
                        }
                      : false
                  }
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Footer note */}
        <p className="mt-3 text-[10px] text-[var(--muted-foreground)] text-center">
          Based on H-1B & PERM LCA filings · Salary percentiles calculated from prevailing & offered wages
        </p>
      </GlassCard>
    </FadeIn>
  );
}
