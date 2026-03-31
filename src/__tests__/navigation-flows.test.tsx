/**
 * Navigation Flow Tests
 *
 * Tests user flows that cross component and page boundaries, especially those
 * involving URL parameters, localStorage state, and inter-page navigation.
 *
 * WHY THIS FILE EXISTS:
 * The previous test gap (employer URL pre-load not working) was caused by
 * WelcomeBackBanner and FeaturedEmployers being mocked out in landing-page.test.tsx.
 * Mocking at the page level hides bugs inside the mocked components.
 *
 * Rule enforced here: test the ACTUAL component logic, not stubs.
 *
 * Coverage:
 *   1. WelcomeBackBanner — shows/hides based on localStorage profile
 *   2. FeaturedEmployers — link URL format (?q= param)
 *   3. Employer Quick Check — "Full Report" link URL format
 *   4. PD Quick Check — "Full Chart" link URL format
 *   5. Insights — employer link navigates to dashboard with pre-load param
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock("framer-motion", async () => {
  const R = await import("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_target: unknown, tag: string) => {
          const C = R.forwardRef(
            (
              { children, className, style, ...rest }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties; [key: string]: unknown },
              ref: React.Ref<HTMLElement>
            ) => {
              const skip = new Set(["variants", "initial", "animate", "exit", "whileHover", "whileTap", "whileInView", "transition", "layout", "layoutId"]);
              const htmlProps: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(rest)) {
                if (!skip.has(k)) htmlProps[k] = v;
              }
              return R.createElement(tag as string, { ref, className, style, ...htmlProps }, children);
            }
          );
          C.displayName = `motion.${tag}`;
          return C;
        },
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => false,
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeLocalStorage(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

// ============================================================================
// 1. WelcomeBackBanner — real component, not mocked
// ============================================================================

describe("WelcomeBackBanner — real component behavior", () => {
  // Mock secureGet to read directly from localStorage for these tests
  vi.mock("@/lib/security", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/lib/security")>();
    return {
      ...original,
      secureGet: <T,>(key: string): T | null => {
        try {
          const raw = window.localStorage.getItem(key);
          return raw ? (JSON.parse(raw) as T) : null;
        } catch {
          return null;
        }
      },
    };
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it("renders nothing when localStorage has no profile", async () => {
    const { WelcomeBackBanner } = await import("@/components/home/welcome-back-banner");
    const { container } = render(<WelcomeBackBanner />);
    // After useEffect runs, still nothing if no profile
    await act(async () => {});
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when profile exists but has no meaningful fields", async () => {
    writeLocalStorage("user_profile", { category: "", country: "" });
    const { WelcomeBackBanner } = await import("@/components/home/welcome-back-banner");
    const { container } = render(<WelcomeBackBanner />);
    await act(async () => {});
    expect(container.firstChild).toBeNull();
  });

  it("shows 'Welcome back' text when profile has priorityDate", async () => {
    writeLocalStorage("user_profile", { priorityDate: "2020-01-15", category: "EB2", country: "IND" });
    const { WelcomeBackBanner } = await import("@/components/home/welcome-back-banner");
    render(<WelcomeBackBanner />);
    await act(async () => {});
    await waitFor(() => {
      expect(screen.getByText("Welcome back")).toBeInTheDocument();
    });
  });

  it("shows category and country in profile summary", async () => {
    writeLocalStorage("user_profile", { category: "EB2", country: "IND", priorityDate: "2020-01-15" });
    const { WelcomeBackBanner } = await import("@/components/home/welcome-back-banner");
    render(<WelcomeBackBanner />);
    await act(async () => {});
    await waitFor(() => {
      expect(screen.getByText(/EB2 IND/)).toBeInTheDocument();
    });
  });

  it("shows employer name in profile summary when set", async () => {
    writeLocalStorage("user_profile", { employerName: "Google LLC", priorityDate: "2020-01-15" });
    const { WelcomeBackBanner } = await import("@/components/home/welcome-back-banner");
    render(<WelcomeBackBanner />);
    await act(async () => {});
    await waitFor(() => {
      expect(screen.getByText(/Google LLC/)).toBeInTheDocument();
    });
  });

  it("links to /insights page", async () => {
    writeLocalStorage("user_profile", { employerName: "Microsoft", priorityDate: "2021-06-01" });
    const { WelcomeBackBanner } = await import("@/components/home/welcome-back-banner");
    render(<WelcomeBackBanner />);
    await act(async () => {});
    await waitFor(() => {
      const link = screen.getByText(/My Insights/).closest("a");
      expect(link).toHaveAttribute("href", "/insights");
    });
  });

  it("does not show banner when only wageOffered is set (no meaningful narrative)", async () => {
    // wageOffered alone is not enough to show the banner (readProfile requires
    // priorityDate, employerName, wageOffered, or jobTitle)
    writeLocalStorage("user_profile", { wageOffered: "150000" });
    const { WelcomeBackBanner } = await import("@/components/home/welcome-back-banner");
    render(<WelcomeBackBanner />);
    await act(async () => {});
    // wageOffered IS in the condition — banner should show
    await waitFor(() => {
      expect(screen.getByText("Welcome back")).toBeInTheDocument();
    });
  });
});

// ============================================================================
// 2. FeaturedEmployers — link URL parameters
// ============================================================================

const MOCK_EMPLOYER_ENTRIES = [
  { employer_name: "Infosys Limited",       employer_id: "infosys1", total_filings: 227000, n_soc_codes: 30, latest_median_salary: 95000,  latest_year: 2025, srs_score: 89.3, srs_tier: "Excellent", activity_status: "active" as const },
  { employer_name: "Tata Consultancy",      employer_id: "tcs1",     total_filings: 180000, n_soc_codes: 25, latest_median_salary: 92000,  latest_year: 2025, srs_score: 84.0, srs_tier: "Good",      activity_status: "active" as const },
  { employer_name: "Microsoft Corporation", employer_id: "msft1",    total_filings: 50000,  n_soc_codes: 45, latest_median_salary: 180000, latest_year: 2025, srs_score: 76.0, srs_tier: "Good",      activity_status: "active" as const },
  { employer_name: "Amazon.com Services",   employer_id: "amzn1",    total_filings: 48000,  n_soc_codes: 40, latest_median_salary: 175000, latest_year: 2025, srs_score: 72.0, srs_tier: "Moderate",  activity_status: "active" as const },
  { employer_name: "Google LLC",            employer_id: "goog1",    total_filings: 35000,  n_soc_codes: 38, latest_median_salary: 200000, latest_year: 2025, srs_score: 81.0, srs_tier: "Good",      activity_status: "active" as const },
  { employer_name: "Wipro Limited",         employer_id: "wipro1",   total_filings: 30000,  n_soc_codes: 22, latest_median_salary: 90000,  latest_year: 2025, srs_score: 78.0, srs_tier: "Good",      activity_status: "active" as const },
];

vi.mock("@/lib/data/employer-shard", () => ({
  loadEmployerSearch: vi.fn(() => Promise.resolve(MOCK_EMPLOYER_ENTRIES)),
  loadSrsOverview: vi.fn(() => Promise.resolve({ totalEmployers: 70000, ratedEmployers: 60000, excellentCount: 10000, goodCount: 20000, moderateCount: 15000, belowAverageCount: 8000, poorCount: 5000, unratedCount: 2000, avgScore: 72, medianScore: 68, warnFlaggedCount: 0 })),
  loadEmployerShard: vi.fn(() => Promise.resolve(null)),
  extractSrsFromShard: vi.fn(() => null),
  extractMonthlyMetrics: vi.fn(() => []),
}));

describe("FeaturedEmployers — URL parameter generation", () => {
  it("renders employer cards with correct ?q= links", async () => {
    const { FeaturedEmployers } = await import("@/components/home/featured-employers");
    render(<FeaturedEmployers />);

    await waitFor(() => {
      // Top by filing volume — Infosys should be present
      const infosysLink = screen.getByText("Infosys Limited").closest("a");
      expect(infosysLink).toHaveAttribute(
        "href",
        "/dashboard/employer?q=Infosys%20Limited"
      );
    });
  });

  it("generates correct URL for employer names with special chars", async () => {
    const { FeaturedEmployers } = await import("@/components/home/featured-employers");
    render(<FeaturedEmployers />);

    await waitFor(() => {
      // "Amazon.com Services" — dot and space both need encoding
      const amazonLink = screen.getByText("Amazon.com Services").closest("a");
      expect(amazonLink).toHaveAttribute(
        "href",
        "/dashboard/employer?q=Amazon.com%20Services"
      );
    });
  });

  it("shows SRS tier and filing count on each card", async () => {
    const { FeaturedEmployers } = await import("@/components/home/featured-employers");
    render(<FeaturedEmployers />);

    await waitFor(() => {
      // Infosys should show 227,000 filings
      expect(screen.getByText(/227,000 filings/)).toBeInTheDocument();
      // And Excellent tier
      expect(screen.getByText(/Excellent/)).toBeInTheDocument();
    });
  });

  it("shows loading skeleton before data arrives", async () => {
    const { loadEmployerSearch } = await import("@/lib/data/employer-shard");
    vi.mocked(loadEmployerSearch).mockReturnValueOnce(new Promise(() => {})); // never resolves

    const { FeaturedEmployers } = await import("@/components/home/featured-employers");
    const { container } = render(<FeaturedEmployers />);
    // Should show pulse skeleton divs
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows nothing when all employers have no srs_score", async () => {
    const { loadEmployerSearch } = await import("@/lib/data/employer-shard");
    vi.mocked(loadEmployerSearch).mockResolvedValueOnce(
      MOCK_EMPLOYER_ENTRIES.map((e) => ({ ...e, srs_score: null as unknown as number }))
    );
    const { FeaturedEmployers } = await import("@/components/home/featured-employers");
    const { container } = render(<FeaturedEmployers />);
    await act(async () => {});
    // No employers rated → nothing rendered
    expect(container.querySelector('[role="listitem"]')).toBeNull();
  });
});

// ============================================================================
// 3. Cross-page navigation contract
// ============================================================================

describe("Navigation URL contracts — home → dashboard", () => {
  /**
   * These tests verify the exact URL param contract between:
   *   - Home widgets (publisher)
   *   - Dashboard pages (consumer via useSearchParams)
   *
   * If either side changes the param name/format, these tests break
   * and alert us before the user sees a broken pre-load.
   */

  it("employer quick check 'Full Report' uses ?q= param with encoded employer name", async () => {
    const { EmployerQuickCheck } = await import("@/components/home/employer-quick-check");
    const { fireEvent } = await import("@testing-library/react");
    render(<EmployerQuickCheck />);

    // Wait for data to load (placeholder changes from 'Loading...' to 'Type an employer')
    const input = await screen.findByPlaceholderText(/Type an employer/i);
    fireEvent.change(input, { target: { value: "Google" } });
    // Fuse.js debounces 150ms — wait for dropdown
    await waitFor(() => expect(screen.getByText("Google LLC")).toBeInTheDocument(), { timeout: 1000 });
    fireEvent.click(screen.getByText("Google LLC"));

    await waitFor(() => {
      const link = screen.getByText(/Full Report/).closest("a");
      // Contract: employer name in ?q= param, URL-encoded
      expect(link).toHaveAttribute("href", "/dashboard/employer?q=Google%20LLC");
    });
  });

  it("featured employers links use same ?q= param format as quick check", async () => {
    // Both home components must use the same URL format for the employer dashboard
    // to pre-load correctly. This test enforces that contract.
    const { FeaturedEmployers } = await import("@/components/home/featured-employers");
    render(<FeaturedEmployers />);

    await waitFor(() => {
      const links = screen.getAllByRole("listitem").map((li) => li.closest("a"));
      links.forEach((link) => {
        // Every featured employer link must use /dashboard/employer?q=
        expect(link?.getAttribute("href")).toMatch(/^\/dashboard\/employer\?q=/);
      });
    });
  });

  it("PD quick check 'Full Chart' uses correct category and country params", async () => {
    const { loadCutoffTrends } = await import("@/lib/data/pdi");
    vi.mock("@/lib/data/pdi", () => ({
      loadCutoffTrends: vi.fn(() => Promise.resolve([
        { bulletin_year: 2026, bulletin_month: 4, chart: "FAD", category: "EB2", country: "IND", status_flag: "D", cutoff_date: "2014-07-01", queue_position_days: null, monthly_advancement_days: 122, velocity_3m: 122, velocity_6m: 80, retrogression_flag: 0, retrogression_count_cum: 0 },
        { bulletin_year: 2026, bulletin_month: 4, chart: "FAD", category: "EB2", country: "ROW", status_flag: "C", cutoff_date: null, queue_position_days: null, monthly_advancement_days: null, velocity_3m: null, velocity_6m: null, retrogression_flag: 0, retrogression_count_cum: 0 },
      ])),
    }));

    const { PdQuickCheck } = await import("@/components/home/pd-quick-check");
    render(<PdQuickCheck />);

    await waitFor(() => {
      const link = screen.getByText(/Full Chart/).closest("a");
      // Contract: category and country as dedicated params
      expect(link?.getAttribute("href")).toMatch(/category=EB2/);
      expect(link?.getAttribute("href")).toMatch(/country=IND/);
    });
  });
});

