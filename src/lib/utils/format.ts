/**
 * Formatting utilities for the Compass UI.
 */

const numberFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Format a number with commas: 1234567 → "1,234,567" */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return numberFormatter.format(n);
}

/** Format as currency: 125000 → "$125,000" */
export function formatCurrency(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return currencyFormatter.format(n);
}

/** Format as percentage: 0.892 → "89.2%" */
export function formatPercent(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return percentFormatter.format(n);
}

/** Format as compact: 1234567 → "1.2M" */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return compactFormatter.format(n);
}

/** Format an ISO date string as "Mar 2025" */
export function formatMonthYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

/** Format an ISO date string as "March 15, 2025" */
export function formatFullDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

/** Format days into human-readable duration: 730 → "2 years", 45 → "1.5 months" */
export function formatWaitTime(days: number | null | undefined): string {
  if (days == null || isNaN(days)) return "—";
  if (days < 0) return "Current";
  if (days < 30) return `${days} days`;
  if (days < 365) {
    const months = Math.round(days / 30.44);
    return `${months} month${months !== 1 ? "s" : ""}`;
  }
  const years = (days / 365.25).toFixed(1);
  return `${years} years`;
}

/** SRS tier → color class mapping */
export function srsTierColor(tier: string): string {
  switch (tier?.toLowerCase()) {
    case "excellent":
      return "text-emerald-400";
    case "good":
      return "text-blue-400";
    case "moderate":
      return "text-amber-400";
    case "below average":
      return "text-orange-400";
    case "poor":
      return "text-rose-400";
    default:
      return "text-zinc-400";
  }
}

/** SRS tier → background color class */
export function srsTierBg(tier: string): string {
  switch (tier?.toLowerCase()) {
    case "excellent":
      return "bg-emerald-500/10 border-emerald-500/20";
    case "good":
      return "bg-blue-500/10 border-blue-500/20";
    case "moderate":
      return "bg-amber-500/10 border-amber-500/20";
    case "below average":
      return "bg-orange-500/10 border-orange-500/20";
    case "poor":
      return "bg-rose-500/10 border-rose-500/20";
    default:
      return "bg-zinc-500/10 border-zinc-500/20";
  }
}

/** SRS tier → hex color for charts */
export function srsTierHex(tier: string): string {
  switch (tier?.toLowerCase()) {
    case "excellent":
      return "#10b981";
    case "good":
      return "#3b82f6";
    case "moderate":
      return "#f59e0b";
    case "below average":
      return "#f97316";
    case "poor":
      return "#f43f5e";
    default:
      return "#71717a";
  }
}

/** SRS numeric score → tier label */
export function srsScoreToTier(score: number | null): string {
  if (score == null || isNaN(score)) return "Unrated";
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Moderate";
  if (score >= 35) return "Below Average";
  return "Poor";
}

// Keep backwards compat aliases
export const tierColor = srsTierColor;
export const tierBg = srsTierBg;
