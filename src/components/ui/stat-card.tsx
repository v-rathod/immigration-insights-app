"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { type LucideIcon, Info } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatCardProps {
  /** Stat label */
  label: string;
  /** Numeric value for animation */
  value: number;
  /** Formatted display value (if different from animated number) */
  displayValue?: string;
  /** Optional suffix (e.g., "+", "%", "M") */
  suffix?: string;
  /** Optional prefix (e.g., "$") */
  prefix?: string;
  /** Icon component */
  icon?: LucideIcon;
  /** Trend indicator */
  trend?: { value: number; label: string };
  /** Additional className */
  className?: string;
  /** Format function for the ticker */
  format?: (n: number) => string;
  /** Short explanation shown as a tooltip on the ⓘ icon */
  tooltip?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatCard({
  label,
  value,
  displayValue,
  suffix = "",
  prefix = "",
  icon: Icon,
  trend,
  className,
  format,
  tooltip,
}: StatCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  // Defensive: never allow NaN or undefined to render
  const safeValue = typeof value !== 'number' || isNaN(value) || !isFinite(value) ? 0 : value;
  const safeDisplay = (displayValue == null || displayValue === '' || displayValue === 'NaN' || displayValue === 'undefined' || displayValue === 'null') ? undefined : displayValue;
  return (
    <GlassCard
      variant="elevated"
      padding="md"
      glow
      className={cn("group", className)}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              {label}
            </p>
            {tooltip && (
              <div className="relative">
                <button
                  type="button"
                  aria-label={`About ${label}`}
                  onClick={() => setShowTooltip((v) => !v)}
                  onBlur={() => setShowTooltip(false)}
                  className="flex items-center text-[var(--muted-foreground)]/40 hover:text-[var(--muted-foreground)] transition-colors focus:outline-none"
                >
                  <Info className="h-3 w-3" strokeWidth={2} />
                </button>
                {showTooltip && (
                  <div
                    role="tooltip"
                    className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-xs leading-relaxed text-[var(--muted-foreground)] shadow-xl"
                  >
                    {tooltip}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--border)]" />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            {safeDisplay ? (
              <span className="font-mono text-3xl font-bold tracking-tight text-[var(--foreground)]">
                {prefix}{safeDisplay}{suffix}
              </span>
            ) : (
              <NumberTicker
                value={safeValue}
                format={format}
                prefix={prefix}
                suffix={suffix}
                className="font-mono text-3xl font-bold tracking-tight text-[var(--foreground)]"
              />
            )}
          </div>
          {trend && (
            <TrendBadge value={trend.value} label={trend.label} />
          )}
        </div>
        {Icon && (
          <div className="rounded-xl bg-[var(--muted)]/50 p-2.5 transition-colors group-hover:bg-[var(--accent-blue)]/10">
            <Icon
              className="h-5 w-5 text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--accent-blue)]"
              strokeWidth={1.5}
            />
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Trend Badge
// ---------------------------------------------------------------------------

function TrendBadge({ value, label }: { value: number; label: string }) {
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        isPositive
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-rose-500/10 text-rose-400"
      )}
    >
      <span>{isPositive ? "↑" : "↓"}</span>
      <span>{Math.abs(value).toFixed(2)}%</span>
      <span className="text-[var(--muted-foreground)]">{label}</span>
    </span>
  );
}
