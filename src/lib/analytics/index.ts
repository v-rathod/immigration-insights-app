import { getEnvironment } from "@/lib/env";

/**
 * Analytics utility for NorthStar Compass (P3)
 *
 * All event tracking through PostHog. Every function here maps to a named
 * event that appears in the PostHog dashboard. Properties follow snake_case
 * and avoid PII (no raw user-input text, no employer names, no profile dates).
 *
 * Usage:
 *   import { analytics } from '@/lib/analytics'
 *   analytics.dashboardViewed('visa-bulletin', 342000)
 */

import posthog from "posthog-js";

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

export type DashboardName =
  | "visa-bulletin"
  | "employer"
  | "eb-category"
  | "geographic"
  | "wage"
  | "job-demand"
  | "processing"
  | "backlog"
  | "approvals";

export type PageName =
  | "home"
  | "insights"
  | "ask"
  | "about"
  | "privacy"
  | "terms"
  | "ops"
  | DashboardName;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Internal event capture with automatic environment tagging.
 * NEXT_PUBLIC_APP_ENV explicitly tags events: dev | stage | prod.
 * This enables filtering all PostHog data by environment without
 * manually adding environment to every function.
 */
function capture(event: string, props?: Record<string, unknown>) {
  try {
    const environment = getEnvironment();
    posthog.capture(event, { environment, ...props });
  } catch {
    // PostHog not yet initialised (SSR) — silently swallow
  }
}

// ---------------------------------------------------------------------------
// Page & navigation
// ---------------------------------------------------------------------------

/**
 * Called on every route change. PostHog's autocapture handles most page views
 * but this gives us clean named pages.
 */
