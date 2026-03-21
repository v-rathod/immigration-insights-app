"use client";

import { type ReactNode, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Footer } from "@/components/layout/footer";
import { FeedbackWidget } from "@/components/ui/feedback-widget";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
}

/**
 * Root layout shell providing the sidebar + scrollable main area.
 *
 * The sidebar is 240px wide (60px collapsed) on desktop, hidden on mobile
 * with a hamburger toggle. On the home page ("/") the sidebar auto-collapses
 * to give maximum content width. The main content area responds accordingly.
 */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  // Auto-collapse on home; track whether current state was user-overridden
  const [collapsed, setCollapsed] = useState(isHome);
  const [autoManaged, setAutoManaged] = useState(true);
  const [prevPath, setPrevPath] = useState(pathname);

  // Detect route changes — reset auto-management so new page drives collapse
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setAutoManaged(true);
  }

  useEffect(() => {
    if (autoManaged) setCollapsed(isHome);
  }, [isHome, autoManaged]);

  const handleToggle = () => {
    setCollapsed((v) => !v);
    setAutoManaged(false); // User has taken manual control
  };

  return (
    <div className="relative min-h-screen bg-[var(--background)]">
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />

      {/* Main content area — offset by sidebar width on desktop */}
      <main
        className={cn(
          "min-h-screen transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          collapsed ? "lg:ml-[60px]" : "lg:ml-[240px]",
          "pt-16 lg:pt-0", // Mobile: offset for hamburger button
        )}
      >
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
        <Footer />
      </main>

      {/* Floating feedback widget */}
      <FeedbackWidget />
    </div>
  );
}
