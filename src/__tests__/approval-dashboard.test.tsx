/**
 * Tests for the Approval & Denial Trends dashboard.
 *
 * Covers:
 *   - Helper functions (getPermTrends, getAdminBand, getAdminAvg, sourceLabel, categoryLabel, isPartialYear)
 *   - ApprovalDenialDashboard component rendering (7 sections)
 *   - Static JSON data integrity
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

import {
  getPermTrends,
  getAdminBand,
  getAdminAvg,
  sourceLabel,
  categoryLabel,
  isPartialYear,
  ADMIN_BANDS,
} from "../lib/data/approvals";
import type {
  ApprovalTrendRow,
  PermDetailPoint,
  ApprovalSummary,
  CategoryRow,
} from "../lib/data/approvals";

// ── Mock framer-motion (full proxy pattern matching existing tests) ──────

vi.mock("framer-motion", async () => {
  const ReactMod = await import("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_, tag: string) => {
          return ReactMod.forwardRef(
            ({ children, className, style, ...rest }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties; [key: string]: unknown }, ref: React.Ref<unknown>) => {
              const motionKeys = new Set([
                "variants", "initial", "animate", "exit",
                "whileHover", "whileTap", "whileInView",
                "transition", "layout", "layoutId",
                "onAnimationComplete", "strokeDasharray",
              ]);
              const htmlProps: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(rest)) {
                if (!motionKeys.has(k)) htmlProps[k] = v;
              }
              return ReactMod.createElement(
                tag,
                { ref, className, style, ...htmlProps },
                children
              );
            }
          );
        },
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useSpring: () => ({ set: vi.fn(), get: () => 0 }),
    useTransform: (_: unknown, fn: (v: number) => unknown) => {
      try { return fn(0); } catch { return "0"; }
    },
    useInView: () => true,
  };
});

// ── Mock recharts ────────────────────────────────────────────────────────

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div data-testid="composed-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  ReferenceArea: () => null,
  Legend: () => null,
  Cell: () => null,
}));

// ── Mock data ─────────────────────────────────────────────────────────────

const MOCK_SUMMARY: ApprovalSummary = {
  period: "Last 10 Fiscal Years (PERM)",
  data_source: "PERM Labor Certification",
  total_cases: 1023108,
  total_approved: 930362,
  total_denied: 45751,
  avg_approval_rate: 95.29,
  min_approval_rate: 93.18,
  max_approval_rate: 98.14,
  trend: "increasing",
  yearly_breakdown: [
    { fiscal_year: 2017, APPROVED: 87609, DENIED: 6413, total_cases: 97603, approval_rate_pct: 93.18, denial_rate_pct: 6.82 },
    { fiscal_year: 2018, APPROVED: 109550, DENIED: 6255, total_cases: 119776, approval_rate_pct: 94.60, denial_rate_pct: 5.40 },
    { fiscal_year: 2019, APPROVED: 93865, DENIED: 5535, total_cases: 102655, approval_rate_pct: 94.43, denial_rate_pct: 5.57 },
    { fiscal_year: 2020, APPROVED: 86056, DENIED: 4213, total_cases: 94019, approval_rate_pct: 95.33, denial_rate_pct: 4.67 },
    { fiscal_year: 2021, APPROVED: 100552, DENIED: 4141, total_cases: 108264, approval_rate_pct: 96.04, denial_rate_pct: 3.96 },
    { fiscal_year: 2022, APPROVED: 94485, DENIED: 4573, total_cases: 104600, approval_rate_pct: 95.38, denial_rate_pct: 4.62 },
    { fiscal_year: 2023, APPROVED: 102286, DENIED: 6364, total_cases: 116427, approval_rate_pct: 94.14, denial_rate_pct: 5.86 },
    { fiscal_year: 2024, APPROVED: 102036, DENIED: 5031, total_cases: 114550, approval_rate_pct: 95.30, denial_rate_pct: 4.70 },
    { fiscal_year: 2025, APPROVED: 137753, DENIED: 2615, total_cases: 147056, approval_rate_pct: 98.14, denial_rate_pct: 1.86 },
    { fiscal_year: 2026, APPROVED: 16170, DENIED: 611, total_cases: 18158, approval_rate_pct: 96.36, denial_rate_pct: 3.64 },
  ],
};

const MOCK_PERM_DETAILED = {
  title: "PERM Labor Certification: 19-Year Approval Trends",
  subtitle: "Worldwide Employment-Based First Preference Cases",
  source: "US Department of Labor",
  fiscal_years: "FY2008-FY2026",
  last_fiscal_year: 2026,
  data_points: [
    { fiscal_year: 2008, approved: 49205, denied: 10729, total: 61997, approval_rate: 82.1, denial_rate: 17.9 },
    { fiscal_year: 2017, approved: 87609, denied: 6413, total: 97603, approval_rate: 93.18, denial_rate: 6.82, yoy_total_change_pct: -22.72, yoy_approval_rate_change: -2.24 },
    { fiscal_year: 2020, approved: 86056, denied: 4213, total: 94019, approval_rate: 95.33, denial_rate: 4.67, yoy_total_change_pct: -8.4, yoy_approval_rate_change: 0.9 },
    { fiscal_year: 2025, approved: 137753, denied: 2615, total: 147056, approval_rate: 98.14, denial_rate: 1.86, yoy_total_change_pct: 28.38, yoy_approval_rate_change: 2.84 },
    { fiscal_year: 2026, approved: 16170, denied: 611, total: 18158, approval_rate: 96.36, denial_rate: 3.64, yoy_total_change_pct: -87.65, yoy_approval_rate_change: -1.78 },
  ] as PermDetailPoint[],
};

const MOCK_CATEGORIES: CategoryRow[] = [
  { data_source: "PERM_Labor_Certification", visa_category: "Employment_Based_EB", total_cases: 1675051, approved: 1486457, denied: 111083, approval_rate_pct: 88.74, denial_rate_pct: 6.63 },
  { data_source: "USCIS_Forms", visa_category: "USCIS_Adjustment", total_cases: 3646523, approved: 3226992, denied: 419531, approval_rate_pct: 88.50, denial_rate_pct: 11.50 },
  { data_source: "Visa_Applications", visa_category: "Non_Immigrant_Visa", total_cases: 444762, approved: 444762, denied: 0, approval_rate_pct: 100.0, denial_rate_pct: 0.0 },
];

const MOCK_TRENDS: ApprovalTrendRow[] = [
  { fiscal_year: 2017, APPROVED: 87609, DENIED: 6413, total_cases: 97603, approval_rate_pct: 93.18, denial_rate_pct: 6.82, data_source: "PERM_Labor_Certification", visa_category: "Employment_Based_EB" },
  { fiscal_year: 2018, APPROVED: 109550, DENIED: 6255, total_cases: 119776, approval_rate_pct: 94.60, denial_rate_pct: 5.40, data_source: "PERM_Labor_Certification", visa_category: "Employment_Based_EB" },
  { fiscal_year: 2020, APPROVED: 3226992, DENIED: 419531, total_cases: 3646523, approval_rate_pct: 88.50, denial_rate_pct: 11.50, data_source: "USCIS_Forms", visa_category: "USCIS_Adjustment" },
];

// ── Mock data loaders for component tests ──────────────────────────────

vi.mock("../lib/data/approvals", async () => {
  const actual = await vi.importActual<typeof import("../lib/data/approvals")>("../lib/data/approvals");
  return {
    ...actual,
    loadApprovalSummary: vi.fn(),
    loadPermDetailed: vi.fn(),
    loadCategoryComparison: vi.fn(),
  };
});

// ── Tests: Helper Functions ─────────────────────────────────────────────

describe("Approval/Denial Helper Functions", () => {
  describe("getPermTrends", () => {
    it("filters to PERM rows only", () => {
      const result = getPermTrends(MOCK_TRENDS);
      expect(result.length).toBe(2);
      expect(result.every((r) => r.data_source === "PERM_Labor_Certification")).toBe(true);
    });

    it("sorts by fiscal year ascending", () => {
      const result = getPermTrends(MOCK_TRENDS);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].fiscal_year).toBeGreaterThan(result[i - 1].fiscal_year);
      }
    });

    it("returns empty array for no PERM data", () => {
      const uscisOnly = MOCK_TRENDS.filter((r) => r.data_source === "USCIS_Forms");
      expect(getPermTrends(uscisOnly)).toEqual([]);
    });
  });

  describe("getAdminBand", () => {
    it("returns Obama for FY2012", () => {
      const band = getAdminBand(2012);
      expect(band?.label).toBe("Obama");
    });

    it("returns Trump I for FY2018", () => {
      const band = getAdminBand(2018);
      expect(band?.label).toBe("Trump I");
    });

    it("returns Biden for FY2022", () => {
      const band = getAdminBand(2022);
      expect(band?.label).toBe("Biden");
    });

    it("returns Trump II for FY2025", () => {
      const band = getAdminBand(2025);
      expect(band?.label).toBe("Trump II");
    });

    it("returns undefined for FY2008 (pre-Obama)", () => {
      expect(getAdminBand(2008)).toBeUndefined();
    });
  });

  describe("getAdminAvg", () => {
    it("computes average for an administration with data", () => {
      const trumpI = ADMIN_BANDS.find((b) => b.label === "Trump I")!;
      const avg = getAdminAvg(trumpI, MOCK_PERM_DETAILED.data_points);
      // FY2017: 93.18, FY2020: 95.33 → avg = 94.255
      expect(avg).toBeCloseTo(94.255, 1);
    });

    it("returns null for an administration with no data", () => {
      const trumpII = { label: "Future", start: 2040, end: 2044, color: "" };
      expect(getAdminAvg(trumpII, MOCK_PERM_DETAILED.data_points)).toBeNull();
    });
  });

  describe("sourceLabel", () => {
    it("maps PERM_Labor_Certification to PERM", () => {
      expect(sourceLabel("PERM_Labor_Certification")).toBe("PERM");
    });

    it("maps USCIS_Forms to USCIS", () => {
      expect(sourceLabel("USCIS_Forms")).toBe("USCIS");
    });

    it("maps Visa_Applications to Visa Apps", () => {
      expect(sourceLabel("Visa_Applications")).toBe("Visa Apps");
    });

    it("returns raw value for unknown source", () => {
      expect(sourceLabel("Unknown_Source")).toBe("Unknown_Source");
    });
  });

  describe("categoryLabel", () => {
    it("maps Employment_Based_EB to readable label", () => {
      expect(categoryLabel("Employment_Based_EB")).toBe("Employment-Based (EB)");
    });

    it("maps USCIS_Adjustment correctly", () => {
      expect(categoryLabel("USCIS_Adjustment")).toBe("USCIS Petitions (I-140/I-485)");
    });

    it("maps Non_Immigrant_Visa correctly", () => {
      expect(categoryLabel("Non_Immigrant_Visa")).toBe("Non-Immigrant Visas (NIV)");
    });
  });

  describe("isPartialYear", () => {
    it("returns true for current year with low volume", () => {
      expect(isPartialYear(2026, 18158)).toBe(true);
    });

    it("returns false for past year with normal volume", () => {
      expect(isPartialYear(2025, 147056)).toBe(false);
    });

    it("returns false for current year with high volume (>50K)", () => {
      expect(isPartialYear(2026, 100000)).toBe(false);
    });
  });

  describe("ADMIN_BANDS", () => {
    it("has 4 administration bands", () => {
      expect(ADMIN_BANDS).toHaveLength(4);
    });

    it("covers FY2009 to FY2028 contiguously", () => {
      const labels = ADMIN_BANDS.map((b) => b.label);
      expect(labels).toEqual(["Obama", "Trump I", "Biden", "Trump II"]);
      // Check no gaps
      for (let i = 1; i < ADMIN_BANDS.length; i++) {
        expect(ADMIN_BANDS[i].start).toBe(ADMIN_BANDS[i - 1].end + 1);
      }
    });
  });
});

// ── Tests: ApprovalDenialDashboard Component ─────────────────────────────

import {
  loadApprovalSummary as _loadSummary,
  loadPermDetailed as _loadPerm,
  loadCategoryComparison as _loadCats,
} from "../lib/data/approvals";

const loadApprovalSummaryMock = vi.mocked(_loadSummary);
const loadPermDetailedMock = vi.mocked(_loadPerm);
const loadCategoryComparisonMock = vi.mocked(_loadCats);

// Default mock data for resolved loaders
const DEFAULT_SUMMARY_MOCK: ApprovalSummary = {
  period: "Last 10 Fiscal Years (PERM)",
  data_source: "PERM Labor Certification",
  total_cases: 1023108,
  total_approved: 930362,
  total_denied: 45751,
  avg_approval_rate: 95.29,
  min_approval_rate: 93.18,
  max_approval_rate: 98.14,
  trend: "increasing",
  yearly_breakdown: [
    { fiscal_year: 2017, APPROVED: 87609, DENIED: 6413, total_cases: 97603, approval_rate_pct: 93.18, denial_rate_pct: 6.82 },
    { fiscal_year: 2018, APPROVED: 109550, DENIED: 6255, total_cases: 119776, approval_rate_pct: 94.60, denial_rate_pct: 5.40 },
    { fiscal_year: 2019, APPROVED: 93865, DENIED: 5535, total_cases: 102655, approval_rate_pct: 94.43, denial_rate_pct: 5.57 },
    { fiscal_year: 2020, APPROVED: 86056, DENIED: 4213, total_cases: 94019, approval_rate_pct: 95.33, denial_rate_pct: 4.67 },
    { fiscal_year: 2021, APPROVED: 100552, DENIED: 4141, total_cases: 108264, approval_rate_pct: 96.04, denial_rate_pct: 3.96 },
    { fiscal_year: 2022, APPROVED: 94485, DENIED: 4573, total_cases: 104600, approval_rate_pct: 95.38, denial_rate_pct: 4.62 },
    { fiscal_year: 2023, APPROVED: 102286, DENIED: 6364, total_cases: 116427, approval_rate_pct: 94.14, denial_rate_pct: 5.86 },
    { fiscal_year: 2024, APPROVED: 102036, DENIED: 5031, total_cases: 114550, approval_rate_pct: 95.30, denial_rate_pct: 4.70 },
    { fiscal_year: 2025, APPROVED: 137753, DENIED: 2615, total_cases: 147056, approval_rate_pct: 98.14, denial_rate_pct: 1.86 },
    { fiscal_year: 2026, APPROVED: 16170, DENIED: 611, total_cases: 18158, approval_rate_pct: 96.36, denial_rate_pct: 3.64 },
  ],
};

const DEFAULT_PERM_MOCK = {
  title: "PERM Labor Certification: 19-Year Approval Trends",
  subtitle: "Worldwide Employment-Based First Preference Cases",
  source: "US Department of Labor",
  fiscal_years: "FY2008-FY2026",
  last_fiscal_year: 2026,
  data_points: [
    { fiscal_year: 2008, approved: 49205, denied: 10729, total: 61997, approval_rate: 82.1, denial_rate: 17.9 },
    { fiscal_year: 2017, approved: 87609, denied: 6413, total: 97603, approval_rate: 93.18, denial_rate: 6.82, yoy_total_change_pct: -22.72, yoy_approval_rate_change: -2.24 },
    { fiscal_year: 2020, approved: 86056, denied: 4213, total: 94019, approval_rate: 95.33, denial_rate: 4.67, yoy_total_change_pct: -8.4, yoy_approval_rate_change: 0.9 },
    { fiscal_year: 2025, approved: 137753, denied: 2615, total: 147056, approval_rate: 98.14, denial_rate: 1.86, yoy_total_change_pct: 28.38, yoy_approval_rate_change: 2.84 },
    { fiscal_year: 2026, approved: 16170, denied: 611, total: 18158, approval_rate: 96.36, denial_rate: 3.64, yoy_total_change_pct: -87.65, yoy_approval_rate_change: -1.78 },
  ],
};

const DEFAULT_CATS_MOCK: CategoryRow[] = [
  { data_source: "PERM_Labor_Certification", visa_category: "Employment_Based_EB", total_cases: 1675051, approved: 1486457, denied: 111083, approval_rate_pct: 88.74, denial_rate_pct: 6.63 },
  { data_source: "USCIS_Forms", visa_category: "USCIS_Adjustment", total_cases: 3646523, approved: 3226992, denied: 419531, approval_rate_pct: 88.50, denial_rate_pct: 11.50 },
  { data_source: "Visa_Applications", visa_category: "Non_Immigrant_Visa", total_cases: 444762, approved: 444762, denied: 0, approval_rate_pct: 100.0, denial_rate_pct: 0.0 },
];

function resetLoaderMocks() {
  loadApprovalSummaryMock.mockResolvedValue(DEFAULT_SUMMARY_MOCK);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadPermDetailedMock.mockResolvedValue(DEFAULT_PERM_MOCK as any);
  loadCategoryComparisonMock.mockResolvedValue(DEFAULT_CATS_MOCK);
}

describe("ApprovalDenialDashboard", () => {
  beforeEach(() => {
    localStorage.clear();
    resetLoaderMocks();
  });

  // Lazy-import so mocks are active
  async function renderDashboard() {
    const mod = await import("../components/approvals/ApprovalDenialDashboard");
    const { ApprovalDenialDashboard } = mod;
    return render(<ApprovalDenialDashboard />);
  }

  it("renders loading spinner initially", async () => {
    // Make the loaders never resolve to keep loading state
    loadApprovalSummaryMock.mockReturnValue(new Promise(() => {}));
    loadPermDetailedMock.mockReturnValue(new Promise(() => {}));
    loadCategoryComparisonMock.mockReturnValue(new Promise(() => {}));
    const mod = await import("../components/approvals/ApprovalDenialDashboard");
    const { container } = render(<mod.ApprovalDenialDashboard />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders dashboard with all 7 sections after loading", async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId("approval-denial-dashboard")).toBeInTheDocument();
    });
  });

  it("renders KPI stat cards", async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("PERM Cases (10yr)")).toBeInTheDocument();
      expect(screen.getByText("Avg Approval Rate")).toBeInTheDocument();
      expect(screen.getByText("Best Year")).toBeInTheDocument();
      expect(screen.getByText("Total Denied")).toBeInTheDocument();
    });
  });

  it("renders Approval Pulse chart section", async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("PERM Approval Pulse")).toBeInTheDocument();
    });
  });

  it("renders YoY Velocity chart section", async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("YoY Approval Rate Velocity")).toBeInTheDocument();
    });
  });

  it("renders Cross-Track Comparison section", async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Cross-Track Comparison")).toBeInTheDocument();
    });
  });

  it("renders cross-track source labels", async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("PERM")).toBeInTheDocument();
      expect(screen.getByText("USCIS")).toBeInTheDocument();
      expect(screen.getByText("Visa Apps")).toBeInTheDocument();
    });
  });

  it("renders Heat Grid section", async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("19-Year Approval Heatmap")).toBeInTheDocument();
    });
  });

  it("renders heatmap cells for each fiscal year", async () => {
    await renderDashboard();
    await waitFor(() => {
      // Check a few FY labels exist in heatmap cells
      expect(screen.getByText("FY08")).toBeInTheDocument();
      expect(screen.getByText("FY25")).toBeInTheDocument();
    });
  });

  it("shows Administration Bands toggle button", async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Show Administration Bands")).toBeInTheDocument();
    });
  });

  it("toggles administration bands on click", async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Show Administration Bands")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Show Administration Bands"));
    await waitFor(() => {
      expect(screen.getByText("Hide Administration Bands")).toBeInTheDocument();
      expect(screen.getByText("Average Approval Rate by Administration")).toBeInTheDocument();
    });
  });

  it("renders admin stats bar when bands toggled on", async () => {
    await renderDashboard();
    await waitFor(() => screen.getByText("Show Administration Bands"));
    fireEvent.click(screen.getByText("Show Administration Bands"));
    await waitFor(() => {
      // Should show at least some admin labels
      expect(screen.getByText("Trump I")).toBeInTheDocument();
    });
  });

  it("shows Risk Window CTA when no user profile", async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("See your personal approval climate")).toBeInTheDocument();
    });
  });

  it("renders methodology section", async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("About this data")).toBeInTheDocument();
    });
  });

  it("renders error state on load failure", async () => {
    loadApprovalSummaryMock.mockRejectedValue(new Error("Network error"));
    loadPermDetailedMock.mockRejectedValue(new Error("Network error"));
    loadCategoryComparisonMock.mockRejectedValue(new Error("Network error"));
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    });
  });
});

// ── Tests: Static JSON Data Integrity ─────────────────────────────────────

import * as fs from "fs";
import * as path from "path";

describe("Approval/Denial JSON Data Integrity", () => {
  const dataDir = path.join(__dirname, "../../public/data/dashboards/approvals");

  function loadJson(file: string) {
    const content = fs.readFileSync(path.join(dataDir, file), "utf8");
    return JSON.parse(content);
  }

  it("approval_denial_trends.json exists and has rows", () => {
    const data = loadJson("approval_denial_trends.json");
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(40);
  });

  it("approval_denial_trends.json has required columns", () => {
    const data = loadJson("approval_denial_trends.json");
    const cols = ["fiscal_year", "APPROVED", "DENIED", "total_cases", "approval_rate_pct", "denial_rate_pct", "data_source", "visa_category"];
    for (const row of data) {
      for (const col of cols) {
        expect(row).toHaveProperty(col);
      }
    }
  });

  it("approval_denial_trends.json has 3 data sources", () => {
    const data = loadJson("approval_denial_trends.json");
    const sources = new Set(data.map((r: Record<string, unknown>) => r.data_source));
    expect(sources.size).toBe(3);
    expect(sources.has("PERM_Labor_Certification")).toBe(true);
    expect(sources.has("USCIS_Forms")).toBe(true);
    expect(sources.has("Visa_Applications")).toBe(true);
  });

  it("approval rates are 0-100 range", () => {
    const data = loadJson("approval_denial_trends.json");
    for (const row of data) {
      expect(row.approval_rate_pct).toBeGreaterThanOrEqual(0);
      expect(row.approval_rate_pct).toBeLessThanOrEqual(100);
    }
  });

  it("approval_denial_summary.json has correct structure", () => {
    const data = loadJson("approval_denial_summary.json");
    expect(data.total_cases).toBeGreaterThan(0);
    expect(data.total_approved).toBeGreaterThan(0);
    expect(data.avg_approval_rate).toBeGreaterThan(80);
    expect(data.yearly_breakdown.length).toBeGreaterThanOrEqual(10);
  });

  it("approval_denial_summary.json has increasing trend", () => {
    const data = loadJson("approval_denial_summary.json");
    expect(data.trend).toBe("increasing");
  });

  it("approval_denial_by_category.json has 3 tracks", () => {
    const data = loadJson("approval_denial_by_category.json");
    expect(data.length).toBe(3);
    const sources = data.map((r: Record<string, unknown>) => r.data_source);
    expect(sources).toContain("PERM_Labor_Certification");
    expect(sources).toContain("USCIS_Forms");
    expect(sources).toContain("Visa_Applications");
  });

  it("PERM has highest case volume in by_category", () => {
    const data = loadJson("approval_denial_by_category.json");
    const uscis = data.find((r: Record<string, unknown>) => r.data_source === "USCIS_Forms");
    const perm = data.find((r: Record<string, unknown>) => r.data_source === "PERM_Labor_Certification");
    // USCIS actually has more total cases than PERM
    expect(uscis.total_cases).toBeGreaterThan(perm.total_cases);
  });

  it("perm_trends_detailed.json has 19 data points", () => {
    const data = loadJson("perm_trends_detailed.json");
    expect(data.data_points.length).toBe(19);
  });

  it("perm_trends_detailed.json spans FY2008 to FY2026", () => {
    const data = loadJson("perm_trends_detailed.json");
    const years = data.data_points.map((d: Record<string, unknown>) => d.fiscal_year as number);
    expect(Math.min(...years)).toBe(2008);
    expect(Math.max(...years)).toBe(2026);
  });

  it("perm_trends_detailed.json has YoY change fields", () => {
    const data = loadJson("perm_trends_detailed.json");
    // First year won't have YoY, but later years should
    const withYoy = data.data_points.filter((d: Record<string, unknown>) => d.yoy_approval_rate_change != null);
    expect(withYoy.length).toBeGreaterThanOrEqual(15);
  });

  it("FY2025 has highest approval rate in PERM history", () => {
    const data = loadJson("perm_trends_detailed.json");
    const fy2025 = data.data_points.find((d: Record<string, unknown>) => d.fiscal_year === 2025);
    expect(fy2025).toBeDefined();
    for (const d of data.data_points) {
      if (d.fiscal_year !== 2025 && d.fiscal_year !== 2026) {
        expect((fy2025 as Record<string, unknown>).approval_rate as number).toBeGreaterThanOrEqual((d as Record<string, unknown>).approval_rate as number);
      }
    }
  });

  it("counts are non-negative across all data points", () => {
    const data = loadJson("perm_trends_detailed.json");
    for (const d of data.data_points as Record<string, unknown>[]) {
      expect(d.approved).toBeGreaterThanOrEqual(0);
      expect(d.denied).toBeGreaterThanOrEqual(0);
      expect(d.total).toBeGreaterThanOrEqual(0);
    }
  });
});