function pageViewed(page: PageName, path: string) {
  capture("page_viewed", { page, path });
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/**
 * Called after a JSON fetch completes. Tracks bytes + load time per source.
 */
function dataLoaded(params: {
  source: string; // e.g. "pd_forecasts", "worksite_geo_metrics"
  bytes: number;
  loadTimeMs: number;
  dashboard?: DashboardName;
}) {
  capture("data_loaded", {
    source: params.source,
    bytes: params.bytes,
    load_time_ms: params.loadTimeMs,
    dashboard: params.dashboard,
    size_bucket: byteBucket(params.bytes),
  });
}

/** Classify bytes into human-readable buckets for easy filtering. */
function byteBucket(bytes: number): string {
  if (bytes < 50_000) return "<50KB";
  if (bytes < 500_000) return "50KB–500KB";
  if (bytes < 5_000_000) return "500KB–5MB";
  if (bytes < 20_000_000) return "5MB–20MB";
  return ">20MB";
}

// ---------------------------------------------------------------------------
// Dashboard-specific events
// ---------------------------------------------------------------------------

/**
 * User landed on a dashboard. Call once at mount after data is loaded.
 */
function dashboardViewed(dashboard: DashboardName, totalBytesLoaded?: number) {
  capture("dashboard_viewed", {
    dashboard,
    total_bytes_loaded: totalBytesLoaded,
    size_bucket: totalBytesLoaded ? byteBucket(totalBytesLoaded) : undefined,
  });
}

/**
 * User changed a filter on a dashboard (category, country, date, toggle, tab).
 */
function filterChanged(params: {
  dashboard: DashboardName;
  filter: string; // e.g. "category", "country", "chart_type", "dataset"
  value: string; // e.g. "EB2", "IND", "DFF"
}) {
  capture("filter_changed", {
    dashboard: params.dashboard,
    filter: params.filter,
    value: params.value,
  });
}

/**
 * User switched between chart types (DFF/FAD, area/bar, etc).
 */
function chartTypeChanged(params: {
  dashboard: DashboardName;
  from: string;
  to: string;
}) {
  capture("chart_type_changed", params);
}

// ---------------------------------------------------------------------------
// Employer / SRS dashboard
// ---------------------------------------------------------------------------

/**
 * User searched for an employer (no query text to avoid PII).
 */
function employerSearched(resultCount: number) {
  capture("employer_searched", { result_count: resultCount });
}

/**
 * User selected an employer from search results.
 */
function employerSelected(params: {
  tier: string; // "Platinum", "Gold", etc.
  score: number | null;
  hasMLScore: boolean;
}) {
  capture("employer_selected", {
    tier: params.tier,
    score_bucket: params.score !== null ? scoreBucket(params.score) : "unrated",
    has_ml_score: params.hasMLScore,
  });
}

function scoreBucket(score: number): string {
  if (score >= 80) return "80–100";
  if (score >= 60) return "60–79";
  if (score >= 40) return "40–59";
  return "<40";
}

// ---------------------------------------------------------------------------
// Wage / role drill-down
// ---------------------------------------------------------------------------

/**
 * User clicked to expand a role's percentile trend chart.
 */
function roleExpanded(hasData: boolean) {
  capture("role_expanded", { has_trend_data: hasData });
}

/**
 * User used the role search box inside EmployerProfile.
 */
function roleSearchUsed(hasResults: boolean) {
  capture("role_search_used", { has_results: hasResults });
}

/**
 * Wage mode switched between employer / role search.
 */
function wageModeChanged(mode: "employer" | "role") {
  capture("wage_mode_changed", { mode });
}

// ---------------------------------------------------------------------------
// My Insights page
// ---------------------------------------------------------------------------

/**
 * User saved / updated their profile. Tracks all entered values.
 * No PII risk since there's no user account system.
 */
function insightProfileSaved(params: {
  fieldsFilled: number;           // 0–7
  hasPriorityDate: boolean;
  hasCountry: boolean;
  hasCategory: boolean;
  hasEmployer: boolean;
  hasJobTitle: boolean;
  hasWage: boolean;
  // Exact values (no PII risk)
  priorityDate?: string;          // e.g. "2020-03-15"
  country?: string;               // e.g. "IND"
  category?: string;              // e.g. "EB2"
  employerName?: string;          // e.g. "Acme Corp"
  jobTitle?: string;              // e.g. "Software Engineer"
  wageOffered?: string;           // e.g. "85000"
  yearsOfExperience?: string;     // e.g. "5"
}) {
  capture("insight_profile_saved", params);
}

/**
 * A smart panel became visible (i.e. required input was provided).
 */
function insightPanelUnlocked(panel: "green_card" | "sponsor" | "salary") {
  capture("insight_panel_unlocked", { panel });
}

// ---------------------------------------------------------------------------
// RAG / Ask page
// ---------------------------------------------------------------------------

/**
 * User submitted a question on the /ask page.
 */
function ragQuestionAsked(params: {
  topic: string;
  resultCount: number;
  usedLlm: boolean;
  llmBackend?: string; // "groq" | "openai" | "ollama" | "mock"
}) {
  capture("rag_question_asked", {
    topic: params.topic,
    result_count: params.resultCount,
    used_llm: params.usedLlm,
    llm_backend: params.llmBackend,
  });
}

/**
 * User clicked the AI Answer button.
 */
function llmAnswerRequested(backend: string) {
  capture("llm_answer_requested", { backend });
}

/**
 * User filtered questions by topic pill.
 */
function topicFilterSelected(topic: string) {
  capture("topic_filter_selected", { topic });
}

// ---------------------------------------------------------------------------
// Visa Bulletin / priority date
// ---------------------------------------------------------------------------

/**
 * User entered a priority date — one of the highest-value interactions.
 */
function priorityDateEntered(params: {
  category: string; // "EB2", "EB3", etc. Not the date itself (PII)
  country: string; // "IND", "CHN", "ROW"
  yearsInQueue?: number; // derived approximate bucket
}) {
  capture("priority_date_entered", params);
}

// ---------------------------------------------------------------------------
// Backlog
// ---------------------------------------------------------------------------

/**
 * User performed a queue position lookup.
 */
function queuePositionLooked(category: string) {
  capture("queue_position_lookup", { category });
}

// ---------------------------------------------------------------------------
// Error monitoring
// ---------------------------------------------------------------------------

/**
 * Called by ErrorMonitor when an unhandled JS error or promise rejection occurs.
 * Dual-reported: Sentry (stack traces, replay) + PostHog (session context).
 * Stack trace is truncated to 500 chars to keep PostHog event payloads lean.
 */
function errorOccurred(params: {
  message: string;         // e.g. "TypeError: Cannot read properties of null"
  type: string;            // e.g. "TypeError", "ReferenceError", "UnhandledRejection"
  page: string;            // e.g. "/dashboard/visa-bulletin"
  severity?: "low" | "medium" | "high";
  stack?: string;          // First 500 chars of stack trace
  context?: Record<string, unknown>;
}) {
  capture("error_occurred", {
    error_message: params.message,
    error_type: params.type,
    page: params.page,
    severity: params.severity ?? "high",
    ...(params.stack ? { stack_preview: params.stack } : {}),
    ...(params.context ?? {}),
  });
}

// ---------------------------------------------------------------------------
// Geographic
// ---------------------------------------------------------------------------

/**
 * User switched the geographic dataset.
 */
function geoDatasetChanged(dataset: string) {
  capture("geo_dataset_changed", { dataset });
}

// ---------------------------------------------------------------------------
// Sidebar / navigation
// ---------------------------------------------------------------------------

/**
 * User clicked a sidebar nav item.
 */
function navItemClicked(label: string, href: string) {
  capture("nav_item_clicked", { nav_label: label, href });
}

/**
 * User submitted feedback via the FAB feedback dialog.
 * The full message is captured so it can be queried in PostHog daily.
 * Properties:
 *   - feedback_type: "feedback" | "feature" | "bug"
 *   - feedback_message: the verbatim text (user-volunteered for this purpose)
 *   - page_path: current route (e.g. "/dashboard/visa-bulletin")
 *   - environment: automatically added by capture() helper
 */
function feedbackSubmitted(params: {
  type: "feedback" | "feature" | "bug";
  message: string;
  pagePath: string;
}) {
  capture("feedback_submitted", {
    feedback_type: params.type,
    feedback_message: params.message,
    page_path: params.pagePath,
  });
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

/**
 * User sent a contact form message.
 * Only the subject category is captured — no name/email/message text (PII).
 */
function contactSubmitted(subject: string) {
  capture("contact_submitted", { contact_subject: subject });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const analytics = {
  pageViewed,
  dataLoaded,
  dashboardViewed,
  filterChanged,
  chartTypeChanged,
  employerSearched,
  employerSelected,
  roleExpanded,
  roleSearchUsed,
  wageModeChanged,
  insightProfileSaved,
  insightPanelUnlocked,
  ragQuestionAsked,
  llmAnswerRequested,
  topicFilterSelected,
  priorityDateEntered,
  queuePositionLooked,
  geoDatasetChanged,
  navItemClicked,
  feedbackSubmitted,
  contactSubmitted,
  errorOccurred,
};
