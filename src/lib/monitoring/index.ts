import { getEnvironment } from "@/lib/env";

/**
 * Client-side error monitoring via Sentry.
 *
 * Initialised once on first client load. If NEXT_PUBLIC_SENTRY_DSN is absent,
 * monitoring silently no-ops — dev/test environments work without Sentry configured.
 *
 * Dual-reporting design:
 *   - Sentry: stack traces, source-mapped frames, session replay, release tracking
 *   - PostHog: error events correlated with user session context (analytics.errorOccurred)
 *
 * The ErrorMonitor component (src/components/providers/error-monitor.tsx) wires this up
 * automatically via global window.addEventListener handlers.
 *
 * Setup (add to .env.local or CloudFront environment variables):
 *   NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/12345
 *   NEXT_PUBLIC_APP_VERSION=1.0.0   (optional — git sha or release tag)
 */

import * as Sentry from "@sentry/browser";

let initialised = false;

/**
 * Initialise Sentry once per browser session.
 * Safe to call multiple times — only runs on first invocation.
 */
export function initSentry(): void {
  if (initialised || typeof window === "undefined") return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return; // Silently no-op if DSN not configured

  const environment = getEnvironment();

  Sentry.init({
    dsn,
    environment,
    release: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",

    // Sample 10% of performance traces — unhandled errors are always captured
    tracesSampleRate: 0.1,

    // Session replay: 5% of all sessions, 100% of sessions containing an error
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,

    // Suppress noisy browser-extension and vendor errors that we can't fix
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      /^Loading chunk \d+ failed/,
      "Non-Error promise rejection captured",
      /^Script error\.?$/,             // cross-origin scripts (no stack trace)
      /^undefined is not an object/,   // common Safari noise
    ],

    beforeSend(event) {
      // Strip URL query params — they may contain state that looks like user data
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url);
          url.search = "";
          event.request.url = url.toString();
        } catch {
          // Leave as-is if URL parsing fails
        }
      }
      return event;
    },
  });

  initialised = true;
}

/**
 * Report an error to Sentry with optional extra context.
 * Use this for known error boundaries and caught errors you want to escalate.
 * Unhandled errors are captured automatically by ErrorMonitor.
 */
export function reportError(
  error: Error | string,
  context?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;

  const err = typeof error === "string" ? new Error(error) : error;

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    }
    Sentry.captureException(err);
  });
}
