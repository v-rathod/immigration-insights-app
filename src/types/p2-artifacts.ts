/**
 * TypeScript type definitions for P2 Meridian artifacts.
 *
 * These types mirror the Parquet schemas from immigration-model-builder.
 * Updated by scripts/sync_p2_data.py when schemas change.
 */

// ---------------------------------------------------------------------------
// Dimension Tables
// ---------------------------------------------------------------------------

export interface DimEmployer {
  employer_id: string;
  employer_name: string;
  aliases: string | null;
  domain: string | null;
  source_files: string | null;
  ingested_at: string;
}

export interface DimSoc {
  soc_code: string;
  soc_title: string;
  soc_major: string;
  soc_major_title: string;
  soc_group: string | null;
  soc_group_title: string | null;
  soc_broad: string | null;
  soc_broad_title: string | null;
  soc_version: string;
  is_legacy: boolean;
  mapped_2018_code: string | null;
  mapped_2018_title: string | null;
}

export interface DimCountry {
  country_code: string;
  country_name: string;
  region: string;
  sub_region: string;
  alpha3: string;
  numeric_code: number;
}

export interface DimArea {
  area_code: string;
  area_title: string;
  area_type: string;
  state_code: string | null;
  state_name: string | null;
  county_fips: string | null;
  cbsa_code: string | null;
  cbsa_title: string | null;
  csa_code: string | null;
  csa_title: string | null;
}

export interface DimVisaClass {
  visa_class: string;
  visa_class_name: string;
  category_group: string;
  preference_level: number;
  description: string;
  has_schedule_a: boolean;
  subject_to_cap: boolean;
  annual_cap: number | null;
  notes: string | null;
}

export interface DimVisaCeiling {
  fiscal_year: number;
  category: string;
  annual_limit: number;
  source: string;
  notes: string | null;
  is_estimated: boolean;
}

// ---------------------------------------------------------------------------
// Fact Tables (commonly used in P3)
// ---------------------------------------------------------------------------

export interface FactCutoffTrend {
  bulletin_year: number;
  bulletin_month: number;
  category: string;
  country: string;
  chart_type: string;
  cutoff_date: string;  // ISO date
  cutoff_numeric: number;
  monthly_advancement_days: number;
  velocity_3m: number;
  velocity_6m: number;
  velocity_12m: number;
  is_current: boolean;
  is_retrogression: boolean;
  retrogression_count: number;
}

export interface FactCutoffsAll {
  bulletin_date: string;
  bulletin_year: number;
  bulletin_month: number;
  category: string;
  country: string;
  chart_type: string;
  cutoff_date: string;
  is_current: boolean;
  days_advanced: number;
  source: string;
}

// ---------------------------------------------------------------------------
// Feature Tables
// ---------------------------------------------------------------------------

/** Sponsor Reliability Score — rules-based (70,206 employers) */
export interface SponsorReliabilityScore {
  employer_id: string;
  employer_name: string;
  scope: string;           // "overall" | "SOC"
  soc_code: string | null;
  n_12m: number;
  n_24m: number;
  n_36m: number;
  approval_rate_24m: number;
  denial_rate_24m: number;
  wage_ratio_med: number;
  wage_ratio_p75: number;
  outcome_subscore: number;
  wage_subscore: number;
  sustainability_subscore: number;
  srs: number | null;      // renamed from efs
  srs_tier: string;        // renamed from efs_tier
  months_active_24m: number;
  soc_breadth_24m: number;
  site_breadth_24m: number;
  approval_rate_trend_12v12: number | null;
  outcome_volatility: number | null;
  last_refreshed_at: string;
}

/** Sponsor Reliability Score — ML model (1,695 high-volume employers) */
export interface SponsorReliabilityScoreML {
  employer_id: string;
  n_cases_36m: number;
  avg_calibrated_prob: number;
  median_calibrated_prob: number;
  srs_ml: number;          // renamed from efs_ml
  scope: string;
  version: string;
  last_refreshed_at: string;
}

export interface EmployerMonthlyMetric {
  employer_id: string;
  employer_name: string;
  month: string;           // ISO date: "2021-11-01"
  filings: number;
  approvals: number;
  denials: number;
  approval_rate: number;
  denial_rate: number;
  audit_rate_t12: number;
  dataset: string;
}

export interface EmployerRiskFeature {
  employer_key: string;
  total_warn_events: number;
  total_employees_affected: number;
  states: string;
  employer_name_raw: string;
  employer_id: string | null;
  is_warn_flagged: boolean;
}

