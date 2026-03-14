/**
 * Tests for the 5 new dashboard data loaders:
 *   - eb-category.ts
 *   - geographic.ts
 *   - soc-demand.ts
 *   - processing.ts
 *   - backlog.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  CategoryMovementMetric,
  BacklogEstimate,
  QueueDepthEstimate,
  WorksiteGeoMetric,
  SocDemandMetric,
  ProcessingTimesTrend,
  FactUscisApproval,
  DimSoc,
} from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/** Helper to mock successful fetch with JSON body */
function mockFetchSuccess(body: unknown = []) {
  const jsonStr = JSON.stringify(body);
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(jsonStr),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// EB Category
// ---------------------------------------------------------------------------
import {
  loadCategoryMovement,
  filterMovementSeries,
  getLatestMovement,
  buildCategorySummary,
  getAvailableCountries,
  EB_CATEGORIES,
  COUNTRY_LABELS,
} from "@/lib/data/eb-category";

const makeMovement = (
  overrides: Partial<CategoryMovementMetric> = {}
): CategoryMovementMetric => ({
  bulletin_year: 2025,
  bulletin_month: 1,
  chart: "DFF",
  category: "EB2",
  country: "IND",
  avg_monthly_advancement_days: 10,
  median_advancement_days: 8,
  volatility_score: 0.3,
  retrogression_events_12m: 0,
  next_movement_prediction: "Advance Slowly",
  blended_velocity: 12,
  net_velocity: 9,
  ...overrides,
});

describe("eb-category data", () => {
  it("loadCategoryMovement calls correct path", async () => {
    mockFetchSuccess();
    await loadCategoryMovement();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/data/dashboards/eb-category/category_movement_metrics.json");
  });

  it("filterMovementSeries filters and sorts", () => {
    const data = [
      makeMovement({ bulletin_month: 3 }),
      makeMovement({ bulletin_month: 1 }),
      makeMovement({ category: "EB3" }),
      makeMovement({ country: "CHN" }),
      makeMovement({ chart: "FAD" }),
      makeMovement({ bulletin_month: 2 }),
    ];
    const result = filterMovementSeries(data, "EB2", "IND", "DFF");
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.bulletin_month)).toEqual([1, 2, 3]);
  });

  it("getLatestMovement picks last non-null entry", () => {
    const data = [
      makeMovement({ bulletin_month: 1 }),
      makeMovement({ bulletin_month: 2, avg_monthly_advancement_days: null, blended_velocity: null }),
    ];
    const latest = getLatestMovement(data, "EB2", "IND", "DFF");
    expect(latest?.bulletin_month).toBe(1);
  });

  it("getLatestMovement returns null for empty", () => {
    expect(getLatestMovement([], "EB2", "IND")).toBeNull();
  });

  it("buildCategorySummary returns 3 categories", () => {
    const data = [
      makeMovement({ category: "EB1", avg_monthly_advancement_days: 20 }),
      makeMovement({ category: "EB2", avg_monthly_advancement_days: 10 }),
      makeMovement({ category: "EB3", avg_monthly_advancement_days: 5 }),
    ];
    const summary = buildCategorySummary(data, "IND", "DFF");
    expect(summary).toHaveLength(3);
    expect(summary[0].category).toBe("EB1");
    expect(summary[0].avgAdvancement).toBe(20);
    expect(summary[1].avgAdvancement).toBe(10);
    expect(summary[2].avgAdvancement).toBe(5);
  });

  it("buildCategorySummary handles missing data with nulls", () => {
    const summary = buildCategorySummary([], "IND");
    expect(summary).toHaveLength(3);
    for (const s of summary) {
      expect(s.avgAdvancement).toBeNull();
      expect(s.volatility).toBeNull();
    }
  });

  it("getAvailableCountries returns unique sorted list with priority order", () => {
    const data = [
      makeMovement({ country: "CHN" }),
      makeMovement({ country: "IND" }),
      makeMovement({ country: "ROW" }),
      makeMovement({ country: "PHL" }),
    ];
    const countries = getAvailableCountries(data);
    // IND, CHN, ROW should come first
    expect(countries.indexOf("IND")).toBeLessThan(countries.indexOf("PHL"));
    expect(countries.indexOf("CHN")).toBeLessThan(countries.indexOf("PHL"));
  });

  it("EB_CATEGORIES has 3 entries", () => {
    expect(EB_CATEGORIES).toEqual(["EB1", "EB2", "EB3"]);
  });

  it("COUNTRY_LABELS has IND, CHN, ROW", () => {
    expect(COUNTRY_LABELS["IND"]).toBe("India");
    expect(COUNTRY_LABELS["CHN"]).toBe("China");
    expect(COUNTRY_LABELS["ROW"]).toBe("Rest of World");
  });
});

