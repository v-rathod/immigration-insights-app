"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Compass,
  BarChart3,
  Globe2,
  DollarSign,
  Clock,
  Layers,
  Briefcase,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Calendar,
  Shield,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { sanitizeUrl } from "@/lib/security";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Navigation Config
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: typeof Compass;
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/insights", label: "My Insights", icon: User },
  { href: "/dashboard/visa-bulletin", label: "Priority Date Cortex", icon: Calendar, group: "Core Tools" },
  { href: "/dashboard/employer", label: "Employer Sponsor Score", icon: Shield, group: "Core Tools" },
  { href: "/dashboard/wage", label: "Wage Intelligence", icon: DollarSign, group: "Core Tools" },
  { href: "/dashboard/eb-category", label: "EB Categories", icon: BarChart3, group: "Explore" },
  { href: "/dashboard/geographic", label: "Geographic", icon: Globe2, group: "Explore" },
  { href: "/dashboard/job-demand", label: "Occupation Demand", icon: Briefcase, group: "Explore" },
  { href: "/dashboard/processing", label: "Processing", icon: Clock, group: "Explore" },
  { href: "/dashboard/approvals", label: "Approvals", icon: CheckCircle, group: "Explore" },
  { href: "/about", label: "About", icon: Compass, group: "App" }
];

// ---------------------------------------------------------------------------
// Sidebar Component
// ---------------------------------------------------------------------------

