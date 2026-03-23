"use client";

import { useEffect } from "react";
import { initSentry, reportError } from "@/lib/monitoring";
import { analytics } from "@/lib/analytics";

/**
 * ErrorMonitor — Renders nothing. Sets up global client-side error tracking.
 *
 * Three layers of defense:
 *   1. Sentry: catches unhandled errors with full stack traces, source maps, and
 *      optional session replay — best for root-cause analysis.
 *   2. PostHog: fires `error_occurred` events — best for correlating errors with
 *      what the user was doing (which dashboard, which filters, session replay).
 *   3. Console: errors still reach browser DevTools (nothing is suppressed).
 *
 * Mount once inside PostHogProvider so both destinations are available.
 * See src/app/layout.tsx for usage.
 */
export function ErrorMonitor() {
  useEffect(() => {
    initSentry();

    function handleError(event: ErrorEvent) {
      const message = event.message || "Unknown JavaScript error";
      const type = event.error?.name || "Error";
      const page = window.location.pathname;
      // Limit stack to 500 chars — enough for root cause, avoids PostHog bloat
      const stack = event.error?.stack?.substring(0, 500);

      reportError(event.error ?? new Error(message), { page });

      analytics.errorOccurred({
        message,
        type,
        page,
        severity: "high",
        stack,
      });
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";
      const type =
        reason instanceof Error ? reason.name : "UnhandledRejection";
      const page = window.location.pathname;

      reportError(reason instanceof Error ? reason : new Error(message), {
        page,
      });

      analytics.errorOccurred({
        message,
        type,
        page,
        severity: "high",
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
    };
  }, []);

  return null;
}
