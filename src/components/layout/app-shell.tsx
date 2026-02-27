"use client";

import { type ReactNode } from "react";
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
 * with a hamburger toggle. The main content area fills the remaining space
 * with smooth transitions on sidebar collapse.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-screen bg-[var(--background)]">
      <Sidebar />

      {/* Main content area — offset by sidebar width on desktop */}
      <main
        className={cn(
          "min-h-screen transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          "lg:ml-[240px]", // Default desktop sidebar width
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
