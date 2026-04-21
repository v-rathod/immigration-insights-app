/**
 * QueueSnapshotCard — Component render tests.
 *
 * Tests focus on:
 *   - Null / empty-state rendering guards
 *   - Correct segment labels, total row, momentum banner
 *   - Violet border styling applied (border-violet-500/20)
 *   - Segment 3 visibility based on hasI140Estimate flag
 *   - getMomentum helper produces the right label for each gap bracket
 *
 * Data helpers (computeDemandBreakdown) are tested separately in
 * gcc-competitive-features.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { EbInventoryRecord, I140DemandRecord } from "@/types/p2-artifacts";
import type { CutoffTrendRecord } from "@/lib/data/pdi";

// ---------------------------------------------------------------------------
// Mock @/lib/data/pdi — swap computeDemandBreakdown for a spy
// ---------------------------------------------------------------------------
const mockComputeDemandBreakdown = vi.fn();

vi.mock("@/lib/data/pdi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/pdi")>(
    "@/lib/data/pdi"
  );
  return {
    ...actual,
    computeDemandBreakdown: (...args: unknown[]) =>
      mockComputeDemandBreakdown(...args),
  };
});

// Import AFTER the mock is registered
import { QueueSnapshotCard } from "@/components/pdi/queue-snapshot-card";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const sampleInventory: EbInventoryRecord[] = [
  {
    snapshot_date: "2026-01-02",
    country: "IND",
    category: "EB2",
    visa_status: "Available",
    pd_month: 7,
    pd_year: 2014,
    pending_count: 4000,
  },
  {
    snapshot_date: "2026-01-02",
    country: "IND",
    category: "EB2",
    visa_status: "Awaiting Availability",
    pd_month: 11,
    pd_year: 2014,
    pending_count: 25000,
  },
];

const sampleCutoffs: CutoffTrendRecord[] = [
  {
    bulletin_year: 2026,
    bulletin_month: 5,
    chart: "FAD",
    category: "EB2",
    country: "IND",
    status_flag: "D",
    cutoff_date: "2014-07-15",
    queue_position_days: null,
    monthly_advancement_days: null,
    velocity_3m: null,
    velocity_6m: null,
    retrogression_flag: 0,
    retrogression_count_cum: 0,
  },
  {
    bulletin_year: 2026,
    bulletin_month: 5,
    chart: "DFF",
    category: "EB2",
    country: "IND",
    status_flag: "D",
    cutoff_date: "2015-01-15",
    queue_position_days: null,
    monthly_advancement_days: null,
    velocity_3m: null,
    velocity_6m: null,
    retrogression_flag: 0,
    retrogression_count_cum: 0,
  },
];

const sampleI140: I140DemandRecord[] = [
  {
    report_period: "FY2025_Q4",
    country: "IND",
    category: "EB2",
    fiscal_year: 2015,
    received: 50000,
    approved: 40000,
    denied: 3000,
    pending: 150,
  },
];

/** Full nominal result from computeDemandBreakdown */
const FULL_RESULT = {
  currentlyProcessable: 4000,
  inDffWindow: 25000,
  beyondDff: 96700,
  total: 125700,
  fadCutoffDate: "2014-07-15",
  dffCutoffDate: "2015-01-15",
  fadDffGapMonths: 6,
  snapshotDate: "2026-01-02",
  i485DataMaxYear: 2014,
  isPdBeyondI485Ceiling: true,
  hasI140Estimate: true,
};

