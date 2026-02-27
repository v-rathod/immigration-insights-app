/**
 * Footer — Site-wide footer with navigation links, data sources,
 * and social/project links.
 *
 * Renders inside the main content area (offset by sidebar).
 */
import Link from "next/link";
import { Compass, Github, Heart, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Link Groups
// ---------------------------------------------------------------------------

const FOOTER_LINKS = [
  {
    heading: "Dashboards",
    links: [
      { label: "Visa Bulletin", href: "/dashboard/visa-bulletin" },
      { label: "Sponsor Score", href: "/dashboard/employer" },
      { label: "EB Categories", href: "/dashboard/eb-category" },
      { label: "Geographic", href: "/dashboard/geographic" },
      { label: "Wages", href: "/dashboard/wage" },
      { label: "Occupations", href: "/dashboard/soc-demand" },
      { label: "Processing", href: "/dashboard/processing" },
      { label: "Backlog", href: "/dashboard/backlog" },
    ],
  },
  {
    heading: "Tools",
    links: [
      { label: "Ask a Question", href: "/ask" },
      { label: "My Insights", href: "/insights" },
      { label: "Setup Profile", href: "/setup" },
    ],
  },
  {
    heading: "Project",
    links: [
      { label: "About", href: "/about" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
] as const;

const DATA_SOURCES = [
  "DOL PERM/LCA",
  "DOS Visa Bulletin",
  "BLS OEWS",
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
        {/* Top grid — logo + link columns */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                <Compass className="h-4 w-4 text-white" strokeWidth={2} />
              </div>
              <div>
                <span className="text-sm font-semibold tracking-tight">
                  NorthStar Compass
                </span>
                <span className="ml-2 text-[10px] font-mono text-[var(--muted-foreground)]">
                  v1.0
                </span>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--muted-foreground)]">
              Personalized immigration insights powered by 18.5M+ data points
              from official government sources. Open-source, privacy-first, and
              free forever.
            </p>

            {/* External links */}
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub repository"
                className="rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"
              >
                <Github className="h-4.5 w-4.5" strokeWidth={1.5} />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map((group) => (
            <div key={group.heading}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                {group.heading}
              </h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
        <div className="mt-8 flex flex-col items-center gap-2 text-center text-xs text-[var(--muted-foreground)]">
          <p>
            &copy; {year} NorthStar Compass. Built with{" "}
            <Heart className="inline-block h-3 w-3 text-rose-400" strokeWidth={2} />{" "}
            by an immigrant, for immigrants.
          </p>
          <p className="flex items-center gap-1">
            Powered by{" "}
            <span className="font-medium text-[var(--foreground)]">Horizon</span>{" "}
            data &amp;{" "}
            <span className="font-medium text-[var(--foreground)]">Meridian</span>{" "}
            analytics
            <ExternalLink className="ml-0.5 h-2.5 w-2.5" />
          </p>
        </div>
      </div>
    </footer>
  );
}
