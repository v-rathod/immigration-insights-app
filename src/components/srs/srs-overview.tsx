/**
 * SrsOverview — Aggregate statistics bar + tier distribution chart.
 *
 * Displayed at the top of the SRS dashboard before employer search.
 * Shows total employers, rated count, average score, WARN flags,
 * and a horizontal tier distribution bar.
 */
"use client";

import {
  Building2,
  Award,
  BarChart3,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatNumber, formatCompact, srsTierHex } from "@/lib/utils/format";
import { GlassCard, StatCard, StaggerContainer, StaggerItem } from "@/components/ui";
import type { SrsOverviewStats } from "@/lib/data/srs";

interface SrsOverviewProps {
  stats: SrsOverviewStats;
  className?: string;
}

export function SrsOverview({ stats, className }: SrsOverviewProps) {
  const tiers = [
    { label: "Excellent", count: stats.excellentCount, color: srsTierHex("excellent") },
    { label: "Good", count: stats.goodCount, color: srsTierHex("good") },
    { label: "Moderate", count: stats.moderateCount, color: srsTierHex("moderate") },
    { label: "Below Avg", count: stats.belowAverageCount, color: srsTierHex("below average") },
    { label: "Poor", count: stats.poorCount, color: srsTierHex("poor") },
  ];

  const totalRated = stats.ratedEmployers;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Stat Cards */}
      <StaggerContainer className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StaggerItem>
          <StatCard
            label="Total Employers"
            value={stats.totalEmployers}
            icon={Building2}
            format={formatCompact}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="SRS Rated"
            value={stats.ratedEmployers}
            icon={Award}
            format={formatCompact}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Avg SRS Score"
            value={stats.avgScore}
            icon={BarChart3}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="WARN Flagged"
            value={stats.warnFlaggedCount}
            icon={AlertTriangle}
          />
        </StaggerItem>
      </StaggerContainer>

      {/* Tier Distribution */}
      <GlassCard variant="default" padding="md">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-[var(--accent-blue)]" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Score Distribution
          </h3>
          <span className="text-xs text-[var(--muted-foreground)]">
            ({formatCompact(totalRated)} rated employers)
          </span>
        </div>

        {/* Stacked bar */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.04] flex">
          {tiers.map((tier) => {
            const pct = totalRated > 0 ? (tier.count / totalRated) * 100 : 0;
            if (pct === 0) return null;
            return (
              <motion.div
                key={tier.label}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{
                  duration: 0.8,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
                style={{ backgroundColor: tier.color }}
                title={`${tier.label}: ${formatNumber(tier.count)} (${pct.toFixed(1)}%)`}
                className="h-full first:rounded-l-full last:rounded-r-full"
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {tiers.map((tier) => (
            <div key={tier.label} className="flex items-center gap-1.5 text-xs">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: tier.color }}
              />
              <span className="text-[var(--muted-foreground)]">
                {tier.label}
              </span>
              <span className="font-mono tabular-nums text-[var(--foreground)]">
                {formatCompact(tier.count)}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
