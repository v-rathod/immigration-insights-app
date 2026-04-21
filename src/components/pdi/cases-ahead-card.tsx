/**
 * CasesAheadCard — reusable "Cases Ahead of You" widget.
 *
 * Shows how many pending I-485 applications have a priority date at or before
 * the user's PD, for a given EB category and country of chargeability.
 *
 * The key insight this card must communicate:
 *  - For oversubscribed countries (EB2/IND, EB3/IND) the data only goes up to
 *    the current cutoff year (~2014). Anyone with a newer PD sees the same count
 *    because applicants with future PDs haven't filed I-485 yet.
 *  - For near-current categories, the count does change with PD.
 *
 * Used on: /dashboard/visa-bulletin, /insights
 */
"use client";

import { useMemo } from "react";
import type { EbInventoryRecord } from "@/types/p2-artifacts";
import { computeCasesAhead, COUNTRY_LABELS } from "@/lib/data/pdi";

interface CasesAheadCardProps {
  inventory: EbInventoryRecord[];
  category: string;
  country: string;
  priorityDate: string; // ISO "YYYY-MM-DD"
  className?: string;
}

export function CasesAheadCard({
  inventory,
  category,
  country,
  priorityDate,
  className,
}: CasesAheadCardProps) {
  const result = useMemo(() => {
    if (!priorityDate || inventory.length === 0) return null;
    return computeCasesAhead(inventory, category, country, priorityDate);
  }, [inventory, category, country, priorityDate]);

  if (!result || result.casesAhead === 0) return null;

  const countryLabel = COUNTRY_LABELS[country] ?? country;
  const pdYear = new Date(priorityDate).getFullYear();

  const beyondRange = result.isPdBeyondDataRange;

  return (
    <div
      className={`rounded-xl border border-purple-500/20 bg-purple-500/[0.03] backdrop-blur-xl p-4 ${className ?? ""}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-violet-400 shrink-0">
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
        <h3 className="text-xs font-semibold text-[var(--foreground)]">
          Cases Ahead of You
        </h3>
        <span className="ml-auto text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400">
          I-485 Queue
        </span>
      </div>

      {/* Count */}
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold font-mono text-purple-400 tracking-tight">
          ~{result.casesAhead.toLocaleString()}
        </span>
        <span className="text-[10px] text-[var(--muted-foreground)]">
          {beyondRange
            ? `all filed ${category} cases in ${countryLabel} are ahead of your ${pdYear} PD`
            : `pending I-485 applications with priority dates at or before yours`}
        </span>
      </div>

      {/* Contextual explanation when PD is newer than data range */}
      {beyondRange && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-purple-500/[0.06] border border-purple-500/10 px-2.5 py-1.5">
          <svg
            className="h-3 w-3 text-purple-400/70 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-[9px] text-purple-400/70 leading-relaxed">
            The USCIS inventory only tracks applicants with PDs up to{" "}
            <span className="font-semibold text-purple-400">{result.dataMaxYear}</span>{" "}
            for {category}/{countryLabel} — the current cutoff year. Applicants with{" "}
            {pdYear > result.dataMaxYear ? `${result.dataMaxYear + 1}+` : `${pdYear}+`} PDs
            haven&apos;t filed I-485 yet (cutoff hasn&apos;t reached them). Your count reflects
            all currently-filed cases — it will decrease as those applicants are approved.
          </p>
        </div>
      )}

      {/* Footer */}
      <p className="mt-1.5 text-[9px] text-[var(--muted-foreground)]/50 leading-relaxed">
        Source: USCIS EB I-485 Pending Inventory
        {result.snapshotDate ? ` (${result.snapshotDate})` : ""}.
        Excludes DOS consular inventory and approved I-140 holders who haven&apos;t filed
        I-485 yet.
      </p>
    </div>
  );
}
