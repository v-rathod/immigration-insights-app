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
          "flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-12",
          className
        )}
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          No monthly filing trend available
        </p>
        <p className="text-xs text-[var(--muted-foreground)]/60 max-w-xs text-center">
          Monthly PERM filing breakdowns are available for employers with consistent activity over the 36-month analysis window.
          This employer may have too few filings or only recent/intermittent activity.
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
            margin={{ top: 4, right: 16, bottom: 24, left: 4 }}
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
              stroke="rgba(128,128,160,0.15)"
              horizontal={true}
              vertical={true}
            />

            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={{ stroke: "rgba(128,128,160,0.2)" }}
              tickLine={{ stroke: "rgba(128,128,160,0.2)" }}
              interval="preserveStartEnd"
              label={{ value: "Month", position: "insideBottom", offset: -12, fill: "#6b7280", fontSize: 11 }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={{ stroke: "rgba(128,128,160,0.2)" }}
              tickLine={false}
              width={40}
              label={{ value: "Filings", angle: -90, position: "insideLeft", offset: 10, fill: "#6b7280", fontSize: 11 }}
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
              dot={{ fill: "#3b82f6", r: 3 }}
              activeDot={{ r: 5, fill: "#3b82f6", stroke: "rgba(59,130,246,0.4)", strokeWidth: 8 }}
            />
            <Area
              type="monotone"
              dataKey="approvals"
              name="Approvals"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#fillApprovals)"
              dot={{ fill: "#10b981", r: 3 }}
              activeDot={{ r: 5, fill: "#10b981", stroke: "rgba(16,185,129,0.4)", strokeWidth: 8 }}
            />
            <Area
              type="monotone"
              dataKey="denials"
              name="Denials"
              stroke="#f43f5e"
              strokeWidth={1.5}
              fill="url(#fillDenials)"
              dot={{ fill: "#f43f5e", r: 2.5 }}
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
