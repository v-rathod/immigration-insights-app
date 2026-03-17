/**
 * Tests for the Visa Bulletin / Priority Date Cortex dashboard page
 * and PriorityDateChart unified component.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { PdForecast } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/link
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

// Mock Recharts — minimal mocks for chart rendering
vi.mock("recharts", async () => {
  const React = await import("react");
  const Wrapper = ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => React.createElement("div", { className, "data-testid": "recharts-wrapper" }, children);
  return {
    ResponsiveContainer: Wrapper,
    ComposedChart: Wrapper,
    AreaChart: Wrapper,
    Area: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: ({ label }: { label?: { value?: string } }) =>
      label?.value
        ? React.createElement("div", { "data-testid": "reference-line" }, label.value)
        : null,
  };
});

// Mock loadPdForecasts and loadCutoffTrends
const mockLoadPdForecasts = vi.fn();
const mockLoadCutoffTrends = vi.fn();
vi.mock("@/lib/data/pdi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/pdi")>(
    "@/lib/data/pdi"
  );
  return {
    ...actual,
    loadPdForecasts: (...args: unknown[]) => mockLoadPdForecasts(...args),
    loadCutoffTrends: (...args: unknown[]) => mockLoadCutoffTrends(...args),
  };
});

// Import components after mocks
import VisaBulletinPage from "@/app/dashboard/visa-bulletin/page";
import { PriorityDateChart } from "@/components/pdi/priority-date-chart";
import type { CutoffTrendRecord } from "@/lib/data/pdi";

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

function buildSeriesForChartAndCombo(
  chart: string,
  category: string,
  country: string,
  startDate: string,
  velocity: number
): PdForecast[] {
  const series: PdForecast[] = [];
  const base = new Date(startDate);
  for (let i = 1; i <= 24; i++) {
    const cutoff = new Date(base);
    cutoff.setDate(cutoff.getDate() + velocity * i);
    // Generate valid forecast months starting from 2026-04
    const fmBase = new Date(Date.UTC(2026, 3, 1));
    fmBase.setUTCMonth(fmBase.getUTCMonth() + (i - 1));
    const fm = `${fmBase.getUTCFullYear()}-${String(
      fmBase.getUTCMonth() + 1
    ).padStart(2, "0")}`;
    series.push(
      makeForecast({
        chart,
        category,
        country,
        months_ahead: i,
        forecast_month: fm,
        projected_cutoff_date: cutoff.toISOString().slice(0, 10),
        confidence_low: new Date(
          cutoff.getTime() - 30 * 86400000
        )
          .toISOString()
          .slice(0, 10),
        confidence_high: new Date(
          cutoff.getTime() + 30 * 86400000
        )
          .toISOString()
          .slice(0, 10),
        velocity_days_per_month: velocity,
        cumulative_advancement_days: velocity * i,
      })
    );
  }
  return series;
}

function buildFullForecasts(): PdForecast[] {
  return [
    // EB2/IND — both charts
    ...buildSeriesForChartAndCombo("DFF", "EB2", "IND", "2014-11-01", 18),
    ...buildSeriesForChartAndCombo("FAD", "EB2", "IND", "2013-10-01", 13),
    // EB1/IND — both charts
    ...buildSeriesForChartAndCombo("DFF", "EB1", "IND", "2023-12-01", 22),
    ...buildSeriesForChartAndCombo("FAD", "EB1", "IND", "2023-06-01", 15),
    // EB2/CHN — both charts
    ...buildSeriesForChartAndCombo("DFF", "EB2", "CHN", "2020-01-01", 20),
    ...buildSeriesForChartAndCombo("FAD", "EB2", "CHN", "2019-06-01", 16),
    // EB3/ROW — both charts
    ...buildSeriesForChartAndCombo("DFF", "EB3", "ROW", "2022-01-01", 25),
    ...buildSeriesForChartAndCombo("FAD", "EB3", "ROW", "2021-06-01", 20),
  ];
}

/** Build historical cutoff trend records for testing */
function makeTrend(overrides: Partial<CutoffTrendRecord> = {}): CutoffTrendRecord {
  return {
    bulletin_year: 2020,
    bulletin_month: 1,
    chart: "DFF",
    category: "EB2",
    country: "IND",
    status_flag: "D",
    cutoff_date: "2012-01-01",
    queue_position_days: null,
    monthly_advancement_days: 15,
    velocity_3m: 14,
    velocity_6m: 13,
    retrogression_flag: 0,
    retrogression_count_cum: 0,
    ...overrides,
  };
}

