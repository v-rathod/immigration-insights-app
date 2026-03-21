/**
 * Tests for SRS dashboard components.
 *
 * Tests EmployerSearch, SrsScoreGauge, EmployerDetailCard,
 * SrsTrendChart, and SrsOverview.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/employer",
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

// Mock framer-motion
vi.mock("framer-motion", async () => {
  const ReactMod = await import("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_, tag: string) => {
          return ReactMod.forwardRef(
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
              const motionKeys = new Set([
                "variants",
                "initial",
                "animate",
                "exit",
                "whileHover",
                "whileTap",
                "whileInView",
                "transition",
                "layout",
                "layoutId",
                "onAnimationComplete",
                "strokeDasharray",
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
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useSpring: () => ({ set: vi.fn(), get: () => 0 }),
    useTransform: (_: unknown, fn: (v: number) => unknown) => {
      try { return fn(0); } catch { return "0"; }
    },
    useInView: () => true,
  };
});

// Mock Fuse.js
vi.mock("fuse.js", () => {
  return {
    default: class MockFuse<T> {
      private items: T[];
      constructor(items: T[]) {
        this.items = items;
      }
      search(query: string, options?: { limit?: number }) {
        const limit = options?.limit ?? 10;
        const results = this.items
          .filter((item) => {
            const name = (item as Record<string, unknown>).employer_name as string;
            return name?.toLowerCase().includes(query.toLowerCase());
          })
          .slice(0, limit)
          .map((item) => ({ item, score: 0.1 }));
        return results;
      }
    },
  };
});

// Mock recharts
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="chart-area" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import type { SponsorReliabilityScore, EmployerMonthlyMetric, EmployerRiskFeature } from "@/types/p2-artifacts";
import type { SrsOverviewStats } from "@/lib/data/srs";

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeSrs(overrides: Partial<SponsorReliabilityScore> = {}): SponsorReliabilityScore {
  return {
    employer_id: "abc123",
    employer_name: "Acme Corp",
    scope: "overall",
    soc_code: null,
    n_12m: 10,
    n_24m: 20,
    n_36m: 30,
    approval_rate_24m: 0.95,
    denial_rate_24m: 0.05,
    approval_rate_36m: 0.94,
    denial_rate_36m: 0.06,
    wage_ratio_med: 1.1,
    wage_ratio_p75: 0.9,
    outcome_subscore: 90,
    wage_subscore: 75,
    sustainability_subscore: 60,
    srs: 82,
    srs_tier: "Good",
    months_active_24m: 12,
    months_active_36m: 18,
    soc_breadth_24m: 5,
    site_breadth_24m: 3,
    approval_rate_trend_12v12: 0.02,
    outcome_volatility: 0.01,
    lca_filings_36m: 25,
    lca_approval_rate_36m: 1.0,
    lca_median_wage: 120000,
    lca_wage_ratio: 1.05,
    lca_to_perm_ratio: 0.83,
    last_refreshed_at: "2026-02-26",
    ...overrides,
  };
}

function makeMetric(overrides: Partial<EmployerMonthlyMetric> = {}): EmployerMonthlyMetric {
  return {
    employer_id: "abc123",
    employer_name: "Acme Corp",
    month: "2024-06-01",
    filings: 5,
    approvals: 4,
    denials: 1,
    approval_rate: 0.8,
    denial_rate: 0.2,
    audit_rate_t12: 0.9,
    dataset: "PERM",
    ...overrides,
  };
}

const mockStats: SrsOverviewStats = {
  totalEmployers: 70206,
  ratedEmployers: 14280,
  excellentCount: 579,
  goodCount: 7640,
  moderateCount: 5696,
  belowAverageCount: 95,
  poorCount: 270,
  unratedCount: 55926,
  avgScore: 73.5,
  medianScore: 74.2,
  warnFlaggedCount: 668,
};

// ═══════════════════════════════════════════════════════════════════════════
// EmployerSearch
// ═══════════════════════════════════════════════════════════════════════════

import { EmployerSearch } from "@/components/srs/employer-search";

describe("EmployerSearch", () => {
  it("renders search input with placeholder", () => {
    render(<EmployerSearch employers={[]} onSelect={vi.fn()} />);
    expect(
      screen.getByPlaceholderText("Search 70,000+ employers…")
    ).toBeDefined();
  });

  it("has combobox role and aria attributes", () => {
    render(<EmployerSearch employers={[]} onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows results on search", async () => {
    const employers = [
      makeSrs({ employer_name: "Google LLC" }),
      makeSrs({ employer_name: "Meta Platforms", employer_id: "def" }),
      makeSrs({ employer_name: "Apple Inc", employer_id: "ghi" }),
    ];
    const onSelect = vi.fn();

    render(<EmployerSearch employers={employers} onSelect={onSelect} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Google" } });

    await waitFor(() => {
      expect(screen.getByText("Google LLC")).toBeDefined();
    });
  });

  it("calls onSelect when result clicked", async () => {
    const employers = [makeSrs({ employer_name: "Google LLC" })];
    const onSelect = vi.fn();

    render(<EmployerSearch employers={employers} onSelect={onSelect} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Google" } });

    await waitFor(() => {
      const result = screen.getByText("Google LLC");
      fireEvent.click(result);
    });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ employer_name: "Google LLC" })
    );
  });

  it("shows clear button when query present", () => {
    render(<EmployerSearch employers={[]} onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");

    // No clear button initially
    expect(screen.queryByLabelText("Clear search")).toBeNull();

    fireEvent.change(input, { target: { value: "test" } });
    expect(screen.getByLabelText("Clear search")).toBeDefined();
  });

  it("clears search on clear button click", () => {
    render(<EmployerSearch employers={[]} onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.click(screen.getByLabelText("Clear search"));

    expect(input.value).toBe("");
  });

  // ── Case count display ────────────────────────────────────────────────────

  it("shows correct case count from n_36m when populated", async () => {
    // This verifies the fix: SRS page must map total_filings → n_36m when building
    // asScores, otherwise the search shows "0 cases" for every employer.
    const employers = [
      makeSrs({ employer_name: "Optum Services", employer_id: "optum1", n_36m: 1928 }),
    ];
    render(<EmployerSearch employers={employers} onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Optum" } });

    await waitFor(() => {
      expect(screen.getByText(/1,928 cases/)).toBeDefined();
    });
  });

  it("shows 0 cases when n_36m is zero (not populated)", async () => {
    const employers = [
      makeSrs({ employer_name: "Small Tech", employer_id: "small1", n_36m: 0 }),
    ];
    render(<EmployerSearch employers={employers} onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Small" } });

    await waitFor(() => {
      expect(screen.getByText(/0 cases/)).toBeDefined();
    });
  });

  it("formats large case counts with thousand separators", async () => {
    const employers = [
      makeSrs({ employer_name: "Cognizant Technology", employer_id: "cog1", n_36m: 15000 }),
    ];
    render(<EmployerSearch employers={employers} onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Cognizant" } });

    await waitFor(() => {
      expect(screen.getByText(/15,000 cases/)).toBeDefined();
    });
  });

  // ── Smart sort — volume ranking ───────────────────────────────────────────

  it("smart sort ranks higher-volume employer above lower-volume", async () => {
    // Both have equal Fuse text score (mock returns 0.1 for all).
    // "Optum Services" has n_36m=1928; "Optum Technology" has n_36m=10.
    // sortEmployerResults composite: volume accounts for 20%, pushing
    // Optum Services ahead despite identical text match quality.
    const employers = [
      makeSrs({ employer_name: "Optum Services",   employer_id: "optum1", n_36m: 1928, srs: 85 }),
      makeSrs({ employer_name: "Optum Technology", employer_id: "optum2", n_36m: 10,   srs: 90 }),
    ];
    render(<EmployerSearch employers={employers} onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Optum" } });

    await waitFor(() => {
      const options = screen.getAllByRole("option");
      // Higher-volume employer must appear first in the list
      expect(options[0].textContent).toContain("Optum Services");
    });
  });

  it("smart sort falls back gracefully when all n_36m are zero", async () => {
    // Without the SRS page fix all employers would have n_36m=0.
    // Sort should still return results (not throw) — just text-only ranking.
    const employers = [
      makeSrs({ employer_name: "Alpha Inc",  employer_id: "a1", n_36m: 0 }),
      makeSrs({ employer_name: "Beta Corp",  employer_id: "b1", n_36m: 0 }),
    ];
    render(<EmployerSearch employers={employers} onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Alpha" } });

    await waitFor(() => {
      // At minimum, the matched employer appears
      expect(screen.getByText("Alpha Inc")).toBeDefined();
    });
  });

  it("pre-populates search box with initialValue (URL parameter case)", async () => {
    // Simulates home page → employer dashboard redirect with ?q=Google
    // The dashboard passes initialValue="Google" to EmployerSearch
    const employers = [
      makeSrs({ employer_name: "Google LLC", employer_id: "ghi789", n_36m: 35000, srs: 81 }),
      makeSrs({ employer_name: "Microsoft Corporation", employer_id: "abc123", n_36m: 50000, srs: 76 }),
    ];
    const onSelect = vi.fn();
    
    render(
      <EmployerSearch 
        employers={employers} 
        onSelect={onSelect}
        initialValue="Google LLC"
      />
    );
    
    const input = screen.getByRole("combobox") as HTMLInputElement;
    
    // Search box should be pre-populated with "Google LLC"
    expect(input.value).toBe("Google LLC");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SrsScoreGauge
// ═══════════════════════════════════════════════════════════════════════════

import { SrsScoreGauge } from "@/components/srs/score-gauge";

describe("SrsScoreGauge", () => {
  it("renders gauge with accessible label for rated employer", () => {
    render(
      <SrsScoreGauge
        score={82}
        tier="Good"
        subscores={{ outcome: 90, wage: 75, sustainability: 60 }}
      />
    );

    const gauge = screen.getByRole("img");
    expect(gauge.getAttribute("aria-label")).toContain("82");
    expect(gauge.getAttribute("aria-label")).toContain("Good");
  });

  it("shows Unrated for null score", () => {
    render(
      <SrsScoreGauge
        score={null}
        tier="Unrated"
        subscores={{ outcome: 0, wage: 0, sustainability: 0 }}
      />
    );

    expect(screen.getByText("Unrated")).toBeDefined();
  });

  it("renders subscore bars for rated employer", () => {
    render(
      <SrsScoreGauge
        score={82}
        tier="Good"
        subscores={{ outcome: 90, wage: 75, sustainability: 60 }}
      />
    );

    expect(screen.getByText("Approval Outcomes")).toBeDefined();
    expect(screen.getByText("Wage Competitiveness")).toBeDefined();
    expect(screen.getByText("Sustainability")).toBeDefined();
  });

  it("shows ML score badge when provided", () => {
    render(
      <SrsScoreGauge
        score={82}
        tier="Good"
        subscores={{ outcome: 90, wage: 75, sustainability: 60 }}
        mlScore={91}
      />
    );

    expect(screen.getByText(/ML Score: 91/)).toBeDefined();
  });

  it("hides ML badge when not provided", () => {
    render(
      <SrsScoreGauge
        score={82}
        tier="Good"
        subscores={{ outcome: 90, wage: 75, sustainability: 60 }}
      />
    );

    expect(screen.queryByText(/ML Score/)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EmployerDetailCard
// ═══════════════════════════════════════════════════════════════════════════

import { EmployerDetailCard } from "@/components/srs/employer-detail-card";

describe("EmployerDetailCard", () => {
  it("renders key metrics heading", () => {
    render(<EmployerDetailCard employer={makeSrs()} />);
    expect(screen.getByText("Key Metrics")).toBeDefined();
  });

  it("displays approval and denial rates", () => {
    render(
      <EmployerDetailCard
        employer={makeSrs({ approval_rate_36m: 0.95, denial_rate_36m: 0.05 })}
      />
    );

    expect(screen.getByText("95.0%")).toBeDefined();
    expect(screen.getByText("5.0%")).toBeDefined();
  });

  it("shows case count", () => {
    render(<EmployerDetailCard employer={makeSrs({ n_36m: 150 })} />);
    expect(screen.getByText("150")).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SrsTrendChart
// ═══════════════════════════════════════════════════════════════════════════

import { SrsTrendChart } from "@/components/srs/trend-chart";

describe("SrsTrendChart", () => {
  it("renders chart with title", () => {
    render(
      <SrsTrendChart
        metrics={[makeMetric()]}
        employerName="Acme Corp"
      />
    );
    expect(screen.getByText("Filing Trends")).toBeDefined();
    expect(screen.getByText(/Acme Corp/)).toBeDefined();
  });

  it("shows empty message when no data", () => {
    render(
      <SrsTrendChart metrics={[]} employerName="Acme Corp" />
    );
    expect(screen.getByText(/No monthly filing data/)).toBeDefined();
  });

  it("renders chart container when data present", () => {
    render(
      <SrsTrendChart
        metrics={[makeMetric(), makeMetric({ month: "2024-07-01" })]}
        employerName="Acme Corp"
      />
    );
    expect(screen.getByTestId("chart-container")).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SrsOverview
// ═══════════════════════════════════════════════════════════════════════════

import { SrsOverview } from "@/components/srs/srs-overview";
import { ThemeProvider } from "@/components/providers/theme-provider";

describe("SrsOverview", () => {
  function renderOverview() {
    return render(
      <ThemeProvider>
        <SrsOverview stats={mockStats} />
      </ThemeProvider>
    );
  }

  it("renders score distribution heading", () => {
    renderOverview();
    expect(screen.getByText("Score Distribution")).toBeDefined();
  });

  it("renders all tier labels", () => {
    renderOverview();
    expect(screen.getByText("Excellent")).toBeDefined();
    expect(screen.getByText("Good")).toBeDefined();
    expect(screen.getByText("Moderate")).toBeDefined();
    expect(screen.getByText("Below Avg")).toBeDefined();
    expect(screen.getByText("Poor")).toBeDefined();
  });
});
