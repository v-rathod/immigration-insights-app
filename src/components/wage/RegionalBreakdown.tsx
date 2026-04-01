/**
 * RegionalBreakdown — Horizontal ranked bar chart for top-paying states.
 *
 * Shows the top-N states for the selected job category code by median salary,
 * with a gradient bar from low (blue) to high (purple) tones.
 */
"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import type { SalaryBenchmark } from "@/lib/data/wage";

interface RegionalBreakdownProps {
  states: SalaryBenchmark[];
  className?: string;
}

export function RegionalBreakdown({ states, className }: RegionalBreakdownProps) {
  const sorted = useMemo(
    () => [...states].sort((a, b) => b.median - a.median),
    [states]
  );

  if (sorted.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8", className)}>
        <p className="text-sm text-[var(--muted-foreground)]">No state-level breakdown available</p>
        <p className="text-xs text-[var(--muted-foreground)]/60 max-w-xs text-center">
          Regional salary data requires sufficient LCA filings across multiple states. Smaller employers may not have enough geographic diversity.
        </p>
      </div>
    );
  }

  const maxMedian = sorted[0].median;
  const minMedian = sorted[sorted.length - 1].median;
  const range = maxMedian - minMedian || 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={cn("w-full space-y-2", className)}
    >
      {sorted.map((state, i) => {
        const barWidth = ((state.median - minMedian) / range) * 80 + 20; // 20–100%
        const intensity = (state.median - minMedian) / range; // 0–1
        const r = Math.round(59 + intensity * (139 - 59));   // blue→purple
        const g = Math.round(130 - intensity * 50);
        const b = Math.round(246 - intensity * (246 - 246));
        const barColor = `rgba(${r}, ${g}, ${b + Math.round(intensity * 50)}, 0.7)`;

        return (
          <motion.div
            key={state.area_code}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: i * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center gap-3"
          >
            {/* Rank */}
            <span className="w-5 text-right text-[10px] font-mono text-[rgba(255,255,255,0.25)] shrink-0">
              {i + 1}
            </span>

            {/* State name */}
            <span className="w-32 text-xs font-medium text-[var(--foreground)] truncate shrink-0">
              {state.area_title || state.area_code}
            </span>

            {/* Bar */}
            <div className="flex-1 h-5 relative rounded-sm overflow-hidden bg-white/[0.04]">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{
                  width: `${barWidth}%`,
                  transformOrigin: "left center",
                  background: `linear-gradient(90deg, ${barColor}, ${barColor.replace("0.7", "0.9")})`,
                }}
              />
            </div>

            {/* Value */}
            <span className="w-24 text-right text-xs font-mono font-semibold text-white shrink-0">
              {formatCurrency(state.median)}
            </span>

            {/* 75th pct hint */}
            <span className="hidden sm:block w-20 text-right text-[10px] font-mono text-[var(--muted-foreground)] shrink-0">
              75th% {formatCurrency(state.p75)}
            </span>
          </motion.div>
        );
      })}

      <div className="pt-2 border-t border-white/[0.06]">
        <p className="text-[10px] text-[var(--muted-foreground)]">
          Source: U.S. Bureau of Labor Statistics · Annual salary · Sorted by median
        </p>
      </div>
    </motion.div>
  );
}