function buildHistoricalTrends(): CutoffTrendRecord[] {
  const records: CutoffTrendRecord[] = [];
  for (const chart of ["DFF", "FAD"] as const) {
    for (let year = 2016; year <= 2025; year++) {
      for (let month = 1; month <= 12; month++) {
        const monthsFromStart = (year - 2016) * 12 + month;
        const baseDate = chart === "DFF"
          ? new Date(2010, 0, 1)
          : new Date(2009, 0, 1);
        baseDate.setDate(baseDate.getDate() + monthsFromStart * 14);
        records.push(
          makeTrend({
            bulletin_year: year,
            bulletin_month: month,
            chart,
            cutoff_date: baseDate.toISOString().slice(0, 10),
          })
        );
      }
    }
  }
  return records;
}

// ---------------------------------------------------------------------------
// PriorityDateChart Tests (unified chart)
// ---------------------------------------------------------------------------

describe("PriorityDateChart", () => {
  const dffTrends = buildHistoricalTrends().filter((t) => t.chart === "DFF");
  const fadTrends = buildHistoricalTrends().filter((t) => t.chart === "FAD");
  const dffForecast = buildSeriesForChartAndCombo(
    "DFF",
    "EB2",
    "IND",
    "2014-11-01",
    18
  );
  const fadForecast = buildSeriesForChartAndCombo(
    "FAD",
    "EB2",
    "IND",
    "2013-10-01",
    13
  );

  it("renders chart with title", () => {
    render(
      <PriorityDateChart
        dffTrends={dffTrends}
        fadTrends={fadTrends}
        dffForecast={dffForecast}
        fadForecast={fadForecast}
      />
    );
    expect(screen.getByText("Priority Date Movement")).toBeInTheDocument();
  });

  it("renders legend with DFF Actual and FAD Actual labels", () => {
    render(
      <PriorityDateChart
        dffTrends={dffTrends}
        fadTrends={fadTrends}
        dffForecast={dffForecast}
        fadForecast={fadForecast}
      />
    );
    expect(screen.getByText("DFF Actual")).toBeInTheDocument();
    expect(screen.getByText("FAD Actual")).toBeInTheDocument();
  });

  it("renders DFF Forecast and FAD Forecast legend items when forecast data provided", () => {
    render(
      <PriorityDateChart
        dffTrends={dffTrends}
        fadTrends={fadTrends}
        dffForecast={dffForecast}
        fadForecast={fadForecast}
      />
    );
    expect(screen.getByText(/DFF Forecast/)).toBeInTheDocument();
    expect(screen.getByText(/FAD Forecast/)).toBeInTheDocument();
  });

  it("does not show forecast legend items when no forecast data", () => {
    render(
      <PriorityDateChart
        dffTrends={dffTrends}
        fadTrends={fadTrends}
        dffForecast={[]}
        fadForecast={[]}
      />
    );
    expect(screen.queryByText(/DFF Forecast/)).not.toBeInTheDocument();
    expect(screen.queryByText(/FAD Forecast/)).not.toBeInTheDocument();
  });

  it("shows no-data message when all data is empty", () => {
    render(
      <PriorityDateChart
        dffTrends={[]}
        fadTrends={[]}
        dffForecast={[]}
        fadForecast={[]}
      />
    );
    expect(
      screen.getByText("No data for this combination")
    ).toBeInTheDocument();
  });

  it("renders with historical data only (no forecast)", () => {
    render(
      <PriorityDateChart
        dffTrends={dffTrends}
        fadTrends={fadTrends}
        dffForecast={[]}
        fadForecast={[]}
      />
    );
    expect(screen.getByText("Priority Date Movement")).toBeInTheDocument();
    expect(screen.getByText("DFF Actual")).toBeInTheDocument();
    expect(screen.getByText("FAD Actual")).toBeInTheDocument();
  });

  it("renders with forecast data only (no historical)", () => {
    render(
      <PriorityDateChart
        dffTrends={[]}
        fadTrends={[]}
        dffForecast={dffForecast}
        fadForecast={fadForecast}
      />
    );
    expect(screen.getByText("Priority Date Movement")).toBeInTheDocument();
    expect(screen.getByText(/DFF Forecast/)).toBeInTheDocument();
  });

  it("shows Your PD legend item when priorityDate is set", () => {
    render(
      <PriorityDateChart
        dffTrends={dffTrends}
        fadTrends={fadTrends}
        dffForecast={dffForecast}
        fadForecast={fadForecast}
        priorityDate="2012-06-01"
      />
    );
    expect(screen.getByText("Your PD")).toBeInTheDocument();
  });

  it("does not show Your PD legend when no priorityDate", () => {
    render(
      <PriorityDateChart
        dffTrends={dffTrends}
        fadTrends={fadTrends}
        dffForecast={dffForecast}
        fadForecast={fadForecast}
      />
    );
    expect(screen.queryByText("Your PD")).not.toBeInTheDocument();
  });

  it("renders explainer text about solid and dashed lines", () => {
    render(
      <PriorityDateChart
        dffTrends={dffTrends}
        fadTrends={fadTrends}
        dffForecast={dffForecast}
        fadForecast={fadForecast}
      />
    );
    expect(
      screen.getByText(/Solid lines show actual monthly DOS Visa Bulletin/)
    ).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(
      <PriorityDateChart
        dffTrends={dffTrends}
        fadTrends={fadTrends}
        dffForecast={dffForecast}
        fadForecast={fadForecast}
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});

// ---------------------------------------------------------------------------
// VisaBulletinPage Tests
// ---------------------------------------------------------------------------

describe("VisaBulletinPage", () => {
  beforeEach(() => {
    mockLoadPdForecasts.mockReset();
    mockLoadCutoffTrends.mockReset();
    // Default: return empty trends (individual tests can override)
    mockLoadCutoffTrends.mockResolvedValue([]);
  });

  it("shows loading spinner initially", () => {
    mockLoadPdForecasts.mockReturnValue(new Promise(() => {}));
    mockLoadCutoffTrends.mockReturnValue(new Promise(() => {}));
    render(<VisaBulletinPage />);
    // Spinner has border-t-transparent class
    const spinner = document.querySelector(".border-t-transparent");
    expect(spinner).toBeInTheDocument();
  });

  it("renders page header with title", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    // "Priority Date Cortex" appears in h1 and methodology <strong>
    const titles = await screen.findAllByText("Priority Date Cortex");
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it("renders category pills (EB1, EB2, EB3)", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    await screen.findByText("EB1");
    expect(screen.getByText("EB2")).toBeInTheDocument();
    expect(screen.getByText("EB3")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
  });

  it("renders country pills", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    await screen.findByRole("button", { name: "India" });
    expect(screen.getByRole("button", { name: "China (mainland)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rest of World" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Philippines" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mexico" })).toBeInTheDocument();
    expect(screen.getByText("Country")).toBeInTheDocument();
  });

  it("renders priority date input", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    await screen.findByText("Your PD");
    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).toBeInTheDocument();
  });

  it("shows call-to-action when no PD entered (smart visibility)", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    await screen.findByText("Priority Date Movement");
    // CTA placeholder shown instead of prediction cards
    expect(
      screen.getByText("Enter your priority date to see predictions")
    ).toBeInTheDocument();
    // Individual prediction card sublabels not rendered yet
    expect(
      screen.queryByText("File I-485 (Adjustment of Status)")
    ).not.toBeInTheDocument();
  });

  it("shows unified Priority Date Movement chart", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    await screen.findByText("Priority Date Movement");
  });

  it("shows chart with historical trend data", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    mockLoadCutoffTrends.mockResolvedValue(buildHistoricalTrends());
    render(<VisaBulletinPage />);
    await screen.findByText("Priority Date Movement");
    expect(screen.getByText("DFF Actual")).toBeInTheDocument();
  });

  it("shows chart even without historical trend data", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    mockLoadCutoffTrends.mockResolvedValue([]);
    render(<VisaBulletinPage />);
    await screen.findByText("Priority Date Movement");
  });

  it("shows velocity stats", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    await screen.findByText("DFF Velocity");
    expect(screen.getByText("FAD Velocity")).toBeInTheDocument();
    expect(screen.getByText("DFF Total Gain")).toBeInTheDocument();
    expect(screen.getByText("FAD Total Gain")).toBeInTheDocument();
  });

  it("shows methodology section", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    await screen.findByText("How It Works");
    // "Priority Date Cortex" appears in both h1 and methodology — just verify methodology section
    expect(screen.getByText(/forecasts EB visa cutoff/)).toBeInTheDocument();
  });

  it("switching category updates the chart", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    const eb1Button = await screen.findByText("EB1");
    fireEvent.click(eb1Button);
    // Chart should still render (EB1/IND data exists)
    expect(screen.getByText("Priority Date Movement")).toBeInTheDocument();
  });

  it("switching country updates the chart", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    const chinaButton = await screen.findByText("China (mainland)");
    fireEvent.click(chinaButton);
    // Chart should still render (EB2/CHN data exists)
    expect(screen.getByText("Priority Date Movement")).toBeInTheDocument();
  });

  it("entering priority date shows prediction", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    await screen.findByText("Your PD");
    // CTA visible before PD entry
    expect(
      screen.getByText("Enter your priority date to see predictions")
    ).toBeInTheDocument();

    const dateInput = document.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2015-06-01" } });

    // CTA disappears; prediction cards now visible
    await waitFor(() => {
      expect(
        screen.queryByText("Enter your priority date to see predictions")
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("File I-485 (Adjustment of Status)")
    ).toBeInTheDocument();
  });

  it("shows estimated prediction for PD beyond model window", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    await screen.findByText("Your PD");

    const dateInput = document.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement;
    // Use a PD far in the future that's beyond all forecasts
    fireEvent.change(dateInput, { target: { value: "2025-01-01" } });

    await waitFor(() => {
      const estimatedTexts = screen.getAllByText("Estimated");
      expect(estimatedTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows extended categories when More is clicked", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    const moreButton = await screen.findByText("More");
    fireEvent.click(moreButton);
    expect(screen.getByText("EB4")).toBeInTheDocument();
    expect(screen.getByText("EB5")).toBeInTheDocument();
    expect(screen.getByText("EB3-Other")).toBeInTheDocument();
  });

  it("shows error state on data load failure", async () => {
    mockLoadPdForecasts.mockRejectedValue(new Error("Network error"));
    render(<VisaBulletinPage />);
    expect(await screen.findByText("Network error")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("shows no-data state for combo without forecasts", async () => {
    // Only provide EB2/IND data
    const limited = [
      ...buildSeriesForChartAndCombo("DFF", "EB2", "IND", "2014-11-01", 18),
      ...buildSeriesForChartAndCombo("FAD", "EB2", "IND", "2013-10-01", 13),
    ];
    mockLoadPdForecasts.mockResolvedValue(limited);
    render(<VisaBulletinPage />);
    // Switch to Philippines which has no data
    const phlButton = await screen.findByRole("button", { name: "Philippines" });
    fireEvent.click(phlButton);
    expect(
      screen.getByText(/No data for EB2/i)
    ).toBeInTheDocument();
  });

  it("renders sublabels for prediction cards after entering PD", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    await screen.findByText("Your PD");
    const dateInput = document.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2015-06-01" } });
    await screen.findByText("File I-485 (Adjustment of Status)");
    expect(screen.getByText("Green Card Approval")).toBeInTheDocument();
  });

  it("renders optimistic/realistic toggle switch", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    // Toggle switch should be present (starts in optimistic state)
    const toggle = await screen.findByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    // Enter PD to reveal prediction cards with mode badges
    const dateInput = document.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2015-06-01" } });
    await waitFor(() => {
      const badges = screen.getAllByText("Optimistic");
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("toggling to Realistic shows realistic badges on cards", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    // Enter PD to reveal prediction cards first
    await screen.findByText("Your PD");
    const dateInput = document.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2015-06-01" } });
    await screen.findByText("File I-485 (Adjustment of Status)");
    // Now toggle to Realistic
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    });
    await waitFor(() => {
      const badges = screen.getAllByText("Realistic");
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("both prediction cards visible when PD entered, persist through toggle", async () => {
    mockLoadPdForecasts.mockResolvedValue(buildFullForecasts());
    render(<VisaBulletinPage />);
    // Enter PD to reveal prediction cards
    await screen.findByText("Your PD");
    const dateInput = document.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2015-06-01" } });
    // Both cards visible after PD entry
    await screen.findByText("File I-485 (Adjustment of Status)");
    expect(screen.getByText("Green Card Approval")).toBeInTheDocument();
    // Toggle — cards persist
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    expect(
      screen.getByText("File I-485 (Adjustment of Status)")
    ).toBeInTheDocument();
    expect(screen.getByText("Green Card Approval")).toBeInTheDocument();
  });
});
