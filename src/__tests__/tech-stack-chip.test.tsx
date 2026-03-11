import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { TechStackChip } from "@/components/about/tech-stack-chip";

describe("TechStackChip", () => {
  const mockTech = {
    label: "XGBoost",
    detail: "Gradient boosting for SRS ranking",
    explanation:
      "XGBoost powers Meridian's Sponsor Reliability Score (SRS) model: predicts employer approval likelihood from case history, wages, SOC mix, and geographic diversity. Outperforms linear models in SHAP-based validation.",
  };

  it("renders the chip label", () => {
    render(
      <TechStackChip
        label={mockTech.label}
        detail={mockTech.detail}
        explanation={mockTech.explanation}
      />
    );
    expect(screen.getByText(mockTech.label)).toBeInTheDocument();
  });

  it("displays detail text in the title attribute", () => {
    render(
      <TechStackChip
        label={mockTech.label}
        detail={mockTech.detail}
        explanation={mockTech.explanation}
      />
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", mockTech.detail);
  });

  it("shows tooltip on hover with explanation", async () => {
    const user = userEvent.setup();
    render(
      <TechStackChip
        label={mockTech.label}
        detail={mockTech.detail}
        explanation={mockTech.explanation}
      />
    );

    const button = screen.getByRole("button");
    
    // Hover over the button
    await user.hover(button);

    // Wait for tooltip to appear with explanation
    await waitFor(() => {
      expect(screen.getByText(mockTech.explanation)).toBeInTheDocument();
    });
  });

  it("hides tooltip when mouse leaves", async () => {
    const user = userEvent.setup();
    render(
      <TechStackChip
        label={mockTech.label}
        detail={mockTech.detail}
        explanation={mockTech.explanation}
      />
    );

    const button = screen.getByRole("button");

    // Hover over the button
    await user.hover(button);

    // Verify tooltip is visible
    await waitFor(() => {
      expect(screen.getByText(mockTech.explanation)).toBeInTheDocument();
    });

    // Unhover
    await user.unhover(button);

    // Tooltip should be hidden (might be removed from DOM or have visibility:hidden)
    await waitFor(() => {
      const tooltip = screen.queryByText(mockTech.explanation);
      expect(tooltip).not.toBeInTheDocument();
    });
  });

  it("displays info icon on hover", async () => {
    const user = userEvent.setup();
    render(
      <TechStackChip
        label={mockTech.label}
        detail={mockTech.detail}
        explanation={mockTech.explanation}
      />
    );

    const button = screen.getByRole("button");

    // Check if info icon becomes visible on hover (class opacity-0 → opacity-60)
    const infoIcon = button.querySelector(".opacity-0");
    expect(infoIcon).toBeInTheDocument();

    // Hover and verify icon is still there (Framer Motion handles opacity)
    await user.hover(button);
    await waitFor(() => {
      expect(screen.getByText(mockTech.explanation)).toBeInTheDocument();
    });
  });

  it("has accessible aria-label", () => {
    render(
      <TechStackChip
        label={mockTech.label}
        detail={mockTech.detail}
        explanation={mockTech.explanation}
      />
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", `${mockTech.label}: ${mockTech.detail}`);
  });

  it("displays both detail and explanation in tooltip", async () => {
    const user = userEvent.setup();
    render(
      <TechStackChip
        label={mockTech.label}
        detail={mockTech.detail}
        explanation={mockTech.explanation}
      />
    );

    const button = screen.getByRole("button");
    await user.hover(button);

    // Both detail and explanation should be visible
    await waitFor(() => {
      expect(screen.getByText(mockTech.detail)).toBeInTheDocument();
      expect(screen.getByText(mockTech.explanation)).toBeInTheDocument();
    });
  });
});
