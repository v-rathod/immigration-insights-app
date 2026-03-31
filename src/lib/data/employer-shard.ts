/**
 * Employer Shard Loaders — Unified shard-based data access.
 *
 * Instead of loading monolithic 50–140 MB JSON files containing ALL employers,
 * this module loads:
 *   1. A compact search index (_search.json, ~14 MB) for typeahead search
 *   2. Individual per-employer shards (~3–50 KB each) on demand
 *   3. Pre-computed SRS overview stats (~200 bytes)
 *
 * This reduces initial page load from ~400 MB → ~14 MB, and per-employer
 * interaction from ~245 MB → ~15–50 KB (~200× improvement).
 */

import type {
  SponsorReliabilityScore,
  EmployerMonthlyMetric,
} from "@/types/p2-artifacts";
import type {
  EmployerSalaryTrend,
  EmployerWageRanking,
  EmployerRoleTrend,
  LcaFiling,
  H1bPetitionYear,
  LcaAnnualCount,
} from "@/lib/data/wage";
import type { SrsOverviewStats } from "@/lib/data/srs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Employer activity classification: active (recent filings), legacy (4-8 years ago), historical (9+ years). */
export type ActivityStatus = 'active' | 'legacy' | 'historical';

/** Compact entry format used in _search.json (short keys to stay under 20 MB). */
interface CompactSearchEntry {
  n: string;       // employer_name
  id: string;      // employer_id (SHA-1 hash)
  f?: number;      // total_filings
  sc?: number;     // n_soc_codes
  ms?: number;     // latest_median_salary
  y?: number;      // latest_year
  ss?: number;     // srs_score
  st?: string;     // srs_tier
  ac?: string;     // activity_status compact code: "a" | "l" | "h"
}

/** Expanded search entry used by UI components. */
export interface EmployerSearchEntry {
  employer_name: string;
  employer_id: string;
  total_filings: number;
  n_soc_codes: number;
  latest_median_salary: number;
  latest_year: number;
  srs_score: number | null;
  srs_tier: string;
  activity_status: ActivityStatus;
}

/** Full enriched employer shard loaded on demand. */
export interface EmployerShard {
  employer_name: string;
  employer_id: string;
  lca: LcaFiling[];
  lca_total?: number;
  lca_fy_range?: [number, number];
  /** Annual LCA filing counts for the last 10 fiscal years. [{fiscal_year, count}] FY desc. */
  lca_annual?: LcaAnnualCount[];
  h1b_petitions?: H1bPetitionYear[];
  /** Role breakdown from employer_role_profiles (employer_name/id stripped). */
  wage_roles?: Record<string, unknown>[];
  /** Yearly salary trend from employer_salary_trend (employer_name/id stripped). */
  wage_trend?: Record<string, unknown>[];
  /** Multi-year percentile data from employer_role_trends (employer_name/id stripped). */
  wage_role_trends?: Record<string, unknown>[];
  /** SRS score record (P2 field names: efs/efs_tier — remapped on extraction). */
  srs?: Record<string, unknown>;
  /** Monthly metrics time series (employer_name/id stripped). */
  srs_monthly?: Record<string, unknown>[];
}