// ---------------------------------------------------------------------------
// Geographic
// ---------------------------------------------------------------------------
import {
  loadGeoMetrics,
  getStateAggregates,
  getTopStates,
  getNationalSummary,
  getAvailableDatasets,
  STATE_NAMES,
} from "@/lib/data/geographic";

const makeGeo = (
  overrides: Partial<WorksiteGeoMetric> = {}
): WorksiteGeoMetric => ({
  state: "CA",
  filings_count: 100,
  approvals_count: 90,
  offered_median: 120000,
  distinct_employers: 50,
  dataset: "PERM",
  grain: "state",
  area_code: "41860",
  soc_code: "15-1252",
  filings_count_soc_area: 10,
  offered_median_soc_area: 130000,
  city: "San Jose",
  competitiveness_ratio: 0.85,
  approval_rate: 0.9,
  ...overrides,
});

describe("geographic data", () => {
  it("loadGeoMetrics calls correct path", async () => {
    mockFetchSuccess();
    await loadGeoMetrics();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/data/dashboards/geographic/worksite_geo_metrics.json");
  });

  it("getStateAggregates filters grain=state and dataset", () => {
    const data = [
      makeGeo({ state: "CA", filings_count: 200 }),
      makeGeo({ state: "TX", filings_count: 150 }),
      makeGeo({ grain: "city" }), // should be excluded
      makeGeo({ dataset: "LCA", state: "NY", filings_count: 100 }),
    ];
    const states = getStateAggregates(data, "PERM");
    expect(states).toHaveLength(2);
    expect(states[0].state).toBe("CA"); // sorted by filings desc
    expect(states[1].state).toBe("TX");
  });

  it("getTopStates returns top N", () => {
    const data = Array.from({ length: 20 }, (_, i) =>
      makeGeo({ state: `S${i}`, filings_count: 100 - i })
    );
    const top = getTopStates(data, "PERM", 5);
    expect(top).toHaveLength(5);
    expect(top[0].filings).toBe(100);
  });

  it("getNationalSummary computes totals", () => {
    const data = [
      makeGeo({ state: "CA", filings_count: 200, approvals_count: 180, distinct_employers: 50, competitiveness_ratio: 0.9 }),
      makeGeo({ state: "TX", filings_count: 100, approvals_count: 90, distinct_employers: 30, competitiveness_ratio: 0.8 }),
    ];
    const summary = getNationalSummary(data, "PERM");
    expect(summary.totalFilings).toBe(300);
    expect(summary.totalApprovals).toBe(270);
    expect(summary.totalEmployers).toBe(80);
    expect(summary.stateCount).toBe(2);
    expect(summary.avgCompetitiveness).toBeCloseTo(0.85, 2);
  });

  it("getAvailableDatasets returns unique sorted datasets", () => {
    const data = [
      makeGeo({ dataset: "PERM" }),
      makeGeo({ dataset: "LCA" }),
      makeGeo({ dataset: "LCA" }),
    ];
    const datasets = getAvailableDatasets(data);
    expect(datasets).toEqual(["LCA", "PERM"]);
  });

  it("STATE_NAMES maps all 50 states + non-state jurisdictions", () => {
    expect(STATE_NAMES["CA"]).toBe("California");
    expect(STATE_NAMES["NY"]).toBe("New York");
    expect(STATE_NAMES["DC"]).toContain("Washington"); // Federal District
    expect(STATE_NAMES["PR"]).toContain("Puerto Rico"); // Territory
    expect(STATE_NAMES["GU"]).toContain("Territory");
    expect(Object.keys(STATE_NAMES).length).toBeGreaterThanOrEqual(51);
  });
});

// ---------------------------------------------------------------------------
// SOC Demand
// ---------------------------------------------------------------------------
import {
  loadSocDemand,
  loadDimSoc,
  enrichWithTitles,
  filterDemand,
  getTopOccupations,
  getMajorGroupSummary,
  getAvailableWindows,
  getAvailableDatasetsForDemand,
} from "@/lib/data/soc-demand";

