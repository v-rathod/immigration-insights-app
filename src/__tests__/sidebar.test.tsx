import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

  it("renders Home link", async () => {
    renderSidebar();
    const homeLinks = await screen.findAllByText("Home");
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders all dashboard nav items", async () => {
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

  it("renders Analytics group with PDI, SRS, and Wage Intelligence", async () => {
    renderSidebar();
    const pdiItems = await screen.findAllByText("Priority Date Cortex");
    expect(pdiItems.length).toBeGreaterThanOrEqual(1);
    const srsItems = await screen.findAllByText("Sponsor Score");
    expect(srsItems.length).toBeGreaterThanOrEqual(1);
    const wageItems = await screen.findAllByText("Wage Intelligence");
    expect(wageItems.length).toBeGreaterThanOrEqual(1);
  });

  it("marks active page with aria-current", async () => {
    renderSidebar();
    // Home should be active since we mocked pathname as "/"
    const homeLinks = await screen.findAllByText("Home");
    const activeLink = homeLinks.find(
      (el) => el.closest("button")?.getAttribute("aria-current") === "page"
    );
    expect(activeLink).toBeDefined();
  });

  it("renders mobile hamburger button", () => {
    renderSidebar();
    expect(screen.getByLabelText("Open navigation menu")).toBeInTheDocument();
  });

  it("renders My Insights in the Personal group", async () => {
    renderSidebar();
    const items = await screen.findAllByText("My Insights");
    expect(items.length).toBeGreaterThanOrEqual(1);
    // Setup should NOT be in the sidebar
    const setupItems = screen.queryAllByText("Setup");
    expect(setupItems.length).toBe(0);
  });

  it("renders collapse button", async () => {
    renderSidebar();
    const collapseButtons = await screen.findAllByLabelText("Collapse sidebar");
    expect(collapseButtons.length).toBeGreaterThanOrEqual(1);
  });
});
