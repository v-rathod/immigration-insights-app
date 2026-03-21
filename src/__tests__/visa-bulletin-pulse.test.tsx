import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock next/link
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
              {
                children,
                className,
                ...rest
              }: { children?: React.ReactNode; className?: string; [key: string]: unknown },
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
  };
});

// ---------------------------------------------------------------------------
// Mock data loader
// ---------------------------------------------------------------------------
const MOCK_TRENDS = [
  {
    bulletin_year: 2026,
    bulletin_month: 4,
    chart: "FAD",
    category: "EB2",
    country: "IND",
    status_flag: "D",
    cutoff_date: "2014-07-01",
    queue_position_days: null,
    monthly_advancement_days: 122,
    velocity_3m: 122,
    velocity_6m: 80,
    retrogression_flag: 0,
    retrogression_count_cum: 0,
  },
  {
    bulletin_year: 2026,
    bulletin_month: 4,
    chart: "FAD",
    category: "EB3",
    country: "IND",
    status_flag: "D",
    cutoff_date: "2013-11-01",
    queue_position_days: null,
    monthly_advancement_days: 0,
    velocity_3m: 0,
    velocity_6m: 15,
    retrogression_flag: 0,
    retrogression_count_cum: 0,
  },
  {
    bulletin_year: 2026,
    bulletin_month: 4,
    chart: "FAD",
    category: "EB1",
    country: "IND",
    status_flag: "D",
    cutoff_date: "2023-04-01",
    queue_position_days: null,
    monthly_advancement_days: 30,
    velocity_3m: 30,
    velocity_6m: 45,
    retrogression_flag: 0,
    retrogression_count_cum: 0,
  },
  {
    bulletin_year: 2026,
    bulletin_month: 4,
    chart: "FAD",
    category: "EB2",
    country: "CHN",
    status_flag: "D",
    cutoff_date: "2021-09-01",
    queue_position_days: null,
    monthly_advancement_days: 60,
    velocity_3m: 60,
    velocity_6m: 50,
    retrogression_flag: 0,
    retrogression_count_cum: 0,
  },
  {
    bulletin_year: 2026,
    bulletin_month: 4,
    chart: "FAD",
    category: "EB3",
    country: "CHN",
    status_flag: "C",
    cutoff_date: null,
    queue_position_days: null,
    monthly_advancement_days: null,
    velocity_3m: null,
    velocity_6m: null,
    retrogression_flag: 0,
    retrogression_count_cum: 0,
  },
  {
    bulletin_year: 2026,
    bulletin_month: 4,
    chart: "FAD",
    category: "EB2",
    country: "ROW",
    status_flag: "D",
    cutoff_date: "2024-10-01",
    queue_position_days: null,
    monthly_advancement_days: 90,
    velocity_3m: 90,
    velocity_6m: 70,
    retrogression_flag: 0,
    retrogression_count_cum: 0,
  },
  // DFF chart row — should be ignored
  {
    bulletin_year: 2026,
    bulletin_month: 4,
    chart: "DFF",
    category: "EB2",
    country: "IND",
    status_flag: "D",
    cutoff_date: "2015-01-01",
    queue_position_days: null,
    monthly_advancement_days: 60,
    velocity_3m: 60,
    velocity_6m: 40,
    retrogression_flag: 0,
    retrogression_count_cum: 0,
  },
];

import { loadCutoffTrends } from "@/lib/data/pdi";

vi.mock("@/lib/data/pdi", () => ({
  loadCutoffTrends: vi.fn(() => Promise.resolve(MOCK_TRENDS)),
}));

import { VisaBulletinPulse } from "@/components/home/visa-bulletin-pulse";

const mockLoadCutoffTrends = vi.mocked(loadCutoffTrends);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VisaBulletinPulse", () => {
  beforeEach(() => {
    mockLoadCutoffTrends.mockReset();
    mockLoadCutoffTrends.mockResolvedValue(MOCK_TRENDS);
  });

  it("renders skeleton while loading", () => {
    // Override to never resolve
    mockLoadCutoffTrends.mockReturnValue(new Promise(() => {}));

    render(<VisaBulletinPulse />);
    // Skeleton has animate-pulse class on the outer card
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeTruthy();
  });

  it("renders the bulletin month label", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument();
    });
  });

  it("renders the Visa Bulletin header", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      expect(screen.getByText("Visa Bulletin")).toBeInTheDocument();
    });
  });

  it("renders a table with accessible label", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      expect(
        screen.getByRole("table", { name: /visa bulletin cutoff/i })
      ).toBeInTheDocument();
    });
  });

  it("renders EB2 India cutoff date", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      expect(screen.getByText("Jul 2014")).toBeInTheDocument();
    });
  });

  it("renders EB3 India cutoff date", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      expect(screen.getByText("Nov 2013")).toBeInTheDocument();
    });
  });

  it("renders Current for status_flag C categories", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      // EB3-CHN is current
      const currentTexts = screen.getAllByText("Current");
      expect(currentTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows velocity for advancing categories", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      // EB2-IND has velocity_3m = 122
      expect(screen.getByText("+122 days/mo")).toBeInTheDocument();
    });
  });

  it("shows no movement for stalled categories", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      // EB3-IND has velocity_3m = 0
      expect(screen.getByText("No movement")).toBeInTheDocument();
    });
  });

  it("renders source attribution", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      expect(
        screen.getByText(/Department of State/i)
      ).toBeInTheDocument();
    });
  });

  it("renders all key series rows", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      // 6 key series defined: EB1-IND, EB2-IND, EB3-IND, EB2-CHN, EB3-CHN, EB2-ROW
      const rows = screen.getAllByRole("row");
      // 1 header row + 6 data rows = 7
      expect(rows.length).toBe(7);
    });
  });

  it("does not render DFF chart rows in default FAD mode", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      // DFF EB2-IND has cutoff Jan 2015, should not appear in default FAD view
      expect(screen.queryByText("Jan 2015")).not.toBeInTheDocument();
    });
  });

  it("renders FAD/DFF toggle buttons", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "Final Action" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Date for Filing" })).toBeInTheDocument();
    });
  });

  it("FAD is selected by default", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "Final Action" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "Date for Filing" })).toHaveAttribute("aria-checked", "false");
    });
  });

  it("switching to DFF shows DFF data", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "Date for Filing" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("radio", { name: "Date for Filing" }));
    await waitFor(() => {
      // DFF EB2-IND cutoff is Jan 2015 in mock data
      expect(screen.getByText("Jan 2015")).toBeInTheDocument();
    });
  });

  it("renders PD Cortex link to /dashboard/visa-bulletin", async () => {
    render(<VisaBulletinPulse />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /pd cortex/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/dashboard/visa-bulletin");
    });
  });

  it("renders nothing when data is empty", async () => {
    mockLoadCutoffTrends.mockResolvedValue([]);

    const { container } = render(<VisaBulletinPulse />);
    await waitFor(() => {
      // After loading completes with empty data, should render nothing
      expect(container.querySelector("table")).toBeNull();
    });
  });
});