const makeSocDemand = (
  overrides: Partial<SocDemandMetric> = {}
): SocDemandMetric => ({
  soc_code: "15-1252",
  window: "12m",
  dataset: "PERM",
  filings_count: 500,
  approvals_count: 450,
  approval_rate: 0.9,
  offered_avg: 130000,
  offered_median: 125000,
  competitiveness_percentile: 0.85,
  top_employers_json: '[]',
  ...overrides,
});

const makeDimSoc = (overrides: Partial<DimSoc> = {}): DimSoc => ({
  soc_code: "15-1252",
  soc_title: "Software Developers",
  soc_major: "15",
  soc_major_title: "Computer and Mathematical",
  soc_group: null,
  soc_group_title: null,
  soc_broad: null,
  soc_broad_title: null,
  soc_version: "2018",
  is_legacy: false,
  mapped_2018_code: null,
  mapped_2018_title: null,
  ...overrides,
});

describe("soc-demand data", () => {
  it("loadSocDemand calls correct path", async () => {
    mockFetchSuccess();
    await loadSocDemand();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/data/dashboards/soc-demand/soc_demand_metrics.json");
  });

  it("loadDimSoc calls dims path", async () => {
    mockFetchSuccess();
    await loadDimSoc();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/data/dims/dim_soc.json");
  });

  it("enrichWithTitles maps SOC codes to titles", () => {
    const demand = [makeSocDemand({ soc_code: "15-1252" })];
    const socDim = [makeDimSoc({ soc_code: "15-1252", soc_title: "Software Developers" })];
    const enriched = enrichWithTitles(demand, socDim);
    expect(enriched[0].soc_title).toBe("Software Developers");
    expect(enriched[0].soc_major).toBe("Computer and Mathematical");
  });

  it("enrichWithTitles prefers embedded soc_title over dim_soc", () => {
    const demand = [makeSocDemand({ soc_code: "15-1132", soc_title: "Software Developers, Applications" })];
    // dim_soc has NaN title for this legacy code — should not be used
    const socDim = [makeDimSoc({ soc_code: "15-1132", soc_title: "" })];
    const enriched = enrichWithTitles(demand, socDim);
    expect(enriched[0].soc_title).toBe("Software Developers, Applications");
  });

  it("enrichWithTitles falls back to soc_code if not found", () => {
    const demand = [makeSocDemand({ soc_code: "99-9999" })];
    const enriched = enrichWithTitles(demand, []);
    expect(enriched[0].soc_title).toBe("99-9999");
    expect(enriched[0].soc_major).toBe("");
  });

  it("enrichWithTitles parses top_employers_json", () => {
    const demand = [
      makeSocDemand({
        top_employers_json: JSON.stringify([{ employer_id: "E1", filings: 50 }]),
      }),
    ];
    const enriched = enrichWithTitles(demand, []);
    expect(enriched[0].top_employers).toHaveLength(1);
    expect(enriched[0].top_employers[0].employer_id).toBe("E1");
  });

  it("filterDemand filters by window and dataset and sorts", () => {
    const demand = [
      makeSocDemand({ soc_code: "A", filings_count: 100, window: "12m", dataset: "PERM" }),
      makeSocDemand({ soc_code: "B", filings_count: 200, window: "12m", dataset: "PERM" }),
      makeSocDemand({ soc_code: "C", filings_count: 300, window: "24m", dataset: "PERM" }),
    ];
    const enriched = enrichWithTitles(demand, []);
    const filtered = filterDemand(enriched, "12m", "PERM");
    expect(filtered).toHaveLength(2);
    expect(filtered[0].soc_code).toBe("B"); // sorted by filings desc
  });

  it("getTopOccupations returns top N", () => {
    const demand = Array.from({ length: 30 }, (_, i) =>
      makeSocDemand({ soc_code: `${10 + i}-0000`, filings_count: 1000 - i * 10 })
    );
    const enriched = enrichWithTitles(demand, []);
    const top = getTopOccupations(enriched, "12m", "PERM", 5);
    expect(top).toHaveLength(5);
    expect(top[0].filings_count).toBe(1000);
  });

  it("getAvailableWindows returns unique windows", () => {
    const data = [
      makeSocDemand({ window: "12m" }),
      makeSocDemand({ window: "24m" }),
      makeSocDemand({ window: "12m" }),
    ];
    expect(getAvailableWindows(data)).toEqual(["12m", "24m"]);
  });

  it("getAvailableDatasetsForDemand returns unique datasets", () => {
    const data = [
      makeSocDemand({ dataset: "PERM" }),
      makeSocDemand({ dataset: "LCA" }),
    ];
    expect(getAvailableDatasetsForDemand(data)).toEqual(["LCA", "PERM"]);
  });

  it("getMajorGroupSummary aggregates by 2-digit SOC", () => {
    const demand = [
      makeSocDemand({
        soc_code: "15-1252",
        filings_count: 100,
        approvals_count: 90,
        approval_rate: 0.9,
        offered_median: 130000,
      }),
      makeSocDemand({
        soc_code: "15-2099",
        filings_count: 50,
        approvals_count: 45,
        approval_rate: 0.9,
        offered_median: 120000,
      }),
      makeSocDemand({
        soc_code: "11-1021",
        filings_count: 30,
        approvals_count: 25,
        approval_rate: 0.83,
        offered_median: 140000,
      }),
    ];
    const enriched = enrichWithTitles(demand, [
      makeDimSoc({ soc_code: "15-1252", soc_major_title: "Computer" }),
      makeDimSoc({ soc_code: "15-2099", soc_major_title: "Computer" }),
      makeDimSoc({ soc_code: "11-1021", soc_major_title: "Management" }),
    ]);
    const groups = getMajorGroupSummary(enriched, "12m", "PERM");
    expect(groups).toHaveLength(2);
    expect(groups[0].majorCode).toBe("15"); // higher total filings
    expect(groups[0].occupationCount).toBe(2);
    expect(groups[0].totalFilings).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------
import {
  loadProcessingTrends,
  loadUscisApprovals,
  sortProcessingTrends,
  getLatestProcessing,
  computeProcessingKpis,
  aggregateByForm,
} from "@/lib/data/processing";

const makeProcTrend = (
  overrides: Partial<ProcessingTimesTrend> = {}
): ProcessingTimesTrend => ({
  fiscal_year: 2024,
  quarter: 1,
  reporting_period: "FY2024 Q1",
  form_type: "I-485",
  period_end_date: "2024-03-31",
  category: "Employment-based",
  eb_received: null,
  eb_approved: 50000,
  eb_denied: 5000,
  eb_pending: 500000,
  total_received: null,
  total_approved: null,
  total_denied: null,
  total_pending: null,
  approval_rate: 0.91,
  throughput: 55000,
  net_intake: null,
  backlog_months: 10,
  pending_change: -0.05,
  throughput_change: 0.1,
  ...overrides,
});

const makeUscisApproval = (
  overrides: Partial<FactUscisApproval> = {}
): FactUscisApproval => ({
  fiscal_year: "FY2024",
  form: "I-485",
  category: "EB",
  approvals: 50000,
  denials: 5000,
  source_file: "uscis_q1.csv",
  ingested_at: "2024-01-01",
  ...overrides,
});

describe("processing data", () => {
  it("loadProcessingTrends calls correct path", async () => {
    mockFetchSuccess();
    await loadProcessingTrends();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/data/dashboards/processing/processing_times_trends.json");
  });

  it("loadUscisApprovals calls correct path", async () => {
    mockFetchSuccess();
    await loadUscisApprovals();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/data/dashboards/processing/fact_uscis_approvals.json");
  });

  it("sortProcessingTrends by year then quarter", () => {
    const data = [
      makeProcTrend({ fiscal_year: 2025, quarter: 1 }),
      makeProcTrend({ fiscal_year: 2024, quarter: 3 }),
      makeProcTrend({ fiscal_year: 2024, quarter: 1 }),
    ];
    const sorted = sortProcessingTrends(data);
    expect(sorted[0].fiscal_year).toBe(2024);
    expect(sorted[0].quarter).toBe(1);
    expect(sorted[1].quarter).toBe(3);
    expect(sorted[2].fiscal_year).toBe(2025);
  });

  it("getLatestProcessing returns last sorted entry", () => {
    const data = [
      makeProcTrend({ fiscal_year: 2023, quarter: 4 }),
      makeProcTrend({ fiscal_year: 2024, quarter: 2 }),
    ];
    const latest = getLatestProcessing(data);
    expect(latest?.fiscal_year).toBe(2024);
    expect(latest?.quarter).toBe(2);
  });

  it("getLatestProcessing returns null for empty", () => {
    expect(getLatestProcessing([])).toBeNull();
  });

  it("computeProcessingKpis extracts correct values", () => {
    const data = [
      makeProcTrend({ approval_rate: 0.88, eb_pending: 400000, backlog_months: 8, throughput: 50000 }),
      makeProcTrend({ fiscal_year: 2024, quarter: 2, approval_rate: 0.92, eb_pending: 500000, backlog_months: 10, throughput: 60000 }),
    ];
    const kpis = computeProcessingKpis(data);
    expect(kpis.latestApprovalRate).toBe(0.92);
    expect(kpis.latestPending).toBe(500000);
    expect(kpis.latestBacklogMonths).toBe(10);
    expect(kpis.avgThroughput).toBe(55000); // (50K+60K)/2
    expect(kpis.totalQuarters).toBe(2);
  });

  it("computeProcessingKpis handles empty data", () => {
    const kpis = computeProcessingKpis([]);
    expect(kpis.latestApprovalRate).toBeNull();
    expect(kpis.avgThroughput).toBeNull();
    expect(kpis.totalQuarters).toBe(0);
  });

  it("aggregateByForm groups and sorts by approvals", () => {
    const data = [
      makeUscisApproval({ form: "I-485", approvals: 50000, denials: 5000, fiscal_year: "FY2023" }),
      makeUscisApproval({ form: "I-485", approvals: 60000, denials: 4000, fiscal_year: "FY2024" }),
      makeUscisApproval({ form: "I-140", approvals: 30000, denials: 2000, fiscal_year: "FY2024" }),
    ];
    const agg = aggregateByForm(data);
    expect(agg).toHaveLength(2);
    expect(agg[0].form).toBe("I-485"); // higher total
    expect(agg[0].totalApprovals).toBe(110000);
    expect(agg[0].totalDenials).toBe(9000);
    expect(agg[0].fyCount).toBe(2);
    expect(agg[0].fyMin).toBe("FY2023");
    expect(agg[0].fyMax).toBe("FY2024");
    expect(agg[0].approvalRate).toBeCloseTo(110000 / 119000, 3);
    expect(agg[1].form).toBe("I-140");
    expect(agg[1].fyMin).toBe("FY2024");
    expect(agg[1].fyMax).toBe("FY2024");
  });
});

// ---------------------------------------------------------------------------
// Backlog
// ---------------------------------------------------------------------------
import {
  loadBacklogEstimates,
  loadQueueDepth,
  filterBacklog,
  getLatestBacklog,
  buildBacklogSummary,
  filterQueueDepth,
  getQueuePosition,
  getQueueDimensions,
  BACKLOG_CATEGORIES,
  BACKLOG_COUNTRIES,
} from "@/lib/data/backlog";

const makeBacklog = (
  overrides: Partial<BacklogEstimate> = {}
): BacklogEstimate => ({
  bulletin_year: 2025,
  bulletin_month: 1,
  chart: "DFF",
  category: "EB2",
  country: "IND",
  inflow_estimate_12m: 5000,
  advancement_days_12m_avg: 15,
  blended_velocity: 12,
  backlog_months_to_clear_est: 120,
  ...overrides,
});

const makeQueueDepth = (
  overrides: Partial<QueueDepthEstimate> = {}
): QueueDepthEstimate => ({
  category: "EB2",
  country: "IND",
  pd_month: "2020-03",
  perm_filings_certified: 1000,
  eb_category_ratio: 0.4,
  est_category_filings: 400,
  est_applicants_with_dependents: 600,
  current_cutoff_date: "2015-01-01",
  is_ahead_of_cutoff: false,
  annual_visa_allocation: 2800,
  velocity_days_per_month: 15,
  cumulative_ahead: 50000,
  est_wait_years: 10,
  est_months_to_current: 120,
  confidence: "medium",
  generated_at: "2025-01-01",
  ...overrides,
});

describe("backlog data", () => {
  it("loadBacklogEstimates calls correct path", async () => {
    mockFetchSuccess();
    await loadBacklogEstimates();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/data/dashboards/backlog/backlog_estimates.json");
  });

  it("loadQueueDepth calls correct path", async () => {
    mockFetchSuccess();
    await loadQueueDepth();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/data/dashboards/backlog/queue_depth_estimates.json");
  });

  it("filterBacklog filters correctly and sorts", () => {
    const data = [
      makeBacklog({ bulletin_month: 3 }),
      makeBacklog({ bulletin_month: 1 }),
      makeBacklog({ category: "EB3" }),
      makeBacklog({ country: "CHN" }),
      makeBacklog({ chart: "FAD" }),
      makeBacklog({ bulletin_month: 2 }),
    ];
    const result = filterBacklog(data, "EB2", "IND", "DFF");
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.bulletin_month)).toEqual([1, 2, 3]);
  });

  it("getLatestBacklog picks last non-null entry", () => {
    const data = [
      makeBacklog({ bulletin_month: 1, backlog_months_to_clear_est: 120 }),
      makeBacklog({ bulletin_month: 2, backlog_months_to_clear_est: null }),
    ];
    const latest = getLatestBacklog(data, "EB2", "IND");
    expect(latest?.bulletin_month).toBe(1);
  });

  it("getLatestBacklog returns null for empty", () => {
    expect(getLatestBacklog([], "EB2", "IND")).toBeNull();
  });

  it("buildBacklogSummary returns 3 categories with correct data", () => {
    const data = [
      makeBacklog({ category: "EB1", backlog_months_to_clear_est: 24 }),
      makeBacklog({ category: "EB2", backlog_months_to_clear_est: 120 }),
      makeBacklog({ category: "EB3", backlog_months_to_clear_est: 180 }),
    ];
    const summary = buildBacklogSummary(data, "IND");
    expect(summary).toHaveLength(3);
    expect(summary[0].category).toBe("EB1");
    expect(summary[0].backlogMonths).toBe(24);
    expect(summary[0].backlogYears).toBe(2);
    expect(summary[1].backlogYears).toBe(10);
    expect(summary[2].backlogYears).toBe(15);
  });

  it("buildBacklogSummary handles empty data", () => {
    const summary = buildBacklogSummary([], "IND");
    expect(summary).toHaveLength(3);
    for (const s of summary) {
      expect(s.backlogMonths).toBeNull();
      expect(s.backlogYears).toBeNull();
    }
  });

  it("filterQueueDepth filters and sorts by pd_month", () => {
    const data = [
      makeQueueDepth({ pd_month: "2020-06" }),
      makeQueueDepth({ pd_month: "2020-01" }),
      makeQueueDepth({ category: "EB3" }),
      makeQueueDepth({ country: "CHN" }),
      makeQueueDepth({ pd_month: "2020-03" }),
    ];
    const result = filterQueueDepth(data, "EB2", "IND");
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.pd_month)).toEqual(["2020-01", "2020-03", "2020-06"]);
  });

  it("getQueuePosition finds closest pd_month ≤ priorityDate", () => {
    const data = [
      makeQueueDepth({ pd_month: "2018-01", cumulative_ahead: 100000 }),
      makeQueueDepth({ pd_month: "2019-01", cumulative_ahead: 80000 }),
      makeQueueDepth({ pd_month: "2020-01", cumulative_ahead: 60000 }),
    ];
    const result = getQueuePosition(data, "EB2", "IND", "2019-06");
    expect(result?.pd_month).toBe("2019-01");
    expect(result?.cumulative_ahead).toBe(80000);
  });

  it("getQueuePosition returns null when no match", () => {
    const data = [
      makeQueueDepth({ pd_month: "2020-01" }),
    ];
    const result = getQueuePosition(data, "EB2", "IND", "2019-01");
    expect(result).toBeNull();
  });

  it("getQueueDimensions returns unique categories and countries", () => {
    const data = [
      makeQueueDepth({ category: "EB1", country: "IND" }),
      makeQueueDepth({ category: "EB2", country: "IND" }),
      makeQueueDepth({ category: "EB2", country: "CHN" }),
    ];
    const dims = getQueueDimensions(data);
    expect(dims.categories).toEqual(["EB1", "EB2"]);
    expect(dims.countries).toEqual(["CHN", "IND"]);
  });

  it("BACKLOG_CATEGORIES has 3 entries", () => {
    expect(BACKLOG_CATEGORIES).toEqual(["EB1", "EB2", "EB3"]);
  });

  it("BACKLOG_COUNTRIES has 3 entries", () => {
    expect(BACKLOG_COUNTRIES).toEqual(["IND", "CHN", "ROW"]);
  });
});

