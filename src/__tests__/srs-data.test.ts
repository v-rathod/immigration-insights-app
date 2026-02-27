/**
 * Tests for SRS data loader and helper functions.
 */
import { describe, it, expect } from "vitest";
import {
  filterOverallScores,
  filterRatedEmployers,
  mergeMLScores,
  getEmployerMetrics,
  getEmployerRisk,
  computeSrsStats,
  remapEfsToSrs,
  remapEfsMlToSrs,
} from "@/lib/data/srs";
import type {
  SponsorReliabilityScore,
  SponsorReliabilityScoreML,
  EmployerMonthlyMetric,
  EmployerRiskFeature,
} from "@/types/p2-artifacts";

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeSrs(overrides: Partial<SponsorReliabilityScore> = {}): SponsorReliabilityScore {
  return {
    employer_id: "abc123",
    employer_name: "Acme Corp",
    scope: "overall",
    soc_code: null,
    n_12m: 10,
    n_24m: 20,
    n_36m: 30,
    approval_rate_24m: 0.95,
    denial_rate_24m: 0.05,
    wage_ratio_med: 1.1,
    wage_ratio_p75: 0.9,
    outcome_subscore: 90,
    wage_subscore: 75,
    sustainability_subscore: 60,
    srs: 82,
    srs_tier: "Good",
    months_active_24m: 12,
    soc_breadth_24m: 5,
    site_breadth_24m: 3,
    approval_rate_trend_12v12: 0.02,
    outcome_volatility: 0.01,
    last_refreshed_at: "2026-02-26",
    ...overrides,
  };
}

function makeMetric(overrides: Partial<EmployerMonthlyMetric> = {}): EmployerMonthlyMetric {
  return {
    employer_id: "abc123",
    employer_name: "Acme Corp",
    month: "2024-06-01",
    filings: 5,
    approvals: 4,
    denials: 1,
    approval_rate: 0.8,
    denial_rate: 0.2,
    audit_rate_t12: 0.9,
    dataset: "PERM",
    ...overrides,
  };
}

