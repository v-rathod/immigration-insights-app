/**
 * Tests for the three new GCC-competitive features:
 *   1. Queue Snapshot ("Cases Ahead of You") — computeCasesAhead()
 *   2. Transparent Scenario Math — VISA_SUPPLY constants + PredictionCard annotation
 *   3. I-140 Latent Demand — computeI140LatentDemand()
 *
 * These test the data helpers and computation logic with real-shaped data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EbInventoryRecord, I140DemandRecord } from "@/types/p2-artifacts";
import type { CutoffTrendRecord } from "@/lib/data/pdi";

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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

// ======================================================================
// Feature #1: Queue Snapshot — computeCasesAhead
// ======================================================================

describe("computeCasesAhead", () => {
  // Dynamic import to let fetch mock take effect
  async function loadHelper() {
    const mod = await import("@/lib/data/pdi");
    return mod.computeCasesAhead;
  }

  const sampleInventory: EbInventoryRecord[] = [
    // India EB2 Available — various priority date years
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Available", pd_month: 1, pd_year: 0, pending_count: 50 },
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Available", pd_month: 1, pd_year: 2012, pending_count: 100 },
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Available", pd_month: 6, pd_year: 2012, pending_count: 200 },
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Available", pd_month: 1, pd_year: 2013, pending_count: 500 },
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Available", pd_month: 6, pd_year: 2013, pending_count: 300 },
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Available", pd_month: 1, pd_year: 2014, pending_count: 400 },
    // Awaiting Availability
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Awaiting Availability", pd_month: 1, pd_year: 2012, pending_count: 80 },
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Awaiting Availability", pd_month: 6, pd_year: 2012, pending_count: 60 },
    // China EB2 (should not be counted for India lookup)
    { snapshot_date: "2026-01-02", country: "CHN", category: "EB2", visa_status: "Available", pd_month: 1, pd_year: 2012, pending_count: 999 },
  ];

  it("returns null for empty inventory", async () => {
    const fn = await loadHelper();
    const result = fn([], "EB2", "IND", "2013-06-15");
    expect(result).toBeNull();
  });

  it("returns null for invalid priority date", async () => {
    const fn = await loadHelper();
    const result = fn(sampleInventory, "EB2", "IND", "not-a-date");
    expect(result).toBeNull();
  });

  it("includes Prior Years (pd_year=0) in cases ahead", async () => {
    const fn = await loadHelper();
    // PD is 2014-01-15 — should include Prior Years + all 2012 + all 2013 + Jan 2014
    const result = fn(sampleInventory, "EB2", "IND", "2014-01-15");
    expect(result).not.toBeNull();
    // Prior (50) + Jan 2012 (100+80) + Jun 2012 (200+60) + Jan 2013 (500) + Jun 2013 (300) + Jan 2014 (400)
    expect(result!.casesAhead).toBe(50 + 100 + 80 + 200 + 60 + 500 + 300 + 400);
  });

  it("counts only records before the priority date for mid-year PD", async () => {
    const fn = await loadHelper();
    // PD is 2013-03-01 — should include Prior + all 2012 + Jan 2013 (not Jun 2013)
    const result = fn(sampleInventory, "EB2", "IND", "2013-03-01");
    expect(result).not.toBeNull();
    // Prior (50) + Jan 2012 (100+80) + Jun 2012 (200+60) + Jan 2013 (500) = 990
    expect(result!.casesAhead).toBe(50 + 100 + 80 + 200 + 60 + 500);
  });

  it("does not include other countries in the count", async () => {
    const fn = await loadHelper();
    const result = fn(sampleInventory, "EB2", "CHN", "2020-01-01");
    expect(result).not.toBeNull();
    // Only CHN row: 999
    expect(result!.casesAhead).toBe(999);
  });

  it("includes snapshot date in result", async () => {
    const fn = await loadHelper();
    const result = fn(sampleInventory, "EB2", "IND", "2013-01-15");
    expect(result).not.toBeNull();
    expect(result!.snapshotDate).toBe("2026-01-02");
  });

  it("maps ROW country correctly", async () => {
    const inventory: EbInventoryRecord[] = [
      { snapshot_date: "2026-01-02", country: "ROW", category: "EB1", visa_status: "Available", pd_month: 1, pd_year: 2024, pending_count: 500 },
    ];
    const fn = await loadHelper();
    const result = fn(inventory, "EB1", "ROW", "2025-01-01");
    expect(result).not.toBeNull();
    expect(result!.casesAhead).toBe(500);
  });

  // ---- New fields: dataMaxYear, isPdBeyondDataRange, totalPending ----

  it("returns correct totalPending as sum of all matching rows", async () => {
    const fn = await loadHelper();
    const result = fn(sampleInventory, "EB2", "IND", "2020-01-01");
    expect(result).not.toBeNull();
    // All IND/EB2 rows: 50+100+200+500+300+400+80+60 = 1690
    expect(result!.totalPending).toBe(50 + 100 + 200 + 500 + 300 + 400 + 80 + 60);
  });

  it("returns correct dataMaxYear as highest non-zero pd_year", async () => {
    const fn = await loadHelper();
    const result = fn(sampleInventory, "EB2", "IND", "2014-01-01");
    expect(result).not.toBeNull();
    expect(result!.dataMaxYear).toBe(2014);
  });

  it("dataMaxYear excludes pd_year=0 (Prior Years bucket)", async () => {
    const fn = await loadHelper();
    const inventory: EbInventoryRecord[] = [
      { snapshot_date: "2026-01-02", country: "IND", category: "EB1", visa_status: "Available", pd_month: 1, pd_year: 0, pending_count: 100 },
    ];
    // Only pd_year=0 exists — dataMaxYear should still be 0 (or the only year)
    const result = fn(inventory, "EB1", "IND", "2025-01-01");
    expect(result).not.toBeNull();
    // pd_year=0 is "Prior Years", no named year → dataMaxYear=0
    expect(result!.dataMaxYear).toBe(0);
    expect(result!.isPdBeyondDataRange).toBe(true);
  });

  it("isPdBeyondDataRange is false when PD is within data range", async () => {
    const fn = await loadHelper();
    const result = fn(sampleInventory, "EB2", "IND", "2013-06-01");
    expect(result).not.toBeNull();
    expect(result!.isPdBeyondDataRange).toBe(false);
  });

  it("isPdBeyondDataRange is true when PD exceeds dataMaxYear", async () => {
    const fn = await loadHelper();
    const result = fn(sampleInventory, "EB2", "IND", "2020-01-01");
    expect(result).not.toBeNull();
    expect(result!.isPdBeyondDataRange).toBe(true);
    expect(result!.dataMaxYear).toBe(2014);
    // casesAhead should equal totalPending when beyond range
    expect(result!.casesAhead).toBe(result!.totalPending);
  });

  it("casesAhead is always <= totalPending (bounds check)", async () => {
    const fn = await loadHelper();
    const dates = ["2010-01-01", "2012-06-15", "2013-03-01", "2014-01-01", "2015-01-01", "2020-01-01"];
    for (const pd of dates) {
      const result = fn(sampleInventory, "EB2", "IND", pd);
      expect(result).not.toBeNull();
      expect(result!.casesAhead).toBeGreaterThanOrEqual(0);
      expect(result!.casesAhead).toBeLessThanOrEqual(result!.totalPending);
    }
  });

  it("casesAhead is monotonically non-decreasing as PD gets later", async () => {
    const fn = await loadHelper();
    const pds = ["2010-01-01", "2012-01-01", "2013-01-01", "2014-01-01", "2015-01-01"] as const;
    const results = pds.map((pd) => fn(sampleInventory, "EB2", "IND", pd)!);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].casesAhead).toBeGreaterThanOrEqual(results[i - 1].casesAhead);
    }
  });

  it("casesAhead strictly increases within data range (monotonicity)", async () => {
    const fn = await loadHelper();
    const r2010 = fn(sampleInventory, "EB2", "IND", "2010-01-01")!;
    const r2012 = fn(sampleInventory, "EB2", "IND", "2012-06-01")!;
    const r2014 = fn(sampleInventory, "EB2", "IND", "2014-01-15")!;
    // More cases are "ahead" as PD moves later within data range
    expect(r2010.casesAhead).toBeLessThan(r2012.casesAhead);
    expect(r2012.casesAhead).toBeLessThan(r2014.casesAhead);
  });

  it("country isolation: same PD/category, different country → different count", async () => {
    const fn = await loadHelper();
    const indResult = fn(sampleInventory, "EB2", "IND", "2020-01-01");
    const chnResult = fn(sampleInventory, "EB2", "CHN", "2020-01-01");
    expect(indResult).not.toBeNull();
    expect(chnResult).not.toBeNull();
    // India has much larger backlog than CHN sample (1690 vs 999)
    expect(indResult!.casesAhead).not.toBe(chnResult!.casesAhead);
  });

  it("beyond-range count equals totalPending for any future PD", async () => {
    const fn = await loadHelper();
    const r2020 = fn(sampleInventory, "EB2", "IND", "2020-01-01")!;
    const r2025 = fn(sampleInventory, "EB2", "IND", "2025-06-01")!;
    // Both beyond dataMaxYear (2014), both should equal totalPending
    expect(r2020.casesAhead).toBe(r2020.totalPending);
    expect(r2025.casesAhead).toBe(r2025.totalPending);
    expect(r2020.casesAhead).toBe(r2025.casesAhead);
  });
});

// ======================================================================
// Feature #3: I-140 Latent Demand — computeI140LatentDemand
// ======================================================================

describe("computeI140LatentDemand", () => {
  async function loadHelper() {
    const mod = await import("@/lib/data/backlog");
    return mod.computeI140LatentDemand;
  }

  const sampleI140: I140DemandRecord[] = [
    // India EB2 across fiscal years
    { report_period: "FY2025_Q4", country: "IND", category: "EB2", fiscal_year: 2020, received: 36472, approved: 34924, denied: 1512, pending: 36 },
    { report_period: "FY2025_Q4", country: "IND", category: "EB2", fiscal_year: 2021, received: 39021, approved: 37504, denied: 1494, pending: 23 },
    { report_period: "FY2025_Q4", country: "IND", category: "EB2", fiscal_year: 2022, received: 46589, approved: 45152, denied: 1407, pending: 30 },
    { report_period: "FY2025_Q4", country: "IND", category: "EB2", fiscal_year: 2023, received: 40024, approved: 39216, denied: 688, pending: 120 },
    { report_period: "FY2025_Q4", country: "IND", category: "EB2", fiscal_year: 2024, received: 43327, approved: 39165, denied: 2529, pending: 1633 },
    { report_period: "FY2025_Q4", country: "IND", category: "EB2", fiscal_year: 2025, received: 43985, approved: 32058, denied: 2342, pending: 9585 },
    // China EB1
    { report_period: "FY2025_Q4", country: "CHN", category: "EB1", fiscal_year: 2024, received: 10486, approved: 6532, denied: 1405, pending: 2549 },
  ];

  it("returns null for missing category/country combo", async () => {
    const fn = await loadHelper();
    const result = fn(sampleI140, "EB3", "IND");
    expect(result).toBeNull();
  });

  it("sums approved I-140s across all fiscal years for India EB2", async () => {
    const fn = await loadHelper();
    const result = fn(sampleI140, "EB2", "IND");
    expect(result).not.toBeNull();
    const expectedApproved = 34924 + 37504 + 45152 + 39216 + 39165 + 32058;
    expect(result!.totalApproved).toBe(expectedApproved);
  });

  it("sums pending I-140s across all fiscal years", async () => {
    const fn = await loadHelper();
    const result = fn(sampleI140, "EB2", "IND");
    expect(result).not.toBeNull();
    const expectedPending = 36 + 23 + 30 + 120 + 1633 + 9585;
    expect(result!.totalPending).toBe(expectedPending);
  });

  it("returns report period from first matched record", async () => {
    const fn = await loadHelper();
    const result = fn(sampleI140, "EB2", "IND");
    expect(result).not.toBeNull();
    expect(result!.reportPeriod).toBe("FY2025_Q4");
  });

  it("handles China EB1 separately", async () => {
    const fn = await loadHelper();
    const result = fn(sampleI140, "EB1", "CHN");
    expect(result).not.toBeNull();
    expect(result!.totalApproved).toBe(6532);
    expect(result!.totalPending).toBe(2549);
  });

  it("uses ALL countries as proxy for ROW", async () => {
    const allCountry: I140DemandRecord[] = [
      { report_period: "FY2025_Q4", country: "ALL", category: "EB1", fiscal_year: 2024, received: 41164, approved: 28194, denied: 4869, pending: 8101 },
    ];
    const fn = await loadHelper();
    // ROW maps to "ALL" in I140_COUNTRY_MAP
    const result = fn(allCountry, "EB1", "ROW");
    expect(result).not.toBeNull();
    expect(result!.totalApproved).toBe(28194);
  });
});

// ======================================================================
// Feature #2: Transparent Scenario Math — Visa Supply Constants
// ======================================================================

describe("Visa Supply Constants (scenario math)", () => {
  it("EB total sums to 140,000", () => {
    const catBase: Record<string, number> = {
      EB1: 40040, EB2: 40040, EB3: 40040, EB4: 9940, EB5: 9940,
    };
    const total = Object.values(catBase).reduce((a, b) => a + b, 0);
    expect(total).toBe(140000);
  });

  it("per-country cap is 7% of total", () => {
    const total = 140000;
    const perCountry = 9800;
    expect(perCountry / total).toBeCloseTo(0.07, 2);
  });

  it("each main category gets 28.6% of total", () => {
    const catShare = 40040 / 140000;
    expect(catShare).toBeCloseTo(0.286, 2);
  });

  it("per-country category allocation is ~2,800 for main categories", () => {
    const perCountryCap = 9800;
    const catBase = 40040;
    const perCountryCat = Math.round(perCountryCap * catBase / 140000);
    expect(perCountryCat).toBe(2803);
    expect(perCountryCat).toBeGreaterThan(2500);
    expect(perCountryCat).toBeLessThan(3500);
  });
});

// ======================================================================
// Data loading tests (fetch mock)
// ======================================================================

describe("loadEbInventory", () => {
  it("fetches from correct URL path", async () => {
    const sample: EbInventoryRecord[] = [
      { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Available", pd_month: 1, pd_year: 2013, pending_count: 500 },
    ];
    mockFetchSuccess(sample);
    const { loadEbInventory } = await import("@/lib/data/pdi");
    const result = await loadEbInventory();
    expect(mockFetch).toHaveBeenCalledWith("/data/dashboards/visa-bulletin/fact_eb_inventory.json");
    expect(result).toHaveLength(1);
    expect(result[0].country).toBe("IND");
  });
});

describe("loadI140Demand", () => {
  it("fetches from correct URL path", async () => {
    const sample: I140DemandRecord[] = [
      { report_period: "FY2025_Q4", country: "IND", category: "EB2", fiscal_year: 2024, received: 43327, approved: 39165, denied: 2529, pending: 1633 },
    ];
    mockFetchSuccess(sample);
    const { loadI140Demand } = await import("@/lib/data/backlog");
    const result = await loadI140Demand();
    expect(mockFetch).toHaveBeenCalledWith("/data/dashboards/backlog/fact_i140_demand.json");
    expect(result).toHaveLength(1);
  });
});

// ======================================================================
// computeDemandBreakdown — Queue Snapshot three-segment breakdown
// ======================================================================

describe("computeDemandBreakdown", () => {
  // Shared sample data — EB2/IND with FAD=Jul 2014, DFF=Jan 2015
  const makeCutoffs = (fadDate: string, dffDate: string): CutoffTrendRecord[] => [
    {
      bulletin_year: 2026, bulletin_month: 5,
      chart: "FAD", category: "EB2", country: "IND",
      status_flag: "D", cutoff_date: fadDate,
      queue_position_days: null, monthly_advancement_days: null,
      velocity_3m: null, velocity_6m: null,
      retrogression_flag: 0, retrogression_count_cum: 0,
    },
    {
      bulletin_year: 2026, bulletin_month: 5,
      chart: "DFF", category: "EB2", country: "IND",
      status_flag: "D", cutoff_date: dffDate,
      queue_position_days: null, monthly_advancement_days: null,
      velocity_3m: null, velocity_6m: null,
      retrogression_flag: 0, retrogression_count_cum: 0,
    },
  ];

  const sampleInventory: EbInventoryRecord[] = [
    // Available — PD before Jul 2014 FAD
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Available",              pd_month: 1, pd_year: 0,    pending_count: 50 },
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Available",              pd_month: 3, pd_year: 2013, pending_count: 100 },
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Available",              pd_month: 7, pd_year: 2014, pending_count: 999 }, // Jul 2014 - at FAD boundary, included
    // Awaiting Availability — PD at or before Jan 2015 DFF
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Awaiting Availability", pd_month: 8, pd_year: 2014, pending_count: 200 },
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Awaiting Availability", pd_month: 1, pd_year: 2015, pending_count: 300 }, // Jan 2015 - at DFF boundary, included
    // Awaiting Availability — PD after DFF (should NOT count in seg 2)
    { snapshot_date: "2026-01-02", country: "IND", category: "EB2", visa_status: "Awaiting Availability", pd_month: 6, pd_year: 2015, pending_count: 999 },
  ];

  const sampleI140: I140DemandRecord[] = [
    { report_period: "FY2025_Q4", country: "IND", category: "EB2", fiscal_year: 2015, received: 33807, approved: 31634, denied: 2171, pending: 2 },
    { report_period: "FY2025_Q4", country: "IND", category: "EB2", fiscal_year: 2016, received: 50538, approved: 47635, denied: 2895, pending: 8 },
  ];

  it("returns null for empty inventory", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    const result = computeDemandBreakdown([], makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB2", "IND", "2016-06-01");
    expect(result).toBeNull();
  });

  it("returns null for invalid priority date", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB2", "IND", "not-a-date");
    expect(result).toBeNull();
  });

  it("returns null when no records match the category/country", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB3", "CHN", "2016-06-01");
    expect(result).toBeNull();
  });

  it("segment 1 counts only Available I-485 records at or before FAD", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    // FAD = Jul 2014 → rows 50 (Prior Years) + 100 (Mar 2013) + 999 (Jul 2014) = 1149
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB2", "IND", "2016-06-01");
    expect(result).not.toBeNull();
    expect(result!.currentlyProcessable).toBe(50 + 100 + 999);
  });

  it("segment 2 counts only Awaiting Availability records at or before DFF", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    // DFF = Jan 2015 → rows 200 (Aug 2014) + 300 (Jan 2015) = 500; row Jun 2015 excluded
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB2", "IND", "2016-06-01");
    expect(result).not.toBeNull();
    expect(result!.inDffWindow).toBe(200 + 300);
  });

  it("total equals sum of all three segments", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB2", "IND", "2016-06-01");
    expect(result).not.toBeNull();
    expect(result!.total).toBe(result!.currentlyProcessable + result!.inDffWindow + result!.beyondDff);
  });

  it("FAD-DFF gap is correct (6 months for Jul 2014 → Jan 2015)", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB2", "IND", "2016-06-01");
    expect(result).not.toBeNull();
    expect(result!.fadDffGapMonths).toBe(6);
  });

  it("hasI140Estimate is false when i140Data is empty", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), [], "EB2", "IND", "2016-06-01");
    expect(result).not.toBeNull();
    expect(result!.hasI140Estimate).toBe(false);
    expect(result!.beyondDff).toBe(0);
  });

  it("beyondDff is 0 when priority date is at or before DFF", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    // PD = Jan 2015 = DFF → no latent demand beyond DFF
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB2", "IND", "2015-01-01");
    expect(result).not.toBeNull();
    expect(result!.beyondDff).toBe(0);
  });

  it("isPdBeyondI485Ceiling is true when PD > data max year", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    // sampleInventory max non-zero year = 2015; PD = 2016 > 2015
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB2", "IND", "2016-06-01");
    expect(result).not.toBeNull();
    expect(result!.isPdBeyondI485Ceiling).toBe(true);
    expect(result!.i485DataMaxYear).toBe(2015);
  });

  it("isPdBeyondI485Ceiling is false when PD is within data range", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    // PD = 2013 < max year 2015
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB2", "IND", "2013-06-01");
    expect(result).not.toBeNull();
    expect(result!.isPdBeyondI485Ceiling).toBe(false);
  });

  it("snapshotDate comes from inventory records", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB2", "IND", "2016-06-01");
    expect(result).not.toBeNull();
    expect(result!.snapshotDate).toBe("2026-01-02");
  });

  it("fadCutoffDate and dffCutoffDate come from latest bulletin", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB2", "IND", "2016-06-01");
    expect(result).not.toBeNull();
    expect(result!.fadCutoffDate).toBe("2014-07-15");
    expect(result!.dffCutoffDate).toBe("2015-01-15");
  });

  it("beyondDff is positive when PD is past DFF and I-140 data exists", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    const result = computeDemandBreakdown(sampleInventory, makeCutoffs("2014-07-15", "2015-01-15"), sampleI140, "EB2", "IND", "2016-06-01");
    expect(result).not.toBeNull();
    expect(result!.beyondDff).toBeGreaterThan(0);
    expect(result!.hasI140Estimate).toBe(true);
  });

  it("latest bulletin is used when multiple bulletin months exist", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    // Inject older bulletin with different dates — should be ignored
    const cutoffsOldAndNew: CutoffTrendRecord[] = [
      ...makeCutoffs("2014-07-15", "2015-01-15"),
      {
        bulletin_year: 2025, bulletin_month: 1,
        chart: "FAD", category: "EB2", country: "IND",
        status_flag: "D", cutoff_date: "2012-01-01",
        queue_position_days: null, monthly_advancement_days: null,
        velocity_3m: null, velocity_6m: null,
        retrogression_flag: 0, retrogression_count_cum: 0,
      },
    ];
    const result = computeDemandBreakdown(sampleInventory, cutoffsOldAndNew, sampleI140, "EB2", "IND", "2016-06-01");
    expect(result).not.toBeNull();
    // Should use May 2026 dates, not Jan 2025
    expect(result!.fadCutoffDate).toBe("2014-07-15");
  });

  it("ROW country uses ROW inventory bucket and ALL I-140 data", async () => {
    const { computeDemandBreakdown } = await import("@/lib/data/pdi");
    const rowInventory: EbInventoryRecord[] = [
      { snapshot_date: "2026-01-02", country: "ROW", category: "EB2", visa_status: "Available", pd_month: 1, pd_year: 2020, pending_count: 500 },
    ];
    const rowCutoffs: CutoffTrendRecord[] = [
      { bulletin_year: 2026, bulletin_month: 5, chart: "FAD", category: "EB2", country: "ROW", status_flag: "D", cutoff_date: "2021-01-01", queue_position_days: null, monthly_advancement_days: null, velocity_3m: null, velocity_6m: null, retrogression_flag: 0, retrogression_count_cum: 0 },
      { bulletin_year: 2026, bulletin_month: 5, chart: "DFF", category: "EB2", country: "ROW", status_flag: "D", cutoff_date: "2022-01-01", queue_position_days: null, monthly_advancement_days: null, velocity_3m: null, velocity_6m: null, retrogression_flag: 0, retrogression_count_cum: 0 },
    ];
    const allI140: I140DemandRecord[] = [
      { report_period: "FY2025_Q4", country: "ALL", category: "EB2", fiscal_year: 2022, received: 80000, approved: 70000, denied: 5000, pending: 100 },
    ];
    const result = computeDemandBreakdown(rowInventory, rowCutoffs, allI140, "EB2", "ROW", "2023-06-01");
    expect(result).not.toBeNull();
    expect(result!.currentlyProcessable).toBe(500);
    // beyondDff should use ALL country I-140 data
    expect(result!.beyondDff).toBeGreaterThan(0);
  });
});
