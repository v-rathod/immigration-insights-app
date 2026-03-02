/**
 * SrsTrendChart — Monthly filing trend line chart for an employer.
 *
 * Shows filings, approvals, and denials over time using Recharts
 * with a glassmorphic container and Aurora design tokens.
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
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import type { EmployerMonthlyMetric } from "@/types/p2-artifacts";

interface SrsTrendChartProps {
  metrics: EmployerMonthlyMetric[];
  employerName: string;
  className?: string;
}

export function SrsTrendChart({
  metrics,
  employerName,
  className,
}: SrsTrendChartProps) {
  // Prepare chart data
  const chartData = useMemo(() => {
    return metrics.map((m) => ({
      month: formatMonth(m.month),
      monthRaw: m.month,
      filings: m.filings,
      approvals: m.approvals,
      denials: m.denials,
      approvalRate: Math.round(m.approval_rate * 100),
    }));
  }, [metrics]);

  if (chartData.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-12",
          className
        )}
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          No monthly filing data available for this employer
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-6",
        className
      )}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          Filing Trends
        </h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          Monthly green card sponsorship filings, approvals, and denials for {employerName}
        </p>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="fillFilings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillApprovals" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillDenials" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />

            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="circle"
              iconSize={6}
            />

            <Area
              type="monotone"
              dataKey="filings"
              name="Filings"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#fillFilings)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="approvals"
              name="Approvals"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#fillApprovals)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="denials"
              name="Denials"
              stroke="#f43f5e"
              strokeWidth={1.5}
              fill="url(#fillDenials)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-white/[0.1] bg-[var(--background)]/95 backdrop-blur-xl px-3 py-2 shadow-xl">
      <div className="text-xs font-medium text-[var(--foreground)] mb-1.5">
        {label}
      </div>
      {payload.map((p) => (
        <div
          key={p.name}
          className="flex items-center gap-2 text-xs"
        >
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-[var(--muted-foreground)]">{p.name}:</span>
          <span className="font-mono tabular-nums text-[var(--foreground)]">
            {formatNumber(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonth(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}
