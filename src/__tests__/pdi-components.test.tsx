import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { PdForecast } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Mock dependencies
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

const mockLoadPdForecasts = vi.fn();
vi.mock("@/lib/data/pdi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/pdi")>(
    "@/lib/data/pdi"
  );
  return {
    ...actual,
    loadPdForecasts: (...args: unknown[]) => mockLoadPdForecasts(...args),
  };
});

// Mock framer-motion
vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_, tag: string) => {
          const Component = React.forwardRef(
            (
              {
                children,
                className,
                ...rest
              }: {
                children?: React.ReactNode;
                className?: string;
                [key: string]: unknown;
              },
              ref: React.Ref<HTMLElement>
            ) => {
              const htmlProps: Record<string, unknown> = {};
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
                "pathLength",
              ]);
              for (const [k, v] of Object.entries(rest)) {
                if (!motionKeys.has(k)) htmlProps[k] = v;
              }
              return React.createElement(
                tag,
                { ref, className, ...htmlProps },
                children
              );
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

import { PdiQuickLook } from "@/components/pdi/pdi-quick-look";
import { SrsTeaser } from "@/components/pdi/srs-teaser";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeForecast(overrides: Partial<PdForecast> = {}): PdForecast {
  return {
    forecast_month: "2026-04",
    months_ahead: 1,
    chart: "DFF",
    category: "EB2",
    country: "IND",
    projected_cutoff_date: "2015-01-01",
    confidence_low: "2014-06-01",
    confidence_high: "2015-06-01",
    velocity_days_per_month: 17.5,
    cumulative_advancement_days: 17.5,
    ...overrides,
  };
}

function buildMockForecasts(): PdForecast[] {
  const series: PdForecast[] = [];
  for (const chart of ["DFF", "FAD"]) {
    for (const category of ["EB1", "EB2", "EB3"]) {
      for (const country of ["IND", "CHN", "ROW", "PHL", "MEX"]) {
        for (let i = 1; i <= 3; i++) {
          const baseDate = new Date("2015-01-01");
          baseDate.setDate(baseDate.getDate() + 17 * i);
          series.push(
            makeForecast({
              chart,
              category,
              country,
              months_ahead: i,
              forecast_month: `2026-${String(3 + i).padStart(2, "0")}`,
              projected_cutoff_date: baseDate.toISOString().slice(0, 10),
              cumulative_advancement_days: 17 * i,
              velocity_days_per_month: 17,
            })
          );
        }
      }
    }
  }
  return series;
}

// ---------------------------------------------------------------------------
// PdiQuickLook Tests
// ---------------------------------------------------------------------------

describe("PdiQuickLook", () => {
  beforeEach(() => {
    mockLoadPdForecasts.mockReset();
  });

  it("shows loading skeleton initially", () => {
    mockLoadPdForecasts.mockReturnValue(new Promise(() => {})); // never resolves
    render(<PdiQuickLook />);
    // Should have an animate-pulse skeleton
    const container = document.querySelector(".animate-pulse");
    expect(container).toBeInTheDocument();
  });

  it("renders PDI header and description", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildMockForecasts());
    render(<PdiQuickLook />);
    expect(await screen.findByText("Priority Date Cortex")).toBeInTheDocument();
    expect(await screen.findByText("PDI")).toBeInTheDocument();
  });

  it("renders category selector pills", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildMockForecasts());
    render(<PdiQuickLook />);
    expect(await screen.findByText("EB1")).toBeInTheDocument();
    expect(screen.getByText("EB2")).toBeInTheDocument();
    expect(screen.getByText("EB3")).toBeInTheDocument();
  });

  it("renders country selector pills", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildMockForecasts());
    render(<PdiQuickLook />);
    expect(await screen.findByText("India")).toBeInTheDocument();
    expect(screen.getByText("China (mainland)")).toBeInTheDocument();
    expect(screen.getByText("Rest of World")).toBeInTheDocument();
  });

  it("renders chart type toggles", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildMockForecasts());
    render(<PdiQuickLook />);
    expect(await screen.findByText("Date for Filing")).toBeInTheDocument();
    expect(screen.getByText("Final Action Date")).toBeInTheDocument();
  });

  it("shows velocity stats after data loads", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildMockForecasts());
    render(<PdiQuickLook />);
    // Wait for velocity stat to appear
    expect(await screen.findByText("Velocity")).toBeInTheDocument();
    expect(screen.getByText("days/mo")).toBeInTheDocument();
    expect(screen.getByText("Advancement")).toBeInTheDocument();
  });

  it("updates series when category is changed", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildMockForecasts());
    render(<PdiQuickLook />);
    // Wait for data to load
    await screen.findByText("Velocity");

    // Click EB1
    fireEvent.click(screen.getByText("EB1"));
    // Stats should still be visible (different series, same structure)
    await waitFor(() => {
      expect(screen.getByText("Velocity")).toBeInTheDocument();
    });
  });

  it("updates series when country is changed", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildMockForecasts());
    render(<PdiQuickLook />);
    await screen.findByText("Velocity");

    fireEvent.click(screen.getByText("China (mainland)"));
    await waitFor(() => {
      expect(screen.getByText("Velocity")).toBeInTheDocument();
    });
  });

  it("shows no-data fallback for missing combo", async () => {
    // Only EB2/IND/DFF exists
    const limited = [
      makeForecast({ months_ahead: 1 }),
      makeForecast({ months_ahead: 2 }),
    ];
    mockLoadPdForecasts.mockResolvedValue(limited);
    render(<PdiQuickLook />);
    await screen.findByText("Velocity"); // default combo loads

    // Switch to EB1 — no data
    fireEvent.click(screen.getByText("EB1"));
    expect(
      await screen.findByText("No forecast data for this combination")
    ).toBeInTheDocument();
  });

  it("has CTA link to visa bulletin dashboard", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildMockForecasts());
    render(<PdiQuickLook />);
    const link = await screen.findByText("Full forecast & analysis");
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "/dashboard/visa-bulletin/"
    );
  });

  it("applies className prop", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildMockForecasts());
    const { container } = render(<PdiQuickLook className="custom-class" />);
    await screen.findByText("Priority Date Cortex");
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SrsTeaser Tests
// ---------------------------------------------------------------------------

