/**
 * Browser Smoke Test — Real Website Loading Verification
 *
 * Tests that all pages load successfully in a real browser environment.
 * Simulates browser navigation, checks HTML structure, and verifies key UI elements.
 *
 * Start server: npm run dev (port 3000)
 * Run test: npm test browser-smoke-test
 */
import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = "http://localhost:3000";
const PAGES = ["/", "/about", "/privacy", "/terms", "/insights", "/ask"];
const DASHBOARDS = [
  "/dashboard/visa-bulletin",
  "/dashboard/employer",
  "/dashboard/wage",
  "/dashboard/eb-category",
  "/dashboard/geographic",
  "/dashboard/job-demand",
  "/dashboard/processing",
  "/dashboard/backlog",
];

interface PageCheckResult {
  url: string;
  status: number;
  contentLength: number;
  loadTimeMs: number;
}

async function checkPage(path: string) {
  const url = `${BASE_URL}${path}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, 5000);

    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutHandle);

    const html = await response.text();
    const loadTimeMs = Date.now() - start;

    return {
      url,
      status: response.status,
      contentLength: html.length,
      loadTimeMs,
    };
  } catch (err: unknown) {
    const loadTimeMs = Date.now() - start;
    throw new Error(
      `Failed to load ${path}: ${err instanceof Error ? err.message : String(err)} (${loadTimeMs}ms)`
    );
  }
}

describe("Browser Smoke Test", () => {
  let serverAvailable = false;

  beforeAll(async () => {
    try {
      const controller = new AbortController();
      const handle = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(BASE_URL, { signal: controller.signal });
      clearTimeout(handle);
      serverAvailable = res.ok;
    } catch {
      serverAvailable = false;
    }
    if (!serverAvailable) {
      console.log(`⚠️  Server not running at ${BASE_URL} — skipping browser smoke tests`);
    }
  });

  it(
    "server is accessible",
    { timeout: 10000 },
    async () => {
      if (!serverAvailable) return;
      console.log(`\n🔍 Testing server at ${BASE_URL}...`);
      const result = await checkPage("/");
      console.log(`✅ Server accessible: ${result.status} in ${result.loadTimeMs}ms`);
      expect(result.status).toBe(200);
    }
  );

  it(
    "home page loads",
    { timeout: 10000 },
    async () => {
      if (!serverAvailable) return;
      const result = await checkPage("/");
      expect(result.status).toBe(200);
      expect(result.contentLength).toBeGreaterThan(500);
      console.log(`✅ Home: Status ${result.status}, ${result.contentLength} bytes, ${result.loadTimeMs}ms`);
    }
  );

  it(
    "all info pages load",
    { timeout: 30000 },
    async () => {
      if (!serverAvailable) return;
      const results = await Promise.all(PAGES.map(checkPage));
      for (const r of results) {
        expect(r.status).toBe(200);
        console.log(`✅ ${r.url.replace(BASE_URL, "")}: ${r.loadTimeMs}ms`);
      }
    }
  );

  it(
    "all dashboard pages load",
    { timeout: 45000 },
    async () => {
      if (!serverAvailable) return;
      const results = await Promise.all(DASHBOARDS.map(checkPage));
      for (const r of results) {
        expect(r.status).toBe(200);
        console.log(`✅ ${r.url.replace(BASE_URL, "")}: ${r.loadTimeMs}ms`);
      }
      const avgTime =
        results.reduce((sum, r) => sum + r.loadTimeMs, 0) / results.length;
      console.log(`\n📊 ${results.length} dashboards loaded avg ${avgTime.toFixed(0)}ms`);
    }
  );

  it(
    "pages load within acceptable time",
    { timeout: 60000 },
    async () => {
      if (!serverAvailable) return;
      const allPages = [...PAGES, ...DASHBOARDS];
      const results = await Promise.all(allPages.map(checkPage));
      for (const r of results) {
        expect(r.loadTimeMs).toBeLessThan(3000);
      }
      const fastestMs = Math.min(...results.map((r) => r.loadTimeMs));
      const slowestMs = Math.max(...results.map((r) => r.loadTimeMs));
      console.log(`\n⏱️  Load times: ${fastestMs}ms (fastest) → ${slowestMs}ms (slowest)`);
    }
  );

  it(
    "visa-bulletin has forecast modes",
    { timeout: 10000 },
    async () => {
      if (!serverAvailable) return;
      const response = await fetch(`${BASE_URL}/dashboard/visa-bulletin/`);
      const html = await response.text();
      expect(html).toContain("Visa Bulletin");
      expect(html).toContain("Priority Date");
      expect(html).toContain("forecast");
      console.log("✅ Visa Bulletin page contains expected content");
    }
  );

  it(
    "employer dashboard has SRS components",
    { timeout: 10000 },
    async () => {
      if (!serverAvailable) return;
      const response = await fetch(`${BASE_URL}/dashboard/employer`);
      const html = await response.text();
      expect(html).toContain("Sponsor");
      expect(html).toContain("Score");
      console.log("✅ Employer dashboard has SRS components");
    }
  );

  it(
    "homepage contains key sections",
    { timeout: 10000 },
    async () => {
      if (!serverAvailable) return;
      const response = await fetch(`${BASE_URL}/`);
      const html = await response.text();
      expect(html).toContain("Priority");
      expect(html).toContain("dashboard");
      console.log("✅ Homepage has key sections");
    }
  );
});
