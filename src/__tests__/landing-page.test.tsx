import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation and next/link
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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

// Mock the VisaBulletinPulse component (loads data async)
vi.mock("@/components/home/visa-bulletin-pulse", () => ({
  VisaBulletinPulse: () => <div data-testid="visa-bulletin-pulse">Visa Bulletin Pulse</div>,
}));

// Mock intent interceptor widgets
vi.mock("@/components/home/employer-quick-check", () => ({
  EmployerQuickCheck: () => <div data-testid="employer-quick-check">Employer Quick Check</div>,
}));

vi.mock("@/components/home/pd-quick-check", () => ({
  PdQuickCheck: () => <div data-testid="pd-quick-check">PD Quick Check</div>,
}));

vi.mock("@/components/home/featured-employers", () => ({
  FeaturedEmployers: () => <div data-testid="featured-employers">Featured Employers</div>,
}));

vi.mock("@/components/home/welcome-back-banner", () => ({
  WelcomeBackBanner: () => <div data-testid="welcome-back-banner">Welcome Back</div>,
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
              }: { children?: React.ReactNode; className?: string; [key: string]: unknown },
              ref: React.Ref<HTMLElement>
            ) => {
              // Filter out framer-motion props
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
    useSpring: () => ({ set: vi.fn() }),
    useTransform: (_: unknown, fn: (v: number) => string) => fn(0),
    useInView: () => true,
  };
});

import LandingPage from "@/app/page";
import { ThemeProvider } from "@/components/providers/theme-provider";

function renderLanding() {
  return render(
    <ThemeProvider>
      <LandingPage />
    </ThemeProvider>
  );
}

describe("Landing Page", () => {
  it("renders the data-first hero headline", async () => {
    renderLanding();
    expect(
      await screen.findByText("Your green card timeline.", { exact: false })
    ).toBeInTheDocument();
  });

  it("renders the gradient salary text", async () => {
    renderLanding();
    expect(
      await screen.findByText("Your salary rank.")
    ).toBeInTheDocument();
  });

  it("renders Check My Situation CTA", async () => {
    renderLanding();
    expect(
      await screen.findByText("Check My Situation")
    ).toBeInTheDocument();
  });

  it("renders Look Up an Employer CTA", async () => {
    renderLanding();
    expect(
      await screen.findByText("Look Up an Employer")
    ).toBeInTheDocument();
  });

  it("renders the live data badge", async () => {
    renderLanding();
    expect(await screen.findByText("Live data")).toBeInTheDocument();
  });

  it("renders the VisaBulletinPulse widget", () => {
    renderLanding();
    expect(screen.getByTestId("visa-bulletin-pulse")).toBeInTheDocument();
  });

  it("renders stat cards", async () => {
    renderLanding();
    expect(await screen.findByText("Data Points")).toBeInTheDocument();
    expect(await screen.findByText("Employers Tracked")).toBeInTheDocument();
    expect(await screen.findByText("Countries")).toBeInTheDocument();
    expect(await screen.findByText("Forecast Series")).toBeInTheDocument();
  });

  it("renders all 8 dashboard cards", async () => {
    renderLanding();
    const dashboards = [
      "Visa Bulletin Trends",
      "Employer Sponsor Score",
      "EB Category Comparison",
      "Geographic Heatmaps",
      "Wage Competitiveness",
      "Occupation Demand",
      "Processing Speed",
      "Approval & Denial Trends",
    ];

    for (const name of dashboards) {
      expect(await screen.findByText(name)).toBeInTheDocument();
    }
  });

  it("has accessible section labels", async () => {
    renderLanding();
    expect(screen.getByLabelText("Key statistics")).toBeInTheDocument();
    expect(screen.getByLabelText("Explore dashboards")).toBeInTheDocument();
  });

  it("links Check My Situation to /insights", async () => {
    renderLanding();
    const link = await screen.findByText("Check My Situation");
    expect(link.closest("a")).toHaveAttribute("href", "/insights");
  });

  it("links Look Up an Employer to /dashboard/employer", async () => {
    renderLanding();
    const link = await screen.findByText("Look Up an Employer");
    expect(link.closest("a")).toHaveAttribute("href", "/dashboard/employer");
  });

  it("links dashboard cards to correct routes", async () => {
    renderLanding();
    const visaLink = await screen.findByText("Visa Bulletin Trends");
    expect(visaLink.closest("a")).toHaveAttribute(
      "href",
      "/dashboard/visa-bulletin/"
    );
  });

  it("renders Explore the Full Dataset heading", async () => {
    renderLanding();
    expect(
      await screen.findByText("Explore the Full Dataset")
    ).toBeInTheDocument();
  });

  it("renders the quick-check widgets section", () => {
    renderLanding();
    expect(screen.getByTestId("employer-quick-check")).toBeInTheDocument();
    expect(screen.getByTestId("pd-quick-check")).toBeInTheDocument();
  });

  it("has accessible quick check section label", () => {
    renderLanding();
    expect(screen.getByLabelText("Quick check tools")).toBeInTheDocument();
  });

  it("renders the featured employers section", () => {
    renderLanding();
    expect(screen.getByTestId("featured-employers")).toBeInTheDocument();
    expect(screen.getByLabelText("Featured employers")).toBeInTheDocument();
  });
});