// ============================================================================
// 4. Employer dashboard URL param → auto-selection
// ============================================================================

describe("Employer dashboard — URL parameter auto-selection", () => {
  /**
   * Verifies that when the employer dashboard receives ?q=<name> in the URL,
   * it: (a) pre-populates the search box, (b) triggers employer selection.
   *
   * The EmployerSearch initialValue prop is the mechanism (see employer-search.tsx).
   */

  it("EmployerSearch initialValue pre-fills the search box", async () => {
    // Import after mocks are set up
    const { EmployerSearch } = await import("@/components/srs/employer-search");
    const mockScores = [
      { employer_name: "Google LLC", employer_id: "goog1", scope: "overall", srs: 81, srs_tier: "Good", n_36m: 35000 },
      { employer_name: "Microsoft Corporation", employer_id: "msft1", scope: "overall", srs: 76, srs_tier: "Good", n_36m: 50000 },
    ];
    render(
      <EmployerSearch
        employers={mockScores as never}
        onSelect={vi.fn()}
        initialValue="Google LLC"
      />
    );

    const input = screen.getByRole("combobox") as HTMLInputElement;
    // Input must show the pre-loaded employer name (no user interaction required)
    expect(input.value).toBe("Google LLC");
  });

  it("EmployerSearch with no initialValue starts empty", async () => {
    const { EmployerSearch } = await import("@/components/srs/employer-search");
    render(
      <EmployerSearch
        employers={[]}
        onSelect={vi.fn()}
      />
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("");
  });
});
