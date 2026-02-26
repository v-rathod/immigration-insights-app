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
  employer_id: number;
  employer_name: string;
  city: string | null;
  state: string | null;
  naics_code: string | null;
  sector: string | null;
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

export interface EmployerFriendlinessScore {
  employer_id: number;
  employer_name: string;
  total_cases: number;
  certified_cases: number;
  denied_cases: number;
  approval_rate: number;
  bayesian_approval_rate: number;
  wage_ratio_med: number;
  wage_ratio_p75: number;
  median_processing_days: number;
  distinct_soc_codes: number;
  distinct_states: number;
  months_active: number;
  trend_slope: number;
  volatility: number;
  score_outcome: number;
  score_wage: number;
  score_sustainability: number;
  efs_score: number;
  efs_tier: string;
  efs_percentile: number;
  data_quality_flag: string;
}

export interface EmployerMonthlyMetric {
  employer_id: number;
  employer_name: string;
  fiscal_year: number;
  month: number;
  filings: number;
  approvals: number;
  denials: number;
  approval_rate: number;
  audit_rate: number;
  avg_wage_offered: number;
}

export interface EmployerRiskFeature {
  employer_id: number;
  employer_name: string;
  warn_events: number;
  total_layoffs: number;
  latest_warn_date: string;
  warn_state: string;
  risk_level: string;
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
  category: string;
  country: string;
  chart_type: string;
  forecast_month: number;  // 1..24
  forecast_date: string;
  predicted_cutoff: string;
  lower_bound: string;
  upper_bound: string;
  confidence: number;
  methodology: string;
}

// ---------------------------------------------------------------------------
// RAG Types
// ---------------------------------------------------------------------------

export interface RagChunk {
  id: string;
  topic: string;
  title: string;
  content: string;
  source_artifacts: string[];
  metadata: Record<string, unknown>;
}

export interface RagQaPair {
  question: string;
  answer: string;
  topic: string;
  source_artifacts: string[];
  confidence: number;
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
