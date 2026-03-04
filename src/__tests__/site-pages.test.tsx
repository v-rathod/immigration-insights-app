/**
 * Tests for Footer, About, Privacy, Terms pages, and FeedbackWidget.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

// Mock next/navigation and next/link
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
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

import { Footer } from "@/components/layout/footer";
import { FeedbackWidget } from "@/components/ui/feedback-widget";
import AboutPage from "@/app/about/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

// =========================================================================
// Footer
// =========================================================================

describe("Footer", () => {
  it("renders brand name and tagline", () => {
    render(<Footer />);
    expect(screen.getByText("NorthStar Compass")).toBeInTheDocument();
    expect(
      screen.getByText(/personalized immigration insights/i)
    ).toBeInTheDocument();
  });

  it("renders all link group headings", () => {
    render(<Footer />);
    expect(screen.getByText("Dashboards")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
    expect(screen.getByText("Project")).toBeInTheDocument();
  });

  it("renders dashboard links", () => {
    render(<Footer />);
    expect(screen.getByText("Visa Bulletin")).toBeInTheDocument();
    expect(screen.getByText("Sponsor Score")).toBeInTheDocument();
  });

  it("renders project links (About, Privacy, Terms)", () => {
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText("About")).toBeInTheDocument();
    expect(within(footer).getByText("Privacy")).toBeInTheDocument();
    expect(within(footer).getByText("Terms")).toBeInTheDocument();
  });

  it("renders data source badges", () => {
    render(<Footer />);
    expect(screen.getByText("Dept. of Labor")).toBeInTheDocument();
    expect(screen.getByText("State Dept. Visa Bulletin")).toBeInTheDocument();
    expect(screen.getByText("Bureau of Labor Statistics")).toBeInTheDocument();
    expect(screen.getByText("USCIS")).toBeInTheDocument();
    expect(screen.getByText("DHS")).toBeInTheDocument();
  });

  it("renders copyright with current year", () => {
    render(<Footer />);
    const year = new Date().getFullYear().toString();
    expect(
      screen.getByText((text) => text.includes(year) && text.includes("NorthStar"))
    ).toBeInTheDocument();
  });

  it("renders GitHub link", () => {
    render(<Footer />);
    expect(screen.getByLabelText("GitHub repository")).toHaveAttribute(
      "target",
      "_blank"
    );
  });
});

// =========================================================================
// FeedbackWidget
// =========================================================================

describe("FeedbackWidget", () => {
  /** Helper: open the feedback dialog by clicking the FAB */
  const openFeedback = () => {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByTitle("Send feedback"));
  };

  it("renders floating FAB button", () => {
    render(<FeedbackWidget />);
    expect(screen.getByTitle("Send feedback")).toBeInTheDocument();
  });

  it("opens feedback dialog on click", () => {
    openFeedback();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Send Feedback" })
    ).toBeInTheDocument();
  });

  it("shows three feedback type buttons", () => {
    openFeedback();
    expect(screen.getByText("General Feedback")).toBeInTheDocument();
    expect(screen.getByText("Feature Request")).toBeInTheDocument();
    expect(screen.getByText("Bug Report")).toBeInTheDocument();
  });

  it("has a textarea for message input", () => {
    openFeedback();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("submit button is disabled when empty", () => {
    openFeedback();
    const submitBtn = screen.getByText(/submit/i).closest("button");
    expect(submitBtn).toBeDisabled();
  });

  it("submit button enables when text is entered", () => {
    openFeedback();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Great tool!" },
    });
    const submitBtn = screen.getByText(/submit/i).closest("button");
    expect(submitBtn).not.toBeDisabled();
  });

  it("closes on close button", () => {
    openFeedback();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows character count", () => {
    openFeedback();
    expect(screen.getByText("0 / 2,000")).toBeInTheDocument();
  });
});

// =========================================================================
// About Page
// =========================================================================

describe("AboutPage", () => {
  it("renders page title", () => {
    render(<AboutPage />);
    expect(screen.getByText("About This Project")).toBeInTheDocument();
  });

  it("renders the story section", () => {
    render(<AboutPage />);
    expect(screen.getByText("The Story")).toBeInTheDocument();
    expect(
      screen.getByText(/software engineer/i)
    ).toBeInTheDocument();
  });

  it("renders guiding principles", () => {
    render(<AboutPage />);
    expect(screen.getByText("Guiding Principles")).toBeInTheDocument();
    expect(screen.getByText("Privacy First")).toBeInTheDocument();
    expect(screen.getByText("Open Source")).toBeInTheDocument();
    expect(screen.getByText("Free Forever")).toBeInTheDocument();
    expect(screen.getByText("Community Driven")).toBeInTheDocument();
  });

  it("renders data sources section", () => {
    render(<AboutPage />);
    expect(screen.getByText("Data Sources")).toBeInTheDocument();
    expect(screen.getByText("Dept. of Labor (DOL)")).toBeInTheDocument();
    expect(screen.getByText("State Dept. Visa Bulletin")).toBeInTheDocument();
  });

  it("renders the three-repo pipeline", () => {
    render(<AboutPage />);
    expect(screen.getByText("Horizon")).toBeInTheDocument();
    expect(screen.getByText("Meridian")).toBeInTheDocument();
    expect(screen.getByText("Compass")).toBeInTheDocument();
  });

  it("renders Get Involved CTA", () => {
    render(<AboutPage />);
    expect(screen.getByText("Get Involved")).toBeInTheDocument();
    expect(screen.getByText("View on GitHub")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
  });

  it("renders tech stack pills", () => {
    render(<AboutPage />);
    expect(screen.getByText("Next.js 16")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Tailwind CSS 4")).toBeInTheDocument();
  });
});

// =========================================================================
// Privacy Page
// =========================================================================

describe("PrivacyPage", () => {
  it("renders page title", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
  });

  it("renders all policy sections", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("What We Collect")).toBeInTheDocument();
    expect(screen.getByText("Your Data Stays Local")).toBeInTheDocument();
    expect(screen.getByText("Hosting & Infrastructure")).toBeInTheDocument();
    expect(screen.getByText("Cookies & Tracking")).toBeInTheDocument();
    expect(screen.getByText("Third-Party Data Sources")).toBeInTheDocument();
    expect(screen.getByText("Security")).toBeInTheDocument();
  });

  it("states nothing is collected", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/we don't collect your data/i)).toBeInTheDocument();
  });
});

// =========================================================================
// Terms Page
// =========================================================================

describe("TermsPage", () => {
  it("renders page title", () => {
    render(<TermsPage />);
    expect(screen.getByText("Terms of Use")).toBeInTheDocument();
  });

  it("renders all terms sections", () => {
    render(<TermsPage />);
    expect(screen.getByText("Use of Service")).toBeInTheDocument();
    expect(screen.getByText("Not Legal Advice")).toBeInTheDocument();
    expect(screen.getByText("Data Accuracy")).toBeInTheDocument();
    expect(screen.getByText("Changes to Terms")).toBeInTheDocument();
    expect(screen.getByText("Open Source License")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
  });

  it("warns about legal advice", () => {
    render(<TermsPage />);
    expect(
      screen.getByText(/not a substitute for professional legal/i)
    ).toBeInTheDocument();
  });
});
