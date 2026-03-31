import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock framer-motion
// ---------------------------------------------------------------------------
vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_, tag: string) => {
          const Component = React.forwardRef(
            (
              { children, className, ...rest }: { children?: React.ReactNode; className?: string; [key: string]: unknown },
              ref: React.Ref<HTMLElement>
            ) => {
              const htmlProps: Record<string, unknown> = {};
              const skip = new Set(["variants", "initial", "animate", "exit", "whileHover", "whileTap", "whileInView", "transition", "layout", "layoutId"]);
              for (const [k, v] of Object.entries(rest)) { if (!skip.has(k)) htmlProps[k] = v; }
              return React.createElement(tag, { ref, className, ...htmlProps }, children);
            }
          );
          Component.displayName = `motion.${tag}`;
          return Component;
        },
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const MOCK_EMPLOYERS = [
  { employer_name: "Microsoft Corporation", employer_id: "abc123", total_filings: 50000, n_soc_codes: 45, latest_median_salary: 180000, latest_year: 2025, srs_score: 76.6, srs_tier: "Good", activity_status: "active" as const },
  { employer_name: "Infosys Limited", employer_id: "def456", total_filings: 227000, n_soc_codes: 30, latest_median_salary: 95000, latest_year: 2025, srs_score: 89.3, srs_tier: "Excellent", activity_status: "active" as const },
  { employer_name: "Google LLC", employer_id: "ghi789", total_filings: 35000, n_soc_codes: 40, latest_median_salary: 200000, latest_year: 2025, srs_score: 81.0, srs_tier: "Good", activity_status: "active" as const },
];

const MOCK_CUTOFF_TRENDS = [
  { bulletin_year: 2026, bulletin_month: 4, chart: "FAD", category: "EB2", country: "IND", status_flag: "D", cutoff_date: "2014-07-01", queue_position_days: null, monthly_advancement_days: 122, velocity_3m: 122, velocity_6m: 80, retrogression_flag: 0, retrogression_count_cum: 0 },
  { bulletin_year: 2026, bulletin_month: 4, chart: "FAD", category: "EB3", country: "IND", status_flag: "D", cutoff_date: "2013-11-01", queue_position_days: null, monthly_advancement_days: 0, velocity_3m: 0, velocity_6m: 15, retrogression_flag: 0, retrogression_count_cum: 0 },
  { bulletin_year: 2026, bulletin_month: 4, chart: "FAD", category: "EB1", country: "IND", status_flag: "C", cutoff_date: null, queue_position_days: null, monthly_advancement_days: null, velocity_3m: null, velocity_6m: null, retrogression_flag: 0, retrogression_count_cum: 0 },
  { bulletin_year: 2026, bulletin_month: 4, chart: "FAD", category: "EB2", country: "CHN", status_flag: "D", cutoff_date: "2021-09-01", queue_position_days: null, monthly_advancement_days: 60, velocity_3m: 60, velocity_6m: 50, retrogression_flag: 0, retrogression_count_cum: 0 },
  { bulletin_year: 2026, bulletin_month: 4, chart: "FAD", category: "EB2", country: "ROW", status_flag: "C", cutoff_date: null, queue_position_days: null, monthly_advancement_days: null, velocity_3m: null, velocity_6m: null, retrogression_flag: 0, retrogression_count_cum: 0 },
];

import { loadEmployerSearch } from "@/lib/data/employer-shard";
import { loadCutoffTrends } from "@/lib/data/pdi";

vi.mock("@/lib/data/employer-shard", () => ({
  loadEmployerSearch: vi.fn(() => Promise.resolve(MOCK_EMPLOYERS)),
}));

vi.mock("@/lib/data/pdi", () => ({
  loadCutoffTrends: vi.fn(() => Promise.resolve(MOCK_CUTOFF_TRENDS)),
}));

import { EmployerQuickCheck } from "@/components/home/employer-quick-check";
import { PdQuickCheck } from "@/components/home/pd-quick-check";

const mockLoadEmployerSearch = vi.mocked(loadEmployerSearch);
const mockLoadCutoffTrends = vi.mocked(loadCutoffTrends);

// ---------------------------------------------------------------------------
// Employer Quick-Check Tests
// ---------------------------------------------------------------------------

