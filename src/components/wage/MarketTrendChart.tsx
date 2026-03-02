/**
 * MarketTrendChart — 10-year animated area chart with P25/P75 band.
 *
 * Shows market_median line with shaded interquartile range (P25–P75).
 * Supports H-1B / PERM toggle via `visaType` prop.
 */
"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import type { SocSalaryMarket } from "@/lib/data/wage";

interface MarketTrendChartProps {
  data: SocSalaryMarket[];
  visaType: "H-1B" | "PERM";
  userWage?: number;
  className?: string;
}

interface TooltipPayload {
  payload?: {
    year: number;
    median: number;
    p25: number;
    p75: number;
    bandRange?: [number, number];
  };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.[0]?.payload) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/[0.12] bg-black/80 backdrop-blur-xl p-3 shadow-2xl">
      <p className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">FY {d.year}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-400" />
          <span className="text-xs text-[var(--muted-foreground)]">Median</span>
          <span className="ml-auto text-xs font-mono font-bold text-white">{formatCurrency(d.median)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-purple-400/60" />
          <span className="text-xs text-[var(--muted-foreground)]">P75</span>
          <span className="ml-auto text-xs font-mono text-white">{formatCurrency(d.p75)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-400/40" />
          <span className="text-xs text-[var(--muted-foreground)]">P25</span>
          <span className="ml-auto text-xs font-mono text-white">{formatCurrency(d.p25)}</span>
        </div>
      </div>
    </div>
  );
}

export function MarketTrendChart({ data, visaType, userWage, className }: MarketTrendChartProps) {
  const chartData = useMemo(() => {
    return data
      .filter((d) => d.visa_type === visaType)
      .sort((a, b) => a.fiscal_year - b.fiscal_year)
      .map((d) => ({
        year: d.fiscal_year,
        median: d.market_median,
        p25: d.market_p25,
        p75: d.market_p75,
        // For banded area: pair is [p25, p75]
        bandLow: d.market_p25,
        bandHigh: d.market_p75,
      }));
  }, [data, visaType]);

  if (chartData.length === 0) {
    return (
      <div className={cn("flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-12", className)}>
        <p className="text-sm text-[var(--muted-foreground)]">No trend data available</p>
      </div>
    );
  }

  const yMin = Math.floor((Math.min(...chartData.map((d) => d.p25)) * 0.9) / 10000) * 10000;
  const yMax = Math.ceil((Math.max(...chartData.map((d) => d.p75)) * 1.05) / 10000) * 10000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn("w-full", className)}
    >
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
          <defs>
            {/* P25–P75 band fill */}
            <linearGradient id="wageGradientBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.08} />
            </linearGradient>
            {/* Median line gradient */}
            <linearGradient id="wageGradientMedian" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
            <filter id="medianGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="year"
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }} />

          {/* P75 upper band */}
          <Area
            type="monotone"
            dataKey="bandHigh"
            stroke="#8b5cf6"
            strokeWidth={1}
            strokeDasharray="4 2"
            strokeOpacity={0.5}
            fill="url(#wageGradientBand)"
            dot={false}
            activeDot={false}
            name="P75"
            legendType="none"
          />
          {/* P25 lower band — same fill color stacks to make band */}
          <Area
            type="monotone"
            dataKey="bandLow"
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4 2"
            strokeOpacity={0.4}
            fill="white"
            fillOpacity={0}
            dot={false}
            activeDot={false}
            name="P25"
            legendType="none"
          />
          {/* Median line */}
          <Area
            type="monotone"
            dataKey="median"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#wageGradientMedian)"
            dot={false}
            activeDot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
            name="Market Median"
          />

          {/* User wage reference line */}
          {userWage && userWage > 0 && (
            <ReferenceLine
              y={userWage}
              stroke="#10b981"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              label={{
                value: "Your Offer",
                position: "insideTopRight",
                fill: "#10b981",
                fontSize: 10,
              }}
            />
          )}
          <Legend
            formatter={(value) => (
              <span className="text-xs text-[rgba(255,255,255,0.5)]">{value}</span>
            )}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center gap-4 px-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-px w-6 border-t-2 border-purple-400/50 border-dashed" />
          <span className="text-xs text-[var(--muted-foreground)]">P25–P75 range</span>
        </div>
        {userWage && userWage > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-px w-6 border-t-2 border-emerald-400 border-dashed" />
            <span className="text-xs text-emerald-400">Your offer</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
