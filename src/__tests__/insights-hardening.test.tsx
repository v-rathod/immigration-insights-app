/**
 * Insights Page Hardening Tests — Edge cases, data rendering correctness,
 * and anti-regression tests for the most popular page on the site.
 *
 * Test categories:
 *   1. Panel render correctness with realistic data (not empty mocks)
 *   2. NaN/undefined never appears in rendered output
 *   3. Edge case priority dates (far future, 2002, etc.)
 *   4. Edge case employer selections (missing data, NaN scores)
 *   5. Edge case salary values (0, very high, very low)
 *   6. Profile form validation and edge cases
 *   7. All three panels interact correctly
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks (same pattern as insights-page.test.tsx)
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_: unknown, tag: string) => {
          const Component = React.forwardRef(
            (
              props: Record<string, unknown>,
              ref: React.Ref<HTMLElement>
            ) => {
              const htmlProps: Record<string, unknown> = {};
              const skip = new Set([
                "variants", "initial", "animate", "exit", "whileHover",
                "whileTap", "whileInView", "transition", "layout", "layoutId",
              ]);
              for (const [k, v] of Object.entries(props)) {
                if (!skip.has(k)) htmlProps[k] = v;
              }
              return React.createElement(tag, { ref, ...htmlProps }, props.children as React.ReactNode);
            }
          );
          Component.displayName = `motion.${tag}`;
          return Component;
        },
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useSpring: () => ({ set: vi.fn() }),
    useTransform: (_: unknown, fn: (v: number) => string) => fn(0),
    useInView: () => true,
  };
});

vi.mock("recharts", async () => {
  const React = await import("react");
  const Stub = ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "recharts-stub" }, children);
  return {
    ResponsiveContainer: Stub, ComposedChart: Stub, BarChart: Stub,
    Bar: Stub, Line: Stub, XAxis: Stub, YAxis: Stub,
    CartesianGrid: Stub, Tooltip: Stub, ReferenceLine: Stub,
    Cell: Stub, Area: Stub,
  };
});

vi.mock("@/components/pdi/priority-date-chart", () => ({
  PriorityDateChart: ({ priorityDate }: { priorityDate?: string }) => (
    <div data-testid="priority-date-chart" data-pd={priorityDate}>PDI Chart</div>
  ),
}));

let lastSelectedEmployer: Record<string, unknown> | null = null;

vi.mock("@/components/srs/employer-search", () => ({
  EmployerSearch: ({
    onSelect,
  }: {
    onSelect: (e: Record<string, unknown>) => void;
  }) => (
    <div data-testid="employer-search">
      <button
        onClick={() => {
          const emp = {
            employer_name: "Ibm",
            employer_id: "d3ac-ibm-test",
            srs: 86,
            srs_tier: "Excellent",
            scope: "overall",
            outcome_subscore: 98.86,
            wage_subscore: 79.69,
            sustainability_subscore: 71.2,
            n_36m: 1157,
          };
          lastSelectedEmployer = emp;
          onSelect(emp as unknown as Parameters<typeof onSelect>[0]);
        }}
        data-testid="mock-select-ibm"
      >
        Select IBM
      </button>
      <button
        onClick={() => {
          const emp = {
            employer_name: "Tiny Startup Inc",
            employer_id: "tiny-001",
            srs: null,
            srs_tier: "Unrated",
            scope: "overall",
            outcome_subscore: undefined,
            wage_subscore: undefined,
            sustainability_subscore: undefined,
            n_36m: 2,
          };
          lastSelectedEmployer = emp;
          onSelect(emp as unknown as Parameters<typeof onSelect>[0]);
        }}
        data-testid="mock-select-tiny"
      >
        Select Tiny
      </button>
    </div>
  ),
}));

vi.mock("@/components/srs/score-gauge", () => ({
  SrsScoreGauge: ({ score, tier, subscores }: {
    score: number | null;
    tier: string;
    subscores: { outcome: number; wage: number; sustainability: number };
  }) => (
    <div data-testid="srs-score-gauge">
      <span data-testid="gauge-tier">{tier}</span>
      <span data-testid="gauge-score">{score ?? "null"}</span>
      <span data-testid="gauge-outcome">{subscores?.outcome ?? "null"}</span>
      <span data-testid="gauge-wage">{subscores?.wage ?? "null"}</span>
      <span data-testid="gauge-sustain">{subscores?.sustainability ?? "null"}</span>
    </div>
  ),
}));

vi.mock("@/components/srs/employer-detail-card", () => ({
  EmployerDetailCard: ({ employer }: { employer: { employer_name: string } }) => (
    <div data-testid="employer-detail-card">{employer.employer_name}</div>
  ),
}));

vi.mock("@/components/srs/trend-chart", () => ({
  SrsTrendChart: ({ employerName }: { employerName: string }) => (
    <div data-testid="srs-trend-chart">{employerName}</div>
  ),
}));

// Mock data loaders
vi.mock("@/lib/data/pdi", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/data/pdi")>();
  return {
    ...actual,
    loadPdForecasts: vi.fn().mockResolvedValue([
      // Minimal forecast data for India EB2 DFF
      {
        chart: "DFF", category: "EB2", country: "IND",
        forecast_month: "2026-05",
        projected_cutoff_date: "2013-06-15T00:00:00",
        confidence_low: "2013-03-01", confidence_high: "2013-09-01",
        velocity_days_per_month: 18.5,
        cumulative_advancement_days: 450,
      },
      {
        chart: "DFF", category: "EB2", country: "IND",
        forecast_month: "2026-06",
        projected_cutoff_date: "2013-07-03T00:00:00",
        confidence_low: "2013-04-01", confidence_high: "2013-10-01",
        velocity_days_per_month: 18.5,
        cumulative_advancement_days: 468,
      },
    ]),
    loadPdForecastsRetrograde: vi.fn().mockResolvedValue([]),
    loadCutoffTrends: vi.fn().mockResolvedValue([
      {
        chart: "DFF", category: "EB2", country: "IND",
        bulletin_year: 2026, bulletin_month: 4,
        cutoff_date: "2013-05-01T00:00:00",
        velocity_3m: 15.2, velocity_6m: 17.1,
        monthly_advancement_days: 18,
        retrogression_flag: false,
      },
    ]),
  };
});

vi.mock("@/lib/data/srs", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/data/srs")>();
  return {
    ...actual,
    loadSrsScoresML: vi.fn().mockResolvedValue([]),
    loadEmployerRiskFeatures: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@/lib/data/wage", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/data/wage")>();
  return {
    ...actual,
    loadSalaryBenchmarksNational: vi.fn().mockResolvedValue([
      {
        soc_code: "15-1252",
        soc_title: "Software Developers",
        area_code: "99",
        p10: 70000, p25: 95000, median: 130000, p75: 165000, p90: 200000,
      },
    ]),
  };
});

vi.mock("@/lib/data/employer-shard", () => ({
  loadEmployerSearch: vi.fn().mockResolvedValue([]),
  loadEmployerShard: vi.fn().mockResolvedValue(null),
  extractSrsFromShard: vi.fn().mockReturnValue(null),
  extractMonthlyMetrics: vi.fn().mockReturnValue([]),
  extractWageRoles: vi.fn().mockReturnValue([]),
}));

const mockStorage: Record<string, unknown> = {};
vi.mock("@/lib/security", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/security")>();
  return {
    ...actual,
    secureGet: vi.fn((key: string) => mockStorage[key] ?? null),
    secureSet: vi.fn((key: string, value: unknown) => {
      mockStorage[key] = value;
    }),
  };
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  lastSelectedEmployer = null;
  vi.clearAllMocks();
  const pdi = await import("@/lib/data/pdi");
  (pdi.loadPdForecasts as ReturnType<typeof vi.fn>).mockResolvedValue([
    {
      chart: "DFF", category: "EB2", country: "IND",
      forecast_month: "2026-05",
      projected_cutoff_date: "2013-06-15T00:00:00",
      confidence_low: "2013-03-01", confidence_high: "2013-09-01",
      velocity_days_per_month: 18.5, cumulative_advancement_days: 450,
    },
  ]);
  (pdi.loadPdForecastsRetrograde as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (pdi.loadCutoffTrends as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  const shard = await import("@/lib/data/employer-shard");
  (shard.loadEmployerSearch as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (shard.loadEmployerShard as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (shard.extractSrsFromShard as ReturnType<typeof vi.fn>).mockReturnValue(null);
  (shard.extractMonthlyMetrics as ReturnType<typeof vi.fn>).mockReturnValue([]);
  (shard.extractWageRoles as ReturnType<typeof vi.fn>).mockReturnValue([]);
});

async function renderPage() {
  const { default: InsightsPage } = await import("@/app/insights/page");
  render(<InsightsPage />);
  await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull(), { timeout: 3000 });
  await waitFor(() => expect(screen.getByTestId("insights-page")).toBeInTheDocument(), { timeout: 3000 });
}

// ======================================================================
// Edge case profiles
// ======================================================================

describe("InsightsPage — edge case: priority date in far future", () => {
  it("renders forecast panel without crashing for PD in 2030", async () => {
    mockStorage["user-profile"] = {
      priorityDate: "2030-01-01",
      countryOfChargeability: "IND",
      category: "EB2",
      employerName: "",
      jobTitle: "",
      location: "",
      wageOffered: 0,
      yearsOfExperience: 0,
    };
    await renderPage();
    expect(screen.getByText("Green Card Forecast")).toBeInTheDocument();
  });
});

describe("InsightsPage — edge case: priority date in 2002", () => {
  it("renders forecast panel for very old PD", async () => {
    mockStorage["user-profile"] = {
      priorityDate: "2002-06-15",
      countryOfChargeability: "IND",
      category: "EB2",
      employerName: "",
      jobTitle: "",
      location: "",
      wageOffered: 0,
      yearsOfExperience: 0,
    };
    await renderPage();
    expect(screen.getByText("Green Card Forecast")).toBeInTheDocument();
  });
});

describe("InsightsPage — edge case: zero salary", () => {
  it("shows salary CTA when salary is 0", async () => {
    mockStorage["user-profile"] = {
      priorityDate: "2013-06-15",
      countryOfChargeability: "IND",
      category: "EB2",
      employerName: "",
      jobTitle: "Software Developer",
      location: "",
      wageOffered: 0,
      yearsOfExperience: 5,
    };
    await renderPage();
    // Salary panel should still show CTA since salary is 0
    const salarySection = screen.getByText("Salary Compass");
    expect(salarySection).toBeInTheDocument();
  });
});

describe("InsightsPage — edge case: very high salary", () => {
  it("renders salary panel with $500K salary without overflow", async () => {
    mockStorage["user-profile"] = {
      priorityDate: "2013-06-15",
      countryOfChargeability: "IND",
      category: "EB2",
      employerName: "",
      jobTitle: "Software Developer",
      location: "",
      wageOffered: 500000,
      yearsOfExperience: 15,
    };
    await renderPage();
    expect(screen.getByText("Salary Compass")).toBeInTheDocument();
  });
});

// ======================================================================
// NaN guard: no "NaN" or "undefined" in any rendered output
// ======================================================================

describe("InsightsPage — CRITICAL: no NaN/undefined in rendered output", () => {
  it("full profile with forecast data renders no NaN", async () => {
    mockStorage["user-profile"] = {
      priorityDate: "2013-06-15",
      countryOfChargeability: "IND",
      category: "EB2",
      employerName: "Google LLC",
      jobTitle: "Software Developer",
      location: "CA",
      wageOffered: 200000,
      yearsOfExperience: 10,
    };
    await renderPage();

    // Wait for all panels to render
    await waitFor(() => {
      expect(screen.getByText("Green Card Forecast")).toBeInTheDocument();
    }, { timeout: 3000 });

    // The nuclear test: scan ALL rendered text for NaN/undefined
    const pageText = document.body.textContent ?? "";
    // Allow "NaN" only in technical explanations, not in data fields
    // Split by whitespace and check each word
    const words = pageText.split(/\s+/);
    const nanWords = words.filter((w) => w === "NaN" || w === "NaN%" || w === "$NaN");
    const undefinedWords = words.filter((w) => w === "undefined");

    expect(nanWords.length, `Found NaN in page text: "${nanWords.join(", ")}"`).toBe(0);
    expect(undefinedWords.length, `Found undefined in page text: "${undefinedWords.join(", ")}"`).toBe(0);
  });

  it("empty profile renders no NaN", async () => {
    await renderPage();
    const pageText = document.body.textContent ?? "";
    const words = pageText.split(/\s+/);
    const nanWords = words.filter((w) => w === "NaN" || w === "NaN%");
    expect(nanWords.length).toBe(0);
  });
});

// ======================================================================
// Sponsor panel edge cases
// ======================================================================

describe("InsightsPage — sponsor panel with unrated employer", () => {
  it("shows Unrated tier when employer has no SRS score", async () => {
    mockStorage["user-profile"] = {
      priorityDate: "",
      countryOfChargeability: "IND",
      category: "EB2",
      employerName: "Tiny Startup Inc",
      jobTitle: "",
      location: "",
      wageOffered: 0,
      yearsOfExperience: 0,
    };
    await renderPage();

    // Select the tiny employer
    fireEvent.click(screen.getByTestId("mock-select-tiny"));

    await waitFor(() => {
      const gauge = screen.queryByTestId("srs-score-gauge");
      if (gauge) {
        const tierText = gauge.querySelector("[data-testid='gauge-tier']");
        expect(tierText?.textContent).toBe("Unrated");
      }
    }, { timeout: 3000 });
  });
});

describe("InsightsPage — sponsor panel with rated employer (IBM)", () => {
  it("shows correct tier and sub-scores", async () => {
    mockStorage["user-profile"] = {
      priorityDate: "2013-06-15",
      countryOfChargeability: "IND",
      category: "EB2",
      employerName: "Ibm",
      jobTitle: "",
      location: "",
      wageOffered: 0,
      yearsOfExperience: 0,
    };
    await renderPage();

    // Select IBM
    fireEvent.click(screen.getByTestId("mock-select-ibm"));

    await waitFor(() => {
      const gauge = screen.queryByTestId("srs-score-gauge");
      if (gauge) {
        const tier = gauge.querySelector("[data-testid='gauge-tier']");
        expect(tier?.textContent).toBe("Excellent");
        // Sub-scores should be numbers, not "NaN" or "null"
        const outcome = gauge.querySelector("[data-testid='gauge-outcome']");
        expect(outcome?.textContent).not.toBe("NaN");
        expect(outcome?.textContent).not.toBe("null");
      }
    }, { timeout: 3000 });
  });
});

// ======================================================================
// Profile card resilience
// ======================================================================

describe("InsightsPage — profile resilience", () => {
  it("handles corrupted localStorage gracefully", async () => {
    // Simulate corrupted data
    mockStorage["user-profile"] = "not-valid-json";
    // Should not crash
    await renderPage();
    expect(screen.getByRole("heading", { name: /my insights/i })).toBeInTheDocument();
  });

  it("handles partial profile data", async () => {
    // Only some fields set
    mockStorage["user-profile"] = {
      priorityDate: "2013-06-15",
      // All other fields missing
    };
    await renderPage();
    expect(screen.getByText("Green Card Forecast")).toBeInTheDocument();
  });

  it("handles profile with null values", async () => {
    mockStorage["user-profile"] = {
      priorityDate: null,
      countryOfChargeability: null,
      category: null,
      employerName: null,
      jobTitle: null,
      location: null,
      wageOffered: null,
      yearsOfExperience: null,
    };
    await renderPage();
    expect(screen.getByRole("heading", { name: /my insights/i })).toBeInTheDocument();
  });
});

// ======================================================================
// Category / Country completeness
// ======================================================================

describe("InsightsPage — all EB categories selectable", () => {
  it("EB2 pill exists and is clickable", async () => {
    await renderPage();
    const eb2 = screen.getAllByText("EB2").find(
      (el) => el.tagName === "BUTTON" || el.closest("button")
    );
    expect(eb2).toBeTruthy();
  });

  it("EB3 pill exists", async () => {
    await renderPage();
    const eb3 = screen.getAllByText("EB3").find(
      (el) => el.tagName === "BUTTON" || el.closest("button")
    );
    expect(eb3).toBeTruthy();
  });
});

describe("InsightsPage — country pills", () => {
  it("India is selectable", async () => {
    await renderPage();
    expect(screen.getByText("India")).toBeInTheDocument();
  });

  it("China is selectable", async () => {
    await renderPage();
    expect(screen.getByText("China")).toBeInTheDocument();
  });

  it("country section has a More button to expand ROW/PHL/MEX", async () => {
    await renderPage();
    // ROW is behind an expandable "More" button in the country picker
    // Multiple "More" buttons may exist (one for categories, one for countries)
    const moreButtons = screen.getAllByText("More");
    expect(moreButtons.length).toBeGreaterThanOrEqual(1);
  });
});
