#!/usr/bin/env node
/**
 * Simple Browser Smoke Test — Direct HTTP Verification
 * Uses native Node.js without Vitest for compatibility
 * 
 * Run: node scripts/browser-smoke-test.mjs
 * Or:  npm run test:browser
 */

import http from "http";

const BASE_URL = "http://localhost:3000";
const PAGES = [
  { path: "/", name: "Home" },
  { path: "/about", name: "About" },
  { path: "/privacy", name: "Privacy" },
  { path: "/terms", name: "Terms" },
  { path: "/insights", name: "Insights" },
  { path: "/ask", name: "Ask" },
  { path: "/dashboard/visa-bulletin", name: "Visa Bulletin" },
  { path: "/dashboard/employer", name: "Employer" },
  { path: "/dashboard/wage", name: "Wage" },
  { path: "/dashboard/eb-category", name: "EB Category" },
  { path: "/dashboard/geographic", name: "Geographic" },
  { path: "/dashboard/job-demand", name: "Job Demand" },
  { path: "/dashboard/processing", name: "Processing" },
  { path: "/dashboard/backlog", name: "Backlog" },
];

function fetchUrl(path, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const url = new URL(path, BASE_URL);

    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        const loadTimeMs = Date.now() - startTime;
        resolve({
          path,
          status: response.statusCode || 0,
          size: data.length,
          timeMslowMs: loadTimeMs,
          hasContent: data.length > 100,
        });
      });
    });

    request.on("error", (err) => {
      const loadTimeMs = Date.now() - startTime;
      reject({
        path,
        error: err.message,
        loadTimeMs,
      });
    });

    request.on("timeout", () => {
      request.destroy();
      const loadTimeMs = Date.now() - startTime;
      reject({
        path,
        error: "Request timeout",
        loadTimeMs,
      });
    });
  });
}

async function runTests() {
  console.log("\n📊 Browser Smoke Test — Direct HTTP Verification");
  console.log(`🌐 Testing server: ${BASE_URL}`);
  console.log(`📄 Testing ${PAGES.length} pages...\n`);

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const page of PAGES) {
    try {
      const result = await fetchUrl(page.path);
      if (result.status === 200 && result.hasContent) {
        console.log(`✅ ${page.name.padEnd(20)} → ${result.status} (${result.loadTimeMs}ms, ${result.size} bytes)`);
        passed++;
        results.push(result);
      } else {
        console.log(`❌ ${page.name.padEnd(20)} → Status ${result.status}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${page.name.padEnd(20)} → ${err.error} (${err.loadTimeMs}ms)`);
      failed++;
    }
  }

  console.log(`\n📈 Results:`);
  console.log(`   Passed: ${passed}/${PAGES.length}`);
  console.log(`   Failed: ${failed}/${PAGES.length}`);

  if (results.length > 0) {
    const avgTime = results.reduce((sum, r) => sum + r.loadTimeMs, 0) / results.length;
    const minTime = Math.min(...results.map((r) => r.loadTimeMs));
    const maxTime = Math.max(...results.map((r) => r.loadTimeMs));
    console.log(`\n⏱️  Load Times:`);
    console.log(`   Average: ${avgTime.toFixed(0)}ms`);
    console.log(`   Fastest: ${minTime}ms`);
    console.log(`   Slowest: ${maxTime}ms`);
  }

  if (failed === 0) {
    console.log(`\n✨ All tests passed! Website is accessible and responsive.\n`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Check server on http://localhost:3000\n`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
