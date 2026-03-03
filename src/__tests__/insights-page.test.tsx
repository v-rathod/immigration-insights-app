/**
 * Tests for My Insights page (/insights)
 *
 * Covers:
 *  - Page renders with header and profile card
 *  - Profile form fields (priority date, category pills, country pills, employer, salary, job, experience)
 *  - Form collapse / expand (Done / Edit toggle)
 *  - Profile persists to localStorage on change
 *  - Profile loaded from localStorage on mount
 *  - Smart Visibility: Green Card panel CTA when no priority date
 *  - Smart Visibility: Green Card panel data shown when priority date entered
 *  - Smart Visibility: Sponsor panel CTA when no employer selected
 *  - Smart Visibility: Salary panel CTA when no salary entered
 *  - Salary panel renders benchmark when salary is provided
 *  - Privacy note rendered
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
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
                "variants", "initial", "animate", "exit", "whileHover",
                "whileTap", "whileInView", "transition", "layout", "layoutId",
              ]);
              for (const [k, v] of Object.entries(rest)) {
                if (!motionKeys.has(k)) htmlProps[k] = v;
              }
              return React.createElement(tag, { ref, className, ...htmlProps }, children);
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
    ResponsiveContainer: Stub,
    ComposedChart: Stub,
    BarChart: Stub,
    Bar: Stub,
    Line: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
    ReferenceLine: Stub,
    Cell: Stub,
    Area: Stub,
  };
});

// Mock complex sub-components to prevent deep dependency chains in tests
vi.mock("@/components/pdi/priority-date-chart", () => ({
  PriorityDateChart: ({ priorityDate }: { priorityDate?: string }) => (
    <div data-testid="priority-date-chart" data-pd={priorityDate}>PDI Chart</div>
  ),
}));

vi.mock("@/components/srs/employer-search", () => ({
  EmployerSearch: ({
    onSelect,
    placeholder,
  }: {
    onSelect: (e: { employer_name: string; employer_id: string }) => void;
    placeholder?: string;
  }) => (
    <div data-testid="employer-search">
      <p>{placeholder ?? "Search employers"}</p>
      <button
        onClick={() =>
          onSelect({
            employer_name: "Google LLC",
            employer_id: "google-001",
            srs: 88,
            srs_tier: "Excellent",
            scope: "overall",
            outcome_subscore: 90,
            wage_subscore: 85,
            sustainability_subscore: 88,
            srs_ml: 87,
          } as any)
        }
        data-testid="mock-select-employer"
      >
        Select Google
      </button>
    </div>
  ),
}));

vi.mock("@/components/srs/score-gauge", () => ({
  SrsScoreGauge: ({ score, tier }: { score: number | null; tier: string }) => (
    <div data-testid="srs-score-gauge">{tier ?? score}</div>
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
    loadPdForecasts: vi.fn().mockResolvedValue([]),
    loadCutoffTrends: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@/lib/data/srs", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/data/srs")>();
  return {
    ...actual,
    loadSrsScores: vi.fn().mockResolvedValue([]),
    loadSrsScoresML: vi.fn().mockResolvedValue([]),
    loadEmployerMonthlyMetrics: vi.fn().mockResolvedValue([]),
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
        p10: 70000,
        p25: 95000,
        median: 130000,
        p75: 165000,
        p90: 200000,
      },
    ]),
  };
});

// Mock security module
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

beforeEach(() => {
  // Clear mock storage before each test
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function renderPage() {
  const { default: InsightsPage } = await import("@/app/insights/page");
  render(<InsightsPage />);
  // Wait for loading spinner to disappear and page to render
  await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull(), { timeout: 3000 });
  await waitFor(() => expect(screen.getByTestId("insights-page")).toBeInTheDocument(), { timeout: 3000 });
}

describe("InsightsPage — page structure", () => {
  it("renders page title and subtitle", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { name: /my insights/i })).toBeInTheDocument();
    expect(screen.getByText(/personalized immigration intelligence/i)).toBeInTheDocument();
  });

  it("renders privacy note", async () => {
    await renderPage();
    expect(screen.getByText(/stored locally in your browser/i)).toBeInTheDocument();
  });

  it("renders the three section headers", async () => {
    await renderPage();
    // Use role queries to distinguish panel h2 headings from other text with same words
    expect(screen.getByRole("heading", { name: /green card forecast/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /sponsor intelligence/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /salary compass/i })).toBeInTheDocument();
  });
});

describe("InsightsPage — profile card (empty state)", () => {
  it("shows profile card with edit form open by default", async () => {
    await renderPage();
    expect(screen.getByLabelText(/priority date/i)).toBeInTheDocument();
    // Employer is set via Sponsor Intelligence panel, not a text input
    expect(screen.getByLabelText(/annual salary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/job title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/years of experience/i)).toBeInTheDocument();
  });

  it("shows EB category pills", async () => {
    await renderPage();
    expect(screen.getByRole("button", { name: "EB1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EB2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EB3" })).toBeInTheDocument();
  });

  it("shows country of chargeability pills", async () => {
    await renderPage();
    expect(screen.getByRole("button", { name: "India" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "China" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rest of World" })).toBeInTheDocument();
  });

  it("shows Done button to collapse the form", async () => {
    await renderPage();
    expect(screen.getByRole("button", { name: /collapse profile|done/i })).toBeInTheDocument();
  });

  it("shows prompt to fill details when form is closed and no data", async () => {
    await renderPage();
    // Close the form
    const doneBtn = screen.getByRole("button", { name: /collapse profile|done/i });
    fireEvent.click(doneBtn);
    await waitFor(() =>
      expect(screen.getByText(/fill in your details/i)).toBeInTheDocument()
    );
  });
});

describe("InsightsPage — profile card (field interactions)", () => {
  it("clicking an EB category pill changes selection", async () => {
    await renderPage();
    const eb3Pill = screen.getByRole("button", { name: "EB3" });
    fireEvent.click(eb3Pill);
    // EB3 should have active styling — we verify secureSet was called
    const { secureSet } = await import("@/lib/security");
    await waitFor(() => expect(secureSet).toHaveBeenCalled());
  });

  it("typing in priority date field triggers save", async () => {
    await renderPage();
    const pdInput = screen.getByLabelText(/priority date/i);
    fireEvent.change(pdInput, { target: { value: "2020-03-15" } });
    const { secureSet } = await import("@/lib/security");
    await waitFor(() => expect(secureSet).toHaveBeenCalled());
  });

  it("typing salary triggers save", async () => {
    await renderPage();
    const salaryInput = screen.getByLabelText(/annual salary/i);
    fireEvent.change(salaryInput, { target: { value: "145000" } });
    const { secureSet } = await import("@/lib/security");
    await waitFor(() => expect(secureSet).toHaveBeenCalled());
  });

  it("typed values appear in collapsed summary after Done", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText(/priority date/i), {
      target: { value: "2020-03-15" },
    });
    // Close form
    fireEvent.click(screen.getByRole("button", { name: /collapse profile|done/i }));
    await waitFor(() => {
      expect(screen.getByText("2020-03-15")).toBeInTheDocument();
    });
  });

  it("employer name in collapsed summary reflects selection from Sponsor panel", async () => {
    await renderPage();
    // Select employer via the Sponsor Intelligence panel search
    fireEvent.click(screen.getByTestId("mock-select-employer"));
    // After selection, employer name appears in both score gauge, detail card, and profile summary
    await waitFor(() => {
      const instances = screen.getAllByText("Google LLC");
      expect(instances.length).toBeGreaterThan(0);
    });
    // Close form — employer name should still appear in collapsed profile summary
    fireEvent.click(screen.getByRole("button", { name: /collapse profile|done/i }));
    await waitFor(() => {
      expect(screen.getAllByText("Google LLC").length).toBeGreaterThan(0);
    });
  });
});

describe("InsightsPage — profile persistence", () => {
  it("loads existing profile from localStorage on mount", async () => {
    // Pre-populate mock storage with an object (secureGet returns parsed objects)
    mockStorage["user_profile"] = {
      priorityDate: "2021-06-01",
      category: "EB3",
      country: "CHN",
      employerName: "Amazon",
      wageOffered: "160000",
      jobTitle: "SDE2",
      yearsOfExperience: "7",
    };

    await renderPage();

    // With a filled profile, isEditing defaults to false → no "fill in details" prompt
    await waitFor(() => {
      expect(screen.queryByText(/fill in your details/i)).toBeNull();
    });
  });
});

describe("InsightsPage — Smart Visibility: Green Card panel", () => {
  it("shows CTA when no priority date entered", async () => {
    await renderPage();
    // Close form so we can see the CTA
    fireEvent.click(screen.getByRole("button", { name: /collapse profile|done/i }));
    await waitFor(() => {
      expect(screen.getByText(/enter your priority date above/i)).toBeInTheDocument();
    });
  });

  it("shows Green Card Forecast panel when priority date is entered", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText(/priority date/i), {
      target: { value: "2021-06-01" },
    });
    await waitFor(() => {
      // Green Card panel reveals the forecast-mode toggle when PD is set
      expect(screen.getByRole("button", { name: /optimistic/i })).toBeInTheDocument();
      expect(screen.getByText(/green card forecast/i)).toBeInTheDocument();
    });
  });

  it("shows optimistic/realistic toggle", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText(/priority date/i), {
      target: { value: "2021-06-01" },
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /optimistic/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /realistic/i })).toBeInTheDocument();
    });
  });
});

describe("InsightsPage — Smart Visibility: Sponsor panel", () => {
  it("always shows EmployerSearch", async () => {
    await renderPage();
    expect(screen.getByTestId("employer-search")).toBeInTheDocument();
  });

  it("shows CTA when no employer selected yet", async () => {
    await renderPage();
    expect(screen.getByText(/select your employer/i)).toBeInTheDocument();
  });

  it("shows score gauge after employer is selected", async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId("mock-select-employer"));
    await waitFor(() => {
      expect(screen.getByTestId("srs-score-gauge")).toBeInTheDocument();
    });
  });

  it("shows detail card after employer is selected", async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId("mock-select-employer"));
    await waitFor(() => {
      expect(screen.getByTestId("employer-detail-card")).toBeInTheDocument();
    });
  });

  it("syncs employer name to profile when employer is selected", async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId("mock-select-employer"));
    const { secureSet } = await import("@/lib/security");
    await waitFor(() => {
      expect(secureSet).toHaveBeenCalledWith(
        "user_profile",
        expect.objectContaining({ employerName: "Google LLC" })
      );
    });
  });
});

describe("InsightsPage — Smart Visibility: Salary panel", () => {
  it("shows CTA when no salary entered", async () => {
    await renderPage();
    // Close form
    fireEvent.click(screen.getByRole("button", { name: /collapse profile|done/i }));
    await waitFor(() => {
      expect(screen.getByText(/enter your offered salary/i)).toBeInTheDocument();
    });
  });

  it("shows salary benchmark card when salary is entered", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText(/annual salary/i), {
      target: { value: "145000" },
    });
    await waitFor(() => {
      // Should show "Your Offered Salary" heading
      expect(screen.getByText(/your offered salary/i)).toBeInTheDocument();
    });
  });

  it("shows formatted salary amount", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText(/annual salary/i), {
      target: { value: "145000" },
    });
    await waitFor(() => {
      // formatCurrency(145000) = "$145,000"
      expect(screen.getByText(/\$145,000/i)).toBeInTheDocument();
    });
  });

  it("shows benchmark comparison when salary and benchmark data available", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText(/annual salary/i), {
      target: { value: "145000" },
    });
    await waitFor(() => {
      // Should show percentile markers
      expect(screen.getByText(/vs median/i)).toBeInTheDocument();
    });
  });
});

describe("InsightsPage — loading and error states", () => {
  it("shows loading spinner initially", async () => {
    // Use a promise that never resolves to test loading state
    const { loadPdForecasts } = await import("@/lib/data/pdi");
    (loadPdForecasts as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { default: InsightsPage } = await import("@/app/insights/page");
    render(<InsightsPage />);
    // The loading spinner (data-testid) should be present while data is loading
    await waitFor(() => {
      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    });
  });
});
