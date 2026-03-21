/**
 * AppShell — sidebar auto-collapse tests
 *
 * Verifies that the AppShell:
 * - Passes collapsed=true to Sidebar when the current route is "/"
 * - Passes collapsed=false to Sidebar on any non-home route
 * - Applies the correct lg:ml-* margin to <main> based on collapsed state
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: ({
    collapsed,
    onToggle,
  }: {
    collapsed?: boolean;
    onToggle?: () => void;
  }) => (
    <aside
      data-testid="mock-sidebar"
      data-collapsed={String(collapsed)}
      onClick={onToggle}
    />
  ),
}));

vi.mock("@/components/layout/footer", () => ({
  Footer: () => <footer data-testid="footer" />,
}));

vi.mock("@/components/ui/feedback-widget", () => ({
  FeedbackWidget: () => null,
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function renderShell(pathname: string, children?: React.ReactNode) {
  mockPathname = pathname;
  const { AppShell } = await import("@/components/layout/app-shell");
  return render(<AppShell>{children ?? <div>page content</div>}</AppShell>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules();
  mockPathname = "/";
});

describe("AppShell — sidebar auto-collapse", () => {
  it("passes collapsed=true to Sidebar on the home page ('/')", async () => {
    await renderShell("/");
    expect(screen.getByTestId("mock-sidebar")).toHaveAttribute("data-collapsed", "true");
  });

  it("passes collapsed=false to Sidebar on a dashboard route", async () => {
    await renderShell("/dashboard/employer");
    expect(screen.getByTestId("mock-sidebar")).toHaveAttribute("data-collapsed", "false");
  });

  it("passes collapsed=false to Sidebar on the insights route", async () => {
    await renderShell("/insights");
    expect(screen.getByTestId("mock-sidebar")).toHaveAttribute("data-collapsed", "false");
  });

  it("applies lg:ml-[60px] (narrow) to <main> on the home page", async () => {
    const { container } = await renderShell("/");
    const main = container.querySelector("main");
    expect(main?.className).toContain("lg:ml-[60px]");
  });

  it("applies lg:ml-[240px] (wide) to <main> on non-home routes", async () => {
    const { container } = await renderShell("/dashboard/employer");
    const main = container.querySelector("main");
    expect(main?.className).toContain("lg:ml-[240px]");
  });

  it("toggling the sidebar calls onToggle and changes collapsed state", async () => {
    await renderShell("/");
    // Sidebar starts collapsed on home
    const sidebar = screen.getByTestId("mock-sidebar");
    expect(sidebar).toHaveAttribute("data-collapsed", "true");

    // Simulate user clicking toggle (mock sidebar clicks onToggle via onClick)
    await act(async () => {
      fireEvent.click(sidebar);
    });

    // After toggle, collapsed should be false
    expect(screen.getByTestId("mock-sidebar")).toHaveAttribute("data-collapsed", "false");
  });

  it("renders children inside <main>", async () => {
    await renderShell("/", <p>Hello world</p>);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });
});
