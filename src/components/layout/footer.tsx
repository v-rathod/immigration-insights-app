/**
 * Footer — Site-wide footer with navigation links, data sources,
 * and social/project links.
 *
 * Renders inside the main content area (offset by sidebar).
 */
import Link from "next/link";
import { Compass, Github, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactButton } from "@/components/ui/contact-modal";
import { DataFreshnessChip } from "@/components/ui/data-freshness-chip";

// ---------------------------------------------------------------------------
// Link Groups
// ---------------------------------------------------------------------------

const PROJECT_LINKS = [
  { label: "About", href: "/about" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
] as const;

const DATA_SOURCES = [
  "Dept. of Labor",
  "State Dept. Visa Bulletin",
  "Bureau of Labor Statistics",
  "USCIS",
  "DHS",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "mt-16 border-t border-[var(--border)]",
        "bg-[var(--card-glass)] backdrop-blur-xl"
      )}
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Brand + project links */}
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          {/* Brand */}
          <div className="flex flex-col items-center gap-3 sm:items-start">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                <Compass className="h-4 w-4 text-white" strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold tracking-tight">
                Compass
              </span>
            </div>
            <p className="max-w-xs text-center text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-left">
              Personalized immigration insights powered by 18.5M+ data points
              from official government sources.
            </p>
          </div>

          {/* Project links — horizontal */}
          <div className="flex items-center gap-6">
            {PROJECT_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                {link.label}
              </Link>
            ))}
            <ContactButton />
            <a
              href="https://github.com/v-rathod/immigration-insights-app"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              className="rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"
            >
              <Github className="h-4.5 w-4.5" strokeWidth={1.5} />
            </a>
          </div>
        </div>

        {/* Data sources */}
        <div className="mt-10 border-t border-[var(--border)] pt-6">
          <p className="mb-3 text-center text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
            Data Sources
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {DATA_SOURCES.map((source) => (
              <span
                key={source}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] font-mono text-[var(--muted-foreground)]"
              >
                {source}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-center gap-3 text-center text-xs text-[var(--muted-foreground)]">
          <DataFreshnessChip />
          <p>
            &copy; {year} Compass. Built with{" "}
            <Heart className="inline-block h-3 w-3 text-rose-400" strokeWidth={2} />{" "}
            by{" "}
            <a
              href="https://github.com/v-rathod"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Vivek Rathod
            </a>
            , for immigrants.
          </p>
        </div>
      </div>
    </footer>
  );
}