function makeRisk(overrides: Partial<EmployerRiskFeature> = {}): EmployerRiskFeature {
  return {
    employer_key: "acme corp",
    total_warn_events: 2,
    total_employees_affected: 150,
    states: "['CA']",
    employer_name_raw: "Acme Corp",
    employer_id: "abc123",
    is_warn_flagged: true,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// filterOverallScores
// ═══════════════════════════════════════════════════════════════════════════

describe("filterOverallScores", () => {
  it("filters to scope=overall only", () => {
    const data = [
      makeSrs({ scope: "overall" }),
      makeSrs({ scope: "SOC", soc_code: "15-1211" }),
      makeSrs({ scope: "overall", employer_id: "xyz" }),
    ];
    const result = filterOverallScores(data);
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.scope === "overall")).toBe(true);
  });

  it("returns empty for no overall", () => {
    const data = [makeSrs({ scope: "SOC" })];
    expect(filterOverallScores(data)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// filterRatedEmployers
// ═══════════════════════════════════════════════════════════════════════════

describe("filterRatedEmployers", () => {
  it("excludes Unrated employers", () => {
    const data = [
      makeSrs({ srs: 82, srs_tier: "Good" }),
      makeSrs({ srs: null, srs_tier: "Unrated" }),
      makeSrs({ srs: NaN, srs_tier: "Unrated" }),
    ];
    const result = filterRatedEmployers(data);
    expect(result).toHaveLength(1);
    expect(result[0].srs_tier).toBe("Good");
  });

  it("returns all when all rated", () => {
    const data = [
      makeSrs({ srs: 90, srs_tier: "Excellent" }),
      makeSrs({ srs: 50, srs_tier: "Moderate" }),
    ];
    expect(filterRatedEmployers(data)).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// mergeMLScores
// ═══════════════════════════════════════════════════════════════════════════

describe("mergeMLScores", () => {
  it("merges ML score onto matching employer", () => {
    const scores = [makeSrs({ employer_id: "abc123" })];
    const ml: SponsorReliabilityScoreML[] = [
      {
        employer_id: "abc123",
        n_cases_36m: 50,
        avg_calibrated_prob: 0.95,
        median_calibrated_prob: 0.96,
        srs_ml: 91,
        scope: "overall",
        version: "v2",
        last_refreshed_at: "2026-02-26",
      },
    ];
    const result = mergeMLScores(scores, ml);
    expect(result[0].srs_ml).toBe(91);
  });

  it("leaves srs_ml undefined when no ML match", () => {
    const scores = [makeSrs({ employer_id: "xyz" })];
    const ml: SponsorReliabilityScoreML[] = [];
    const result = mergeMLScores(scores, ml);
    expect(result[0].srs_ml).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getEmployerMetrics
// ═══════════════════════════════════════════════════════════════════════════

describe("getEmployerMetrics", () => {
  it("filters and sorts by month", () => {
    const metrics = [
      makeMetric({ employer_id: "abc123", month: "2024-03-01" }),
      makeMetric({ employer_id: "other", month: "2024-02-01" }),
      makeMetric({ employer_id: "abc123", month: "2024-01-01" }),
    ];
    const result = getEmployerMetrics(metrics, "abc123");
    expect(result).toHaveLength(2);
    expect(result[0].month).toBe("2024-01-01");
    expect(result[1].month).toBe("2024-03-01");
  });

  it("returns empty for unknown employer", () => {
    expect(getEmployerMetrics([makeMetric()], "unknown")).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getEmployerRisk
// ═══════════════════════════════════════════════════════════════════════════

describe("getEmployerRisk", () => {
  it("finds matching risk feature", () => {
    const risks = [makeRisk({ employer_id: "abc123" })];
    const result = getEmployerRisk(risks, "abc123");
    expect(result?.is_warn_flagged).toBe(true);
  });

  it("returns undefined for no match", () => {
    expect(getEmployerRisk([makeRisk()], "unknown")).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// computeSrsStats
// ═══════════════════════════════════════════════════════════════════════════

describe("computeSrsStats", () => {
  it("computes aggregate statistics", () => {
    const scores = [
      makeSrs({ srs: 90, srs_tier: "Excellent", scope: "overall" }),
      makeSrs({ srs: 75, srs_tier: "Good", scope: "overall", employer_id: "b" }),
      makeSrs({ srs: 60, srs_tier: "Moderate", scope: "overall", employer_id: "c" }),
      makeSrs({ srs: null, srs_tier: "Unrated", scope: "overall", employer_id: "d" }),
      makeSrs({ srs: 80, srs_tier: "Good", scope: "SOC", employer_id: "e" }), // Should be excluded (not overall)
    ];
    const risks = [makeRisk({ is_warn_flagged: true })];

    const stats = computeSrsStats(scores, risks);

    expect(stats.totalEmployers).toBe(4); // Only overall scope
    expect(stats.ratedEmployers).toBe(3);
    expect(stats.excellentCount).toBe(1);
    expect(stats.goodCount).toBe(1);
    expect(stats.moderateCount).toBe(1);
    expect(stats.unratedCount).toBe(1);
    expect(stats.avgScore).toBe(75);
    expect(stats.medianScore).toBe(75);
    expect(stats.warnFlaggedCount).toBe(1);
  });

  it("handles empty data", () => {
    const stats = computeSrsStats([], []);
    expect(stats.totalEmployers).toBe(0);
    expect(stats.ratedEmployers).toBe(0);
    expect(stats.avgScore).toBe(0);
    expect(stats.medianScore).toBe(0);
  });

  it("handles all unrated", () => {
    const scores = [
      makeSrs({ srs: null, srs_tier: "Unrated", scope: "overall" }),
    ];
    const stats = computeSrsStats(scores, []);
    expect(stats.totalEmployers).toBe(1);
    expect(stats.ratedEmployers).toBe(0);
    expect(stats.unratedCount).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// remapEfsToSrs — P2 JSON efs→srs field remapping
// ═══════════════════════════════════════════════════════════════════════════

describe("remapEfsToSrs", () => {
  it("renames efs→srs and efs_tier→srs_tier", () => {
    const raw = [
      { employer_id: "a", employer_name: "Test", efs: 85.3, efs_tier: "Excellent", scope: "overall" },
    ];
    const result = remapEfsToSrs(raw);
    expect(result[0].srs).toBe(85.3);
    expect(result[0].srs_tier).toBe("Excellent");
    // Original efs/efs_tier should not exist
    expect("efs" in result[0]).toBe(false);
    expect("efs_tier" in result[0]).toBe(false);
  });

  it("normalizes NaN efs to null", () => {
    const raw = [
      { employer_id: "b", employer_name: "NaN Corp", efs: NaN, efs_tier: "Unrated", scope: "overall" },
    ];
    const result = remapEfsToSrs(raw);
    expect(result[0].srs).toBeNull();
  });

  it("defaults missing efs_tier to Unrated", () => {
    const raw = [
      { employer_id: "c", employer_name: "No Tier", efs: null, scope: "overall" },
    ];
    const result = remapEfsToSrs(raw);
    expect(result[0].srs_tier).toBe("Unrated");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// remapEfsMlToSrs — P2 JSON efs_ml→srs_ml field remapping
// ═══════════════════════════════════════════════════════════════════════════

describe("remapEfsMlToSrs", () => {
  it("renames efs_ml→srs_ml", () => {
    const raw = [
      { employer_id: "a", efs_ml: 91.5, scope: "overall", n_cases_36m: 50 },
    ];
    const result = remapEfsMlToSrs(raw);
    expect(result[0].srs_ml).toBe(91.5);
    expect("efs_ml" in result[0]).toBe(false);
  });

  it("defaults missing efs_ml to 0", () => {
    const raw = [
      { employer_id: "b", scope: "overall", n_cases_36m: 10 },
    ];
    const result = remapEfsMlToSrs(raw);
    expect(result[0].srs_ml).toBe(0);
  });
});
