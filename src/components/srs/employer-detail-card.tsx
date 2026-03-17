/**
 * EmployerDetailCard — Key statistics panel for a selected employer.
 *
 * Shows approval/denial rates, case volume, wage ratios, risk flags,
 * and SOC/geographic breadth in a glassmorphic card layout.
 */
"use client";

import {
  CheckCircle,
  XCircle,
  FileText,
  DollarSign,
  MapPin,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Award,
  BarChart2,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatPercent, formatNumber, formatMonthYear } from "@/lib/utils/format";
import type { SponsorReliabilityScore, EmployerRiskFeature } from "@/types/p2-artifacts";

interface EmployerDetailCardProps {
  employer: SponsorReliabilityScore;
  risk?: EmployerRiskFeature;
  mlScore?: number;
  className?: string;
}

export function EmployerDetailCard({
  employer,
  risk,
  className,
}: EmployerDetailCardProps) {
  const trend = employer.approval_rate_trend_12v12;
  const trendIcon =
    trend != null && !isNaN(trend)
      ? trend > 0.05
        ? TrendingUp
        : trend < -0.05
          ? TrendingDown
          : Minus
      : null;
  const trendColor =
    trend != null && !isNaN(trend)
      ? trend > 0.05
        ? "text-emerald-400"
        : trend < -0.05
          ? "text-rose-400"
          : "text-zinc-400"
      : "text-zinc-400";

  const stats = [
    {
      label: "PERM Approval (36m)",
      value: formatPercent(employer.approval_rate_36m),
      icon: CheckCircle,
      color: "text-emerald-400",
      tooltip: "DOL PERM (green card) certification rate in the last 36 months",
    },
    {
      label: "PERM Denial (36m)",
      value: formatPercent(employer.denial_rate_36m),
      icon: XCircle,
      color:
        employer.denial_rate_36m > 0.1 ? "text-rose-400" : "text-zinc-400",
      tooltip: "DOL PERM (green card) denial rate in the last 36 months",
    },
    {
      label: "PERM Filings (36m)",
      value: formatNumber(employer.n_36m),
      icon: FileText,
      color: "text-blue-400",
      tooltip: "Green card (PERM) applications filed with DOL in the last 36 months",
    },
    {
      label: "H-1B Filings (36m)",
      value: employer.lca_filings_36m != null && !isNaN(employer.lca_filings_36m)
        ? formatNumber(employer.lca_filings_36m)
        : "—",
      icon: BarChart2,
      color: "text-violet-400",
      tooltip: "DOL LCA (H-1B) filings in the last 36 months",
    },
    {
      label: "H-1B per GC Filing",
      value: employer.lca_to_perm_ratio != null && !isNaN(employer.lca_to_perm_ratio)
        ? `${employer.lca_to_perm_ratio.toFixed(1)}×`
        : "—",
      icon: Award,
      color:
        employer.lca_to_perm_ratio != null && !isNaN(employer.lca_to_perm_ratio)
          ? employer.lca_to_perm_ratio <= 3
            ? "text-emerald-400"
            : employer.lca_to_perm_ratio <= 10
              ? "text-amber-400"
              : "text-rose-400"
          : "text-zinc-400",
      tooltip: "H-1B LCA filings per PERM (green card) application. Lower = more GC-committed. ≤3× excellent, 3–10× typical, 10×+ H-1B-heavy.",
      suffix: employer.lca_to_perm_ratio != null && !isNaN(employer.lca_to_perm_ratio)
        ? employer.lca_to_perm_ratio <= 3
          ? "GC-committed"
          : employer.lca_to_perm_ratio <= 10
            ? "typical"
            : "H-1B-heavy"
        : undefined,
    },
    {
      label: "Wage Ratio (Median)",
      value:
        employer.wage_ratio_med != null && !isNaN(employer.wage_ratio_med)
          ? `${(employer.wage_ratio_med * 100).toFixed(0)}%`
          : "—",
      icon: DollarSign,
      color:
        employer.wage_ratio_med >= 1.0
          ? "text-emerald-400"
          : "text-amber-400",
      suffix: "of market",
      tooltip: "Median offered wage as a percentage of OEWS prevailing wage for this occupation and location",
    },
    {
      label: "SOC Breadth",
      value: formatNumber(employer.soc_breadth_24m),
      icon: Briefcase,
      color: "text-purple-400",
      suffix: "occupations",
      tooltip: "Distinct occupation codes (SOC) sponsored in the last 24 months",
    },
    {
      label: "Site Breadth",
      value: formatNumber(employer.site_breadth_24m),
      icon: MapPin,
      color: "text-cyan-400",
      suffix: "locations",
      tooltip: "Distinct work site states sponsored in the last 24 months",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-6",
        className
      )}
    >
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          Key Metrics
        </h3>
        <div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Updated {formatMonthYear(employer.last_refreshed_at)}
          </span>
          {employer.months_active_36m > 0 && (
            <span>
              {employer.months_active_36m} months active
            </span>
          )}
          {trendIcon && trend != null && !isNaN(trend) && (
            <span
              className={cn("flex items-center gap-1 cursor-help", trendColor)}
              title={`Approval rate change over the past 12 months vs the prior 12 months: ${trend > 0 ? "+" : ""}${(trend * 100).toFixed(0)}%. Positive means improving; negative means declining.`}
            >
              {(() => {
                const Icon = trendIcon;
                return <Icon className="h-3 w-3" />;
              })()}
              Approval trend:{" "}
              <span className="font-semibold">
                {`${trend > 0 ? "+" : ""}${(trend * 100).toFixed(0)}%`}
              </span>
              <span className="text-[var(--muted-foreground)] font-normal">(12m vs prior 12m)</span>
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.3,
              delay: i * 0.05,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
            title={stat.tooltip}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon
                className={cn("h-3.5 w-3.5", stat.color)}
                strokeWidth={1.5}
              />
              <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                {stat.label}
              </span>
            </div>
            <div className="text-xl font-bold tabular-nums font-mono text-[var(--foreground)]">
              {stat.value}
            </div>
            {stat.suffix && (
              <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                {stat.suffix}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* WARN Act alert reserved for future release */}
    </motion.div>
  );
}
