/**
 * Sponsor Reliability Score (SRS) data loaders.
 *
 * Loads pre-computed employer scores, monthly metrics, features,
 * risk signals, and ML scores from public/data/dashboards/employer/.
 */

import { loadDashboardData, loadDimension } from "./loader";
import type {
  SponsorReliabilityScore,
  SponsorReliabilityScoreML,
  EmployerMonthlyMetric,
  EmployerRiskFeature,
  EmployerFeatures,
  DimEmployer,
} from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Field remapping — P2 JSON uses "efs"/"efs_tier"/"efs_ml" while P3 uses
// "srs"/"srs_tier"/"srs_ml". Remap at load boundary so downstream code
// only sees the SRS naming convention.
// ---------------------------------------------------------------------------

export interface RawEfsRecord {
  efs?: number | null;
  efs_tier?: string;
  [key: string]: unknown;
}

export interface RawEfsMlRecord {
  efs_ml?: number;
  [key: string]: unknown;
}

/** Remap efs→srs, efs_tier→srs_tier. Normalizes NaN to null. */
export function remapEfsToSrs(raw: RawEfsRecord[]): SponsorReliabilityScore[] {
  return raw.map(({ efs, efs_tier, ...rest }) => ({
    ...rest,
    srs: efs != null && !isNaN(efs) ? efs : null,
    srs_tier: efs_tier ?? "Unrated",
  })) as SponsorReliabilityScore[];
}

/** Remap efs_ml→srs_ml. */
export function remapEfsMlToSrs(raw: RawEfsMlRecord[]): SponsorReliabilityScoreML[] {
  return raw.map(({ efs_ml, ...rest }) => ({
    ...rest,
    srs_ml: efs_ml ?? 0,
  })) as SponsorReliabilityScoreML[];
}

// ---------------------------------------------------------------------------
// Raw data loaders
// ---------------------------------------------------------------------------

/** Load rules-based SRS scores (70,206 records) */
export async function loadSrsScores(): Promise<SponsorReliabilityScore[]> {
  const raw = await loadDashboardData<RawEfsRecord>(
    "employer",
    "employer_friendliness_scores"
  );
  return remapEfsToSrs(raw);
}

/** Load ML SRS scores for high-volume employers (1,695 records) */
export async function loadSrsScoresML(): Promise<SponsorReliabilityScoreML[]> {
  const raw = await loadDashboardData<RawEfsMlRecord>(
    "employer",
    "employer_friendliness_scores_ml"
  );
  return remapEfsMlToSrs(raw);
}

/** Load employer monthly metrics time series (224,114 records) */
export async function loadEmployerMonthlyMetrics(): Promise<
  EmployerMonthlyMetric[]
> {
  return loadDashboardData<EmployerMonthlyMetric>(
    "employer",
    "employer_monthly_metrics"
  );
}

/** Load WARN Act risk features (668 flagged employers) */
export async function loadEmployerRiskFeatures(): Promise<
  EmployerRiskFeature[]
> {
  return loadDashboardData<EmployerRiskFeature>(
    "employer",
    "employer_risk_features"
  );
}

/** Load raw employer features with rate windows (70,206 records) */
export async function loadEmployerFeatures(): Promise<EmployerFeatures[]> {
  return loadDashboardData<EmployerFeatures>(
    "employer",
    "employer_features"
  );
}

/** Load employer dimension for name lookup (243,134 records) */
export async function loadEmployerDimension(): Promise<DimEmployer[]> {
  return loadDimension<DimEmployer>("dim_employer");
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Get overall-scoped SRS scores (excludes SOC-level slices) */
export function filterOverallScores(
  scores: SponsorReliabilityScore[]
): SponsorReliabilityScore[] {
  return scores.filter((s) => s.scope === "overall");
}

/** Get rated employers only (SRS score is not null/NaN) */
export function filterRatedEmployers(
  scores: SponsorReliabilityScore[]
): SponsorReliabilityScore[] {
  return scores.filter(
    (s) => s.srs != null && !isNaN(s.srs) && s.srs_tier !== "Unrated"
  );
}

/** Merge ML score onto rules-based score by employer_id */
export function mergeMLScores(
  scores: SponsorReliabilityScore[],
  mlScores: SponsorReliabilityScoreML[]
): (SponsorReliabilityScore & { srs_ml?: number })[] {
  const mlMap = new Map(mlScores.map((m) => [m.employer_id, m.srs_ml]));
  return scores.map((s) => ({
    ...s,
    srs_ml: mlMap.get(s.employer_id),
  }));
}

/** Get monthly metrics for a specific employer */
export function getEmployerMetrics(
  metrics: EmployerMonthlyMetric[],
  employerId: string
): EmployerMonthlyMetric[] {
  return metrics
    .filter((m) => m.employer_id === employerId)
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Check if employer has WARN Act risk flags */
export function getEmployerRisk(
  risks: EmployerRiskFeature[],
  employerId: string
): EmployerRiskFeature | undefined {
  return risks.find((r) => r.employer_id === employerId);
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface SrsOverviewStats {
  totalEmployers: number;
  ratedEmployers: number;
  excellentCount: number;
  goodCount: number;
  moderateCount: number;
  belowAverageCount: number;
  poorCount: number;
  unratedCount: number;
  avgScore: number;
  medianScore: number;
  warnFlaggedCount: number;
}

/** Compute aggregate statistics for the SRS overview */
export function computeSrsStats(
  scores: SponsorReliabilityScore[],
  risks: EmployerRiskFeature[]
): SrsOverviewStats {
  const overall = filterOverallScores(scores);
  const rated = filterRatedEmployers(overall);
  const ratedScores = rated
    .map((s) => s.srs!)
    .sort((a, b) => a - b);

  const tierCounts = { excellent: 0, good: 0, moderate: 0, belowAverage: 0, poor: 0, unrated: 0 };
  for (const s of overall) {
    switch (s.srs_tier?.toLowerCase()) {
      case "excellent":
        tierCounts.excellent++;
        break;
      case "good":
        tierCounts.good++;
        break;
      case "moderate":
        tierCounts.moderate++;
        break;
      case "below average":
        tierCounts.belowAverage++;
        break;
      case "poor":
        tierCounts.poor++;
        break;
      default:
        tierCounts.unrated++;
    }
  }

  const sum = ratedScores.reduce((a, b) => a + b, 0);
  const avg = ratedScores.length > 0 ? sum / ratedScores.length : 0;
  const mid = Math.floor(ratedScores.length / 2);
  const median =
    ratedScores.length > 0
      ? ratedScores.length % 2 === 0
        ? (ratedScores[mid - 1] + ratedScores[mid]) / 2
        : ratedScores[mid]
      : 0;

  return {
    totalEmployers: overall.length,
    ratedEmployers: rated.length,
    excellentCount: tierCounts.excellent,
    goodCount: tierCounts.good,
    moderateCount: tierCounts.moderate,
    belowAverageCount: tierCounts.belowAverage,
    poorCount: tierCounts.poor,
    unratedCount: tierCounts.unrated,
    avgScore: Math.round(avg * 10) / 10,
    medianScore: Math.round(median * 10) / 10,
    warnFlaggedCount: risks.filter((r) => r.is_warn_flagged).length,
  };
}
