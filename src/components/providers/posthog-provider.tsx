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
import { useEffect, Suspense } from "react";

// ---------------------------------------------------------------------------
// Inner component: fires $pageview on every route change
// (must be wrapped in <Suspense> because useSearchParams suspends in Next.js)
// ---------------------------------------------------------------------------

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      posthog.capture("$pageview", {
        $current_url: window.location.href,
      });
    }
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