/** JSON shape of srs_overview.json */
interface SrsOverviewJson {
  totalEmployers: number;
  ratedEmployers: number;
  avgScore: number;
  medianScore: number;
  tierDistribution: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

/**
 * Load the unified employer search index (~14 MB, <20 MB CloudFront limit).
 * Handles both compact key format (n/id/f/…) written by current sync script
 * and full key format (employer_name/employer_id/…) from older deploys.
 */
export async function loadEmployerSearch(): Promise<EmployerSearchEntry[]> {
  const res = await fetch("/data/employers/_search.json");
  if (!res.ok) return [];
  const raw = await res.text();
  const sanitized = raw.replace(/\bNaN\b|-?\bInfinity\b/g, "null");
  const data: Array<Record<string, unknown>> = JSON.parse(sanitized);
  if (!Array.isArray(data) || data.length === 0) return [];

  // Detect format by inspecting the first entry's keys
  const isCompact = "n" in data[0];

  return data.map((e) =>
    isCompact
      ? {
          employer_name: e.n as string,
          employer_id: e.id as string,
          total_filings: (e.f as number) ?? 0,
          n_soc_codes: (e.sc as number) ?? 0,
          latest_median_salary: (e.ms as number) ?? 0,
          latest_year: (e.y as number) ?? 0,
          srs_score: (e.ss as number) ?? null,
          srs_tier: (e.st as string) ?? "Unrated",
          activity_status: ({ a: 'active', l: 'legacy', h: 'historical' } as Record<string, ActivityStatus>)[(e.ac as string) ?? 'a'] ?? 'active',
        }
      : {
          employer_name: e.employer_name as string,
          employer_id: e.employer_id as string,
          total_filings: (e.total_filings as number) ?? 0,
          n_soc_codes: (e.n_soc_codes as number) ?? 0,
          latest_median_salary: (e.latest_median_salary as number) ?? 0,
          latest_year: (e.latest_year as number) ?? 0,
          srs_score: (e.srs_score as number) ?? null,
          srs_tier: (e.srs_tier as string) ?? "Unrated",
          activity_status: 'active',
        }
  );
}

/**
 * Load a single employer shard by ID (SHA-1 hash).
 * Returns null if the shard doesn't exist.
 */
export async function loadEmployerShard(employerId: string): Promise<EmployerShard | null> {
  if (!employerId) return null;
  try {
    const res = await fetch(`/data/employers/${employerId}.json`);
    if (!res.ok) return null;
    const raw = await res.text();
    const sanitized = raw.replace(/\bNaN\b|-?\bInfinity\b/g, "null");
    return JSON.parse(sanitized) as EmployerShard;
  } catch {
    return null;
  }
}

/**
 * Load pre-computed SRS overview statistics.
 * The warnFlaggedCount defaults to 0 — caller can update from risk features.
 */
export async function loadSrsOverview(): Promise<SrsOverviewStats> {
  const fallback: SrsOverviewStats = {
    totalEmployers: 0, ratedEmployers: 0,
    excellentCount: 0, goodCount: 0, moderateCount: 0,
    belowAverageCount: 0, poorCount: 0, unratedCount: 0,
    avgScore: 0, medianScore: 0, warnFlaggedCount: 0,
  };
  try {
    const res = await fetch("/data/dashboards/employer/srs_overview.json");
    if (!res.ok) return fallback;
    const data: SrsOverviewJson = await res.json();
    const td = data.tierDistribution ?? {};
    return {
      totalEmployers: data.totalEmployers,
      ratedEmployers: data.ratedEmployers,
      excellentCount: td["Excellent"] ?? 0,
      goodCount: td["Good"] ?? 0,
      moderateCount: td["Moderate"] ?? 0,
      belowAverageCount: td["Below Average"] ?? 0,
      poorCount: td["Poor"] ?? 0,
      unratedCount: td["Unrated"] ?? 0,
      avgScore: data.avgScore,
      medianScore: data.medianScore,
      warnFlaggedCount: 0,
    };
  } catch {
    return fallback;
  }
}

/**
 * Load data freshness timestamp (~50 bytes).
 * Falls back to _manifest.json if _freshness.json is not available.
 */
export async function loadFreshness(): Promise<{ synced_at: string } | null> {
  try {
    let res = await fetch("/data/_freshness.json");
    if (!res.ok) {
      // Fallback to manifest
      res = await fetch("/data/_manifest.json");
      if (!res.ok) return null;
    }
    const data = await res.json();
    return data?.synced_at ? { synced_at: data.synced_at } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shard data extractors — re-inject employer_name/id and remap P2 fields
// ---------------------------------------------------------------------------

/**
 * Extract the SRS record from a shard, remapping P2 efs→srs fields.
 * Returns a full SponsorReliabilityScore compatible with all SRS components.
 */
export function extractSrsFromShard(shard: EmployerShard): SponsorReliabilityScore | null {
  const raw = shard.srs;
  if (!raw) return null;

  const efsVal = raw.efs as number | null | undefined;
  const srsScore = efsVal != null && !isNaN(efsVal) ? efsVal : null;

  // Spread all P2 fields (they match SponsorReliabilityScore field names),
  // then override employer identity and remap efs→srs.
  return {
    ...(raw as Record<string, unknown>),
    employer_name: shard.employer_name,
    employer_id: shard.employer_id,
    srs: srsScore,
    srs_tier: srsScore != null ? ((raw.efs_tier as string) ?? "Unrated") : "Unrated",
  } as unknown as SponsorReliabilityScore;
}

/** Extract monthly metrics from shard, re-injecting employer_id. */
export function extractMonthlyMetrics(shard: EmployerShard): EmployerMonthlyMetric[] {
  if (!shard.srs_monthly) return [];
  return shard.srs_monthly.map((r) => ({
    ...r,
    employer_id: shard.employer_id,
  })) as EmployerMonthlyMetric[];
}

/** Extract salary trend data from shard, re-injecting employer_name. */
export function extractWageTrend(shard: EmployerShard): EmployerSalaryTrend[] {
  if (!shard.wage_trend) return [];
  return shard.wage_trend.map((r) => ({
    ...r,
    employer_name: shard.employer_name,
  })) as EmployerSalaryTrend[];
}

/** Extract role profiles from shard, re-injecting employer_name. */
export function extractWageRoles(shard: EmployerShard): EmployerWageRanking[] {
  if (!shard.wage_roles) return [];
  return shard.wage_roles.map((r) => ({
    ...r,
    employer_name: shard.employer_name,
  })) as EmployerWageRanking[];
}

/** Extract multi-year role trend data from shard, re-injecting employer_name. */
export function extractWageRoleTrends(shard: EmployerShard): EmployerRoleTrend[] {
  if (!shard.wage_role_trends) return [];
  return shard.wage_role_trends.map((r) => ({
    ...r,
    employer_name: shard.employer_name,
  })) as EmployerRoleTrend[];
}
