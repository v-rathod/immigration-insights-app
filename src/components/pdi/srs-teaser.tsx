/**
 * SrsTeaser — Visual teaser card for the SRS feature on the homepage.
 *
 * Displays a static preview of the SRS feature with key stats and
 * a compelling CTA. Does NOT load the 138MB employer dataset — all
 * values are statically provided via props.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Static highlight stats (from P2 — hard-coded to avoid loading 138MB)
// ---------------------------------------------------------------------------

const SRS_HIGHLIGHTS = [
  { label: "Employers Scored", value: "70,206", accent: "text-emerald-400" },
  { label: "ML-Verified", value: "1,695", accent: "text-purple-400" },
];

const SRS_FEATURES = [
  "Bayesian-adjusted approval rates",
  "Wage competitiveness vs. OEWS",
  "ML-verified scores (XGBoost)",
  "Sustainability & job diversity tracking",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SrsTeaser({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden flex flex-col",
        className
      )}
    >
      {/* Header */}
      <div className="p-5 pb-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400">
            <Shield className="h-3.5 w-3.5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Sponsor Reliability Score
            </h3>
            <p className="text-[10px] text-[var(--muted-foreground)] font-mono uppercase tracking-wider">
              SRS
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)] leading-relaxed">
          Evaluate any employer&apos;s immigration sponsorship track record
          with a data-driven reliability score.
        </p>
      </div>

      {/* Stats row */}
      <div className="px-5 pt-4">
        <div className="grid grid-cols-3 gap-3">
          {SRS_HIGHLIGHTS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className={cn("text-lg font-bold font-mono", stat.accent)}>
                {stat.value}
              </div>
              <div className="text-[10px] text-[var(--muted-foreground)]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decorative gauge preview */}
      <div className="px-5 pt-4 flex justify-center">
        <div className="relative">
          <svg width="120" height="72" viewBox="0 0 120 72">
            {/* Background arc */}
            <path
              d="M 15 65 A 50 50 0 0 1 105 65"
              fill="none"
              stroke="var(--border)"
              strokeWidth="8"
              strokeLinecap="round"
              opacity="0.3"
            />
            {/* Colored arc — animated */}
            <motion.path
              d="M 15 65 A 50 50 0 0 1 105 65"
              fill="none"
              stroke="url(#srs-teaser-gradient)"
              strokeWidth="8"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 0.72 }}
              transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
            />
            <defs>
              <linearGradient id="srs-teaser-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          {/* Score label */}
          <div className="absolute inset-0 flex items-end justify-center pb-1">
            <div className="text-center">
              <div className="text-xl font-bold font-mono text-[var(--foreground)]">72</div>
              <div className="text-[9px] text-emerald-400 font-medium">Good</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature checklist */}
      <div className="px-5 pt-3 flex-1">
        <div className="space-y-1.5">
          {SRS_FEATURES.map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <CheckCircle2
                className="h-3 w-3 text-emerald-400/60 shrink-0"
                strokeWidth={2}
              />
              <span className="text-[11px] text-[var(--muted-foreground)]">
                {feature}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Search teaser */}
      <div className="px-5 pt-3">
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
          <Building2 className="h-3.5 w-3.5 text-[var(--muted-foreground)]" strokeWidth={1.5} />
          <span className="text-xs text-[var(--muted-foreground)]/60 italic">
            Search 70,000+ employers…
          </span>
        </div>
      </div>

      {/* CTA */}
      <div className="p-4 pt-3 mt-auto">
        <Link
          href="/dashboard/employer/"
          className="group flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] py-2.5 text-xs font-medium text-[var(--muted-foreground)] transition-all duration-200 hover:bg-white/[0.08] hover:text-[var(--foreground)]"
        >
          <span>Explore employer scores</span>
          <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