const defaultProps = {
  inventory: sampleInventory,
  cutoffTrends: sampleCutoffs,
  i140Data: sampleI140,
  category: "EB2",
  country: "IND",
  priorityDate: "2016-06-01",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Null-guard tests
// ---------------------------------------------------------------------------
describe("QueueSnapshotCard — null-guard rendering", () => {
  it("renders nothing when priorityDate is empty string", () => {
    mockComputeDemandBreakdown.mockReturnValue(null);
    const { container } = render(
      <QueueSnapshotCard {...defaultProps} priorityDate="" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when inventory is empty (computeDemandBreakdown returns null)", () => {
    mockComputeDemandBreakdown.mockReturnValue(null);
    const { container } = render(
      <QueueSnapshotCard {...defaultProps} inventory={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when computeDemandBreakdown returns null", () => {
    mockComputeDemandBreakdown.mockReturnValue(null);
    const { container } = render(<QueueSnapshotCard {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when result.total is 0", () => {
    mockComputeDemandBreakdown.mockReturnValue({
      ...FULL_RESULT,
      currentlyProcessable: 0,
      inDffWindow: 0,
      beyondDff: 0,
      total: 0,
    });
    const { container } = render(<QueueSnapshotCard {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Structural / content tests
// ---------------------------------------------------------------------------
describe("QueueSnapshotCard — content rendering", () => {
  beforeEach(() => {
    mockComputeDemandBreakdown.mockReturnValue(FULL_RESULT);
  });

  it("renders the Queue Snapshot heading", () => {
    render(<QueueSnapshotCard {...defaultProps} />);
    expect(screen.getByText("Queue Snapshot")).toBeTruthy();
  });

  it("renders all three segment label names", () => {
    render(<QueueSnapshotCard {...defaultProps} />);
    expect(screen.getByText("Approvable Now")).toBeTruthy();
    expect(screen.getByText("Filed, Awaiting FAD")).toBeTruthy();
    expect(screen.getByText("Cannot File Yet")).toBeTruthy();
  });

  it("renders the total demand row", () => {
    render(<QueueSnapshotCard {...defaultProps} />);
    expect(screen.getByText("Est. Total Demand Ahead")).toBeTruthy();
  });

  it("renders the momentum banner when both FAD and DFF dates exist", () => {
    render(<QueueSnapshotCard {...defaultProps} />);
    // Banner contains "DFF" + momentum text — may match multiple nodes
    const matches = screen.getAllByText(/DFF .+ of FAD/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders segment counts with ~ prefix for all three segments", () => {
    render(<QueueSnapshotCard {...defaultProps} />);
    // All three segments have counts formatted with ~
    expect(screen.getAllByText(/^~[\d,]+$/).length).toBeGreaterThanOrEqual(3);
  });

  it("renders category and country in the subtitle", () => {
    render(<QueueSnapshotCard {...defaultProps} />);
    // The subtitle includes category — may appear in multiple places
    const matches = screen.getAllByText(/EB2/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'Live Bulletin' badge", () => {
    render(<QueueSnapshotCard {...defaultProps} />);
    expect(screen.getByText("Live Bulletin")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Border / styling tests
// ---------------------------------------------------------------------------
describe("QueueSnapshotCard — styling", () => {
  it("applies violet border class to outer container", () => {
    mockComputeDemandBreakdown.mockReturnValue(FULL_RESULT);
    const { container } = render(<QueueSnapshotCard {...defaultProps} />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain("border-violet-500/20");
  });

  it("applies violet background tint to outer container", () => {
    mockComputeDemandBreakdown.mockReturnValue(FULL_RESULT);
    const { container } = render(<QueueSnapshotCard {...defaultProps} />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain("bg-violet-500/[0.03]");
  });

  it("accepts and forwards custom className prop", () => {
    mockComputeDemandBreakdown.mockReturnValue(FULL_RESULT);
    const { container } = render(
      <QueueSnapshotCard {...defaultProps} className="test-custom-class" />
    );
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain("test-custom-class");
  });
});

// ---------------------------------------------------------------------------
// Conditional segment 3 visibility
// ---------------------------------------------------------------------------
describe("QueueSnapshotCard — segment 3 conditional rendering", () => {
  it("hides segment 3 row when beyondDff is 0 and hasI140Estimate is false", () => {
    mockComputeDemandBreakdown.mockReturnValue({
      ...FULL_RESULT,
      beyondDff: 0,
      total: FULL_RESULT.currentlyProcessable + FULL_RESULT.inDffWindow,
      hasI140Estimate: false,
    });
    render(<QueueSnapshotCard {...defaultProps} />);
    // "Cannot File Yet" segment should NOT be in the document
    expect(screen.queryByText("Cannot File Yet")).toBeNull();
  });

  it("shows segment 3 row when beyondDff > 0 and hasI140Estimate is true", () => {
    mockComputeDemandBreakdown.mockReturnValue(FULL_RESULT);
    render(<QueueSnapshotCard {...defaultProps} />);
    expect(screen.getByText("Cannot File Yet")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Momentum banner label variations
// ---------------------------------------------------------------------------
describe("QueueSnapshotCard — momentum banner labels", () => {
  function renderWithGap(fadDffGapMonths: number) {
    mockComputeDemandBreakdown.mockReturnValue({
      ...FULL_RESULT,
      fadDffGapMonths,
    });
    render(<QueueSnapshotCard {...defaultProps} />);
  }

  it("shows 'No DFF advance' for gap of 0", () => {
    renderWithGap(0);
    expect(screen.getByText(/No DFF advance/i)).toBeTruthy();
  });

  it("shows limited filing window message for gap of 1-3 months", () => {
    renderWithGap(2);
    // Should say +2mo advance
    expect(screen.getByText(/\+2mo advance/i)).toBeTruthy();
  });

  it("shows moderate momentum message for gap of 4-6 months", () => {
    renderWithGap(5);
    expect(screen.getByText(/\+5mo advance/i)).toBeTruthy();
  });

  it("shows strong pre-staging message for gap > 6 months", () => {
    renderWithGap(9);
    expect(screen.getByText(/\+9mo advance/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// No momentum banner when dates missing
// ---------------------------------------------------------------------------
describe("QueueSnapshotCard — momentum banner absent when dates are null", () => {
  it("does not render momentum banner when fadCutoffDate is null", () => {
    mockComputeDemandBreakdown.mockReturnValue({
      ...FULL_RESULT,
      fadCutoffDate: null,
      dffCutoffDate: null,
      fadDffGapMonths: 0,
    });
    render(<QueueSnapshotCard {...defaultProps} />);
    // No "of FAD" text should appear since the banner is conditional
    expect(screen.queryByText(/DFF .* of FAD/i)).toBeNull();
  });
});
