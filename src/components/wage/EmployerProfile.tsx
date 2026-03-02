/**
 * EmployerProfile — Deep-dive card shown when a user selects an employer.
 *
 * Sections:
 *   1. Growth badges (CAGR 5yr, latest YoY, filing count, consecutive raises)
 *   2. Salary trend chart — 2016→2025 median with YoY% tooltip
 *   3. Top roles at this employer (from FY2025 rankings data)
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
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Building2,
  ChevronRight,
  Briefcase,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCompact } from "@/lib/utils/format";
import { GlassCard } from "@/components/ui/glass-card";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import {
  computeEmployerGrowth,
  getEmployerTrend,
  getEmployerRoles,
  annotateWithYoy,
  WAGE_SANITY,
  type EmployerSalaryTrend,
  type EmployerWageRanking,
} from "@/lib/data/wage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployerProfileProps {
  employerName: string;
  trend: EmployerSalaryTrend[];
  rankings: EmployerWageRanking[];
  visaType?: "H-1B" | "PERM";
  onSelectSoc?: (soc: { code: string; title: string }) => void;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function SalaryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { yoy_pct?: number | null } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const salary = payload[0]?.value;
  const yoy = payload[0]?.payload?.yoy_pct;
  return (
    <div className="bg-[var(--card)] border border-white/[0.12] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-[var(--muted-foreground)] mb-1">FY {label}</p>
      <p className="font-mono font-bold text-white">{formatCurrency(salary)}</p>
      {yoy != null && (
        <p className={cn("mt-0.5 font-semibold", yoy >= 0 ? "text-emerald-400" : "text-rose-400")}>
          {yoy >= 0 ? "+" : ""}
          {yoy}% YoY
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Growth badge component
// ---------------------------------------------------------------------------

function GrowthBadge({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          {label}
        </span>
      </div>
      <span className={cn("text-base font-bold font-mono", color)}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EmployerProfile({
  employerName,
  trend,
  rankings,
  visaType = "H-1B",
  onSelectSoc,
}: EmployerProfileProps) {
  const series = useMemo(() => {
    // Filter out years with implausible salary values before rendering the chart
    const validated = getEmployerTrend(trend, employerName, visaType).filter(
      (r) => r.median_salary >= WAGE_SANITY.SALARY_FLOOR && r.median_salary <= WAGE_SANITY.SALARY_CEILING
    );
    return annotateWithYoy(validated);
  }, [trend, employerName, visaType]);

  const stats = useMemo(
    () => computeEmployerGrowth(trend, employerName, visaType),
    [trend, employerName, visaType]
  );

  const roles = useMemo(
    () => getEmployerRoles(rankings, employerName).slice(0, 8),
    [rankings, employerName]
  );

  if (!stats || series.length === 0) {
    return (
      <GlassCard variant="elevated" padding="md">
        <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
          No trend data available for {employerName}
        </p>
      </GlassCard>
    );
  }

  const cagrColor =
    (stats.cagr_5yr ?? 0) >= 5
      ? "text-emerald-400"
      : (stats.cagr_5yr ?? 0) >= 2
      ? "text-blue-400"
      : "text-amber-400";

  const yoyColor =
    (stats.yoy_latest ?? 0) > 0
      ? "text-emerald-400"
      : (stats.yoy_latest ?? 0) < 0
      ? "text-rose-400"
      : "text-[var(--muted-foreground)]";

  const YoyIcon =
    (stats.yoy_latest ?? 0) > 0
      ? TrendingUp
      : (stats.yoy_latest ?? 0) < 0
      ? TrendingDown
      : Minus;

  return (
    <FadeIn>
      <div className="space-y-5">

        {/* ── Growth badge row ────────────────────────────────────────── */}
        <StaggerContainer>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StaggerItem>
              <GrowthBadge
                label="Median Salary"
                value={formatCurrency(stats.latest_median)}
                color="text-white"
                icon={Building2}
              />
            </StaggerItem>
            <StaggerItem>
              <GrowthBadge
                label="5-Yr Growth"
                value={
                  stats.cagr_5yr != null ? `${stats.cagr_5yr > 0 ? "+" : ""}${stats.cagr_5yr}%` : "—"
                }
                color={cagrColor}
                icon={TrendingUp}
              />
            </StaggerItem>
            <StaggerItem>
              <GrowthBadge
                label="Last YoY"
                value={
                  stats.yoy_latest != null
                    ? `${stats.yoy_latest > 0 ? "+" : ""}${stats.yoy_latest}%`
                    : "—"
                }
                color={yoyColor}
                icon={YoyIcon}
              />
            </StaggerItem>
            <StaggerItem>
              <GrowthBadge
                label="Raise Streak"
                value={stats.streak > 0 ? `${stats.streak}yr` : "—"}
                color={stats.streak >= 3 ? "text-amber-400" : "text-[var(--muted-foreground)]"}
                icon={Flame}
              />
            </StaggerItem>
          </div>
        </StaggerContainer>

        {/* ── Salary trend chart ──────────────────────────────────────── */}
        <GlassCard variant="elevated" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {visaType} Salary Trend
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Median annual salary · FY{series[0]?.fiscal_year}–FY{series[series.length - 1]?.fiscal_year}
                {" · "}
                {formatCompact(stats.total_filings)} filings (latest yr)
                {(series.length < 5 || stats.total_filings < 30) && (
                  <span className="ml-1 text-amber-400/80">· Limited data — treat with caution</span>
                )}
              </p>
            </div>
            {stats.cagr_5yr != null && (
              <div className={cn("text-xs font-mono font-bold px-3 py-1.5 rounded-full border", cagrColor, "border-current bg-current/10")}>
                {stats.cagr_5yr > 0 ? "+" : ""}{stats.cagr_5yr}% / yr avg
              </div>
            )}
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                <defs>
                  <linearGradient id="empGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,160,0.15)" vertical={true} />
                <XAxis
                  dataKey="fiscal_year"
                  tick={{ fill: "#9ca3af", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
                  axisLine={{ stroke: "rgba(128,128,160,0.2)" }}
                  tickLine={false}
                  label={{ value: "Fiscal Year", position: "insideBottom", offset: -12, fill: "#6b7280", fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
                  axisLine={{ stroke: "rgba(128,128,160,0.2)" }}
                  tickLine={false}
                  width={72}
                  tickFormatter={(v) => `$${Math.round(v / 1000)}K`}
                />
                <Tooltip content={<SalaryTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
                {/* Median reference line */}
                <ReferenceLine
                  y={stats.latest_median}
                  stroke="rgba(59,130,246,0.25)"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="median_salary"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#empGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#3b82f6", stroke: "rgba(59,130,246,0.4)", strokeWidth: 8 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* ── Top roles table ─────────────────────────────────────────── */}
        {roles.length > 0 && (
          <GlassCard variant="elevated" padding="lg">
            <p className="text-sm font-semibold text-[var(--foreground)] mb-4">
              Top Roles at {employerName}
              <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
                FY{roles[0]?.fiscal_year} · {visaType}
              </span>
            </p>

            <div className="space-y-2">
              {roles.map((role, i) => {
                const premium = role.wage_premium_pct ?? 0;
                const premiumColor =
                  premium >= 20 ? "text-emerald-400" : premium >= 5 ? "text-blue-400" : "text-amber-400";

                return (
                  <motion.div
                    key={`${role.soc_code}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02]",
                      onSelectSoc && "hover:border-white/[0.12] hover:bg-white/[0.04] cursor-pointer transition-all group"
                    )}
                    onClick={() =>
                      onSelectSoc?.({ code: role.soc_code, title: role.soc_title })
                    }
                  >
                    {/* Rank */}
                    <span className="w-5 text-right text-[10px] font-mono text-[rgba(255,255,255,0.25)] shrink-0">
                      {i + 1}
                    </span>

                    {/* Role info */}
                    <Briefcase className="h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{role.soc_title}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)] font-mono truncate">
                        {role.soc_code}
                        {role.job_title_top ? ` · ${role.job_title_top}` : ""}
                        {role.worksite_state_top ? ` · ${role.worksite_state_top}` : ""}
                      </p>
                    </div>

                    {/* Filings */}
                    <span className="hidden sm:block text-xs text-[var(--muted-foreground)] font-mono shrink-0 w-16 text-right">
                      {formatCompact(role.n_filings)} filings
                    </span>

                    {/* Median */}
                    <span className="text-sm font-mono font-bold text-white shrink-0 w-24 text-right">
                      {formatCurrency(role.median_salary)}
                    </span>

                    {/* Premium */}
                    <span className={cn("text-xs font-semibold shrink-0 w-16 text-right hidden sm:block", premiumColor)}>
                      {premium >= 0 ? "+" : ""}
                      {Math.round(premium)}% mkt
                    </span>

                    {/* Arrow */}
                    {onSelectSoc && (
                      <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors shrink-0" />
                    )}
                  </motion.div>
                );
              })}
            </div>

            {onSelectSoc && (
              <p className="mt-3 text-[10px] text-[var(--muted-foreground)] text-center">
                Click any role to see the full market benchmark for that occupation
              </p>
            )}
          </GlassCard>
        )}
      </div>
    </FadeIn>
  );
}
