import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

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

// Must import after mocks
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeProvider } from "@/components/providers/theme-provider";

function renderSidebar() {
  return render(
    <ThemeProvider>
      <Sidebar />
    </ThemeProvider>
  );
}

describe("Sidebar", () => {
  it("renders navigation", () => {
    renderSidebar();
    // Desktop + mobile both have the same aria-label
    const navs = screen.getAllByLabelText("Main navigation");
    expect(navs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Compass brand", async () => {
    renderSidebar();
    // There will be two instances (desktop + mobile), just check one exists
    const brands = await screen.findAllByText("Compass");
    expect(brands.length).toBeGreaterThanOrEqual(1);
  });

  it("renders My Insights as first ungrouped item", async () => {
    renderSidebar();
    const items = await screen.findAllByText("My Insights");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("renders all dashboard nav items in Explore group", async () => {
    renderSidebar();
    const dashboardLabels = [
      "EB Categories",
      "Geographic",
      "Occupation Demand",
      "Processing",
      "Approvals",
    ];

    for (const label of dashboardLabels) {
      const items = await screen.findAllByText(label);
      expect(items.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("renders Core Tools group with PDI, SRS, and Wage Intelligence", async () => {
    renderSidebar();
    const pdiItems = await screen.findAllByText("Priority Date Cortex");
    expect(pdiItems.length).toBeGreaterThanOrEqual(1);
    const srsItems = await screen.findAllByText("Employer Sponsor Score");
    expect(srsItems.length).toBeGreaterThanOrEqual(1);
    const wageItems = await screen.findAllByText("Wage Intelligence");
    expect(wageItems.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render Home link (logo navigates home instead)", async () => {
    renderSidebar();
    const homeItems = screen.queryAllByText("Home");
    expect(homeItems.length).toBe(0);
  });

  it("renders group labels", async () => {
    renderSidebar();
    const coreTools = await screen.findAllByText("Core Tools");
    expect(coreTools.length).toBeGreaterThanOrEqual(1);
    const explore = await screen.findAllByText("Explore");
    expect(explore.length).toBeGreaterThanOrEqual(1);
  });

  it("renders mobile hamburger button", () => {
    renderSidebar();
    expect(screen.getByLabelText("Open navigation menu")).toBeInTheDocument();
  });

  it("renders collapse button", async () => {
    renderSidebar();
    const collapseButtons = await screen.findAllByLabelText("Collapse sidebar");
    expect(collapseButtons.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Sidebar — Mobile Navigation (Phase 7)", () => {
  it("mobile nav has My Insights as a prominent card-style CTA", () => {
    renderSidebar();
    // Open mobile nav
    fireEvent.click(screen.getByLabelText("Open navigation menu"));
    // My Insights card should have descriptive subtext
    expect(screen.getByText("Your personalized dashboard")).toBeInTheDocument();
  });

  it("mobile nav has close button with 44px touch target", () => {
    renderSidebar();
    fireEvent.click(screen.getByLabelText("Open navigation menu"));
    const closeBtn = screen.getByLabelText("Close navigation");
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn.className).toContain("min-h-[44px]");
    expect(closeBtn.className).toContain("min-w-[44px]");
  });

  it("mobile nav items have 44px minimum touch targets", () => {
    renderSidebar();
    fireEvent.click(screen.getByLabelText("Open navigation menu"));
    // Check mobile nav items have min-h-[44px] class
    const mobileNav = screen.getByLabelText("Mobile navigation");
    const navButtons = mobileNav.querySelectorAll("button");
    const navItemButtons = Array.from(navButtons).filter(b =>
      b.className.includes("min-h-[44px]")
    );
    expect(navItemButtons.length).toBeGreaterThan(0);
  });

  it("mobile Explore group is collapsed by default", () => {
    renderSidebar();
    fireEvent.click(screen.getByLabelText("Open navigation menu"));
    // Explore group has an expand toggle with aria-expanded=false
    const exploreToggle = screen.getByRole("button", { name: /explore/i });
    expect(exploreToggle).toHaveAttribute("aria-expanded", "false");
  });

  it("mobile Explore group can be expanded", () => {
    renderSidebar();
    fireEvent.click(screen.getByLabelText("Open navigation menu"));
    const exploreToggle = screen.getByRole("button", { name: /explore/i });
    // Initially, EB Categories should not be visible in mobile nav (collapsed)
    expect(screen.getByLabelText("Mobile navigation").textContent).not.toContain("EB Categories");
    // Expand
    fireEvent.click(exploreToggle);
    expect(exploreToggle).toHaveAttribute("aria-expanded", "true");
  });
});

describe("Sidebar — Controlled props", () => {
  it("shows Expand sidebar button when collapsed=true is passed", async () => {
    render(
      <ThemeProvider>
        <Sidebar collapsed={true} />
      </ThemeProvider>
    );
    const expandBtns = await screen.findAllByLabelText("Expand sidebar");
    expect(expandBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Collapse sidebar button when collapsed=false is passed", async () => {
    render(
      <ThemeProvider>
        <Sidebar collapsed={false} />
      </ThemeProvider>
    );
    const collapseBtns = await screen.findAllByLabelText("Collapse sidebar");
    expect(collapseBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onToggle when the collapse/expand button is clicked", async () => {
    const onToggle = vi.fn();
    render(
      <ThemeProvider>
        <Sidebar collapsed={false} onToggle={onToggle} />
      </ThemeProvider>
    );
    const collapseBtn = await screen.findByLabelText("Collapse sidebar");
    fireEvent.click(collapseBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not change internal state when controlled (onToggle fires but collapsed stays as-is)", async () => {
    // Simulate fully controlled: parent decides the state.
    // With collapsed=false and onToggle that does nothing, sidebar stays expanded.
    const onToggle = vi.fn();
    render(
      <ThemeProvider>
        <Sidebar collapsed={false} onToggle={onToggle} />
      </ThemeProvider>
    );
    const collapseBtn = await screen.findByLabelText("Collapse sidebar");
    fireEvent.click(collapseBtn);
    // onToggle was called but collapsed prop is still false, so still shows Collapse
    expect(await screen.findByLabelText("Collapse sidebar")).toBeInTheDocument();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
