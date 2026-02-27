import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ThemeProvider } from "@/components/providers/theme-provider";

describe("ThemeToggle", () => {
  const renderWithProvider = () =>
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

  it("renders three theme options", () => {
    renderWithProvider();
    expect(screen.getByLabelText("Light theme")).toBeInTheDocument();
    expect(screen.getByLabelText("Dark theme")).toBeInTheDocument();
    expect(screen.getByLabelText("System theme")).toBeInTheDocument();
  });

  it("has radiogroup role", () => {
    renderWithProvider();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("switches theme on click", async () => {
    const user = userEvent.setup();
    renderWithProvider();

    const lightBtn = screen.getByLabelText("Light theme");
    await user.click(lightBtn);
    expect(lightBtn).toHaveAttribute("aria-checked", "true");
  });

  it("applies correct aria-checked state", async () => {
    renderWithProvider();

    // Dark should be checked by default
    const darkBtn = await screen.findByLabelText("Dark theme");
    expect(darkBtn).toHaveAttribute("aria-checked", "true");

    const lightBtn = screen.getByLabelText("Light theme");
    expect(lightBtn).toHaveAttribute("aria-checked", "false");
  });
});
