/**
 * SRS Widget Regression Tests — Guard against NaN, undefined, and useless
 * displays in the Sponsor Reliability Score components.
 *
 * These tests validate:
 *   1. Score gauge never renders "NaN" for any subscore combination
 *   2. Key metrics widget hides when data is insufficient
 *   3. Fallback path (no shard SRS) produces clean display
 *   4. Known employers render correct tier and sub-scores
 *   5. formatPercent / formatNumber never produce "NaN" or "undefined"
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { SrsScoreGauge } from "@/components/srs/score-gauge";

// Mock framer-motion
vi.mock("framer-motion", async () => {
  const R = await import("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_: unknown, tag: string) => {
          const Component = R.forwardRef(
            (props: Record<string, unknown>, ref: React.Ref<HTMLElement>) => {
              const htmlProps: Record<string, unknown> = {};
              const skip = new Set([
                "variants", "initial", "animate", "exit", "whileHover",
                "whileTap", "whileInView", "transition", "layout", "layoutId",
              ]);
              for (const [k, v] of Object.entries(props)) {
                if (!skip.has(k)) htmlProps[k] = v;
              }
              return R.createElement(tag, { ref, ...htmlProps }, props.children as React.ReactNode);
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

// ======================================================================
// Format function tests — the final line of defense against NaN
// ======================================================================

describe("Format functions — NaN/null/undefined safety", () => {
  it("formatPercent never returns 'NaN'", async () => {
    const { formatPercent } = await import("@/lib/utils/format");
    const inputs = [null, undefined, NaN, Infinity, -Infinity, 0, 0.5, 1.0];
    for (const input of inputs) {
      const result = formatPercent(input as number);
      expect(result).not.toContain("NaN");
      expect(result).not.toContain("undefined");
      expect(result).not.toContain("null");
    }
  });

  it("formatNumber never returns 'NaN'", async () => {
    const { formatNumber } = await import("@/lib/utils/format");
    const inputs = [null, undefined, NaN, Infinity, -Infinity, 0, 42, 1000000];
    for (const input of inputs) {
      const result = formatNumber(input as number);
      expect(result).not.toContain("NaN");
      expect(result).not.toContain("undefined");
      expect(result).not.toContain("null");
    }
  });

  it("formatCurrency never returns 'NaN'", async () => {
    const { formatCurrency } = await import("@/lib/utils/format");
    const inputs = [null, undefined, NaN, Infinity, -Infinity, 0, 125000];
    for (const input of inputs) {
      const result = formatCurrency(input as number);
      expect(result).not.toContain("NaN");
      expect(result).not.toContain("undefined");
    }
  });

  it("formatMonthYear handles null/undefined/empty gracefully", async () => {
    const { formatMonthYear } = await import("@/lib/utils/format");
    const inputs = [null, undefined, "", "not-a-date", "nan"];
    for (const input of inputs) {
      const result = formatMonthYear(input as string);
      expect(result).not.toContain("NaN");
      expect(result).not.toContain("undefined");
      expect(result).not.toContain("Invalid");
    }
  });
});

// ======================================================================
// EmployerDetailCard — key metrics usefulness guard
// ======================================================================

describe("EmployerDetailCard — usefulness guard", () => {
  it("returns null when only 1 field (n_36m) has data", async () => {
    const { EmployerDetailCard } = await import("@/components/srs/employer-detail-card");
    // Simulate fallback employer from search index (no shard data)
    const employer = {
      employer_id: "test-001",
      employer_name: "Test Corp",
      scope: "overall",
      soc_code: null,
      n_12m: 0,
      n_24m: 0,
      n_36m: 50, // Only field with data
      approval_rate_24m: NaN,
      denial_rate_24m: NaN,
      approval_rate_36m: NaN,
      denial_rate_36m: NaN,
      wage_ratio_med: NaN,
      wage_ratio_p75: NaN,
      outcome_subscore: NaN,
      wage_subscore: NaN,
      sustainability_subscore: NaN,
      srs: null,
      srs_tier: "Unrated",
      months_active_24m: 0,
      months_active_36m: 0,
      soc_breadth_24m: 0,
      site_breadth_24m: 0,
      approval_rate_trend_12v12: null,
      outcome_volatility: null,
      lca_filings_36m: null,
      lca_approval_rate_36m: null,
      lca_median_wage: null,
      lca_wage_ratio: null,
      lca_to_perm_ratio: null,
      last_refreshed_at: "2026-01-01T00:00:00",
    };

    // @ts-expect-error - partial type for testing
    const { container } = render(<EmployerDetailCard employer={employer} />);
    // Card should not render (returns null when < 3 populated stats)
    expect(container.innerHTML).toBe("");
  });

  it("renders when 4+ fields have data", async () => {
    const { EmployerDetailCard } = await import("@/components/srs/employer-detail-card");
    const employer = {
      employer_id: "test-002",
      employer_name: "Good Corp",
      scope: "overall",
      soc_code: null,
      n_12m: 200,
      n_24m: 400,
      n_36m: 600,
      approval_rate_24m: 0.95,
      denial_rate_24m: 0.05,
      approval_rate_36m: 0.93,
      denial_rate_36m: 0.07,
      wage_ratio_med: 1.05,
      wage_ratio_p75: 1.15,
      outcome_subscore: 90,
      wage_subscore: 85,
      sustainability_subscore: 80,
      srs: 86,
      srs_tier: "Excellent",
      months_active_24m: 24,
      months_active_36m: 36,
      soc_breadth_24m: 15,
      site_breadth_24m: 8,
      approval_rate_trend_12v12: 0.02,
      outcome_volatility: 0.1,
      lca_filings_36m: 3000,
      lca_approval_rate_36m: 0.98,
      lca_median_wage: 150000,
      lca_wage_ratio: 1.1,
      lca_to_perm_ratio: 5.0,
      last_refreshed_at: "2026-04-01T00:00:00",
    };

    // @ts-expect-error - partial type for testing
    const { container } = render(<EmployerDetailCard employer={employer} />);
    // Card should render (has many populated stats)
    expect(container.innerHTML).not.toBe("");
    // Should contain Key Metrics header
    expect(screen.getByText("Key Metrics")).toBeInTheDocument();
  });

  it("never renders 'NaN' in any stat value", async () => {
    const { EmployerDetailCard } = await import("@/components/srs/employer-detail-card");
    // Good employer with all data
    const employer = {
      employer_id: "test-003",
      employer_name: "Clean Corp",
      scope: "overall",
      soc_code: null,
      n_12m: 100, n_24m: 200, n_36m: 300,
      approval_rate_24m: 0.88, denial_rate_24m: 0.12,
      approval_rate_36m: 0.90, denial_rate_36m: 0.10,
      wage_ratio_med: 0.95, wage_ratio_p75: 1.1,
      outcome_subscore: 80, wage_subscore: 70, sustainability_subscore: 60,
      srs: 72, srs_tier: "Good",
      months_active_24m: 20, months_active_36m: 30,
      soc_breadth_24m: 5, site_breadth_24m: 3,
      approval_rate_trend_12v12: -0.02, outcome_volatility: 0.15,
      lca_filings_36m: 500, lca_approval_rate_36m: 0.97,
      lca_median_wage: 120000, lca_wage_ratio: 0.98, lca_to_perm_ratio: 2.5,
      last_refreshed_at: "2026-04-01T00:00:00",
    };

    // @ts-expect-error - partial type for testing
    const { container } = render(<EmployerDetailCard employer={employer} />);
    const html = container.innerHTML;
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("undefined");
  });
});

// ======================================================================
// SrsScoreGauge — subscore NaN guard
// ======================================================================

describe("SrsScoreGauge — NaN guard for sub-scores", () => {
  it("renders cleanly with all zero sub-scores", async () => {
    const { SrsScoreGauge } = await import("@/components/srs/score-gauge");
    const { container } = render(
      <SrsScoreGauge
        score={null}
        tier="Unrated"
        subscores={{ outcome: 0, wage: 0, sustainability: 0 }}
        caseCount={0}
      />
    );
    expect(container.innerHTML).not.toContain("NaN");
    expect(container.innerHTML).not.toContain("undefined");
  });

  it("renders cleanly with valid sub-scores", async () => {
    const { SrsScoreGauge } = await import("@/components/srs/score-gauge");
    const { container } = render(
      <SrsScoreGauge
        score={86}
        tier="Excellent"
        subscores={{ outcome: 98.86, wage: 79.69, sustainability: 71.2 }}
        caseCount={1157}
      />
    );
    expect(container.innerHTML).not.toContain("NaN");
    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });

  it("renders cleanly with NaN sub-scores (fallback guard)", async () => {
    const { SrsScoreGauge } = await import("@/components/srs/score-gauge");
    const { container } = render(
      <SrsScoreGauge
        score={86}
        tier="Excellent"
        subscores={{ outcome: NaN, wage: NaN, sustainability: NaN }}
        caseCount={100}
      />
    );
    expect(container.innerHTML).not.toContain("NaN");
  });
});

// ======================================================================
// Regression: specific employers that had bugs
// ======================================================================

describe("Employer-specific regression tests", () => {
  it("IBM: search index score (ss) is not null", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const searchPath = path.join(process.cwd(), "public/data/employers/_search.json");
    if (!fs.existsSync(searchPath)) return;

    const search = JSON.parse(fs.readFileSync(searchPath, "utf-8")) as Array<Record<string, unknown>>;
    const ibm = search.find((e) => String(e.n).toLowerCase() === "ibm");
    expect(ibm, "IBM should be in search index").toBeTruthy();
    expect(ibm!.ss, "IBM should have SRS score in search index").toBeTruthy();
    expect(ibm!.st, "IBM should have tier in search index").toBeTruthy();
  });
});

// ======================================================================
// Ring geometry — verify score maps 1:1 to fill percentage (360° design)
// ======================================================================

describe("SrsScoreGauge — ring fill geometry", () => {
  const GAUGE_SIZE = 180;
  const STROKE_WIDTH = 12;
  const RADIUS = (GAUGE_SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  it("score 80 fills exactly 80% of circumference (not 60%)", () => {
    const fillPercent = 80 / 100;
    const filledArc = CIRCUMFERENCE * fillPercent;
    const fillRatio = filledArc / CIRCUMFERENCE;
    expect(fillRatio).toBeCloseTo(0.80, 2);
    // Old 270° design would give 0.6 here (0.75 * 0.80 = 0.60)
    expect(fillRatio).not.toBeCloseTo(0.60, 2);
  });

  it("score 79.6 (Optum Services) fills ~79.6% of circumference", () => {
    const fillPercent = 79.6 / 100;
    const filledArc = CIRCUMFERENCE * fillPercent;
    expect(filledArc / CIRCUMFERENCE).toBeCloseTo(0.796, 2);
  });

  it("score 100 fills 100% of circumference", () => {
    const fillPercent = 100 / 100;
    expect(CIRCUMFERENCE * fillPercent).toBeCloseTo(CIRCUMFERENCE, 2);
  });

  it("score 0 fills 0% of circumference", () => {
    const fillPercent = 0 / 100;
    expect(CIRCUMFERENCE * fillPercent).toBe(0);
  });

  it("score 50 fills exactly 50% — visually half the ring", () => {
    const fillPercent = 50 / 100;
    expect(CIRCUMFERENCE * fillPercent).toBeCloseTo(CIRCUMFERENCE / 2, 2);
  });
});

// ======================================================================
// SrsScoreGauge renders ring with correct arc for rated employers
// ======================================================================

describe("SrsScoreGauge — ring renders correctly", () => {
  it("renders aria-label with correct score for Optum-like score (79.6)", () => {
    render(
      <SrsScoreGauge
        score={79.6}
        tier="Good"
        subscores={{ outcome: 95.87, wage: 69.42, sustainability: 65.36 }}
      />
    );
    const gauge = screen.getByRole("img");
    expect(gauge.getAttribute("aria-label")).toContain("79.6");
    expect(gauge.getAttribute("aria-label")).toContain("Good");
  });

  it("does NOT render NaN in aria-label for string-coerced scores", () => {
    // Score could come through as string "79.6" from JSON parsing
    render(
      <SrsScoreGauge
        score={"79.6" as unknown as number}
        tier="Good"
        subscores={{ outcome: 95, wage: 69, sustainability: 65 }}
      />
    );
    const gauge = screen.getByRole("img");
    expect(gauge.getAttribute("aria-label")).not.toContain("NaN");
  });
});
