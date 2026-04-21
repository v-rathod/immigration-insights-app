/**
 * QueueSnapshotCard — three-segment I-485 + I-140 demand breakdown.
 *
 * Inspired by GCC's "Queue Snapshot" panel but built with the Aurora
 * glassmorphic design system. Shows:
 *
 *   Segment 1 — Currently Processable: I-485 Available, PD <= FAD
 *   Segment 2 — Filed, Awaiting FAD:   I-485 Awaiting, PD <= DFF
 *   Segment 3 — Cannot File Yet (est): I-140 latent demand, DFF < PD <= userPD
 *
 * Plus a FAD-DFF momentum banner and a mini proportional bar.
 *
 * Used on: /dashboard/visa-bulletin, /insights
 */
"use client";

import { useMemo } from "react";
import type { EbInventoryRecord, I140DemandRecord } from "@/types/p2-artifacts";
import type { CutoffTrendRecord } from "@/lib/data/pdi";
import { computeDemandBreakdown, COUNTRY_LABELS } from "@/lib/data/pdi";

interface QueueSnapshotCardProps {
  inventory: EbInventoryRecord[];
  cutoffTrends: CutoffTrendRecord[];
  i140Data: I140DemandRecord[];
  category: string;
  country: string;
  priorityDate: string; // ISO "YYYY-MM-DD"
  className?: string;
}

function fmt(n: number): string {
  return `~${n.toLocaleString()}`;
}

function fmtDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Color/label definitions for each segment */
const SEGMENTS = [
  {
    key: "currentlyProcessable" as const,
    label: "Approvable Now",
    status: "I-485 Available",
    dotClass: "bg-emerald-400",
    textClass: "text-emerald-400",
    trackClass: "bg-emerald-400/80",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    exact: true,
  },
  {
    key: "inDffWindow" as const,
    label: "Filed, Awaiting FAD",
    status: "I-485 Awaiting Availability",
    dotClass: "bg-amber-400",
    textClass: "text-amber-400",
    trackClass: "bg-amber-400/80",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    exact: true,
  },
  {
    key: "beyondDff" as const,
    label: "Cannot File Yet",
    status: "I-140 Approved, est.",
    dotClass: "bg-slate-400",
    textClass: "text-slate-400",
    trackClass: "bg-slate-500/60",
    badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    exact: false,
  },
] as const;

/** Determine momentum label + color from FAD-DFF gap months */
function getMomentum(gapMonths: number): {
  label: string;
  description: string;
  color: string;
  dotClass: string;
} {
  if (gapMonths <= 0) {
    return {
      label: "No DFF advance",
      description: "FAD and DFF are aligned — no pre-staging this month.",
      color: "text-slate-400",
      dotClass: "bg-slate-400",
    };
  }
  if (gapMonths <= 3) {
    return {
      label: `+${gapMonths}mo advance`,
      description: `DFF is ${gapMonths} month${gapMonths > 1 ? "s" : ""} ahead of FAD — limited filing window open.`,
      color: "text-blue-400",
      dotClass: "bg-blue-400",
    };
  }
  if (gapMonths <= 6) {
    return {
      label: `+${gapMonths}mo advance`,
      description: `DFF is ${gapMonths} months ahead of FAD — DOS has pre-staged this cohort, signaling moderate FY clearance momentum.`,
      color: "text-amber-400",
      dotClass: "bg-amber-400",
    };
  }
  return {
    label: `+${gapMonths}mo advance`,
    description: `DFF is ${gapMonths} months ahead of FAD — strong pre-staging signals high FY clearance momentum.`,
    color: "text-emerald-400",
    dotClass: "bg-emerald-400",
  };
}

