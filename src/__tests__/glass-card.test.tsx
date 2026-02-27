import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GlassCard } from "@/components/ui/glass-card";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    motion: {
      div: ({
        children,
        className,
        ...props
      }: {
        children: React.ReactNode;
        className?: string;
        [key: string]: unknown;
      }) => (
        <div className={className} data-testid="motion-div" {...filterMotionProps(props)}>
          {children}
        </div>
      ),
    },
  };
});

// Filter out framer-motion-specific props
function filterMotionProps(props: Record<string, unknown>) {
  const motionKeys = [
    "variants",
    "initial",
    "animate",
    "exit",
    "whileHover",
    "whileTap",
    "transition",
    "style",
    "layout",
  ];
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!motionKeys.includes(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

describe("GlassCard", () => {
  it("renders children", () => {
    render(<GlassCard>Card Content</GlassCard>);
    expect(screen.getByText("Card Content")).toBeInTheDocument();
  });

  it("applies default variant styles", () => {
    render(<GlassCard>Default</GlassCard>);
    const el = screen.getByTestId("motion-div");
    expect(el.className).toContain("rounded-2xl");
    expect(el.className).toContain("backdrop-blur-xl");
  });

  it("applies padding variants", () => {
    const { rerender } = render(<GlassCard padding="sm">Small</GlassCard>);
    expect(screen.getByTestId("motion-div").className).toContain("p-4");

    rerender(<GlassCard padding="lg">Large</GlassCard>);
    expect(screen.getByTestId("motion-div").className).toContain("p-8");

    rerender(<GlassCard padding="none">None</GlassCard>);
    expect(screen.getByTestId("motion-div").className).not.toContain("p-4");
    expect(screen.getByTestId("motion-div").className).not.toContain("p-6");
    expect(screen.getByTestId("motion-div").className).not.toContain("p-8");
  });

  it("applies glow effect class", () => {
    render(<GlassCard glow>Glowing</GlassCard>);
    expect(screen.getByTestId("motion-div").className).toContain("hover:shadow");
  });

  it("passes additional className", () => {
    render(<GlassCard className="my-custom-class">Custom</GlassCard>);
    expect(screen.getByTestId("motion-div").className).toContain("my-custom-class");
  });

  it("applies interactive variant", () => {
    render(<GlassCard variant="interactive">Interactive</GlassCard>);
    expect(screen.getByTestId("motion-div").className).toContain("cursor-pointer");
  });
});
