"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Compass,
  BarChart3,
  Globe2,
  DollarSign,
  Briefcase,
  Clock,
  Layers,
  Search,
  User,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Calendar,
  Shield,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { sanitizeUrl } from "@/lib/security";

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
  { href: "/", label: "Home", icon: Compass },
  { href: "/dashboard/visa-bulletin", label: "Priority Date Cortex", icon: Calendar, group: "Insights" },
  { href: "/dashboard/employer", label: "Sponsor Score", icon: Shield, group: "Insights" },
  { href: "/dashboard/approvals", label: "Approvals", icon: CheckCircle, group: "Insights" },
  { href: "/dashboard/eb-category", label: "EB Categories", icon: BarChart3, group: "Dashboards" },
  { href: "/dashboard/geographic", label: "Geographic", icon: Globe2, group: "Dashboards" },
  { href: "/dashboard/wage", label: "Wages", icon: DollarSign, group: "Dashboards" },
  { href: "/dashboard/soc-demand", label: "Occupations", icon: Briefcase, group: "Dashboards" },
  { href: "/dashboard/processing", label: "Processing", icon: Clock, group: "Dashboards" },
  { href: "/dashboard/backlog", label: "Backlog", icon: Layers, group: "Dashboards" },
  { href: "/ask", label: "Ask", icon: Search, group: "Tools" },
  { href: "/about", label: "About", icon: Compass, group: "Project" },
  { href: "/insights", label: "My Insights", icon: User, group: "Personal" },
];

// ---------------------------------------------------------------------------
// Sidebar Component
// ---------------------------------------------------------------------------

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

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

  const toggleCollapse = useCallback(() => setCollapsed((c) => !c), []);
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
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
          <Compass className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold tracking-tight text-[var(--foreground)] truncate">
              Compass
            </span>
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
              NorthStar
            </span>
          </div>
        )}
      </div>

      {/* Nav Groups */}
      <nav
        className="flex-1 overflow-y-auto px-3 pb-4"
        aria-label="Main navigation"
      >
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName} className="mb-4">
            {!collapsed && groupName !== "Main" && (
              <span className="mb-1 block px-3 text-[10px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
                {groupName}
              </span>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <button
                    onClick={() => {
                      // Hard refresh using window.location for full page reload
                      window.location.href = item.href;
                    }}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "group w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 text-left",
                      isActive(item.href)
                        ? "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-medium"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? item.label : undefined}
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
                    {!collapsed && (
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
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && <ThemeToggle />}
          <button
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)] lg:flex"
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

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={toggleMobile}
        aria-label="Open navigation menu"
        className="fixed left-4 top-4 z-50 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 shadow-lg lg:hidden"
      >
        {mobileOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {/* Mobile overlay */}
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
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          // Desktop
          "hidden lg:flex",
          collapsed ? "w-[60px]" : "w-[240px]",
        )}
      >
        {navContent}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen w-[260px] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