/** Raw employer features (approval/denial/audit rates, wage ratios) */
export interface EmployerFeatures {
  employer_id: string;
  employer_name: string;
  scope: string;
  soc_code: string | null;
  n_12m: number;
  n_24m: number;
  n_36m: number;
  months_active_24m: number;
  soc_breadth_24m: number;
  site_breadth_24m: number;
  approval_rate_12m: number | null;
  approval_rate_24m: number | null;
  approval_rate_36m: number | null;
  denial_rate_12m: number | null;
  denial_rate_24m: number | null;
  denial_rate_36m: number | null;
  audit_rate_12m: number | null;
  audit_rate_24m: number | null;
  audit_rate_36m: number | null;
  approval_rate_trend_12v12: number | null;
  outcome_volatility: number | null;
  wage_ratio_med: number | null;
  wage_ratio_p75: number | null;
  windows_used: string;
  last_refreshed_at: string;
}

export interface SalaryBenchmark {
  soc_code: string;
  area_code: string;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
}

export interface WorksiteGeoMetric {
  state: string;
  area_code: string;
  area_title: string;
  soc_code: string;
  filings_count: number;
  approvals_count: number;
  avg_wage_offer: number;
  competitiveness_ratio: number;
  distinct_employers: number;
  perm_filings: number;
  lca_filings: number;
  oews_median: number;
  oews_p75: number;
}

export interface SocDemandMetric {
  soc_code: string;
  soc_title: string;
  filings_12m: number;
  filings_24m: number;
  filings_36m: number;
  approval_rate: number;
  avg_offered_wage: number;
  competitiveness_percentile: number;
  trend_direction: string;
  top_employers: string;
}

export interface CategoryMovementMetric {
  bulletin_year: number;
  bulletin_month: number;
  category: string;
  country: string;
  chart_type: string;
  cutoff_date: string;
  monthly_advancement_days: number;
  velocity_3m: number;
  velocity_6m: number;
  is_retrogression: boolean;
}

export interface BacklogEstimate {
  bulletin_year: number;
  bulletin_month: number;
  category: string;
  country: string;
  chart_type: string;
  cutoff_date: string;
  estimated_backlog: number;
  years_to_clear: number;
}

export interface QueueDepthEstimate {
  category: string;
  country: string;
  chart_type: string;
  priority_date: string;
  estimated_position: number;
  estimated_ahead: number;
  estimated_wait_months: number;
  annual_limit: number;
  fiscal_year: number;
  confidence: string;
  methodology: string;
  perm_proxy_count: number;
  cutoff_date: string;
  days_behind_cutoff: number;
  velocity_days_per_month: number;
  data_vintage: string;
}

// ---------------------------------------------------------------------------
// Model Outputs
// ---------------------------------------------------------------------------

export interface PdForecast {
  forecast_month: string;          // "2026-04"
  months_ahead: number;            // 1–24
  chart: string;                   // "FAD" | "DFF"
  category: string;                // "EB1" | "EB2" | "EB3" | etc.
  country: string;                 // "IND" | "CHN" | "ROW" | etc.
  projected_cutoff_date: string;   // ISO date: "2014-11-19"
  confidence_low: string;          // ISO date
  confidence_high: string;         // ISO date
  velocity_days_per_month: number; // advancement speed
  cumulative_advancement_days: number;
}

// ---------------------------------------------------------------------------
// RAG Types
// ---------------------------------------------------------------------------

export interface RagChunk {
  chunk_id: string;
  source_artifact: string;
  topic: string;
  label: string;
  text: string;
  metadata: Record<string, unknown>;
  generated_at: string;
}

export interface RagQaPair {
  question: string;
  answer: string;
  sources: string[];
  topic: string;
  confidence: string;
  generated_at: string;
}

export interface RagCatalogEntry {
  name: string;
  rows: number;
  columns: number;
  description: string;
  topic: string;
  has_chunks: boolean;
}

// ---------------------------------------------------------------------------
// User Profile (persisted in localStorage)
// ---------------------------------------------------------------------------

export interface UserProfile {
  priorityDate: string;
  countryOfChargeability: string;
  category: string;
  employerName: string;
  jobTitle: string;
  location: string;
  wageOffered: number;
  yearsOfExperience: number;
}

export type RagTopic =
  | "pd_forecast"
  | "employer"
  | "salary"
  | "visa_bulletin"
  | "geographic"
  | "occupation"
  | "processing"
  | "visa_demand"
  | "filings"
  | "general";
