/**
 * PriorityDateChart — Unified single chart for the PDC dashboard.
 *
 * One continuous timeline from ~2016 → future showing:
 *   • Historical DFF cutoff movement (solid blue line)
 *   • Historical FAD cutoff movement (solid amber line)
 *   • Forecast DFF projection (dashed blue line)
 *   • Forecast FAD projection (dashed amber line)
 *   • User's Priority Date (horizontal green dashed reference line)
 *
 * X-axis: years (2016, 2017 …) with monthly-resolution data.
 * Y-axis: cutoff dates (timestamps → formatted to "Mon 'YY").
 * When the forecast lines cross the PD reference, the user becomes eligible.
 */
"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatMonthYear } from "@/lib/utils/format";
import type { CutoffTrendRecord, ExtrapolatedPoint } from "@/lib/data/pdi";
import type { PdForecast } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriorityDateChartProps {
  /** Historical DFF cutoff records (status_flag=D, sorted chronologically) */
  dffTrends: CutoffTrendRecord[];
  /** Historical FAD cutoff records */
  fadTrends: CutoffTrendRecord[];
  /** Forecast DFF series (24-month model projection) */
  dffForecast: PdForecast[];
  /** Forecast FAD series */
  fadForecast: PdForecast[];
  /** DFF extrapolated points beyond 24-month window */
  dffExtrapolation?: ExtrapolatedPoint[];
  /** FAD extrapolated points */
  fadExtrapolation?: ExtrapolatedPoint[];
  /** User's priority date (ISO string) — horizontal reference */
  priorityDate?: string;
  /** Is the toggle set to optimistic? Just for the badge label */
  isOptimistic?: boolean;
  /** Called when the user toggles optimistic/realistic */
  onToggle?: () => void;
  className?: string;
}

