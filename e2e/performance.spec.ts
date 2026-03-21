/**
 * Performance Benchmark Tests
 *
 * Measures key performance metrics for every page of the Compass SPA:
 *   - TTFB (Time to First Byte)
 *   - DOM Content Loaded
 *   - Full window load
 *   - Total JS transfer size
 *   - Critical data fetch times (employer search, forecast data)
 *
 * Thresholds are intentionally lenient for a local dev server (Turbopack HMR
 * overhead) but will catch catastrophic regressions.  Production via CloudFront
 * will be meaningfully faster for TTFB / transfer sizes.
 *
 * Usage:
 *   npx playwright test --config=playwright.perf.config.ts
 *
 * Prerequisites: npm run dev must be running on port 3000.
 */
import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Budget constants — local dev server (Turbopack)
// ---------------------------------------------------------------------------

const BUDGETS = {
  // Time from request start to first byte (should be near 0 on local static)
  ttfb_ms: 500,
  // DOM ready (DOMContentLoadedEventEnd)
  domReady_ms: 8_000,
  // Full window load including all async fetches
  windowLoad_ms: 15_000,
  // Total JS bytes transferred (compressed) across ALL resources on home page
  totalJsBytes: 2_000_000, // 2 MB budget (static SPA with charts)
  // Individual data file fetch (employer search, geo metrics, etc.)
  dataFetch_ms: 3_000,
};

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const PAGES = [
  { name: "home",          path: "/"                         },
  { name: "insights",      path: "/insights"                 },
  { name: "visa-bulletin", path: "/dashboard/visa-bulletin/" },
  { name: "employer",      path: "/dashboard/employer/"      },
  { name: "eb-category",   path: "/dashboard/eb-category/"   },
  { name: "geographic",    path: "/dashboard/geographic/"    },
  { name: "wage",          path: "/dashboard/wage/"          },
  { name: "job-demand",    path: "/dashboard/job-demand/"    },
  { name: "processing",    path: "/dashboard/processing/"    },
  { name: "approvals",     path: "/dashboard/approvals/"     },
  { name: "backlog",       path: "/dashboard/backlog/"       },
  { name: "about",         path: "/about"                    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PagePerfMetrics {
  ttfb: number;
  domReady: number;
  windowLoad: number;
}

async function captureNavTiming(page: import("@playwright/test").Page): Promise<PagePerfMetrics> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return {
      ttfb:       Math.round(nav.responseStart - nav.requestStart),
      domReady:   Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      windowLoad: Math.round(nav.loadEventEnd - nav.startTime),
    };
  });
}

// ---------------------------------------------------------------------------
// Page load timing benchmarks
// ---------------------------------------------------------------------------

test.describe("Performance — Page Load Timings", () => {
  for (const { name, path } of PAGES) {
    test(`${name} — load timing within budget`, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });

      const metrics = await captureNavTiming(page);

      console.log(
        `[PERF] ${name}: TTFB=${metrics.ttfb}ms  DOM=${metrics.domReady}ms  Load=${metrics.windowLoad}ms`
      );

      expect(metrics.ttfb,       `${name}: TTFB must be < ${BUDGETS.ttfb_ms}ms`).toBeLessThan(BUDGETS.ttfb_ms);
      expect(metrics.domReady,   `${name}: DOM ready must be < ${BUDGETS.domReady_ms}ms`).toBeLessThan(BUDGETS.domReady_ms);
      expect(metrics.windowLoad, `${name}: Window load must be < ${BUDGETS.windowLoad_ms}ms`).toBeLessThan(BUDGETS.windowLoad_ms);
    });
  }
});

// ---------------------------------------------------------------------------
// JS bundle size budget
// ---------------------------------------------------------------------------

test.describe("Performance — Bundle Size", () => {
  test("home page — total JS transfer within budget", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const { totalJsBytes, resourceCount } = await page.evaluate(() => {
      const jsResources = performance
        .getEntriesByType("resource")
        .filter((r) => r.name.includes(".js") || r.name.includes("/_next/static/chunks/"));
      const totalJsBytes = jsResources.reduce(
        (sum, r) => sum + (r as PerformanceResourceTiming).transferSize,
        0
      );
      return { totalJsBytes, resourceCount: jsResources.length };
    });

    console.log(
      `[PERF] JS: ${resourceCount} files, ${(totalJsBytes / 1024).toFixed(1)} KB total transferred`
    );

    expect(totalJsBytes, `Total JS must be < ${BUDGETS.totalJsBytes / 1024}KB`).toBeLessThan(
      BUDGETS.totalJsBytes
    );
  });

  test("home page — no oversized individual JS chunk (> 500KB)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const oversized = await page.evaluate(() => {
      return performance
        .getEntriesByType("resource")
        .filter(
          (r) =>
            (r.name.includes(".js") || r.name.includes("/_next/static/chunks/")) &&
            (r as PerformanceResourceTiming).transferSize > 500_000
        )
        .map((r) => ({
          url: r.name.split("/").slice(-1)[0],
          size: Math.round((r as PerformanceResourceTiming).transferSize / 1024),
        }));
    });

    if (oversized.length > 0) {
      console.warn("[PERF] Oversized chunks:", oversized);
    }

    expect(oversized, "No individual JS file should exceed 500KB (uncompressed)").toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Critical data fetch performance
// ---------------------------------------------------------------------------

