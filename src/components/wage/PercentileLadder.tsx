/**
 * PercentileLadder — Horizontal P10→P90 gradient visualization.
 *
 * Levels.fyi-inspired wage distribution bar with marker pins for
 * each percentile breakpoint and an optional "Your Offer" pin.
 */
"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import type { SalaryBenchmark } from "@/lib/data/wage";

interface PercentileLadderProps {
  benchmark: SalaryBenchmark;
  userWage?: number;
  className?: string;
}

const PERCENTILES: Array<{ key: keyof SalaryBenchmark; label: string; pct: string }> = [
  { key: "p10", label: "P10", pct: "10th" },
  { key: "p25", label: "P25", pct: "25th" },
  { key: "median", label: "Median", pct: "50th" },
  { key: "p75", label: "P75", pct: "75th" },
  { key: "p90", label: "P90", pct: "90th" },
];

export function PercentileLadder({ benchmark, userWage, className }: PercentileLadderProps) {
  const { p10, p25, median, p75, p90 } = benchmark;
  const min = p10;
  const max = p90;
  const range = max - min || 1;

  // Position as % of the bar [0–100]
  const pctPos = (v: number) => Math.min(100, Math.max(0, ((v - min) / range) * 100));

  const userPos = userWage ? pctPos(userWage) : null;
  const userLabel = userWage
    ? userWage >= p90 ? "Top 10%"
    : userWage >= p75 ? "Top 25%"
    : userWage >= median ? "Above Median"
    : userWage >= p25 ? "Below Median"
    : "Bottom Quartile"
    : null;
  const userColor = userWage
    ? userWage >= p75 ? "text-emerald-400 border-emerald-400 bg-emerald-400/10"
    : userWage >= p25 ? "text-blue-400 border-blue-400 bg-blue-400/10"
    : "text-amber-400 border-amber-400 bg-amber-400/10"
    : "";

  const segments = useMemo(() => [
    { from: p10, to: p25, color: "from-blue-900/30 to-blue-700/40" },
    { from: p25, to: median, color: "from-blue-700/40 to-blue-500/60" },
    { from: median, to: p75, color: "from-blue-500/60 to-purple-500/70" },
    { from: p75, to: p90, color: "from-purple-500/70 to-purple-400/80" },
  ], [p10, p25, median, p75, p90]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn("w-full space-y-4", className)}
    >
      {/* Main bar */}
      <div className="relative h-10">
        {/* Background track */}
        <div className="absolute inset-y-2 inset-x-0 rounded-full bg-white/[0.04] border border-white/[0.08]" />

        {/* Gradient segments */}
        <div className="absolute inset-y-2 inset-x-0 overflow-hidden rounded-full">
          {segments.map((seg, i) => {
            const leftPct = pctPos(seg.from);
            const widthPct = pctPos(seg.to) - leftPct;
            return (
              <motion.div
                key={i}
                initial={{ scaleX: 0, originX: 0 }}
                animate={{ scaleX: 1, originX: 0 }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                className={cn("absolute inset-y-0 bg-gradient-to-r", seg.color)}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                }}
              />
            );
          })}
        </div>

        {/* Percentile tick marks */}
        {PERCENTILES.map(({ key, label }) => {
          const val = benchmark[key] as number;
          const pos = pctPos(val);
          const isMedian = key === "median";
          return (
            <div
              key={key}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
            >
              <div className={cn(
                "w-px h-2",
                isMedian ? "bg-white/60" : "bg-white/30"
              )} />
              <div className={cn(
                "w-1.5 h-1.5 rounded-full mt-1.5",
                isMedian ? "bg-white/80" : "bg-white/40"
              )} />
            </div>
          );
        })}

        {/* User wage pin */}
        {userPos !== null && userWage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="absolute top-0 flex flex-col items-center z-10"
            style={{ left: `${userPos}%`, transform: "translateX(-50%)" }}
          >
            {/* Triangle pointer */}
            <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-emerald-400 mt-0.5" />
            <div className="w-px h-2 bg-emerald-400" />
          </motion.div>
        )}
      </div>

      {/* Labels row */}
      <div className="relative h-8">
        {PERCENTILES.map(({ key, label, pct }) => {
          const val = benchmark[key] as number;
          const pos = pctPos(val);
          const isMedian = key === "median";
          return (
            <div
              key={key}
              className="absolute flex flex-col items-center"
              style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
            >
              <span className={cn(
                "text-[10px] font-semibold font-mono whitespace-nowrap",
                isMedian ? "text-white" : "text-[var(--muted-foreground)]"
              )}>
                {label}
              </span>
              <span className={cn(
                "text-[10px] font-mono whitespace-nowrap",
                isMedian ? "text-blue-400" : "text-[rgba(255,255,255,0.3)]"
              )}>
                {formatCurrency(val)}
              </span>
            </div>
          );
        })}
      </div>

      {/* User offer annotation */}
      {userWage && userLabel && userPos !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-3 pt-1"
        >
          <span className="text-xs text-[var(--muted-foreground)]">Your offer</span>
          <span className={cn(
            "text-xs font-mono font-bold px-2.5 py-1 rounded-full border",
            userColor
          )}>
            {formatCurrency(userWage)}
          </span>
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full border",
            userColor
          )}>
            {userLabel}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