export function Sidebar({
  collapsed: collapsedProp,
  onToggle: onToggleProp,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
} = {}) {
  const pathname = usePathname();
  // If controlled externally, use props; otherwise manage internally
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = collapsedProp !== undefined ? collapsedProp : internalCollapsed;
  const internalToggle = useCallback(() => setInternalCollapsed((c) => !c), []);
  const toggleCollapse = onToggleProp ?? internalToggle;

  // Hover-expand: when collapsed, hovering the desktop rail shows full sidebar as floating overlay
  const [hoverExpanded, setHoverExpanded] = useState(false);
  // "visually expanded" = fully expanded OR hover-overlay expanded
  const isVisuallyExpanded = !collapsed || hoverExpanded;
  // "floating" = the expansion is an overlay (not shifting main content)
  const isFloating = collapsed && hoverExpanded;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [mobileExploreOpen, setMobileExploreOpen] = useState(false);

  // Close mobile nav on route change (React-recommended derived state pattern)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  // Close mobile nav on escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleMobile = useCallback(() => setMobileOpen((o) => !o), []);

  // Group nav items
  const groups = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    const group = item.group || "Main";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const navContent = (
    <>
      {/* Logo — clickable, routes to home */}
      <button
        onClick={() => { window.location.href = "/"; }}
        className="flex items-center gap-3 px-4 py-6 w-full text-left cursor-pointer hover:opacity-80 transition-opacity"
        aria-label="Go to home page"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
          <Compass className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        {isVisuallyExpanded && (
          <span className="text-sm font-semibold tracking-tight text-[var(--foreground)] truncate">
            Compass
          </span>
        )}
      </button>

      {/* Nav Groups */}
      <nav
        className="flex-1 overflow-y-auto px-3 pb-4"
        aria-label="Main navigation"
      >
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName} className="mb-4">
            {isVisuallyExpanded && groupName !== "Main" && (
              <span className="mb-1 block px-3 text-[10px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
                {groupName}
              </span>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <button
                    onClick={() => {
                      analytics.navItemClicked(item.label, item.href);
                      window.location.href = item.href;
                    }}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "group w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 text-left cursor-pointer",
                      isActive(item.href)
                        ? "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-medium"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]",
                      !isVisuallyExpanded && "justify-center px-2"
                    )}
                    title={!isVisuallyExpanded ? item.label : undefined}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive(item.href)
                          ? "text-[var(--accent-blue)]"
                          : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"
                      )}
                      strokeWidth={1.5}
                    />
                    {isVisuallyExpanded && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--sidebar-border)] px-3 py-3">
        <div className={cn("flex items-center", !isVisuallyExpanded ? "justify-center" : "justify-between")}>
          {isVisuallyExpanded && <ThemeToggle />}
          <button
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)] lg:flex cursor-pointer"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </>
  );

  // Mobile-specific nav with 44px touch targets, card-style My Insights CTA, collapsible Explore
  const mobileNavContent = (
    <>
      {/* Header with logo + close */}
      <div className="flex items-center justify-between px-5 py-5">
        <button
          onClick={() => { window.location.href = "/"; setMobileOpen(false); }}
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          aria-label="Go to home page"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
            <Compass className="h-4.5 w-4.5 text-white" strokeWidth={2} />
          </div>
          <span className="text-base font-semibold tracking-tight text-[var(--foreground)]">
            Compass
          </span>
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="rounded-lg p-2.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* My Insights CTA card */}
      <div className="px-4 mb-4">
        <button
          onClick={() => {
            analytics.navItemClicked("My Insights", "/insights");
            window.location.href = "/insights";
          }}
          className={cn(
            "w-full flex items-center gap-3 rounded-2xl px-4 min-h-[56px] transition-all cursor-pointer border",
            isActive("/insights")
              ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
              : "bg-white/[0.04] border-white/[0.08] text-[var(--foreground)] hover:bg-violet-500/10 hover:border-violet-500/20"
          )}
          aria-current={isActive("/insights") ? "page" : undefined}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-400 shrink-0">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold">My Insights</span>
            <p className="text-[10px] text-[var(--muted-foreground)]">Your personalized dashboard</p>
          </div>
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Mobile navigation">
        {Object.entries(groups).map(([groupName, items]) => {
          // Skip "Main" group (My Insights) — already rendered as CTA card above
          if (groupName === "Main") return null;
          const isExplore = groupName === "Explore";
          const isGroupOpen = isExplore ? mobileExploreOpen : true;

          return (
            <div key={groupName} className="mb-3">
              {isExplore ? (
                <button
                  onClick={() => setMobileExploreOpen((v) => !v)}
                  className="flex items-center justify-between w-full px-3 py-1 mb-1 cursor-pointer"
                  aria-expanded={mobileExploreOpen}
                  aria-controls="mobile-explore-group"
                >
                  <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
                    {groupName}
                  </span>
                  <ChevronDown className={cn(
                    "h-3 w-3 text-[var(--muted-foreground)] transition-transform duration-200",
                    mobileExploreOpen && "rotate-180"
                  )} />
                </button>
              ) : (
                <span className="mb-1 block px-3 text-[10px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
                  {groupName}
                </span>
              )}
              {isGroupOpen && (
                <ul className="space-y-0.5" id={isExplore ? "mobile-explore-group" : undefined}>
                  {items.map((item) => (
                    <li key={item.href}>
                      <button
                        onClick={() => {
                          analytics.navItemClicked(item.label, item.href);
                          window.location.href = item.href;
                        }}
                        aria-current={isActive(item.href) ? "page" : undefined}
                        className={cn(
                          "group w-full flex items-center gap-3 rounded-lg px-3 min-h-[44px] text-sm transition-all duration-200 text-left cursor-pointer",
                          isActive(item.href)
                            ? "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-medium"
                            : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive(item.href)
                              ? "text-[var(--accent-blue)]"
                              : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"
                          )}
                          strokeWidth={1.5}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--sidebar-border)] px-4 py-3">
        <ThemeToggle />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={toggleMobile}
        aria-label="Open navigation menu"
        className="fixed left-4 top-4 z-50 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 shadow-lg lg:hidden cursor-pointer"
      >
        {mobileOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {/* Mobile overlay — full-screen glassmorphic */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] overflow-hidden",
          "transition-[width] duration-200 ease-out",
          // Desktop
          "hidden lg:flex",
          isVisuallyExpanded ? "w-[240px]" : "w-[60px]",
          // Floating shadow when hover-expanded over content (doesn't shift layout)
          isFloating && "shadow-2xl shadow-black/30",
        )}
        onMouseEnter={() => { if (collapsed) setHoverExpanded(true); }}
        onMouseLeave={() => setHoverExpanded(false)}
      >
        {navContent}
      </aside>

      {/* Mobile sidebar — full-width glassmorphic overlay */}
      <aside
        className={cn(
          "fixed inset-0 z-40 flex h-screen w-full flex-col bg-[var(--sidebar)]/95 backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] lg:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {mobileNavContent}
      </aside>
    </>
  );
}