/** A single row in the merged chart dataset */
interface ChartPoint {
  /** "YYYY-MM" key — used for sorting and dedup */
  month: string;
  /** Human label e.g. "Apr 2026" */
  monthLabel: string;
  /** Year string for X-axis ticks */
  yearLabel: string;
  /** Actual DFF cutoff (historical) — ms timestamp */
  dffActual: number | null;
  /** Actual FAD cutoff (historical) */
  fadActual: number | null;
  /** Projected DFF cutoff (forecast+extrapolation) */
  dffForecast: number | null;
  /** Projected FAD cutoff */
  fadForecast: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTs(dateStr: string | null | undefined): number | null {
  if (!dateStr || String(dateStr) === "nan") return null;
  const t = new Date(dateStr).getTime();
  return isNaN(t) ? null : t;
}

function fmtDateTick(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function trendToMonth(r: CutoffTrendRecord): string {
  return `${r.bulletin_year}-${String(r.bulletin_month).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TipEntry {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

function ChartTip({
  active,
  payload,
  label,
  priorityDate,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: string;
  priorityDate?: string | null;
}) {
  if (!active || !payload?.length) return null;

  // Map dataKey → friendly name
  const friendlyName: Record<string, string> = {
    dffActual: "DFF (Actual)",
    fadActual: "FAD (Actual)",
    dffForecast: "DFF (Forecast)",
    fadForecast: "FAD (Forecast)",
  };

  return (
    <div className="rounded-xl border border-white/[0.1] bg-[var(--background)]/95 backdrop-blur-xl px-3.5 py-2.5 shadow-xl min-w-[190px]">
      <p className="text-xs font-medium text-[var(--foreground)] mb-2">
        {label}
      </p>
      {payload
        .filter((e) => e.value != null && typeof e.value === "number" && !isNaN(e.value) && isFinite(e.value) && e.value > 0)
        .filter((e, i, arr) => arr.findIndex((x) => x.dataKey === e.dataKey) === i)
        .map((entry) => (
          <div
            key={entry.dataKey}
            className="flex items-center justify-between gap-4 text-xs py-0.5"
          >
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: entry.color }}
              />
              <span className="text-[var(--muted-foreground)]">
                {friendlyName[entry.dataKey] ?? entry.name}
              </span>
            </div>
            <span className="font-mono text-[var(--foreground)] text-[11px]">
              {formatMonthYear(new Date(entry.value).toISOString())}
            </span>
          </div>
        ))}
      {priorityDate && (
        <div className="flex items-center justify-between gap-4 text-xs py-0.5 mt-1 pt-1 border-t border-white/[0.08]">
          <span className="text-[var(--muted-foreground)]/60">Your PD</span>
          <span className="font-mono text-[var(--muted-foreground)] text-[11px]">
            {formatMonthYear(priorityDate)}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PriorityDateChart({
  dffTrends,
  fadTrends,
  dffForecast,
  fadForecast,
  dffExtrapolation,
  fadExtrapolation,
  priorityDate,
  isOptimistic,
  onToggle,
  className,
}: PriorityDateChartProps) {
  // -----------------------------------------------------------------------
  // Merge all data sources into a single sorted timeline
  // -----------------------------------------------------------------------
  const chartData = useMemo<ChartPoint[]>(() => {
    const map = new Map<string, ChartPoint>();

    const ensure = (key: string) => {
      if (!map.has(key)) {
        map.set(key, {
          month: key,
          monthLabel: formatMonthYear(`${key}-01`),
          yearLabel: key.slice(0, 4),
          dffActual: null,
          fadActual: null,
          dffForecast: null,
          fadForecast: null,
        });
      }
    };

    // Historical actuals
    for (const r of dffTrends) {
      const k = trendToMonth(r);
      ensure(k);
      map.get(k)!.dffActual = toTs(r.cutoff_date);
    }
    for (const r of fadTrends) {
      const k = trendToMonth(r);
      ensure(k);
      map.get(k)!.fadActual = toTs(r.cutoff_date);
    }

    // Model forecasts (24-month projections)
    for (const f of dffForecast) {
      ensure(f.forecast_month);
      map.get(f.forecast_month)!.dffForecast = toTs(f.projected_cutoff_date);
    }
    for (const f of fadForecast) {
      ensure(f.forecast_month);
      map.get(f.forecast_month)!.fadForecast = toTs(f.projected_cutoff_date);
    }

    // Extrapolations (beyond 24-month window)
    for (const ep of dffExtrapolation ?? []) {
      ensure(ep.month);
      map.get(ep.month)!.dffForecast = ep.cutoffTimestamp;
    }
    for (const ep of fadExtrapolation ?? []) {
      ensure(ep.month);
      map.get(ep.month)!.fadForecast = ep.cutoffTimestamp;
    }

    // Bridge: set the first forecast point equal to the last historical point
    // so the forecast line starts exactly where the historical line ends.
    if (dffTrends.length > 0 && dffForecast.length > 0) {
      const lastHistKey = trendToMonth(dffTrends[dffTrends.length - 1]);
      const lastHistVal = map.get(lastHistKey)?.dffActual ?? null;
      if (lastHistVal != null) {
        const firstFcKey = dffForecast[0].forecast_month;
        // If the first forecast month is after the last historical month,
        // create a bridge point at the last historical month
        if (firstFcKey > lastHistKey) {
          map.get(lastHistKey)!.dffForecast = lastHistVal;
        }
      }
    }
    if (fadTrends.length > 0 && fadForecast.length > 0) {
      const lastHistKey = trendToMonth(fadTrends[fadTrends.length - 1]);
      const lastHistVal = map.get(lastHistKey)?.fadActual ?? null;
      if (lastHistVal != null) {
        const firstFcKey = fadForecast[0].forecast_month;
        if (firstFcKey > lastHistKey) {
          map.get(lastHistKey)!.fadForecast = lastHistVal;
        }
      }
    }

    // Filter to last 10 years + next 2 years
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 10;
    const endYear = currentYear + 2;
    const filtered = [...map.values()]
      .filter((d) => {
        const year = parseInt(d.month.slice(0, 4), 10);
        return year >= startYear && year <= endYear;
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    return filtered;
  }, [dffTrends, fadTrends, dffForecast, fadForecast, dffExtrapolation, fadExtrapolation]);

  const pdTs = useMemo(
    () => (priorityDate ? toTs(priorityDate) : null),
    [priorityDate]
  );

  // Y domain
  const yDomain = useMemo(() => {
    const vals: number[] = [];
    for (const d of chartData) {
      if (d.dffActual) vals.push(d.dffActual);
      if (d.fadActual) vals.push(d.fadActual);
      if (d.dffForecast) vals.push(d.dffForecast);
      if (d.fadForecast) vals.push(d.fadForecast);
    }
    if (pdTs) vals.push(pdTs);
    if (vals.length === 0) return [0, 1];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.08;
    return [min - pad, max + pad];
  }, [chartData, pdTs]);

  // X-axis: show one tick per year
  const yearTicks = useMemo(() => {
    const seen = new Set<string>();
    return chartData
      .filter((d) => {
        if (seen.has(d.yearLabel)) return false;
        seen.add(d.yearLabel);
        return true;
      })
      .map((d) => d.month);
  }, [chartData]);

  // Empty state
  if (chartData.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-[300px] rounded-2xl border border-white/[0.08] bg-white/[0.02]",
          className
        )}
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          No data for this combination
        </p>
      </div>
    );
  }

  const hasForecast = dffForecast.length > 0 || fadForecast.length > 0;

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-4 sm:p-6",
        className
      )}
    >
      {/* Header with inline legend + toggle */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Priority Date Movement
          </h3>
          {/* Optimistic / Realistic toggle */}
          {hasForecast && onToggle && (
            <button
              onClick={onToggle}
              className={cn(
                "relative inline-flex h-5 w-[88px] items-center rounded-full transition-colors duration-200 shrink-0",
                isOptimistic
                  ? "bg-blue-500/20 border border-blue-500/30"
                  : "bg-amber-500/20 border border-amber-500/30"
              )}
              role="switch"
              aria-checked={isOptimistic}
              aria-label="Toggle between optimistic and realistic forecast"
            >
              <span
                className={cn(
                  "absolute inset-0 flex items-center pl-[18px] pr-1.5 text-[8px] font-semibold tracking-wide transition-opacity duration-200",
                  isOptimistic
                    ? "opacity-100 text-blue-400 justify-start"
                    : "opacity-0"
                )}
              >
                Optimistic
              </span>
              <span
                className={cn(
                  "absolute inset-0 flex items-center pl-1.5 pr-[18px] text-[8px] font-semibold tracking-wide transition-opacity duration-200",
                  !isOptimistic
                    ? "opacity-100 text-amber-400 justify-end"
                    : "opacity-0"
                )}
              >
                Realistic
              </span>
              <span
                className={cn(
                  "absolute h-3.5 w-3.5 rounded-full shadow-md transition-all duration-200",
                  isOptimistic
                    ? "left-0.5 bg-blue-400"
                    : "left-[calc(100%-18px)] bg-amber-400"
                )}
              />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
          {/* Actual lines */}
          <div className="flex items-center gap-1.5">
            <div className="h-[3px] w-4 rounded-full bg-[#3b82f6]" />
            <span className="text-[var(--muted-foreground)]">DFF Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-[3px] w-4 rounded-full bg-[#f59e0b]" />
            <span className="text-[var(--muted-foreground)]">FAD Actual</span>
          </div>
          {/* Forecast lines */}
          {hasForecast && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="h-0 w-4 border-t-[2px] border-dashed border-[#60a5fa]" />
                <span className="text-[var(--muted-foreground)]">
                  DFF Forecast{isOptimistic != null && (isOptimistic ? "" : " (Realistic)")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0 w-4 border-t-[2px] border-dashed border-[#fbbf24]" />
                <span className="text-[var(--muted-foreground)]">
                  FAD Forecast{isOptimistic != null && (isOptimistic ? "" : " (Realistic)")}
                </span>
              </div>
            </>
          )}
          {/* PD reference */}
          {pdTs && (
            <div className="flex items-center gap-1.5">
              <div className="h-0 w-4 border-t-[2px] border-dashed border-emerald-400" />
              <span className="text-[var(--muted-foreground)]">Your PD</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 16, bottom: 24, left: 4 }}
          >
            <defs>
              <linearGradient id="fillDffAct" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillFadAct" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.10} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
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
              ticks={yearTicks}
              tickFormatter={(m: string) => m.slice(0, 4)}
              label={{ value: "Year", position: "insideBottom", offset: -12, fill: "#6b7280", fontSize: 11 }}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={fmtDateTick}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={{ stroke: "rgba(128,128,160,0.2)" }}
              tickLine={false}
              width={62}
              label={{ value: "Cutoff Date", angle: -90, position: "insideLeft", offset: 10, fill: "#6b7280", fontSize: 11 }}
            />

            <Tooltip
              content={<ChartTip priorityDate={priorityDate ?? null} />}
            />

            {/* ---- Area fills (historical only) ---- */}
            <Area
              type="monotone"
              dataKey="dffActual"
              fill="url(#fillDffAct)"
              stroke="none"
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="fadActual"
              fill="url(#fillFadAct)"
              stroke="none"
              activeDot={false}
              isAnimationActive={false}
            />

            {/* ---- Historical solid lines ---- */}
            <Line
              type="monotone"
              dataKey="dffActual"
              name="DFF (Actual)"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ fill: "#3b82f6", r: 3 }}
              connectNulls
              activeDot={{
                r: 5,
                fill: "#3b82f6",
                stroke: "rgba(59,130,246,0.4)",
                strokeWidth: 8,
              }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="fadActual"
              name="FAD (Actual)"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ fill: "#f59e0b", r: 3 }}
              connectNulls
              activeDot={{
                r: 5,
                fill: "#f59e0b",
                stroke: "rgba(245,158,11,0.4)",
                strokeWidth: 8,
              }}
              isAnimationActive={false}
            />

            {/* ---- Forecast dashed lines ---- */}
            <Line
              type="monotone"
              dataKey="dffForecast"
              name="DFF (Forecast)"
              stroke="#60a5fa"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ fill: "#60a5fa", r: 3 }}
              connectNulls
              activeDot={{
                r: 5,
                fill: "#60a5fa",
                stroke: "rgba(96,165,250,0.4)",
                strokeWidth: 8,
              }}
              animationDuration={600}
              animationEasing="ease-in-out"
            />
            <Line
              type="monotone"
              dataKey="fadForecast"
              name="FAD (Forecast)"
              stroke="#fbbf24"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ fill: "#fbbf24", r: 3 }}
              connectNulls
              activeDot={{
                r: 5,
                fill: "#fbbf24",
                stroke: "rgba(251,191,36,0.4)",
                strokeWidth: 8,
              }}
              animationDuration={600}
              animationEasing="ease-in-out"
            />

            {/* ---- Priority Date reference line ---- */}
            {pdTs && (
              <ReferenceLine
                y={pdTs}
                stroke="#10b981"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: "Your Priority Date",
                  position: "insideTopRight",
                  fill: "#10b981",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Explainer */}
      <p className="mt-3 text-[10px] text-[var(--muted-foreground)]/60 leading-relaxed">
        Solid lines show actual monthly DOS Visa Bulletin cutoff movement
        (Oct 2015 – present). Dashed lines show projected advancement.
        When a projection crosses your priority date, you become eligible.
        DFF = file I-485; FAD = green card approval.
      </p>
    </div>
  );
}
