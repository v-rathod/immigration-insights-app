import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatCompact,
  formatMonthYear,
  formatFullDate,
  formatWaitTime,
  parseCutoffIso,
  formatCutoffIso,
  tierColor,
  tierBg,
  srsTierColor,
  srsTierBg,
  srsTierHex,
  srsScoreToTier,
} from "@/lib/utils/format";

// ═══════════════════════════════════════════════════════════════════════════
// Number Formatting
// ═══════════════════════════════════════════════════════════════════════════

describe("formatNumber", () => {
  it("formats with commas", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("returns em-dash for null/undefined/NaN", () => {
    expect(formatNumber(null)).toBe("–");
    expect(formatNumber(undefined)).toBe("–");
    expect(formatNumber(NaN)).toBe("–");
  });

  it("handles zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
});

describe("formatCurrency", () => {
  it("formats as USD", () => {
    expect(formatCurrency(125000)).toBe("$125,000");
  });

  it("returns em-dash for null", () => {
    expect(formatCurrency(null)).toBe("–");
  });
});

describe("formatPercent", () => {
  it("formats decimal as percentage", () => {
    expect(formatPercent(0.892)).toBe("89.2%");
  });

  it("returns em-dash for NaN", () => {
    expect(formatPercent(NaN)).toBe("–");
  });
});

describe("formatCompact", () => {
  it("compacts millions", () => {
    expect(formatCompact(1234567)).toBe("1.2M");
  });

  it("compacts thousands", () => {
    expect(formatCompact(1500)).toBe("1.5K");
  });

  it("returns em-dash for null", () => {
    expect(formatCompact(null)).toBe("–");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Date Formatting
// ═══════════════════════════════════════════════════════════════════════════

describe("formatMonthYear", () => {
  it("formats ISO date as Month YYYY", () => {
    expect(formatMonthYear("2025-03-15")).toBe("Mar 2025");
  });

  it("returns em-dash for null/empty", () => {
    expect(formatMonthYear(null)).toBe("–");
    expect(formatMonthYear("")).toBe("–");
  });
});

describe("formatFullDate", () => {
  it("formats ISO date fully", () => {
    expect(formatFullDate("2025-03-15")).toBe("March 15, 2025");
  });

  it("returns em-dash for null", () => {
    expect(formatFullDate(null)).toBe("–");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Wait Time Formatting
// ═══════════════════════════════════════════════════════════════════════════

describe("formatWaitTime", () => {
  it("returns Current for negative days", () => {
    expect(formatWaitTime(-1)).toBe("Current");
  });

  it("formats days", () => {
    expect(formatWaitTime(15)).toBe("15 days");
  });

  it("formats months", () => {
    expect(formatWaitTime(90)).toBe("3 months");
  });

  it("formats years", () => {
    expect(formatWaitTime(730)).toBe("2.0 years");
  });

  it("returns em-dash for null/NaN", () => {
    expect(formatWaitTime(null)).toBe("–");
    expect(formatWaitTime(NaN)).toBe("–");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Tier Colors
// ═══════════════════════════════════════════════════════════════════════════

describe("tierColor", () => {
  it("returns correct color for each tier", () => {
    expect(tierColor("excellent")).toBe("text-emerald-400");
    expect(tierColor("good")).toBe("text-blue-400");
    expect(tierColor("moderate")).toBe("text-amber-400");
    expect(tierColor("below average")).toBe("text-orange-400");
    expect(tierColor("poor")).toBe("text-rose-400");
  });

  it("is case-insensitive", () => {
    expect(tierColor("EXCELLENT")).toBe("text-emerald-400");
  });

  it("returns default for unknown tier", () => {
    expect(tierColor("unknown")).toBe("text-zinc-400");
  });
});

describe("tierBg", () => {
  it("returns correct background for each tier", () => {
    expect(tierBg("excellent")).toContain("bg-emerald-500/10");
    expect(tierBg("poor")).toContain("bg-rose-500/10");
  });

  it("returns default for unknown tier", () => {
    expect(tierBg("xyz")).toContain("bg-zinc-500/10");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SRS Utilities
// ═══════════════════════════════════════════════════════════════════════════

describe("srsTierColor", () => {
  it("returns correct color for each tier", () => {
    expect(srsTierColor("excellent")).toBe("text-emerald-400");
    expect(srsTierColor("good")).toBe("text-blue-400");
    expect(srsTierColor("moderate")).toBe("text-amber-400");
    expect(srsTierColor("below average")).toBe("text-orange-400");
    expect(srsTierColor("poor")).toBe("text-rose-400");
  });

  it("is case-insensitive", () => {
    expect(srsTierColor("EXCELLENT")).toBe("text-emerald-400");
  });

  it("is aliased as tierColor", () => {
    expect(tierColor).toBe(srsTierColor);
  });
});

describe("srsTierBg", () => {
  it("returns correct background for each tier", () => {
    expect(srsTierBg("excellent")).toContain("bg-emerald-500/10");
    expect(srsTierBg("poor")).toContain("bg-rose-500/10");
  });

  it("is aliased as tierBg", () => {
    expect(tierBg).toBe(srsTierBg);
  });
});

describe("srsTierHex", () => {
  it("returns hex color for each tier", () => {
    expect(srsTierHex("excellent")).toBe("#10b981");
    expect(srsTierHex("good")).toBe("#3b82f6");
    expect(srsTierHex("moderate")).toBe("#f59e0b");
    expect(srsTierHex("below average")).toBe("#f97316");
    expect(srsTierHex("poor")).toBe("#f43f5e");
  });

  it("returns default for unknown tier", () => {
    expect(srsTierHex("unknown")).toBe("#71717a");
  });
});

describe("srsScoreToTier", () => {
  it("maps score ranges to tiers", () => {
    expect(srsScoreToTier(90)).toBe("Excellent");
    expect(srsScoreToTier(85)).toBe("Excellent");
    expect(srsScoreToTier(75)).toBe("Good");
    expect(srsScoreToTier(70)).toBe("Good");
    expect(srsScoreToTier(60)).toBe("Moderate");
    expect(srsScoreToTier(50)).toBe("Moderate");
    expect(srsScoreToTier(40)).toBe("Below Average");
    expect(srsScoreToTier(35)).toBe("Below Average");
    expect(srsScoreToTier(20)).toBe("Poor");
    expect(srsScoreToTier(0)).toBe("Poor");
  });

  it("returns Unrated for null/NaN", () => {
    expect(srsScoreToTier(null)).toBe("Unrated");
    expect(srsScoreToTier(NaN)).toBe("Unrated");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// parseCutoffIso + formatCutoffIso (CRITICAL — homepage date rendering)
// ═══════════════════════════════════════════════════════════════════════════

describe("parseCutoffIso", () => {
  // M27 regression: pandas serializes datetime as YYYY-MM-DDTHH:mm:ss.
  // Old code did new Date(iso + "T00:00:00Z") which broke for that format.
  // parseCutoffIso strips the time part before applying UTC midnight.

  it("CRITICAL: parses pandas format YYYY-MM-DDTHH:mm:ss without double-T bug", () => {
    const d = parseCutoffIso("2023-12-01T00:00:00");
    expect(d).not.toBeNull();
    expect(Number.isFinite(d!.getTime())).toBe(true);
    // Should be Dec 2023
    expect(d!.getUTCMonth()).toBe(11); // 0-indexed
    expect(d!.getUTCFullYear()).toBe(2023);
  });

  it("parses bare YYYY-MM-DD format correctly", () => {
    const d = parseCutoffIso("2023-12-01");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2023);
    expect(d!.getUTCMonth()).toBe(11);
    expect(d!.getUTCDate()).toBe(1);
  });

  it("returns null for null/undefined", () => {
    expect(parseCutoffIso(null)).toBeNull();
    expect(parseCutoffIso(undefined)).toBeNull();
  });

  it("returns null for \"nan\" string (pandas NaT serialization)", () => {
    expect(parseCutoffIso("nan")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseCutoffIso("")).toBeNull();
  });
});

describe("formatCutoffIso", () => {
  it("CRITICAL: formats pandas datetime format as Mon YYYY (never Invalid Date)", () => {
    expect(formatCutoffIso("2023-12-01T00:00:00")).toBe("Dec 2023");
    expect(formatCutoffIso("2014-07-01T00:00:00")).toBe("Jul 2014");
    expect(formatCutoffIso("2026-05-01T00:00:00")).toBe("May 2026");
  });

  it("formats bare YYYY-MM-DD format correctly", () => {
    expect(formatCutoffIso("2023-12-01")).toBe("Dec 2023");
  });

  it("returns dash for null/undefined/nan", () => {
    expect(formatCutoffIso(null)).toBe("\u2013");
    expect(formatCutoffIso(undefined)).toBe("\u2013");
    expect(formatCutoffIso("nan")).toBe("\u2013");
  });

  it("result never contains the string Invalid", () => {
    // Extra safety: ensure result never bleeds through as 'Invalid Date'
    const inputs = [
      "2023-12-01T00:00:00",
      "2014-07-01T00:00:00",
      "2019-01-01T00:00:00",
      "2026-05-01T00:00:00",
    ];
    for (const iso of inputs) {
      const result = formatCutoffIso(iso);
      expect(result, `formatCutoffIso("${iso}") returned: ${result}`)
        .not.toContain("Invalid");
    }
  });
});