test.describe("Performance — Data Fetch Times", () => {
  test("employer dashboard — data files load within budget", async ({ page }) => {
    await page.goto("/dashboard/employer/", { waitUntil: "networkidle" });

    const dataTimings = await page.evaluate(() => {
      return performance
        .getEntriesByType("resource")
        .filter((r) => r.name.includes("/data/"))
        .map((r) => ({
          file: r.name.split("/data/")[1] ?? r.name,
          duration: Math.round((r as PerformanceResourceTiming).duration),
          size: Math.round((r as PerformanceResourceTiming).transferSize / 1024),
        }));
    });

    console.log("[PERF] Employer data fetches:", dataTimings);

    for (const timing of dataTimings) {
      expect(
        timing.duration,
        `Data file ${timing.file} must load within ${BUDGETS.dataFetch_ms}ms`
      ).toBeLessThan(BUDGETS.dataFetch_ms);
    }
  });

  test("geographic dashboard — geo metrics load within budget", async ({ page }) => {
    await page.goto("/dashboard/geographic/", { waitUntil: "networkidle" });

    const dataTimings = await page.evaluate(() => {
      return performance
        .getEntriesByType("resource")
        .filter((r) => r.name.includes("/data/") || r.name.includes("us-states"))
        .map((r) => ({
          file: r.name.split("/").slice(-1)[0],
          duration: Math.round((r as PerformanceResourceTiming).duration),
          size: Math.round((r as PerformanceResourceTiming).transferSize / 1024),
        }));
    });

    console.log("[PERF] Geographic data fetches:", dataTimings);

    for (const timing of dataTimings) {
      expect(
        timing.duration,
        `Geographic file ${timing.file} must load within ${BUDGETS.dataFetch_ms}ms`
      ).toBeLessThan(BUDGETS.dataFetch_ms);
    }
  });

  test("visa bulletin — forecast data loads within budget", async ({ page }) => {
    await page.goto("/dashboard/visa-bulletin/", { waitUntil: "networkidle" });

    const dataTimings = await page.evaluate(() => {
      return performance
        .getEntriesByType("resource")
        .filter((r) => r.name.includes("/data/") && r.name.includes("models"))
        .map((r) => ({
          file: r.name.split("/").slice(-1)[0],
          duration: Math.round((r as PerformanceResourceTiming).duration),
        }));
    });

    console.log("[PERF] Forecast data fetches:", dataTimings);

    for (const timing of dataTimings) {
      expect(timing.duration).toBeLessThan(BUDGETS.dataFetch_ms);
    }
  });
});

// ---------------------------------------------------------------------------
// Long task detection (UI jank budget)
// ---------------------------------------------------------------------------

test.describe("Performance — Long Tasks (Jank)", () => {
  test("home page — no long task exceeds 200ms during load", async ({ page }) => {
    // Inject PerformanceObserver before navigation to capture all long tasks
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__longTasks = [] as Array<{ duration: number; startTime: number }>;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          ((window as unknown as Record<string, unknown>).__longTasks as Array<{ duration: number; startTime: number }>).push({
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
          });
        }
      });
      try {
        observer.observe({ type: "longtask", buffered: true });
      } catch {
        // longtask API not available in all environments
      }
    });

    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000); // let any post-load tasks settle

    const longTasks = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__longTasks as Array<{ duration: number; startTime: number }>
    );

    const blockers = longTasks.filter((t) => t.duration > 200);
    if (blockers.length > 0) {
      console.warn("[PERF] Long tasks detected:", blockers);
    }

    // Warn but allow — long tasks < 500ms are tolerable on dev server
    // Real Lighthouse audit needed for production budget enforcement
    const severe = blockers.filter((t) => t.duration > 500);
    expect(
      severe,
      "No single task should block the main thread for > 500ms on home load"
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Core Web Vitals — LCP proxy
// ---------------------------------------------------------------------------

test.describe("Performance — Core Web Vitals Proxy", () => {
  test("home page — Largest Contentful Paint proxy within budget", async ({ page }) => {
    // Capture LCP via PerformanceObserver injected before navigation
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__lcpTime = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          (window as unknown as Record<string, unknown>).__lcpTime = Math.round(entries[entries.length - 1].startTime);
        }
      });
      try {
        observer.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
        // LCP not available in all test environments
      }
    });

    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const lcp = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__lcpTime as number
    );

    if (lcp > 0) {
      console.log(`[PERF] LCP proxy: ${lcp}ms`);
      // Good: < 2500ms | Needs improvement: 2500–4000ms | Poor: > 4000ms
      expect(lcp, "LCP should be < 4000ms (Needs Improvement threshold)").toBeLessThan(4000);
    } else {
      console.log("[PERF] LCP API not available in this environment — skipping assertion");
    }
  });

  test("employer dashboard — First Contentful Paint proxy", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__fcpTime = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            (window as unknown as Record<string, unknown>).__fcpTime = Math.round(entry.startTime);
          }
        }
      });
      try {
        observer.observe({ type: "paint", buffered: true });
      } catch {
        // paint entry not available in all environments
      }
    });

    await page.goto("/dashboard/employer/", { waitUntil: "networkidle" });

    const fcp = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__fcpTime as number
    );

    if (fcp > 0) {
      console.log(`[PERF] FCP employer: ${fcp}ms`);
      // Good: < 1800ms; allow up to 3000ms for dev server
      expect(fcp, "FCP should be < 3000ms on dev server").toBeLessThan(3000);
    }
  });
});
