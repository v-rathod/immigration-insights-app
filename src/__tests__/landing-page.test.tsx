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
  it("renders the hero headline", async () => {
    renderLanding();
    expect(
      await screen.findByText("Navigate Your", { exact: false })
    ).toBeInTheDocument();
  });

  it("renders the immigration journey gradient text", async () => {
    renderLanding();
    expect(
      await screen.findByText("Immigration Journey")
    ).toBeInTheDocument();
  });

  it("renders the Get Started CTA", async () => {
    renderLanding();
    expect(
      await screen.findByText("Get Started")
    ).toBeInTheDocument();
  });

  it("renders the Ask a Question CTA", async () => {
    renderLanding();
    expect(
      await screen.findByText("Ask a Question")
    ).toBeInTheDocument();
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
      "Sponsor Reliability Score",
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

  it("renders value propositions", async () => {
    renderLanding();
    expect(await screen.findByText("Real-Time Data")).toBeInTheDocument();
    expect(await screen.findByText("Privacy First")).toBeInTheDocument();
    expect(await screen.findByText("AI-Powered")).toBeInTheDocument();
  });

  it("has accessible section labels", async () => {
    renderLanding();
    expect(screen.getByLabelText("Key statistics")).toBeInTheDocument();
    expect(screen.getByLabelText("Dashboards")).toBeInTheDocument();
    expect(screen.getByLabelText("Why Compass")).toBeInTheDocument();
  });

  it("links Get Started to /insights", async () => {
    renderLanding();
    const link = await screen.findByText("Get Started");
    expect(link.closest("a")).toHaveAttribute("href", "/insights");
  });

  it("links dashboard cards to correct routes", async () => {
    renderLanding();
    const visaLink = await screen.findByText("Visa Bulletin Trends");
    expect(visaLink.closest("a")).toHaveAttribute(
      "href",
      "/dashboard/visa-bulletin/"
    );
  });
});
