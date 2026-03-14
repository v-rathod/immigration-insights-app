/**
 * Tests for the 5 new dashboard pages:
 *   - EB Category (/dashboard/eb-category/)
 *   - Geographic (/dashboard/geographic/)
 *   - Occupation Demand (/dashboard/job-demand/)
 *   - Processing Speed (/dashboard/processing/)
 *   - Backlog Visualization (/dashboard/backlog/)
 *
 * Each page is async (useEffect + fetch) so we wait for loading to complete.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ── Navigation Mocks ──────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/eb-category",
}));

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

// ── Framer Motion Mock ────────────────────────────────────────────────────

vi.mock("framer-motion", async () => {
  const R = await import("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_, tag: string) => {
          return R.forwardRef(
            (
              {
                children,
                className,
                style,
                ...rest
              }: {
                children?: React.ReactNode;
                className?: string;
                style?: React.CSSProperties;
                [key: string]: unknown;
              },
              ref: React.Ref<HTMLElement>
            ) => {
              const skip = new Set([
                "variants", "initial", "animate", "exit",
                "whileHover", "whileTap", "whileInView",
                "transition", "layout", "layoutId",
                "onAnimationComplete", "strokeDasharray",
              ]);
              const htmlProps: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(rest)) {
                if (!skip.has(k)) htmlProps[k] = v;
              }
              return R.createElement(tag, { ref, className, style, ...htmlProps }, children);
            }
          );
        },
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useSpring: () => ({ set: vi.fn(), get: () => 0 }),
    useTransform: (_: unknown, fn: (v: number) => unknown) => {
      try { return fn(0); } catch { return "0"; }
    },
    useInView: () => true,
  };
});

// ── Recharts Mock ─────────────────────────────────────────────────────────

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="composed-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  Cell: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
  Legend: () => <div />,
}));

// ── Data Loader Mocks ─────────────────────────────────────────────────────

// EB Category
const mockMovementData = [
  {
    bulletin_year: 2025, bulletin_month: 1, chart: "DFF", category: "EB1",
    country: "IND", avg_monthly_advancement_days: 20, median_advancement_days: 18,
    volatility_score: 0.2, retrogression_events_12m: 0, next_movement_prediction: "Advance",
    blended_velocity: 22, net_velocity: 18,
  },
  {
    bulletin_year: 2025, bulletin_month: 1, chart: "DFF", category: "EB2",
    country: "IND", avg_monthly_advancement_days: 10, median_advancement_days: 8,
    volatility_score: 0.5, retrogression_events_12m: 1, next_movement_prediction: "Slow",
    blended_velocity: 12, net_velocity: 9,
  },
  {
    bulletin_year: 2025, bulletin_month: 1, chart: "DFF", category: "EB3",
    country: "IND", avg_monthly_advancement_days: 5, median_advancement_days: 4,
    volatility_score: 0.8, retrogression_events_12m: 2, next_movement_prediction: "Retrogress",
    blended_velocity: 7, net_velocity: 5,
  },
  {
    bulletin_year: 2025, bulletin_month: 1, chart: "DFF", category: "EB1",
    country: "CHN", avg_monthly_advancement_days: 15, median_advancement_days: 12,
    volatility_score: 0.3, retrogression_events_12m: 0, next_movement_prediction: "Advance",
    blended_velocity: 17, net_velocity: 14,
  },
  {
    bulletin_year: 2025, bulletin_month: 1, chart: "DFF", category: "EB2",
    country: "CHN", avg_monthly_advancement_days: 8, median_advancement_days: 6,
    volatility_score: 0.4, retrogression_events_12m: 1, next_movement_prediction: "Slow",
    blended_velocity: 10, net_velocity: 7,
  },
];

vi.mock("@/lib/data/eb-category", async () => {
  const actual = await vi.importActual("@/lib/data/eb-category");
  return {
    ...actual,
    loadCategoryMovement: vi.fn(() => Promise.resolve(mockMovementData)),
  };
});

// Geographic
const mockGeoData = [
  {
    state: "CA", filings_count: 50000, approvals_count: 45000,
    offered_median: 135000, distinct_employers: 2000, dataset: "PERM",
    grain: "state", area_code: "", soc_code: "", filings_count_soc_area: 0,
    offered_median_soc_area: 0, city: "", competitiveness_ratio: 0.9,
  },
  {
    state: "TX", filings_count: 20000, approvals_count: 18000,
    offered_median: 110000, distinct_employers: 800, dataset: "PERM",
    grain: "state", area_code: "", soc_code: "", filings_count_soc_area: 0,
    offered_median_soc_area: 0, city: "", competitiveness_ratio: 0.75,
  },
];

vi.mock("@/lib/data/geographic", async () => {
  const actual = await vi.importActual("@/lib/data/geographic");
  return {
    ...actual,
    loadGeoMetrics: vi.fn(() => Promise.resolve(mockGeoData)),
  };
});

// SOC Demand
const mockSocDemandData = [
  {
    soc_code: "15-1252", window: "12m", dataset: "PERM", filings_count: 5000,
    approvals_count: 4500, approval_rate: 0.9, offered_avg: 130000,
    offered_median: 125000, competitiveness_percentile: 0.85, top_employers_json: "[]",
  },
  {
    soc_code: "11-1021", window: "12m", dataset: "PERM", filings_count: 3000,
    approvals_count: 2700, approval_rate: 0.9, offered_avg: 150000,
    offered_median: 145000, competitiveness_percentile: 0.75, top_employers_json: "[]",
  },
];

const mockDimSocData = [
  { soc_code: "15-1252", soc_title: "Software Developers", soc_major: "15", soc_major_title: "Computer and Mathematical", soc_group: null, soc_group_title: null, soc_broad: null, soc_broad_title: null, soc_version: "2018", is_legacy: false, mapped_2018_code: null, mapped_2018_title: null },
  { soc_code: "11-1021", soc_title: "General and Operations Managers", soc_major: "11", soc_major_title: "Management", soc_group: null, soc_group_title: null, soc_broad: null, soc_broad_title: null, soc_version: "2018", is_legacy: false, mapped_2018_code: null, mapped_2018_title: null },
];

vi.mock("@/lib/data/soc-demand", async () => {
  const actual = await vi.importActual("@/lib/data/soc-demand");
  return {
    ...actual,
    loadSocDemand: vi.fn(() => Promise.resolve(mockSocDemandData)),
    loadDimSoc: vi.fn(() => Promise.resolve(mockDimSocData)),
  };
});

// Processing
const mockProcessingData = [
  {
    fiscal_year: 2024, quarter: 1, reporting_period: "FY2024 Q1", form_type: "I-485",
    period_end_date: "2024-03-31", category: "Employment-based",
    eb_received: null, eb_approved: 50000, eb_denied: 5000,
    eb_pending: 500000, total_received: null, total_approved: null,
    total_denied: null, total_pending: null,
    approval_rate: 0.91, throughput: 55000, net_intake: null,
    backlog_months: 10, pending_change: -0.05, throughput_change: 0.1,
  },
];

const mockUscisData = [
  { fiscal_year: "FY2024", form: "I-485", category: "EB", approvals: 50000, denials: 5000, source_file: "uscis_q1.csv", ingested_at: "2024-01-01" },
  { fiscal_year: "FY2024", form: "I-140", category: "EB", approvals: 30000, denials: 2000, source_file: "uscis_q1.csv", ingested_at: "2024-01-01" },
];

vi.mock("@/lib/data/processing", async () => {
  const actual = await vi.importActual("@/lib/data/processing");
  return {
    ...actual,
    loadProcessingTrends: vi.fn(() => Promise.resolve(mockProcessingData)),
    loadUscisApprovals: vi.fn(() => Promise.resolve(mockUscisData)),
  };
});

// Backlog
const mockBacklogData = [
  {
    bulletin_year: 2025, bulletin_month: 1, chart: "DFF", category: "EB1",
    country: "IND", inflow_estimate_12m: 3000, advancement_days_12m_avg: 30,
    blended_velocity: 25, backlog_months_to_clear_est: 24,
  },
  {
    bulletin_year: 2025, bulletin_month: 1, chart: "DFF", category: "EB2",
    country: "IND", inflow_estimate_12m: 5000, advancement_days_12m_avg: 15,
    blended_velocity: 12, backlog_months_to_clear_est: 120,
  },
  {
    bulletin_year: 2025, bulletin_month: 1, chart: "DFF", category: "EB3",
    country: "IND", inflow_estimate_12m: 4000, advancement_days_12m_avg: 10,
    blended_velocity: 8, backlog_months_to_clear_est: 180,
  },
];

const mockQueueDepthData = [
  {
    category: "EB2", country: "IND", pd_month: "2020-03",
    perm_filings_certified: 1000, eb_category_ratio: 0.4,
    est_category_filings: 400, est_applicants_with_dependents: 600,
    current_cutoff_date: "2015-01-01", is_ahead_of_cutoff: false,
    annual_visa_allocation: 2800, velocity_days_per_month: 15,
    cumulative_ahead: 50000, est_wait_years: 10, est_months_to_current: 120,
    confidence: "medium", generated_at: "2025-01-01",
  },
];

vi.mock("@/lib/data/backlog", async () => {
  const actual = await vi.importActual("@/lib/data/backlog");
  return {
    ...actual,
    loadBacklogEstimates: vi.fn(() => Promise.resolve(mockBacklogData)),
    loadQueueDepth: vi.fn(() => Promise.resolve(mockQueueDepthData)),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// EB Category Dashboard
// ═══════════════════════════════════════════════════════════════════════════

import EBCategoryPage from "@/app/dashboard/eb-category/page";

describe("EB Category Dashboard", () => {
  it("renders page header", async () => {
    render(<EBCategoryPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("EB Category Comparison");
  });

  it("shows breadcrumb", async () => {
    render(<EBCategoryPage />);
    await waitFor(() => {
      expect(screen.getByText("Dashboards")).toBeTruthy();
    });
  });

  it("renders country selector pills", async () => {
    render(<EBCategoryPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getAllByText("India").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("China").length).toBeGreaterThanOrEqual(1);
  });

  it("renders chart type toggle", async () => {
    render(<EBCategoryPage />);
    await waitFor(() => {
      expect(screen.getByText("Dates for Filing")).toBeTruthy();
    });
    expect(screen.getByText("Final Action")).toBeTruthy();
  });

  it("displays EB1/EB2/EB3 summary cards", async () => {
    render(<EBCategoryPage />);
    await waitFor(() => {
      expect(screen.getByText("EB1")).toBeTruthy();
    });
    expect(screen.getByText("EB2")).toBeTruthy();
    expect(screen.getByText("EB3")).toBeTruthy();
  });

  it("renders velocity chart section", async () => {
    render(<EBCategoryPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getByText("Priority Date Velocity (12-Month Rolling Avg)")).toBeTruthy();
  });

  it("renders methodology section", async () => {
    render(<EBCategoryPage />);
    await waitFor(() => {
      expect(screen.getByText("Methodology & Data Sources")).toBeTruthy();
    });
  });

  it("handles country selection", async () => {
    render(<EBCategoryPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    const chinaButtons = screen.getAllByText("China");
    fireEvent.click(chinaButtons[0]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Geographic Dashboard
// ═══════════════════════════════════════════════════════════════════════════

import GeographicPage from "@/app/dashboard/geographic/page";

describe("Geographic Dashboard", () => {
  it("renders page header", async () => {
    render(<GeographicPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Geographic Heatmaps");
  });

  it("renders state bar chart section", async () => {
    render(<GeographicPage />);
    await waitFor(() => {
      expect(screen.getByText(/Top.*States/)).toBeTruthy();
    });
  });

  it("shows dataset selector pills", async () => {
    render(<GeographicPage />);
    await waitFor(() => {
      expect(screen.getByText("PERM")).toBeTruthy();
    });
  });

  it("renders KPI cards", async () => {
    render(<GeographicPage />);
    await waitFor(() => {
      expect(screen.getByText("States")).toBeTruthy();
    });
  });

  it("renders data table", async () => {
    render(<GeographicPage />);
    await waitFor(() => {
      // California should appear in state data
      expect(screen.getByText("California")).toBeTruthy();
    });
    expect(screen.getByText("Texas")).toBeTruthy();
  });

  it("renders methodology section", async () => {
    render(<GeographicPage />);
    await waitFor(() => {
      expect(screen.getByText("Methodology & Data Sources")).toBeTruthy();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Occupation Demand (Job Demand) Dashboard
// ═══════════════════════════════════════════════════════════════════════════

import JobDemandPage from "@/app/dashboard/job-demand/page";

describe("Occupation Demand Dashboard", () => {
  it("renders page header", async () => {
    render(<JobDemandPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Occupation Demand");
  });

  it("renders window selector pills", async () => {
    render(<JobDemandPage />);
    await waitFor(() => {
      expect(screen.getByText("1 Year")).toBeTruthy();
    });
  });

  it("renders source selector pills", async () => {
    render(<JobDemandPage />);
    await waitFor(() => {
      expect(screen.getByText("PERM")).toBeTruthy();
    });
  });

  it("renders top occupations chart section", async () => {
    render(<JobDemandPage />);
    await waitFor(() => {
      expect(screen.getByText(/Top.*Occupations/)).toBeTruthy();
    });
  });

  it("shows search box for occupations", async () => {
    render(<JobDemandPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
    });
  });

  it("renders methodology section", async () => {
    render(<JobDemandPage />);
    await waitFor(() => {
      expect(screen.getByText("Methodology & Data Sources")).toBeTruthy();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Processing Speed Dashboard
// ═══════════════════════════════════════════════════════════════════════════

import ProcessingPage from "@/app/dashboard/processing/page";

describe("Processing Speed Dashboard", () => {
  it("renders page header", async () => {
    render(<ProcessingPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Processing Speed");
  });

  it("renders KPI cards with values", async () => {
    render(<ProcessingPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getByText("Latest Approval Rate")).toBeTruthy();
    expect(screen.getByText("EB Pending Cases")).toBeTruthy();
  });

  it("renders I-485 trend chart section", async () => {
    render(<ProcessingPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getAllByText(/I-485.*Trend/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders USCIS form table", async () => {
    render(<ProcessingPage />);
    await waitFor(() => {
      expect(screen.getByText("I-485")).toBeTruthy();
    });
    expect(screen.getByText("I-140")).toBeTruthy();
  });

  it("renders methodology section", async () => {
    render(<ProcessingPage />);
    await waitFor(() => {
      expect(screen.getByText("Methodology & Data Sources")).toBeTruthy();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Backlog Visualization Dashboard
// ═══════════════════════════════════════════════════════════════════════════

import BacklogPage from "@/app/dashboard/backlog/page";

describe("Backlog Visualization Dashboard", () => {
  it("renders page header", async () => {
    render(<BacklogPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Backlog Visualization");
  });

  it("renders country selector pills", async () => {
    render(<BacklogPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getAllByText("India").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("China").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Rest of World").length).toBeGreaterThanOrEqual(1);
  });

  it("renders chart type toggle", async () => {
    render(<BacklogPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getAllByText("Dates for Filing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Final Action").length).toBeGreaterThanOrEqual(1);
  });

  it("displays EB1/EB2/EB3 summary cards", async () => {
    render(<BacklogPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getAllByText("EB1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("EB2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("EB3").length).toBeGreaterThanOrEqual(1);
  });

  it("shows years-to-clear chart section", async () => {
    render(<BacklogPage />);
    await waitFor(() => {
      expect(screen.getByText("Years to Clear Backlog")).toBeTruthy();
    });
  });

  it("shows queue position lookup section", async () => {
    render(<BacklogPage />);
    await waitFor(() => {
      expect(screen.getByText("Queue Position Lookup")).toBeTruthy();
    });
  });

  it("shows empty state when no PD entered", async () => {
    render(<BacklogPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    expect(screen.getAllByText(/Enter your priority date/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders methodology section", async () => {
    render(<BacklogPage />);
    await waitFor(() => {
      expect(screen.getByText("Methodology & Data Sources")).toBeTruthy();
    });
  });

  it("handles country selection", async () => {
    render(<BacklogPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });
    const chinaButtons = screen.getAllByText("China");
    fireEvent.click(chinaButtons[0]);
    // Should update without error
  });
});
