/**
 * Tests for the Ask NorthStar page (/ask).
 *
 * Tests search, topic filtering, suggested questions, result display,
 * AI answer button, loading/error states, and ResultCard expand/collapse.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  usePathname: () => "/ask",
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
          const Component = ReactMod.forwardRef(
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

// Mock data
const MOCK_CHUNKS = [
  {
    chunk_id: "c1",
    source_artifact: "pd_forecasts",
    topic: "pd_forecast",
    label: "Priority Date Forecast Model",
    text: "The priority date forecast model uses ARIMA time-series analysis.",
    metadata: {},
    generated_at: "2025-01-01",
  },
  {
    chunk_id: "c2",
    source_artifact: "salary_benchmarks",
    topic: "salary",
    label: "Salary Benchmarks Overview",
    text: "Salary benchmarks are computed from OEWS data.",
    metadata: {},
    generated_at: "2025-01-01",
  },
  {
    chunk_id: "c3",
    source_artifact: "employer_friendliness_scores",
    topic: "employer",
    label: "Sponsor Reliability Score",
    text: "The SRS evaluates employers based on approval rates.",
    metadata: {},
    generated_at: "2025-01-01",
  },
];

const MOCK_QA_PAIRS = [
  {
    question: "How does the priority date forecast model work?",
    answer: "The forecast model uses ARIMA on visa bulletin data.",
    sources: ["pd_forecasts"],
    topic: "pd_forecast",
    confidence: "high",
    generated_at: "2025-01-01",
  },
  {
    question: "What is a Sponsor Reliability Score?",
    answer: "The SRS is a composite metric evaluating employer friendliness.",
    sources: ["employer_friendliness_scores"],
    topic: "employer",
    confidence: "high",
    generated_at: "2025-01-01",
  },
];

// Mock data loaders
const mockLoadRagChunks = vi.fn().mockResolvedValue(MOCK_CHUNKS);
const mockLoadRagQaPairs = vi.fn().mockResolvedValue(MOCK_QA_PAIRS);

vi.mock("@/lib/data/loader", () => ({
  loadRagChunks: () => mockLoadRagChunks(),
  loadRagQaPairs: () => mockLoadRagQaPairs(),
}));

// Mock LLM service
const mockGetLlmAnswer = vi.fn().mockResolvedValue({
  answer: "This is a mock AI answer about the topic.",
  model: "mock-local",
  sources: ["pd_forecasts"],
  isMock: true,
});

vi.mock("@/lib/search/llm-service", () => ({
  getLlmAnswer: (...args: unknown[]) => mockGetLlmAnswer(...args),
  detectLlmBackend: () => Promise.resolve("mock" as const),
  getLlmBackend: () => "mock" as const,
  isLlmEnabled: () => false,
}));

// Import the page component after mocks
import AskPage from "@/app/ask/page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AskPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadRagChunks.mockResolvedValue(MOCK_CHUNKS);
    mockLoadRagQaPairs.mockResolvedValue(MOCK_QA_PAIRS);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Loading & Initialization ──

  it("shows loading spinner initially", () => {
    render(<AskPage />);
    // The loading spinner is a div with border and animate
    const spinner = document.querySelector('[class*="border-2"]');
    expect(spinner).toBeInTheDocument();
  });

  it("loads data and renders page header", async () => {
    vi.useRealTimers();
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });
  });

  it("shows error state when data loading fails", async () => {
    vi.useRealTimers();
    mockLoadRagChunks.mockRejectedValueOnce(new Error("Network error"));
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("shows non-Error loading failure message", async () => {
    vi.useRealTimers();
    mockLoadRagChunks.mockRejectedValueOnce("string error");
    render(<AskPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Failed to load knowledge base")
      ).toBeInTheDocument();
    });
  });

  // ── Search Bar ──

  it("renders search input with placeholder", async () => {
    vi.useRealTimers();
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });
    const input = screen.getByLabelText("Search the knowledge base");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute(
      "placeholder",
      expect.stringContaining("priority dates")
    );
  });

  it("shows clear button when query is entered", async () => {
    vi.useRealTimers();
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });
    const input = screen.getByLabelText("Search the knowledge base");
    fireEvent.change(input, { target: { value: "test query" } });
    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("clears search on clear button click", async () => {
    vi.useRealTimers();
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });
    const input = screen.getByLabelText(
      "Search the knowledge base"
    ) as HTMLInputElement;

    // Click a suggestion to trigger a search (hides "Try asking")
    fireEvent.click(
      screen.getByText("How does the priority date forecast model work?")
    );
    await waitFor(() => {
      expect(screen.queryByText("Try asking")).not.toBeInTheDocument();
    });

    // Click clear — should reset state and show "Try asking" again
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Clear search"));
    });
    await waitFor(() => {
      expect(screen.getByText("Try asking")).toBeInTheDocument();
    });
  });

  // ── Suggested Questions ──

  it("shows suggested questions before any search", async () => {
    vi.useRealTimers();
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });
    expect(screen.getByText("Try asking")).toBeInTheDocument();
    expect(
      screen.getByText("How does the priority date forecast model work?")
    ).toBeInTheDocument();
    expect(
      screen.getByText("What is a Sponsor Reliability Score?")
    ).toBeInTheDocument();
  });

  it("clicking a suggestion populates the search field and triggers search", async () => {
    vi.useRealTimers();
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });
    const suggestion = screen.getByText(
      "How does the priority date forecast model work?"
    );
    fireEvent.click(suggestion);
    const input = screen.getByLabelText(
      "Search the knowledge base"
    ) as HTMLInputElement;
    expect(input.value).toBe(
      "How does the priority date forecast model work?"
    );
    // Results should appear (suggested questions hidden)
    await waitFor(() => {
      expect(screen.queryByText("Try asking")).not.toBeInTheDocument();
    });
  });

  // ── Topic Pills ──

  it("renders topic filter pills", async () => {
    vi.useRealTimers();
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });
    // Topics should be rendered based on chunk data
    expect(
      screen.getByText("Priority Date Forecast")
    ).toBeInTheDocument();
    expect(screen.getByText("Salary & Wages")).toBeInTheDocument();
    expect(screen.getByText("Employer Insights")).toBeInTheDocument();
  });

  // ── Search Results ──

  it("shows results after typing a search query", async () => {
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });

    const input = screen.getByLabelText("Search the knowledge base");
    fireEvent.change(input, { target: { value: "priority date forecast" } });

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(screen.getByText(/result/)).toBeInTheDocument();
    });
  });

  it("auto-triggers AI answer for no-match query", async () => {
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });

    const input = screen.getByLabelText("Search the knowledge base");
    fireEvent.change(input, {
      target: { value: "xyznonexistentquery99" },
    });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    // Should auto-call the LLM and display its answer (no dead-end "No results")
    await waitFor(() => {
      expect(mockGetLlmAnswer).toHaveBeenCalled();
      expect(screen.getByText("AI Answer")).toBeInTheDocument();
      expect(
        screen.getByText("This is a mock AI answer about the topic.")
      ).toBeInTheDocument();
    });
  });

  it("shows result type badges (Q&A and Chunk)", async () => {
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });

    const input = screen.getByLabelText("Search the knowledge base");
    fireEvent.change(input, { target: { value: "priority date" } });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() => {
      // At least one result should be visible
      const badges = screen.getAllByText(/Q&A|Chunk/);
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  // ── AI Answer ──

  it("shows Get AI Answer button when results exist", async () => {
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });

    // Use a suggested question for reliable results
    const suggestion = screen.getByText(
      "How does the priority date forecast model work?"
    );
    fireEvent.click(suggestion);

    await waitFor(() => {
      expect(screen.getByText("Get AI Answer")).toBeInTheDocument();
    });
  });

  it("triggers LLM and displays mock AI answer", async () => {
    vi.useRealTimers();
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });

    // Click a suggestion to get results
    fireEvent.click(
      screen.getByText("How does the priority date forecast model work?")
    );

    await waitFor(() => {
      expect(screen.getByText("Get AI Answer")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Get AI Answer"));

    await waitFor(() => {
      expect(screen.getByText("AI Answer")).toBeInTheDocument();
      expect(
        screen.getByText("This is a mock AI answer about the topic.")
      ).toBeInTheDocument();
    });

    // Should show model badge (Mock • Local)
    expect(screen.getByText("Mock • Local")).toBeInTheDocument();
  });

  // ── How It Works ──

  it("renders How It Works section", async () => {
    vi.useRealTimers();
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });
    expect(screen.getByText("How It Works")).toBeInTheDocument();
    expect(screen.getByText("Exact Match")).toBeInTheDocument();
    expect(screen.getByText("Context Retrieval")).toBeInTheDocument();
    expect(screen.getByText("AI Synthesis")).toBeInTheDocument();
  });

  it("shows LLM status in AI Synthesis section", async () => {
    vi.useRealTimers();
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });
    // detectLlmBackend resolves to "mock" in tests
    await waitFor(() => {
      expect(
        screen.getByText(/Mock mode|Groq connected|OpenAI connected|Ollama connected/)
      ).toBeInTheDocument();
    });
  });

  // ── Result count ──

  it("shows exact match count indicator", async () => {
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });

    // Click suggestion that should match a QA pair
    const suggestion = screen.getByText(
      "How does the priority date forecast model work?"
    );

    await act(async () => {
      fireEvent.click(suggestion);
    });

    await waitFor(() => {
      // Should show "X exact match(es)" text
      const exactMatch = screen.queryByText(/exact match/);
      expect(exactMatch).toBeInTheDocument();
    });
  });

  // ── Knowledge base stats ──

  it("shows knowledge base stats in header", async () => {
    vi.useRealTimers();
    render(<AskPage />);
    await waitFor(() => {
      expect(screen.getByText("Ask NorthStar")).toBeInTheDocument();
    });
    // The header subtitle contains knowledge stats — use getAllByText to handle
    // the same text appearing in both the header and the How It Works section
    const qaTexts = screen.getAllByText(/182 pre-computed Q&A pairs/);
    expect(qaTexts.length).toBeGreaterThanOrEqual(1);
    // The header subtitle (first match) should also mention chunks and topics
    const subtitle = qaTexts[0].closest("p");
    expect(subtitle?.textContent).toMatch(/knowledge chunks/);
    expect(subtitle?.textContent).toMatch(/topics/);
  });
});
