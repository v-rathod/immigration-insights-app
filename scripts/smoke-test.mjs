#!/usr/bin/env node
/**
 * smoke-test.mjs — Post-deployment smoke tests for Compass
 *
 * Verifies all pages return HTTP 200 and all critical data files are accessible
 * after a deployment to S3/CloudFront. Designed to run both locally and in CI.
 *
 * Usage:
 *   node scripts/smoke-test.mjs                          # prod CloudFront (default)
 *   SMOKE_TEST_URL=http://localhost:3000 node scripts/smoke-test.mjs  # local dev
 *   node scripts/smoke-test.mjs --url https://staging.example.com     # staging
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

const args = process.argv.slice(2);
const urlFlagIdx = args.indexOf('--url');
const BASE_URL = (urlFlagIdx !== -1 ? args[urlFlagIdx + 1] : null)
  ?? process.env.SMOKE_TEST_URL
  ?? 'https://d10immmzyp7xgr.cloudfront.net';

const TIMEOUT_MS = 20_000;
const CONCURRENCY = 5; // parallel requests per batch

// ── ANSI colors ──────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM    = '\x1b[2m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

// ── Check definitions ────────────────────────────────────────────────────────
//
// Each check:
//   path      — URL path to fetch
//   label     — Human-readable description
//   headOnly  — Use HEAD request (skips body download — use for large files)
//   minSize   — Minimum byte count: Content-Length (HEAD) or body length (GET)
//   validate  — Optional fn: receives parsed JSON, throws Error if invalid
//
const CHECKS = [

  // ── Pages (HTML) ────────────────────────────────────────────────────────────
  { path: '/',                         label: 'Home page',                        minSize: 5_000 },
  { path: '/about/',                   label: 'About page',                       minSize: 3_000 },
  { path: '/insights/',                label: 'My Insights page',                 minSize: 5_000 },
  { path: '/ask/',                     label: 'Ask page',                         minSize: 3_000 },
  { path: '/privacy/',                 label: 'Privacy page',                     minSize: 2_000 },
  { path: '/terms/',                   label: 'Terms page',                       minSize: 2_000 },
  { path: '/dashboard/employer/',      label: 'Employer / SRS dashboard',         minSize: 5_000 },
  { path: '/dashboard/wage/',          label: 'Wage Intelligence dashboard',      minSize: 5_000 },
  { path: '/dashboard/visa-bulletin/', label: 'Visa Bulletin dashboard',          minSize: 5_000 },
  { path: '/dashboard/eb-category/',   label: 'EB Category dashboard',            minSize: 5_000 },
  { path: '/dashboard/geographic/',    label: 'Geographic dashboard',             minSize: 5_000 },
  { path: '/dashboard/job-demand/',    label: 'Job Demand dashboard',             minSize: 5_000 },
  { path: '/dashboard/processing/',    label: 'Processing Speed dashboard',       minSize: 5_000 },
  { path: '/dashboard/backlog/',       label: 'Backlog dashboard',                minSize: 5_000 },
  { path: '/dashboard/approvals/',     label: 'Approval Trends dashboard',        minSize: 5_000 },

  // ── Employer shard system ────────────────────────────────────────────────────
  {
    // GET (not HEAD) so we can validate content, not just size.
    // File is ~14–31 MB; CloudFront serves gzip → ~3–4 MB over the wire.
    path: '/data/employers/_search.json',
    label: 'Employer search index — content quality',
    minSize: 500_000,  // gzip body; raw file is 10–31 MB
    validate: (d) => {
      if (!Array.isArray(d) || d.length < 1000)
        throw new Error(`Only ${Array.isArray(d) ? d.length : 'non-array'} entries (need ≥ 1,000)`);
      // Accept both compact format (n/id) and full format (employer_name/employer_id)
      const first = d[0];
      const name = first.n ?? first.employer_name;
      if (!name) throw new Error('First entry has no employer name — format mismatch (check compact vs full keys)');

      // Smart-sort data quality: verify entries have numeric volume field (f/total_filings)
      // so weighted sorting can rank by case volume, not just alphabetically.
      const sampleSize = Math.min(100, d.length);
      let withVolume = 0;
      for (let i = 0; i < sampleSize; i++) {
        const vol = d[i].f ?? d[i].total_filings;
        if (typeof vol === 'number' && vol >= 0) withVolume++;
      }
      if (withVolume < sampleSize * 0.8)
        throw new Error(`Only ${withVolume}/${sampleSize} sampled entries have volume data — smart sorting will degrade`);

      // Verify data is NOT purely alphabetical (would indicate broken sort weights)
      const names = d.slice(0, 50).map(e => e.n ?? e.employer_name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      const isAlphabetical = names.every((n, i) => n === sorted[i]);
      if (isAlphabetical)
        throw new Error('First 50 entries are alphabetically sorted — search index may lack volume/score data for smart sorting');
    },
  },
  {
    path: '/data/employers/_index.json',
    label: 'Employer name index',
    headOnly: true,
    minSize: 1_000_000,   // ~6 MB
  },
  {
    // Optum Services: one of the largest H-1B filers; must have ≥ 1,800 LCA records.
    // employer_id: 78a46d3917846d886ef35fe989075cb353f21a1d
    path: '/data/employers/78a46d3917846d886ef35fe989075cb353f21a1d.json',
    label: 'Optum Services shard (≥ 1,800 LCA records)',
    minSize: 50_000,
    validate: (d) => {
      const count = d.lca_total ?? (Array.isArray(d.lca) ? d.lca.length : 0);
      if (count < 1800)
        throw new Error(`lca_total = ${count} (need ≥ 1,800) — shard may be empty or truncated`);
    },
  },

  // ── Global metadata ──────────────────────────────────────────────────────────
  {
    path: '/data/_freshness.json',
    label: 'Data freshness marker',
    minSize: 10,
    validate: (d) => {
      if (!d.synced_at) throw new Error('Missing synced_at field — data may be corrupt');
    },
  },

  // ── SRS / Employer dashboard data ────────────────────────────────────────────
  {
    path: '/data/dashboards/employer/srs_overview.json',
    label: 'SRS overview stats',
    minSize: 50,
    validate: (d) => {
      if (!(d.totalEmployers > 0))
        throw new Error(`totalEmployers = ${d.totalEmployers} (must be > 0)`);
    },
  },
  {
    path: '/data/dashboards/employer/employer_friendliness_scores_ml.json',
    label: 'SRS ML scores',
    headOnly: true,
    minSize: 100_000,
  },
  {
    path: '/data/dashboards/employer/employer_risk_features.json',
    label: 'Employer risk features',
    headOnly: true,
    minSize: 50_000,
  },

  // ── Wage dashboard data ──────────────────────────────────────────────────────
  { path: '/data/dashboards/wage/salary_benchmarks_national.json', label: 'National salary benchmarks', minSize: 10_000 },
  { path: '/data/dashboards/wage/salary_benchmarks_states.json',   label: 'State salary benchmarks',   headOnly: true, minSize: 100_000 },
  { path: '/data/dashboards/wage/employer_wage_rankings.json',     label: 'Employer wage rankings',    headOnly: true, minSize: 100_000 },
  { path: '/data/dashboards/wage/soc_salary_market.json',          label: 'SOC salary market data',    headOnly: true, minSize: 100_000 },

  // ── Visa Bulletin dashboard data ─────────────────────────────────────────────
  { path: '/data/dashboards/visa-bulletin/fact_cutoff_trends.json', label: 'Visa bulletin cutoff trends', headOnly: true, minSize: 10_000 },
  { path: '/data/dashboards/visa-bulletin/fact_cutoffs_all.json',   label: 'All visa cutoffs (historical)', headOnly: true, minSize: 10_000 },

  // ── EB Category dashboard data ───────────────────────────────────────────────
  { path: '/data/dashboards/eb-category/category_movement_metrics.json', label: 'EB category movement metrics', headOnly: true, minSize: 10_000 },

  // ── Geographic dashboard data ────────────────────────────────────────────────
  { path: '/data/dashboards/geographic/worksite_geo_metrics.json', label: 'Geographic worksite metrics', headOnly: true, minSize: 30_000 },

  // ── Job Demand dashboard data ────────────────────────────────────────────────
  { path: '/data/dashboards/soc-demand/soc_demand_metrics.json', label: 'SOC demand metrics', headOnly: true, minSize: 10_000 },

  // ── Processing Speed dashboard data ─────────────────────────────────────────
  { path: '/data/dashboards/processing/processing_times_trends.json', label: 'Processing time trends', headOnly: true, minSize: 10_000 },
  { path: '/data/dashboards/processing/fact_uscis_approvals.json',    label: 'USCIS approval data',    headOnly: true, minSize: 10_000 },

  // ── Backlog dashboard data ───────────────────────────────────────────────────
  { path: '/data/dashboards/backlog/backlog_estimates.json',    label: 'Backlog estimates',    headOnly: true, minSize: 10_000 },
  { path: '/data/dashboards/backlog/queue_depth_estimates.json', label: 'Queue depth estimates', headOnly: true, minSize: 10_000 },

  // ── Approvals dashboard data ─────────────────────────────────────────────────
  { path: '/data/dashboards/approvals/approval_denial_trends.json',  label: 'Approval/denial trends',  headOnly: true, minSize: 8_000 },
  { path: '/data/dashboards/approvals/approval_denial_summary.json', label: 'Approval/denial summary', headOnly: true, minSize: 1_500 },

  // ── Model outputs ────────────────────────────────────────────────────────────
  { path: '/data/models/pd_forecasts.json', label: 'Priority date forecast model', headOnly: true, minSize: 50_000 },
];

// ── Check runner ─────────────────────────────────────────────────────────────

async function runCheck(check) {
  const url = `${BASE_URL}${check.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const method = check.headOnly ? 'HEAD' : 'GET';
    const res = await fetch(url, { method, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);

    if (res.status !== 200) {
      return { ok: false, reason: `HTTP ${res.status} ${res.statusText}` };
    }

    if (check.headOnly) {
      // For HEAD: validate Content-Length header
      const cl = parseInt(res.headers.get('content-length') ?? '0', 10);
      if (check.minSize && cl > 0 && cl < check.minSize) {
        return {
          ok: false,
          reason: `Too small: ${cl.toLocaleString()} bytes (need ≥ ${check.minSize.toLocaleString()})`,
        };
      }
      return { ok: true, size: cl };
    }

    // For GET: read body, check size, optionally validate JSON
    const body = await res.text();
    if (check.minSize && body.length < check.minSize) {
      return {
        ok: false,
        reason: `Too small: ${body.length.toLocaleString()} bytes (need ≥ ${check.minSize.toLocaleString()})`,
      };
    }

    if (check.validate) {
      try {
        const data = JSON.parse(body);
        check.validate(data);
      } catch (e) {
        return { ok: false, reason: `Validation failed: ${e.message}` };
      }
    }

    return { ok: true, size: body.length };

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { ok: false, reason: `Timeout after ${TIMEOUT_MS / 1000}s` };
    }
    return { ok: false, reason: err.message };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const displayUrl = BASE_URL.replace(/^https?:\/\//, '');
  const pageCount  = CHECKS.filter(c => c.path.match(/^\/[^/]*\/?$|^\/dashboard\//)).length;
  const dataCount  = CHECKS.length - pageCount;

  console.log(`\n${BOLD}Compass Smoke Tests${RESET}`);
  console.log(`${DIM}Target: ${displayUrl}${RESET}`);
  console.log(`${DIM}Checks: ${pageCount} pages + ${dataCount} data files${RESET}\n`);

  const results = [];
  let passed = 0;
  let failed = 0;

  // Run checks in batches for controlled concurrency
  for (let i = 0; i < CHECKS.length; i += CONCURRENCY) {
    const batch = CHECKS.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(runCheck));

    for (let j = 0; j < batch.length; j++) {
      const check  = batch[j];
      const result = batchResults[j];

      const sizeStr = result.size ? ` ${DIM}(${result.size.toLocaleString()} B)${RESET}` : '';
      const icon    = result.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
      const name    = result.ok ? check.label : `${RED}${check.label}${RESET}`;
      const reason  = result.ok ? '' : `\n      ${YELLOW}→ ${result.reason}${RESET}`;

      console.log(`  ${icon}  ${name}${sizeStr}${reason}`);
      results.push({ check, result });
      if (result.ok) passed++; else failed++;
    }
  }

  // Summary
  console.log('\n' + DIM + '─'.repeat(60) + RESET);

  if (failed > 0) {
    console.log(`\n${RED}${BOLD}${failed} check(s) FAILED${RESET}  (${passed} passed)\n`);
    const failures = results.filter(r => !r.result.ok);
    failures.forEach(({ check, result }) => {
      console.log(`  ${RED}✗  ${check.path}${RESET}`);
      console.log(`     ${YELLOW}${result.reason}${RESET}`);
    });
    console.log('');
    process.exit(1);
  } else {
    console.log(`\n${GREEN}${BOLD}ALL ${passed} CHECKS PASSED${RESET} ✓\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`\n${RED}Fatal error: ${err.message}${RESET}\n`);
  process.exit(1);
});
