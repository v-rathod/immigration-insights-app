/**
 * Employer Dashboard — URL Pre-loading Tests
 *
 * Verifies that navigating to /dashboard/employer?q=<name> auto-selects
 * the matching employer and renders their score card without any manual
 * interaction. This covers the useEffect added to SrsDashboardPage that
 * reads useSearchParams() and calls handleSelect() on data load.
 *
 * Root cause that required this test: landing page quick-check links
 * encode the employer name as ?q=<name>, but the page previously never
 * read that parameter — so navigation silently did nothing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Hoist mock state so it is accessible inside vi.mock factory closures
const mockState = vi.hoisted(() => ({ q: null as string | null }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/employer",
  useSearchParams: () => ({
    get: (key: string) => (key === "q" ? mockState.q : null),
  }),
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

// Minimal framer-motion stub — passes children through for all motion.* tags
vi.mock("framer-motion", async () => {
  const ReactMod = await import("react");
  const motionKeys = new Set([
    "initial", "animate", "exit", "whileHover", "whileTap", "whileInView",
    "transition", "layout", "layoutId", "onAnimationComplete", "strokeDasharray",
  ]);
  const passthroughProxy = new Proxy(
    {},
    {
      get: (_t, tag: string) =>
        ReactMod.forwardRef(
          (
            { children, className, style, ...rest }: Record<string, unknown>,
            ref: unknown
          ) => {
            const htmlProps: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(rest)) {
              if (!motionKeys.has(k)) htmlProps[k] = v;
            }
            return ReactMod.createElement(
              tag,
              { ref, className, style, ...htmlProps },
              children as React.ReactNode
            );
          }
        ),
    }
  );
  return {
    motion: passthroughProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useSpring: () => ({ set: vi.fn(), get: () => 0 }),
    useTransform: (_: unknown, fn: (v: number) => unknown) => {
      try { return fn(0); } catch { return "0"; }
    },
    useInView: () => true,
  };
});

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

vi.mock("@/lib/analytics", () => ({
  analytics: {
    dashboardViewed: vi.fn(),
    employerSelected: vi.fn(),
  },
}));

// One realistic mock employer for all tests
vi.mock("@/lib/data/employer-shard", () => ({
  loadEmployerSearch: vi.fn(() =>
    Promise.resolve([
      {
        employer_name: "Acme Corp",
        employer_id: "acme123",
        total_filings: 500,
        n_soc_codes: 5,
        latest_median_salary: 120000,
        latest_year: 2024,
        srs_score: 82,
        srs_tier: "Good",
        activity_status: "active",
      },
    ])
  ),
  loadSrsOverview: vi.fn(() =>
    Promise.resolve({
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
    })
  ),
  // No shard available — triggers fallback path that uses search entry data
  loadEmployerShard: vi.fn(() => Promise.resolve(null)),
  extractSrsFromShard: vi.fn(() => null),
  extractMonthlyMetrics: vi.fn(() => []),
}));

vi.mock("@/lib/data/srs", () => ({
  loadSrsScoresML: vi.fn(() => Promise.resolve([])),
  loadEmployerRiskFeatures: vi.fn(() => Promise.resolve([])),
  getEmployerRisk: vi.fn(() => undefined),
}));

// Import the page under test after all mocks are registered
import SrsDashboardPage from "@/app/dashboard/employer/page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Employer Dashboard — URL parameter pre-loading", () => {
  beforeEach(() => {
    mockState.q = null;
  });

  it("renders search box without auto-selecting when no ?q= param present", async () => {
    render(<SrsDashboardPage />);

    await waitFor(
      () => {
        expect(
          screen.getByPlaceholderText(/Search .+ employers…/)
        ).toBeDefined();
      },
      { timeout: 3000 }
    );

    // Empty state message visible (no employer selected)
    expect(
      screen.getByText(/Search for an employer above to see their Sponsor/i)
    ).toBeDefined();
    // Detail section NOT rendered
    expect(screen.queryByText("Key Metrics")).toBeNull();
  });

  it("auto-selects employer when ?q= exactly matches an employer name", async () => {
    mockState.q = "Acme Corp";
    render(<SrsDashboardPage />);

    // After data loads: useEffect reads q, finds "Acme Corp", calls handleSelect.
    // handleSelect: loadEmployerShard returns null -> fallback sets selectedEmployer.
    // Page then renders employer name banner.
    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: "Acme Corp" })).toBeDefined();
      },
      { timeout: 3000 }
    );
  });

  it("auto-selects with case-insensitive match (acme corp -> Acme Corp)", async () => {
    mockState.q = "acme corp"; // lowercase variant
    render(<SrsDashboardPage />);

    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: "Acme Corp" })).toBeDefined();
      },
      { timeout: 3000 }
    );
  });

  it("does NOT auto-select when ?q= does not match any employer", async () => {
    mockState.q = "Nonexistent Company XYZ";
    render(<SrsDashboardPage />);

    // Wait for loading to finish
    await waitFor(
      () => {
        expect(
          screen.getByPlaceholderText(/Search .+ employers…/)
        ).toBeDefined();
      },
      { timeout: 3000 }
    );

    // No employer detail should be shown
    expect(screen.queryByText("Key Metrics")).toBeNull();
  });
});