describe("SrsTeaser", () => {
  it("renders SRS header and description", () => {
    render(<SrsTeaser />);
    expect(screen.getByText("Sponsor Reliability Score")).toBeInTheDocument();
    expect(screen.getByText("SRS")).toBeInTheDocument();
  });

  it("renders highlight stats", () => {
    render(<SrsTeaser />);
    expect(screen.getByText("70,206")).toBeInTheDocument();
    expect(screen.getByText("1,695")).toBeInTheDocument();
    expect(screen.getByText("668")).toBeInTheDocument();
  });

  it("renders stat labels", () => {
    render(<SrsTeaser />);
    expect(screen.getByText("Employers Scored")).toBeInTheDocument();
    expect(screen.getByText("ML-Verified")).toBeInTheDocument();
    expect(screen.getByText("WARN Flagged")).toBeInTheDocument();
  });

  it("renders feature checklist", () => {
    render(<SrsTeaser />);
    expect(
      screen.getByText("Bayesian-adjusted approval rates")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Wage competitiveness vs. OEWS")
    ).toBeInTheDocument();
    expect(
      screen.getByText("WARN Act layoff risk signals")
    ).toBeInTheDocument();
    expect(
      screen.getByText("ML-verified scores (XGBoost)")
    ).toBeInTheDocument();
  });

  it("renders decorative gauge with score 72", () => {
    render(<SrsTeaser />);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("Good")).toBeInTheDocument();
  });

  it("renders search teaser placeholder", () => {
    render(<SrsTeaser />);
    expect(
      screen.getByText("Search 70,000+ employers…")
    ).toBeInTheDocument();
  });

  it("has CTA link to employer dashboard", () => {
    render(<SrsTeaser />);
    const link = screen.getByText("Explore employer scores");
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "/dashboard/employer/"
    );
  });

  it("applies className prop", () => {
    const { container } = render(<SrsTeaser className="test-cls" />);
    expect(container.querySelector(".test-cls")).toBeInTheDocument();
  });
});
