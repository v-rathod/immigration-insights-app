/**
 * WageGrowthLeaderboard — "Rising Stars" section showing top salary growers.
 *
 * Uses employer_salary_trend to compute 5-year CAGR per employer and
 * renders an animated ranked leaderboard. Always visible at the bottom
 * of the Wage Intelligence Hub — no search required.
 */
"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Flame, Users, Trophy, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCompact } from "@/lib/utils/format";
import { GlassCard } from "@/components/ui/glass-card";
import { FadeIn } from "@/components/ui/animations";
import {
  getTopWageGrowers,
  type EmployerSalaryTrend,
  type EmployerGrowthStats,
} from "@/lib/data/wage";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WageGrowthLeaderboardProps {
  trend: EmployerSalaryTrend[];
  onSelectEmployer?: (name: string) => void;
}

type LeaderboardMode = "cagr" | "yoy" | "volume";

const MODES: Array<{ id: LeaderboardMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "cagr", label: "5yr Growth", icon: TrendingUp },
  { id: "yoy", label: "Latest YoY", icon: ArrowUpRight },
  { id: "volume", label: "Filing Volume", icon: Users },
];

// ---------------------------------------------------------------------------
// Leaderboard row
// ---------------------------------------------------------------------------

function LeaderRow({
  rank,
  stat,
  mode,
  maxValue,
  onSelect,
}: {
  rank: number;
  stat: EmployerGrowthStats;
  mode: LeaderboardMode;
  maxValue: number;
  onSelect?: () => void;
}) {
  const displayValue =
    mode === "cagr"
      ? stat.cagr_5yr != null
        ? `+${stat.cagr_5yr}%`
        : "—"
      : mode === "yoy"
      ? stat.yoy_latest != null
        ? `${stat.yoy_latest > 0 ? "+" : ""}${stat.yoy_latest}%`
        : "—"
      : formatCompact(stat.total_filings);

  const rawValue =
    mode === "cagr"
      ? (stat.cagr_5yr ?? 0)
      : mode === "yoy"
      ? (stat.yoy_latest ?? 0)
      : stat.total_filings;

  const barWidth = maxValue > 0 ? Math.max(4, (rawValue / maxValue) * 100) : 4;

  const valueColor =
    mode === "volume"
      ? "text-blue-400"
      : rawValue > 0
      ? "text-emerald-400"
      : rawValue < 0
      ? "text-rose-400"
      : "text-[var(--muted-foreground)]";

  const rankColor =
    rank === 1
      ? "text-amber-400"
      : rank === 2
      ? "text-slate-300"
      : rank === 3
      ? "text-amber-700"
      : "text-[rgba(255,255,255,0.2)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.04 }}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent",
        onSelect && "hover:border-white/[0.08] hover:bg-white/[0.03] cursor-pointer transition-all group"
      )}
    >
      {/* Rank */}
      <span className={cn("w-5 text-right text-sm font-bold font-mono shrink-0", rankColor)}>
        {rank === 1 ? (
          <Trophy className="h-4 w-4 text-amber-400 inline" />
        ) : (
          rank
        )}
      </span>

      {/* Name */}
      <div className="w-44 shrink-0 min-w-0">
        <p className="text-sm font-medium truncate text-[var(--foreground)] transition-colors">
          {stat.employer_name}
        </p>
        <p className="text-[10px] text-[var(--muted-foreground)] font-mono truncate">
          {formatCurrency(stat.latest_median)} median · FY{stat.latest_year}
        </p>
      </div>

      {/* Animated bar */}
      <div className="flex-1 hidden sm:block">
        <div className="h-4 rounded-sm bg-white/[0.04] overflow-hidden">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.1 + rank * 0.035, ease: [0.25, 0.1, 0.25, 1] }}
            className="h-full rounded-sm bg-gradient-to-r from-blue-600/60 to-purple-600/70"
            style={{ width: `${barWidth}%`, transformOrigin: "left center" }}
          />
        </div>
      </div>

      {/* Value */}
      <span className={cn("text-sm font-bold font-mono shrink-0 w-16 text-right", valueColor)}>
        {displayValue}
      </span>

      {/* Streak fire */}
      {stat.streak >= 3 && (
        <span title={`${stat.streak} consecutive years of raises`} className="shrink-0">
          <Flame className={cn("h-3.5 w-3.5", stat.streak >= 5 ? "text-amber-400" : "text-orange-400/70")} />
        </span>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WageGrowthLeaderboard({
  trend,
  onSelectEmployer,
}: WageGrowthLeaderboardProps) {
  const [mode, setMode] = useState<LeaderboardMode>("cagr");
  const [visaType, setVisaType] = useState<"H-1B" | "PERM">("H-1B");

  // Pre-compute growth stats for all qualifying employers
  const growers = useMemo(
    () => getTopWageGrowers(trend, visaType, 15, 5, 30),
    [trend, visaType]
  );

  // Sort based on mode
  const sorted = useMemo((): EmployerGrowthStats[] => {
    // In growth modes, exclude entries without a valid metric so only meaningful data is ranked
    if (mode === "cagr")
      return [...growers]
        .filter((s) => s.cagr_5yr != null)
        .sort((a, b) => (b.cagr_5yr ?? 0) - (a.cagr_5yr ?? 0));
    if (mode === "yoy")
      return [...growers]
        .filter((s) => s.yoy_latest != null)
        .sort((a, b) => (b.yoy_latest ?? 0) - (a.yoy_latest ?? 0));
    return [...growers].sort((a, b) => b.total_filings - a.total_filings);
  }, [growers, mode]);

  const maxValue = useMemo(() => {
    if (mode === "cagr") return Math.max(...sorted.map((s) => s.cagr_5yr ?? 0), 1);
    if (mode === "yoy") return Math.max(...sorted.map((s) => s.yoy_latest ?? 0), 1);
    return Math.max(...sorted.map((s) => s.total_filings), 1);
  }, [sorted, mode]);

  if (growers.length === 0) return null;

  return (
    <FadeIn delay={0.15}>
      <GlassCard variant="elevated" padding="lg">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-[var(--foreground)]">Rising Stars</h3>
              <span className="text-xs text-[var(--muted-foreground)] font-mono">
                Top salary growers among major {visaType} sponsors
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Visa type toggle */}
            <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
              {(["H-1B", "PERM"] as const).map((vt) => (
                <button
                  key={vt}
                  onClick={() => setVisaType(vt)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-all",
                    visaType === vt
                      ? "bg-blue-500/20 text-blue-300"
                      : "text-[var(--muted-foreground)] hover:text-white"
                  )}
                >
                  {vt}
                </button>
              ))}
            </div>

            {/* Sort mode */}
            <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
              {MODES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all",
                    mode === id
                      ? "bg-purple-500/20 text-purple-300"
                      : "text-[var(--muted-foreground)] hover:text-white"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-3 mb-1.5">
          <span className="w-5 shrink-0" />
          <span className="w-44 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] shrink-0">
            Employer
          </span>
          <span className="flex-1 hidden sm:block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {mode === "cagr" ? "5-year salary growth" : mode === "yoy" ? "latest year-over-year" : "filing volume"}
          </span>
          <span className="w-16 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] shrink-0">
            {mode === "cagr" ? "Growth" : mode === "yoy" ? "YoY" : "Filings"}
          </span>
          <span className="w-3.5 shrink-0" />
        </div>

        {/* Rows */}
        <div className="space-y-0.5">
          {sorted.map((stat, i) => (
            <LeaderRow
              key={stat.employer_name}
              rank={i + 1}
              stat={stat}
              mode={mode}
              maxValue={maxValue}
              onSelect={onSelectEmployer ? () => onSelectEmployer(stat.employer_name) : undefined}
            />
          ))}
        </div>

        <p className="mt-4 text-[10px] text-[var(--muted-foreground)]">
          Source: U.S. Department of Labor employer filings · Based on employers with 5+ years of data and 30+ annual applications · 🔥 = 3+ consecutive years of raises
        </p>
      </GlassCard>
    </FadeIn>
  );
}
