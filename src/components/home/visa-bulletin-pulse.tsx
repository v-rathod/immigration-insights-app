"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, Activity, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { cn } from "@/lib/utils";
import { loadCutoffTrends } from "@/lib/data/pdi";
import type { CutoffTrendRecord } from "@/lib/data/pdi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BulletinRow {
  category: string;
  country: string;
  countryLabel: string;
  cutoffDate: string;
  velocity3m: number | null;
  retrogression: boolean;
  statusCurrent: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEY_SERIES: { category: string; country: string; label: string }[] = [
  { category: "EB1", country: "IND", label: "India" },
  { category: "EB2", country: "IND", label: "India" },
  { category: "EB3", country: "IND", label: "India" },
  { category: "EB2", country: "CHN", label: "China" },
  { category: "EB3", country: "CHN", label: "China" },
  { category: "EB2", country: "ROW", label: "Rest of World" },
];

function formatCutoffDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function velocityIcon(v: number | null, retro: boolean) {
  if (retro) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  if (v === null || v === 0) return <Minus className="h-3.5 w-3.5 text-amber-400" />;
  if (v > 60) return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
  return <TrendingUp className="h-3.5 w-3.5 text-amber-400" />;
}

function velocityLabel(v: number | null, retro: boolean, statusCurrent: boolean): string {
  if (statusCurrent) return "Current";
  if (retro) return "Retrogressed";
  if (v === null || v === 0) return "No movement";
  return `+${Math.round(v)} days/mo`;
}

function velocityColor(v: number | null, retro: boolean, statusCurrent: boolean): string {
  if (statusCurrent) return "text-emerald-400";
  if (retro) return "text-red-400";
  if (v === null || v === 0) return "text-amber-400";
  if (v > 60) return "text-emerald-400";
  return "text-amber-400";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VisaBulletinPulse() {
  const [fadRows, setFadRows] = useState<BulletinRow[]>([]);
  const [dffRows, setDffRows] = useState<BulletinRow[]>([]);
  const [bulletinLabel, setBulletinLabel] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<"FAD" | "DFF">("FAD");

  const rows = chartType === "FAD" ? fadRows : dffRows;

  useEffect(() => {
    let cancelled = false;
    loadCutoffTrends()
      .then((trends) => {
        if (cancelled) return;

        // Find the latest bulletin month using FAD as the reference
        const fadRecords = trends.filter(
          (r) => r.bulletin_year && r.bulletin_month && r.chart === "FAD"
        );
        if (fadRecords.length === 0) {
          setLoading(false);
          return;
        }

        const sorted = [...fadRecords].sort(
          (a, b) =>
            b.bulletin_year * 100 +
            b.bulletin_month -
            (a.bulletin_year * 100 + a.bulletin_month)
        );
        const latestYear = sorted[0].bulletin_year;
        const latestMonth = sorted[0].bulletin_month;

        // Build bulletin month label
        const monthName = new Date(
          Date.UTC(latestYear, latestMonth - 1, 1)
        ).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
        setBulletinLabel(monthName);

        const buildRows = (chartFilter: "FAD" | "DFF"): BulletinRow[] => {
          const latestRecords = trends.filter(
            (r) =>
              r.chart === chartFilter &&
              r.bulletin_year === latestYear &&
              r.bulletin_month === latestMonth
          );
          const result: BulletinRow[] = [];
          for (const series of KEY_SERIES) {
            const match = latestRecords.find(
              (r) => r.category === series.category && r.country === series.country
            );
            if (match) {
              const isCurrent = match.status_flag === "C";
              result.push({
                category: series.category,
                country: series.country,
                countryLabel: series.label,
                cutoffDate:
                  isCurrent || !match.cutoff_date
                    ? "Current"
                    : formatCutoffDate(match.cutoff_date),
                velocity3m: match.velocity_3m,
                retrogression: match.retrogression_flag === 1,
                statusCurrent: isCurrent,
              });
            }
          }
          return result;
        };

        setFadRows(buildRows("FAD"));
        setDffRows(buildRows("DFF"));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Skeleton
  if (loading) {
    return (
      <GlassCard padding="md" className="animate-pulse">
        <div className="mb-3 h-4 w-40 rounded bg-[var(--muted)]/50" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-[var(--muted)]/30" />
          ))}
        </div>
      </GlassCard>
    );
  }

  if (fadRows.length === 0 && dffRows.length === 0) return null;

  return (
    <GlassCard padding="md" className="overflow-hidden">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.5} />
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Visa Bulletin
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* FAD / DFF toggle */}
          <div
            className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5 gap-0.5"
            role="radiogroup"
            aria-label="Bulletin chart type"
          >
            {(["FAD", "DFF"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                role="radio"
                aria-checked={chartType === type}
                className={cn(
                  "px-2 py-0.5 text-[9px] font-semibold tracking-wide rounded-full transition-all duration-200",
                  chartType === type
                    ? type === "FAD"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-transparent"
                )}
              >
                {type === "FAD" ? "Final Action" : "Date for Filing"}
              </button>
            ))}
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            {bulletinLabel}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs" aria-label="Current visa bulletin cutoff dates">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-2 pr-3 font-medium text-[var(--muted-foreground)]">
                Category
              </th>
              <th className="pb-2 pr-3 font-medium text-[var(--muted-foreground)]">
                Country
              </th>
              <th className="pb-2 pr-3 font-medium text-[var(--muted-foreground)]">
                Cutoff
              </th>
              <th className="pb-2 font-medium text-[var(--muted-foreground)]">
                Movement
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.category}-${row.country}`}
                className="border-b border-[var(--border)]/50 last:border-b-0"
              >
                <td className="py-2 pr-3 font-mono font-semibold text-[var(--foreground)]">
                  {row.category}
                </td>
                <td className="py-2 pr-3 text-[var(--muted-foreground)]">
                  {row.countryLabel}
                </td>
                <td
                  className={cn(
                    "py-2 pr-3 font-mono",
                    row.statusCurrent
                      ? "text-emerald-400 font-medium"
                      : "text-[var(--foreground)]"
                  )}
                >
                  {row.cutoffDate}
                </td>
                <td className="py-2">
                  <div
                    className={cn(
                      "flex items-center gap-1",
                      velocityColor(
                        row.velocity3m,
                        row.retrogression,
                        row.statusCurrent
                      )
                    )}
                  >
                    {!row.statusCurrent &&
                      velocityIcon(row.velocity3m, row.retrogression)}
                    <span className="text-[11px]">
                      {velocityLabel(
                        row.velocity3m,
                        row.retrogression,
                        row.statusCurrent
                      )}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-[var(--muted-foreground)]">
          Source: U.S. Department of State,{" "}
          {chartType === "FAD" ? "Final Action Dates" : "Dates for Filing"}
        </span>
        <Link
          href="/dashboard/visa-bulletin"
          className="flex items-center gap-1 text-[10px] font-medium text-[var(--accent-blue)] hover:text-blue-300 transition-colors"
        >
          PD Cortex
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </GlassCard>
  );
}