// ---------------------------------------------------------------------------
// EB Category — Live-data regression (loads real JSON, no mocks)
//
// DEFECT GUARD: EB3 India appeared faster than EB2 India in the summary cards
// because the blended_velocity metric is biased by the 2015-2020 EB3 historical
// catch-up period. The fix: show avg_monthly_advancement_days (12-month rolling
// avg) as "Recent (12m avg)". This test guards that the RECENT metric correctly
// shows EB2 India DFF faster than EB3 India DFF.
// ---------------------------------------------------------------------------
import { readFileSync } from "fs";
import { join } from "path";
import type { CategoryMovementMetric as CMMetric } from "@/types/p2-artifacts";

describe("EB Category live-data regression", () => {
  const rawPath = join(
    process.cwd(),
    "public",
    "data",
    "dashboards",
    "eb-category",
    "category_movement_metrics.json"
  );
  const allData: CMMetric[] = JSON.parse(readFileSync(rawPath, "utf-8"));

  /** Get latest row for a given category/country/chart */
  function latestFor(cat: string, country: string, chart: string): CMMetric | undefined {
    return allData
      .filter((r) => r.category === cat && r.country === country && r.chart === chart)
      .sort((a, b) => a.bulletin_year * 100 + a.bulletin_month - (b.bulletin_year * 100 + b.bulletin_month))
      .at(-1);
  }

  it("loads non-empty data (sanity)", () => {
    expect(allData.length).toBeGreaterThan(1000);
  });

  it("data spans at least 8 years", () => {
    const years = new Set(allData.map((r) => r.bulletin_year));
    expect(years.size).toBeGreaterThanOrEqual(8);
  });

  it("all 3 EB categories present for India DFF", () => {
    for (const cat of ["EB1", "EB2", "EB3"]) {
      const found = allData.some(
        (r) => r.category === cat && r.country === "IND" && r.chart === "DFF"
      );
      expect(found, `${cat} IND DFF missing`).toBe(true);
    }
  });

  // ── DEFECT GUARD ──────────────────────────────────────────────────────────
  // India DFF: recent 12m avg should show EB2 >= EB3
  // (historically EB3 appeared faster due to catch-up; recent signals the opposite)
  it("India DFF: EB2 recent velocity (12m avg) >= EB3 recent velocity", () => {
    const eb2 = latestFor("EB2", "IND", "DFF");
    const eb3 = latestFor("EB3", "IND", "DFF");
    expect(eb2, "EB2 IND DFF not found").toBeDefined();
    expect(eb3, "EB3 IND DFF not found").toBeDefined();
    const eb2Avg = eb2!.avg_monthly_advancement_days ?? 0;
    const eb3Avg = eb3!.avg_monthly_advancement_days ?? 0;
    expect(eb2Avg).toBeGreaterThanOrEqual(eb3Avg);
  });

  it("India FAD: EB2 recent velocity (12m avg) >= EB3 recent velocity", () => {
    const eb2 = latestFor("EB2", "IND", "FAD");
    const eb3 = latestFor("EB3", "IND", "FAD");
    expect(eb2, "EB2 IND FAD not found").toBeDefined();
    expect(eb3, "EB3 IND FAD not found").toBeDefined();
    const eb2Avg = eb2!.avg_monthly_advancement_days ?? 0;
    const eb3Avg = eb3!.avg_monthly_advancement_days ?? 0;
    expect(eb2Avg).toBeGreaterThanOrEqual(eb3Avg);
  });

  // ── blended_velocity is always non-negative (code clamps to max(b, 0)) ────
  it("blended_velocity is non-negative for all IND rows (clamp enforced)", () => {
    const indRows = allData.filter((r) => r.country === "IND");
    for (const r of indRows) {
      if (r.blended_velocity != null) {
        expect(r.blended_velocity).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // avg_monthly_advancement_days CAN be negative (retrogression months move
  // the cutoff backward). Just verify it's always a finite number when present.
  it("avg_monthly_advancement_days is a finite number when present (retrogressions allowed to be negative)", () => {
    for (const r of allData) {
      if (r.avg_monthly_advancement_days != null) {
        expect(Number.isFinite(r.avg_monthly_advancement_days)).toBe(true);
      }
    }
  });
});
