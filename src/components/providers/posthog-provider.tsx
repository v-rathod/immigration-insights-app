"use client";

/**
 * PostHog Analytics Provider
 *
 * Initialises posthog-js once on the client and wraps the app so every
 * component can call `usePostHog()` from `posthog-js/react`.
 *
 * Page views are tracked automatically on every route change via
 * PostHogPageView (needs Suspense boundary because of useSearchParams).
 *
 * All sensitive config is in NEXT_PUBLIC_POSTHOG_* env vars so the build
 * can swap them per environment (dev/prod).
 */

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";
import { getEnvironment } from "@/lib/env";

// ---------------------------------------------------------------------------
// Helper: read page weight + resource transfer sizes from the Performance API
// Returns sizes in KB rounded to 1 decimal. Returns {} if API unavailable.
// ---------------------------------------------------------------------------

function getTransferMetrics(isInitialLoad: boolean): Record<string, number> {
  if (typeof performance === "undefined") return {};

  const metrics: Record<string, number> = {};

  // Navigation timing — only meaningful on the first (hard) page load.
  // On soft SPA navigations the navigation entry still reflects the HTML
  // document fetch, so we gate it to avoid confusing repeated values.
  if (isInitialLoad) {
    const navEntries = performance.getEntriesByType(
      "navigation"
    ) as PerformanceNavigationTiming[];
    const nav = navEntries[0];
    if (nav) {
      // transferSize = bytes over the wire (compressed); 0 if served from cache
      metrics.page_transfer_kb = Math.round((nav.transferSize ?? 0) / 102.4) / 10;
      // decodedBodySize = bytes after decompression (actual HTML size)
      metrics.page_decoded_kb = Math.round((nav.decodedBodySize ?? 0) / 102.4) / 10;
      // Time-to-interactive and full load (ms)
      metrics.dom_interactive_ms = Math.round(nav.domInteractive);
      metrics.dom_complete_ms = Math.round(nav.domComplete);
      metrics.load_event_ms = Math.round(nav.loadEventEnd);
    }
  }

  // Resource timing — JS, CSS, images, fonts, JSON data files, etc.
  // On soft navigations Next.js lazy-loads chunks; we capture those too.
  const resources = performance.getEntriesByType(
    "resource"
  ) as PerformanceResourceTiming[];

  const totalTransferBytes = resources.reduce(
    (sum, r) => sum + (r.transferSize ?? 0), 0
  );
  const totalDecodedBytes = resources.reduce(
    (sum, r) => sum + (r.decodedBodySize ?? 0), 0
  );

  metrics.resource_count = resources.length;
  metrics.total_resource_transfer_kb =
    Math.round(totalTransferBytes / 102.4) / 10;
  metrics.total_resource_decoded_kb =
    Math.round(totalDecodedBytes / 102.4) / 10;

  return metrics;
}

// ---------------------------------------------------------------------------
// Inner component: fires $pageview on every route change
// (must be wrapped in <Suspense> because useSearchParams suspends in Next.js)
// ---------------------------------------------------------------------------

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Track whether this is the very first mount (= hard page load) or a
  // subsequent soft navigation so we can gate navigation-timing properties.
  const hasTrackedInitialLoad = useRef(false);

  useEffect(() => {
    if (!pathname) return;

    const isInitialLoad = !hasTrackedInitialLoad.current;
    hasTrackedInitialLoad.current = true;

    // Defer by one frame so the browser has time to populate performance
    // entries for any resources loaded during this navigation.
    const id = requestAnimationFrame(() => {
      posthog.capture("$pageview", {
        $current_url: window.location.href,
        ...getTransferMetrics(isInitialLoad),
      });

      // Clear resource buffer after capturing so the next soft navigation
      // only accumulates entries loaded for that navigation, not all prior ones.
      if (typeof performance.clearResourceTimings === "function") {
        performance.clearResourceTimings();
      }
    });

    return () => cancelAnimationFrame(id);
  }, [pathname, searchParams]);

  return null;
}

// ---------------------------------------------------------------------------
// Provider: initialises PostHog once and exposes context
// ---------------------------------------------------------------------------

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

    if (!key) return; // No-op in test / CI environments without the key

    posthog.init(key, {
      api_host: host,

      // We fire $pageview manually in PostHogPageView so autocapture
      // doesn't double-count on soft navigations.
      capture_pageview: false,

      // Capture when user leaves a page (time-on-page metric)
      capture_pageleave: true,

      // Session replay — records every click/scroll for user journey analysis.
      // Stays within PostHog's free 15K replays/month.
      session_recording: {
        maskAllInputs: true,    // Never record typed text (privacy)
        maskTextSelector: "[data-ph-mask]", // Opt-in masking via attribute
      },

      // Respect Do Not Track browser setting
      respect_dnt: false, // Set true if you add a privacy banner

      // Only capture in production or when key is explicitly provided
      loaded: (ph) => {
        if (process.env.NODE_ENV !== "production") {
          ph.debug(); // logs events to console in dev
        }
      },
    });

    // Register super properties so ALL events (custom + autocapture)
    // get tagged with environment for filtering.
    const environment = getEnvironment();
    posthog.register({ environment });
  }, []);

  return (
    <PHProvider client={posthog}>
      {/* Suspense required by useSearchParams in Next.js App Router */}
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
