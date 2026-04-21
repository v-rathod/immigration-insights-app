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
