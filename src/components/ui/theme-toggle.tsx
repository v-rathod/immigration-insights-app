"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="w-full flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--muted)]/50 p-1"
      role="radiogroup"
      aria-label="Color theme"
    >
      {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          aria-label={`${label} theme`}
          onClick={() => setTheme(value)}
          className={cn(
            "flex-1 rounded-full p-1.5 transition-all duration-200 min-h-[44px] flex items-center justify-center",
            theme === value
              ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm active:scale-95"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] active:scale-95"
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}