describe("EmployerQuickCheck", () => {
  beforeEach(() => {
    mockLoadEmployerSearch.mockReset();
    mockLoadEmployerSearch.mockResolvedValue(MOCK_EMPLOYERS);
  });

  it("renders the employer check header", async () => {
    render(<EmployerQuickCheck />);
    await waitFor(() => {
      expect(screen.getByText("Employer Check")).toBeInTheDocument();
    });
  });

  it("renders a search input", async () => {
    render(<EmployerQuickCheck />);
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  it("shows Loading placeholder while data loads", () => {
    mockLoadEmployerSearch.mockReturnValue(new Promise(() => {}));
    render(<EmployerQuickCheck />);
    expect(screen.getByPlaceholderText(/Loading/i)).toBeInTheDocument();
  });

  it("shows Type placeholder after data loads", async () => {
    render(<EmployerQuickCheck />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type an employer/i)).toBeInTheDocument();
    });
  });

  it("generates link to employer dashboard with ?q= URL parameter", async () => {
    // Verifies the home button → employer dashboard flow passes employer name in URL
    render(<EmployerQuickCheck />);
    
    // Wait for data to load and search input to appear
    const input = await screen.findByPlaceholderText(/Type an employer/i);
    
    // Type to find Google
    fireEvent.change(input, { target: { value: "Google" } });
    
    // Wait for "Google LLC" to appear in dropdown
    await waitFor(() => {
      expect(screen.getByText("Google LLC")).toBeInTheDocument();
    });
    
    // Click Google to select it
    fireEvent.click(screen.getByText("Google LLC"));
    
    // Verify "Full Report" link is generated with correct URL parameter
    await waitFor(() => {
      const fullReportLink = screen.getByText(/Full Report/).closest("a");
      expect(fullReportLink).toHaveAttribute("href", "/dashboard/employer?q=Google%20LLC");
    });
  });
});

// ---------------------------------------------------------------------------
// PD Quick-Check Tests
// ---------------------------------------------------------------------------

describe("PdQuickCheck", () => {
  beforeEach(() => {
    mockLoadCutoffTrends.mockReset();
    mockLoadCutoffTrends.mockResolvedValue(MOCK_CUTOFF_TRENDS);
  });

  it("renders the priority date check header", async () => {
    render(<PdQuickCheck />);
    await waitFor(() => {
      expect(screen.getByText("Priority Date Check")).toBeInTheDocument();
    });
  });

  it("renders category buttons (EB1, EB2, EB3)", async () => {
    render(<PdQuickCheck />);
    await waitFor(() => {
      expect(screen.getByText("EB1")).toBeInTheDocument();
      expect(screen.getByText("EB2")).toBeInTheDocument();
      expect(screen.getByText("EB3")).toBeInTheDocument();
    });
  });

  it("renders country buttons (IND, CHN, ROW)", async () => {
    render(<PdQuickCheck />);
    await waitFor(() => {
      expect(screen.getByText("IND")).toBeInTheDocument();
      expect(screen.getByText("CHN")).toBeInTheDocument();
      expect(screen.getByText("ROW")).toBeInTheDocument();
    });
  });

  it("shows EB2-IND cutoff by default", async () => {
    render(<PdQuickCheck />);
    await waitFor(() => {
      expect(screen.getByText("Jul 2014")).toBeInTheDocument();
    });
  });

  it("shows velocity for EB2-IND", async () => {
    render(<PdQuickCheck />);
    await waitFor(() => {
      expect(screen.getByText("+122 days/mo")).toBeInTheDocument();
    });
  });

  it("shows Current for EB1-IND", async () => {
    render(<PdQuickCheck />);
    // Click EB1 button
    const eb1 = await screen.findByText("EB1");
    fireEvent.click(eb1);
    await waitFor(() => {
      expect(screen.getByText("Current")).toBeInTheDocument();
    });
  });

  it("shows ROW cutoff after switching country", async () => {
    render(<PdQuickCheck />);
    const row = await screen.findByText("ROW");
    fireEvent.click(row);
    await waitFor(() => {
      // EB2-ROW is "Current"
      expect(screen.getByText("Current")).toBeInTheDocument();
    });
  });

  it("links to visa-bulletin dashboard with params", async () => {
    render(<PdQuickCheck />);
    await waitFor(() => {
      const link = screen.getByText(/Full Chart/i).closest("a");
      expect(link).toHaveAttribute("href", "/dashboard/visa-bulletin?category=EB2&country=IND");
    });
  });

  it("renders skeleton while loading", () => {
    mockLoadCutoffTrends.mockReturnValue(new Promise(() => {}));
    render(<PdQuickCheck />);
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeTruthy();
  });
});
