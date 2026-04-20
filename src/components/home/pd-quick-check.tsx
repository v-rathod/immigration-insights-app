"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Calendar, ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { cn, formatCutoffIso } from "@/lib/utils";
import { loadCutoffTrends } from "@/lib/data/pdi";
import type { CutoffTrendRecord } from "@/lib/data/pdi";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = ["EB1", "EB2", "EB3"] as const;
const COUNTRIES = [
  { code: "IND", label: "India" },
  { code: "CHN", label: "China" },
  { code: "ROW", label: "Rest of World" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// formatCutoffIso is imported from @/lib/utils — handles both YYYY-MM-DD and YYYY-MM-DDTHH:mm:ss

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdQuickCheck() {
  const [trends, setTrends] = useState<CutoffTrendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("EB2");
  const [country, setCountry] = useState<string>("IND");

  useEffect(() => {
    let cancelled = false;
    loadCutoffTrends()
      .then((data) => {
        if (!cancelled) {
          setTrends(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Find the latest FAD record for selected category/country
  const currentCutoff = useCallback(() => {
    const fad = trends.filter(
      (r) =>
        r.chart === "FAD" &&
        r.category === category &&
        r.country === country &&
        r.bulletin_year &&
        r.bulletin_month
    );
    if (fad.length === 0) return null;
    fad.sort(
      (a, b) =>
        b.bulletin_year * 100 +
        b.bulletin_month -
        (a.bulletin_year * 100 + a.bulletin_month)
    );
    return fad[0];
  }, [trends, category, country]);

  const record = currentCutoff();
  const isCurrent = record?.status_flag === "C";
  const v = record?.velocity_3m;
  const retro = record?.retrogression_flag === 1;

  // Skeleton
  if (loading) {
    return (
      <GlassCard padding="md" className="animate-pulse">
        <div className="mb-3 h-4 w-32 rounded bg-[var(--muted)]/50" />
        <div className="flex gap-2 mb-3">
          <div className="h-8 w-16 rounded bg-[var(--muted)]/30" />
          <div className="h-8 w-20 rounded bg-[var(--muted)]/30" />
        </div>
        <div className="h-12 rounded bg-[var(--muted)]/30" />
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="md">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-purple-400" strokeWidth={2} />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Priority Date Check
        </span>
      </div>

      {/* Selectors */}
      <div className="mb-3 flex flex-wrap gap-2">
        {/* Category */}
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                category === cat
                  ? "bg-purple-500/15 text-purple-400"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50"
              )}
              aria-pressed={category === cat}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Country */}
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setCountry(c.code)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                country === c.code
                  ? "bg-purple-500/15 text-purple-400"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50"
              )}
              aria-pressed={country === c.code}
            >
              {c.code}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {record ? (
        <div className="flex items-center justify-between rounded-lg border border-[var(--border)]/50 bg-[var(--muted)]/20 px-3 py-2.5">
          <div>
            <div className="text-[10px] text-[var(--muted-foreground)]">
              {category} {COUNTRIES.find((c) => c.code === country)?.label} Final Action Date
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span
                className={cn(
                  "font-mono text-sm font-semibold",
                  isCurrent ? "text-emerald-400" : "text-[var(--foreground)]"
                )}
              >
                {isCurrent || !record.cutoff_date
                  ? "Current"
                  : formatCutoffIso(record.cutoff_date)}
              </span>
              {!isCurrent && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-[10px]",
                    retro
                      ? "text-red-400"
                      : v && v > 60
                        ? "text-emerald-400"
                        : v && v > 0
                          ? "text-amber-400"
                          : "text-[var(--muted-foreground)]"
                  )}
                >
                  {retro ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : v && v > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  {retro
                    ? "Retrogressed"
                    : v && v > 0
                      ? `+${Math.round(v)} days/mo`
                      : "Stalled"}
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/dashboard/visa-bulletin?category=${category}&country=${country}`}
            className="shrink-0 rounded-md bg-purple-500/10 px-2.5 py-1.5 text-[10px] font-medium text-purple-400 transition-colors hover:bg-purple-500/20"
          >
            Full Chart <ArrowRight className="ml-1 inline h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted-foreground)] space-y-1">
          <p>No data for {category} {country}</p>
          <p className="text-[var(--muted-foreground)]/50">This combination may not have separate cutoff tracking.</p>
        </div>
      )}
    </GlassCard>
  );
}
