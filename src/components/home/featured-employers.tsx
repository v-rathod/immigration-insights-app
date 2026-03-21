"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, Building2, ArrowRight } from "lucide-react";
import { GlassCard, FadeIn } from "@/components/ui";
import { cn } from "@/lib/utils";
import { srsTierColor } from "@/lib/utils/format";
import { loadEmployerSearch, type EmployerSearchEntry } from "@/lib/data/employer-shard";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOP_COUNT = 6;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeaturedEmployers() {
  const [employers, setEmployers] = useState<EmployerSearchEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadEmployerSearch()
      .then((data) => {
        if (cancelled) return;
        // Top employers by filing volume with SRS scores
        const rated = data
          .filter((e) => e.srs_score != null && e.total_filings > 0)
          .sort((a, b) => b.total_filings - a.total_filings)
          .slice(0, TOP_COUNT);
        setEmployers(rated);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: TOP_COUNT }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--muted)]/20 border border-[var(--border)]" />
        ))}
      </div>
    );
  }

  if (employers.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-emerald-400" strokeWidth={2} />
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Top Sponsors by Volume
        </h3>
        <span className="text-xs text-[var(--muted-foreground)]">
          (3-year filings)
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Featured employers">
        {employers.map((emp) => (
          <Link
            key={emp.employer_id}
            href={`/dashboard/employer?q=${encodeURIComponent(emp.employer_name)}`}
            className="block"
            role="listitem"
          >
            <GlassCard
              variant="interactive"
              padding="sm"
              className="group flex items-center gap-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <Building2 className="h-4 w-4 text-blue-400" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-[var(--foreground)]">
                  {emp.employer_name}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">
                  <span>{emp.total_filings.toLocaleString()} filings</span>
                  {emp.srs_score != null && (
                    <>
                      <span className="text-[var(--border)]">|</span>
                      <span className={cn("font-semibold", srsTierColor(emp.srs_tier))}>
                        {emp.srs_tier} ({emp.srs_score})
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ArrowRight className="h-3 w-3 shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