export function QueueSnapshotCard({
  inventory,
  cutoffTrends,
  i140Data,
  category,
  country,
  priorityDate,
  className,
}: QueueSnapshotCardProps) {
  const result = useMemo(() => {
    if (!priorityDate || inventory.length === 0 || cutoffTrends.length === 0)
      return null;
    return computeDemandBreakdown(
      inventory,
      cutoffTrends,
      i140Data,
      category,
      country,
      priorityDate
    );
  }, [inventory, cutoffTrends, i140Data, category, country, priorityDate]);

  if (!result || result.total === 0) return null;

  const momentum = getMomentum(result.fadDffGapMonths);
  const countryLabel = COUNTRY_LABELS[country] ?? country;
  const pdYear = new Date(priorityDate).getFullYear();

  // Proportional bar widths (min 2% so each segment is always visible)
  const barPcts = SEGMENTS.map((s) => {
    const raw = result.total > 0 ? (result[s.key] / result.total) * 100 : 0;
    return Math.max(raw > 0 ? 2 : 0, raw);
  });

  // PD range labels per segment
  const pdRanges = [
    `before ${fmtDate(result.fadCutoffDate)}`,
    result.fadCutoffDate && result.dffCutoffDate
      ? `${fmtDate(result.fadCutoffDate)} – ${fmtDate(result.dffCutoffDate)}`
      : "—",
    result.dffCutoffDate
      ? `${fmtDate(result.dffCutoffDate)} – ${pdYear}`
      : `—`,
  ];

  return (
    <div
      className={`relative rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] backdrop-blur-xl overflow-hidden ${className ?? ""}`}
    >
      {/* Subtle corner glow — matches DFF/FAD card pattern */}
      <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-[0.08] blur-2xl bg-violet-500 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-white/[0.05]">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-400 shrink-0">
          <svg
            className="h-3 w-3 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-[11px] font-semibold text-[var(--foreground)] leading-none">
            Queue Snapshot
          </h3>
          <p className="text-[9px] text-[var(--muted-foreground)] mt-0.5">
            {category} · {countryLabel} · I-485 + I-140 demand ahead of your PD
          </p>
        </div>
        <span className="ml-auto text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
          Live Bulletin
        </span>
      </div>

      {/* FAD-DFF Momentum Banner */}
      {result.fadCutoffDate && result.dffCutoffDate && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
          <div
            className={`h-1.5 w-1.5 rounded-full ${momentum.dotClass} mt-1.5 shrink-0`}
          />
          <div className="min-w-0">
            <span className={`text-[10px] font-semibold ${momentum.color}`}>
              DFF {momentum.label} of FAD
            </span>
            <p className="text-[9px] text-[var(--muted-foreground)] mt-0.5 leading-relaxed">
              {momentum.description}
            </p>
          </div>
        </div>
      )}

      {/* Segment Table */}
      <div className="px-4 pt-3 pb-0 space-y-1">
        {SEGMENTS.map((seg, i) => {
          const count = result[seg.key];
          if (count === 0 && seg.key === "beyondDff" && !result.hasI140Estimate)
            return null;
          return (
            <div
              key={seg.key}
              className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0"
            >
              {/* Color dot */}
              <div
                className={`h-2 w-2 rounded-full ${seg.dotClass} shrink-0 opacity-90`}
              />

              {/* Labels */}
              <div className="min-w-0 flex-1">
                <div
                  className={`text-[10px] font-semibold ${seg.textClass} leading-none`}
                >
                  {seg.label}
                </div>
                <div className="text-[8.5px] text-[var(--muted-foreground)] mt-0.5 truncate">
                  {pdRanges[i]}
                </div>
              </div>

              {/* Status badge */}
              <span
                className={`hidden sm:inline text-[8px] px-1.5 py-0.5 rounded border ${seg.badgeClass} whitespace-nowrap shrink-0`}
              >
                {seg.status}
              </span>

              {/* Count */}
              <div className="text-right shrink-0 min-w-[4.5rem]">
                <span
                  className={`text-sm font-bold font-mono ${seg.textClass}`}
                >
                  {seg.exact ? `~${count.toLocaleString()}` : `~${count.toLocaleString()}`}
                </span>
              </div>
            </div>
          );
        })}

        {/* Total row */}
        <div className="flex items-center gap-3 py-2.5 mt-1 rounded-lg bg-white/[0.03] px-3 -mx-3">
          <div className="h-2 w-2 rounded-full bg-violet-400 shrink-0" />
          <div className="flex-1 text-[10px] font-semibold text-[var(--foreground)]">
            Est. Total Demand Ahead
          </div>
          <div className="text-right">
            <span className="text-sm font-bold font-mono text-violet-400">
              {fmt(result.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Proportional mini-bar */}
      {result.total > 0 && (
        <div className="mx-4 mt-3 flex h-1.5 rounded-full overflow-hidden gap-px">
          {SEGMENTS.map((seg, i) =>
            barPcts[i] > 0 ? (
              <div
                key={seg.key}
                className={`h-full rounded-full ${seg.trackClass}`}
                style={{ width: `${barPcts[i]}%` }}
              />
            ) : null
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pt-2.5 pb-3.5 space-y-1">
        <p className="text-[8.5px] text-[var(--muted-foreground)]/60 leading-relaxed">
          <span className="font-medium text-[var(--muted-foreground)]/80">
            Segments 1 & 2
          </span>{" "}
          are from official USCIS I-485 pending inventory
          {result.snapshotDate ? ` (${result.snapshotDate})` : ""}. Data covers
          PDs up to {result.i485DataMaxYear} for {category}/{countryLabel} — people
          with newer PDs haven&apos;t filed I-485 yet.
          {result.hasI140Estimate && (
            <>
              {" "}
              <span className="font-medium text-[var(--muted-foreground)]/80">
                Segment 3
              </span>{" "}
              is estimated from annual USCIS I-140 approval data × family size
              (×1.8) × attrition (×0.75). Individual counts have been adjusted for
              estimated duplicate filings and petition abandonments.
            </>
          )}
        </p>
        <p className="text-[8px] text-[var(--muted-foreground)]/40 italic">
          All counts include derivatives (spouse + children). Not legal advice.
        </p>
      </div>
    </div>
  );
}
