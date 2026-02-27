import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils/cn";

describe("cn (class name merger)", () => {
  it("merges multiple class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "text-sm")).toBe("base text-sm");
  });

  it("handles undefined and null", () => {
    expect(cn("base", undefined, null, "text-sm")).toBe("base text-sm");
  });

  it("handles empty string", () => {
    expect(cn("", "px-4")).toBe("px-4");
  });

  it("handles no arguments", () => {
    expect(cn()).toBe("");
  });
});
