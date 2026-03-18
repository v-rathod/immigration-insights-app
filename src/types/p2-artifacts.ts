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
  approval_rate_36m: number;
  denial_rate_36m: number;
  wage_ratio_med: number;
  wage_ratio_p75: number;
  outcome_subscore: number;
  wage_subscore: number;
  sustainability_subscore: number;
  srs: number | null;      // renamed from efs
  srs_tier: string;        // renamed from efs_tier
  months_active_24m: number;
  months_active_36m: number;
  soc_breadth_24m: number;
  site_breadth_24m: number;
  approval_rate_trend_12v12: number | null;
  outcome_volatility: number | null;
  lca_filings_36m: number | null;
  lca_approval_rate_36m: number | null;
  lca_median_wage: number | null;
  lca_wage_ratio: number | null;
  lca_to_perm_ratio: number | null;
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
  months_active_36m: number;
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
  filings_count: number;
  approvals_count: number;
  offered_median: number | null;
  distinct_employers: number;
  dataset: string;               // "PERM" | "LCA" | "PERM+LCA"
  grain: string;                 // "state" | "soc_area" | "city"
  area_code: string | null;
  soc_code: string | null;
  filings_count_soc_area: number | null;
  offered_median_soc_area: number | null;
  city: string | null;
  competitiveness_ratio: number | null; // offered_median ÷ OEWS median — WAGE metric, not approval rate
  approval_rate: number | null;         // approvals_count / filings_count, always ≤ 1.0
}

export interface SocDemandMetric {
  soc_code: string;
  soc_title?: string;           // Embedded by P2 — canonical occupation title
  soc_major_title?: string;     // Embedded by P2 — major group label
  window: string;               // "12m" | "24m" | "36m"
  dataset: string;              // "PERM" | "LCA"
  filings_count: number;
  approvals_count: number;
  approval_rate: number;
  offered_avg: number;
  offered_median: number;
  competitiveness_percentile: number;
  top_employers_json: string;   // JSON-encoded array of {employer_id, filings}
}

export interface CategoryMovementMetric {
  bulletin_year: number;
  bulletin_month: number;
  chart: string;             // "DFF" | "FAD"
  category: string;           // EB1, EB2, EB3, EB3-Other, EB4, EB5
  country: string;            // CHN, IND, ROW, MEX, PHL, VIETNAM, etc.
  avg_monthly_advancement_days: number | null;
  median_advancement_days: number | null;
  volatility_score: number | null;
  retrogression_events_12m: number;
  next_movement_prediction: string; // "Flat" | "Advancing" | "Unknown" | etc.
  blended_velocity: number | null;  // Blended velocity (50% full-hist + 25% capped r24 + 25% capped r12)
  net_velocity: number | null;      // Full-history net velocity (days/month)
}

export interface BacklogEstimate {
  bulletin_year: number;
  bulletin_month: number;
  chart: string;             // "DFF" | "FAD"
  category: string;
  country: string;
  inflow_estimate_12m: number | null;
  advancement_days_12m_avg: number | null;
  blended_velocity: number | null;  // Blended velocity (50% full-hist + 25% capped r24 + 25% capped r12)
  backlog_months_to_clear_est: number | null;
}

export interface QueueDepthEstimate {
  category: string;
  country: string;
  pd_month: string;            // ISO date: "2009-04-01"
  perm_filings_certified: number;
  eb_category_ratio: number;
  est_category_filings: number;
  est_applicants_with_dependents: number;
  current_cutoff_date: string;  // ISO date
  is_ahead_of_cutoff: boolean;
  annual_visa_allocation: number;
  velocity_days_per_month: number;
  cumulative_ahead: number;
  est_wait_years: number;
  est_months_to_current: number | null;
  confidence: string;            // "medium-low" | "medium" | "high"
  generated_at: string;
}

/** Processing times trends — I-485 quarterly data */
export interface ProcessingTimesTrend {
  fiscal_year: number;
  quarter: number;
  reporting_period: string;     // "FY2014 Q1"
  period_end_date: string;      // ISO date
  form_type: string;            // "I-485"
  category: string;             // "Employment-based"
  eb_received: number | null;
  eb_approved: number | null;
  eb_denied: number | null;
  eb_pending: number | null;
  total_received: number | null;
  total_approved: number | null;
  total_denied: number | null;
  total_pending: number | null;
  approval_rate: number | null;
  throughput: number | null;
  net_intake: number | null;
  backlog_months: number | null;
  pending_change: number | null;
  throughput_change: number | null;
}

/** USCIS approval/denial by form + category */
export interface FactUscisApproval {
  fiscal_year: string;         // "FY2014"
  form: string;                // "I140" | "I485" | "I765" | "I360"
  category: string;
  approvals: number;
  denials: number;
  source_file: string;
  ingested_at: string;
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

/** MCRA (Monte Carlo Retrograde-Adjusted) forecast — extends PdForecast with risk columns */
export interface PdForecastRetrograde extends PdForecast {
  retrograde_prob: number;         // P(retrogression) for this calendar month [0..1]
  expected_setback_days: number;   // E[|setback|] when retrogression occurs
  risk_adjusted_velocity: number;  // velocity after deducting expected retrograde loss
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
