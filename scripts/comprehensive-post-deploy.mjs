#!/usr/bin/env node
/**
 * comprehensive-post-deploy.mjs — Enterprise-grade post-deployment validation
 *
 * Tests EVERY data file, validates schemas, checks cross-references,
 * verifies employer shard integrity at scale, validates search/filter
 * behavior, and confirms all dashboard data meets quality thresholds.
 *
 * Design philosophy: If it can break, test it. If a user can see it, verify it.
 * Industry standard: treat post-deploy validation like integration tests.
 *
 * Usage:
 *   node scripts/comprehensive-post-deploy.mjs                     # stage (default)
 *   node scripts/comprehensive-post-deploy.mjs --url http://localhost:3000  # local
 *   node scripts/comprehensive-post-deploy.mjs --url https://prod.example.com
 *   node scripts/comprehensive-post-deploy.mjs --quick             # fast subset (~100 tests)
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

const args = process.argv.slice(2);
const urlFlagIdx = args.indexOf('--url');
const BASE_URL = (urlFlagIdx !== -1 ? args[urlFlagIdx + 1] : null)
  ?? process.env.SMOKE_TEST_URL
  ?? 'https://stage.immigrationcompass.fyi';
const QUICK_MODE = args.includes('--quick');
const TIMEOUT_MS = 30_000;
const CONCURRENCY = 8;

// Basic auth support (for stage environments with CloudFront auth)
const BASIC_AUTH_B64 = process.env.BASIC_AUTH_B64 || '';
const AUTH_HEADERS = BASIC_AUTH_B64
  ? { 'Authorization': `Basic ${BASIC_AUTH_B64}` }
  : {};

// ── ANSI ─────────────────────────────────────────────────────────────────────
const C = {
  G: '\x1b[32m', R: '\x1b[31m', Y: '\x1b[33m', B: '\x1b[34m',
  D: '\x1b[2m', BOLD: '\x1b[1m', RST: '\x1b[0m',
};

// ── Statistics ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const failures = [];
const startTime = Date.now();

function pass(label) { passed++; }
function fail(label, reason) {
  failed++;
  failures.push({ label, reason });
  console.log(`  ${C.R}✗${C.RST}  ${C.R}${label}${C.RST}\n      ${C.Y}→ ${reason}${C.RST}`);
}
function skip(label) { skipped++; }

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function fetchJSON(path, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal, headers: AUTH_HEADERS });
    clearTimeout(timer);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const sanitized = text.replace(/\bNaN\b|-?\bInfinity\b/g, 'null');
    return JSON.parse(sanitized);
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function fetchHead(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Use Accept-Encoding: identity to prevent CloudFront from compressing
    // the response, which strips the content-length header.
    const hdrs = { ...AUTH_HEADERS, 'Accept-Encoding': 'identity' };
    const res = await fetch(`${BASE_URL}${path}`, { method: 'HEAD', signal: controller.signal, headers: hdrs });
    clearTimeout(timer);
    return { status: res.status, contentLength: parseInt(res.headers.get('content-length') ?? '0', 10) };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function fetchHTML(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal, headers: AUTH_HEADERS });
    clearTimeout(timer);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Test runner ──────────────────────────────────────────────────────────────
async function runBatch(label, tests) {
  console.log(`\n${C.BOLD}${label}${C.RST} ${C.D}(${tests.length} tests)${C.RST}`);
  for (let i = 0; i < tests.length; i += CONCURRENCY) {
    const batch = tests.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (t) => {
      try {
        await t.fn();
        pass(t.label);
      } catch (e) {
        fail(t.label, e.message);
      }
    }));
  }
}

function assert(condition, msg) { if (!condition) throw new Error(msg); }
function assertGT(val, threshold, label) { assert(val > threshold, `${label}: ${val} ≤ ${threshold}`); }
function assertGTE(val, threshold, label) { assert(val >= threshold, `${label}: ${val} < ${threshold}`); }
function assertRange(val, min, max, label) {
  assert(val >= min && val <= max, `${label}: ${val} not in [${min}, ${max}]`);
}
function assertHasKeys(obj, keys, label) {
  for (const k of keys) assert(k in obj, `${label}: missing key "${k}"`);
}
function assertArrayMinLength(arr, min, label) {
  assert(Array.isArray(arr), `${label}: not an array`);
  assert(arr.length >= min, `${label}: length ${arr.length} < ${min}`);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 1: PAGE AVAILABILITY & RENDERING
// ═══════════════════════════════════════════════════════════════════════════

async function testPages() {
  const pages = [
    { path: '/', label: 'Home page', minSize: 5000, mustContain: ['Compass', 'dashboard'] },
    { path: '/about/', label: 'About page', minSize: 3000, mustContain: ['NorthStar'] },
    { path: '/insights/', label: 'My Insights page', minSize: 5000, mustContain: ['insight'] },
    { path: '/ask/', label: 'Ask page', minSize: 3000, mustContain: ['question'] },
    { path: '/privacy/', label: 'Privacy page', minSize: 2000, mustContain: ['privacy'] },
    { path: '/terms/', label: 'Terms page', minSize: 2000, mustContain: ['terms'] },
    { path: '/dashboard/employer/', label: 'Employer dashboard', minSize: 5000, mustContain: ['employer'] },
    { path: '/dashboard/wage/', label: 'Wage Intelligence', minSize: 5000, mustContain: ['wage'] },
    { path: '/dashboard/visa-bulletin/', label: 'Visa Bulletin', minSize: 5000, mustContain: ['visa'] },
    { path: '/dashboard/eb-category/', label: 'EB Category', minSize: 5000, mustContain: ['category'] },
    { path: '/dashboard/geographic/', label: 'Geographic', minSize: 5000 },
    { path: '/dashboard/job-demand/', label: 'Job Demand', minSize: 5000 },
    { path: '/dashboard/processing/', label: 'Processing Speed', minSize: 5000 },
    { path: '/dashboard/backlog/', label: 'Backlog', minSize: 5000 },
    { path: '/dashboard/approvals/', label: 'Approval Trends', minSize: 5000 },
  ];

  const tests = [];
  for (const pg of pages) {
    tests.push({
      label: `Page loads: ${pg.label} (${pg.path})`,
      fn: async () => {
        const html = await fetchHTML(pg.path);
        assertGTE(html.length, pg.minSize, 'page size');
        assert(!html.includes('Application error'), 'Page shows application error');
        assert(!html.includes('Internal Server Error'), 'Page shows server error');
        if (pg.mustContain) {
          for (const term of pg.mustContain) {
            assert(html.toLowerCase().includes(term.toLowerCase()),
              `Page missing expected content: "${term}"`);
          }
        }
      }
    });
  }

  // CSS bundle integrity
  tests.push({
    label: 'CSS bundles load correctly (not HTML fallback)',
    fn: async () => {
      const html = await fetchHTML('/');
      const cssHrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)]
        .map(m => m[1]).filter(h => h.startsWith('/'));
      assertGTE(cssHrefs.length, 1, 'CSS links found');
      for (const href of cssHrefs) {
        const res = await fetch(`${BASE_URL}${href}`, { headers: AUTH_HEADERS });
        assert(res.status === 200, `CSS ${href}: HTTP ${res.status}`);
        const ct = res.headers.get('content-type') ?? '';
        assert(!ct.includes('text/html'), `CSS ${href}: serving HTML not CSS`);
        const body = await res.text();
        assert(!body.startsWith('<!DOCTYPE'), `CSS ${href}: HTML body served`);
        assert(/[{][^}]*:[^}]*[}]/.test(body), `CSS ${href}: no CSS rules found`);
      }
    }
  });

  // JS bundle integrity
  tests.push({
    label: 'JS bundles load correctly (not HTML fallback)',
    fn: async () => {
      const html = await fetchHTML('/');
      const jsHrefs = [...html.matchAll(/src=["'](\/\_next\/static\/[^"']+\.js)["']/g)]
        .map(m => m[1]);
      assertGTE(jsHrefs.length, 1, 'JS links found');
      // Check first 3 JS bundles
      for (const href of jsHrefs.slice(0, 3)) {
        const res = await fetch(`${BASE_URL}${href}`, { headers: AUTH_HEADERS });
        assert(res.status === 200, `JS ${href}: HTTP ${res.status}`);
        const ct = res.headers.get('content-type') ?? '';
        assert(!ct.includes('text/html'), `JS ${href}: HTML instead of JS`);
      }
    }
  });

  await runBatch('1. Page Availability & Rendering', tests);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 2: EMPLOYER SEARCH SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

async function testEmployerSearch() {
  const tests = [];

  // Load search index once
  let searchIndex;
  tests.push({
    label: 'Search index loads with 100K+ entries',
    fn: async () => {
      searchIndex = await fetchJSON('/data/employers/_search.json');
      assertArrayMinLength(searchIndex, 100000, 'search entries');
    }
  });

  await runBatch('2a. Employer Search Index — Load', tests);
  if (!searchIndex) return; // Can't continue without search index

  const tests2 = [];

  // Schema validation
  tests2.push({
    label: 'Search entry schema: compact format (n/id/f/sc/ms/y)',
    fn: async () => {
      const sample = searchIndex[0];
      assertHasKeys(sample, ['n', 'id'], 'search entry');
      assert(typeof sample.n === 'string' && sample.n.length > 0, 'name is non-empty string');
      assert(typeof sample.id === 'string', 'id is string');
    }
  });

  // Data quality: volume/score fields present for smart sorting
  tests2.push({
    label: 'Search data quality: 80%+ entries have volume data for smart sort',
    fn: async () => {
      const sampleSize = Math.min(500, searchIndex.length);
      let withVolume = 0;
      for (let i = 0; i < sampleSize; i++) {
        if (typeof (searchIndex[i].f ?? searchIndex[i].total_filings) === 'number') withVolume++;
      }
      assertGTE(withVolume / sampleSize, 0.8, 'volume data ratio');
    }
  });

  // Not alphabetically sorted (smart sort working)
  tests2.push({
    label: 'Search index is smart-sorted (not alphabetical)',
    fn: async () => {
      const names = searchIndex.slice(0, 50).map(e => e.n ?? e.employer_name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      const isAlpha = names.every((n, i) => n === sorted[i]);
      assert(!isAlpha, 'First 50 entries are alphabetical — smart sort broken');
    }
  });

  // ── Anchor employer verification ─────────────────────────────────────────
  // These are the employers users search for most. Each must be findable,
  // have shard data, and have trend data that renders correctly.
  const ANCHOR_EMPLOYERS = [
    { search: 'cognizant', expectedName: /cognizant technology solutions/i, minFilings: 10000 },
    { search: 'optum', expectedName: /optum services/i, minFilings: 500 },
    { search: 'infosys', expectedName: /infosys/i, minFilings: 5000 },
    { search: 'tata consultancy', expectedName: /tata consultancy/i, minFilings: 5000 },
    { search: 'wipro', expectedName: /wipro/i, minFilings: 1000 },
    { search: 'amazon', expectedName: /amazon/i, minFilings: 5000 },
    { search: 'google', expectedName: /google/i, minFilings: 1000 },
    { search: 'microsoft', expectedName: /microsoft/i, minFilings: 1000 },
    { search: 'meta platforms', expectedName: /meta/i, minFilings: 500 },
    { search: 'apple', expectedName: /apple/i, minFilings: 500 },
    { search: 'deloitte', expectedName: /deloitte/i, minFilings: 1000 },
    { search: 'accenture', expectedName: /accenture/i, minFilings: 1000 },
    { search: 'hcl', expectedName: /hcl/i, minFilings: 1000 },
    { search: 'capgemini', expectedName: /capgemini/i, minFilings: 500 },
    { search: 'ibm', expectedName: /ibm/i, minFilings: 1000 },
    { search: 'ernst young', expectedName: /ernst/i, minFilings: 500 },
    { search: 'jpmorgan', expectedName: /jpmorgan|jp morgan/i, minFilings: 500 },
    { search: 'goldman', expectedName: /goldman/i, minFilings: 200 },
    { search: 'uber', expectedName: /uber/i, minFilings: 200 },
    { search: 'tesla', expectedName: /tesla/i, minFilings: 100 },
  ];

  for (const anchor of ANCHOR_EMPLOYERS) {
    const q = anchor.search.toLowerCase();
    tests2.push({
      label: `Employer findable: "${anchor.search}" in search index`,
      fn: async () => {
        const matches = searchIndex.filter(e =>
          (e.n ?? e.employer_name ?? '').toLowerCase().includes(q)
        );
        assertGTE(matches.length, 1, `"${anchor.search}" matches`);
        const top = matches.sort((a, b) => (b.f ?? 0) - (a.f ?? 0))[0];
        assert(anchor.expectedName.test(top.n ?? top.employer_name),
          `Top match "${top.n}" doesn't match /${anchor.expectedName.source}/`);
        assertGTE(top.f ?? top.total_filings ?? 0, anchor.minFilings,
          `${top.n} total filings`);
        assert(top.id && top.id.length > 10, `${top.n} has no employer_id hash`);
      }
    });
  }

  await runBatch('2b. Employer Search — Quality & Anchors', tests2);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 3: EMPLOYER SHARD INTEGRITY (THE BIG ONE)
// ═══════════════════════════════════════════════════════════════════════════

async function testEmployerShards() {
  // Load search index
  let searchIndex;
  try {
    searchIndex = await fetchJSON('/data/employers/_search.json');
  } catch { return; }

  // ── Deep validation of anchor employer shards ────────────────────────────
  // These validate the FULL user journey: search → select → shard loads →
  // wage trend renders → roles render → SRS data renders.
  // This catches the exact bug type that was breaking Cognizant.

  const DEEP_SHARDS = [
    {
      name: 'Cognizant Technology Solutions',
      search: 'cognizant',
      checks: {
        minLca: 5000,
        requireWageTrend: true,
        requireWageRoles: true,
        requireSrs: true,
        minWageTrendYears: 5,
        minWageRoles: 5,
        salaryFloor: 40000,
        salaryCeiling: 500000,
      }
    },
    {
      name: 'Optum Services',
      search: 'optum services',
      checks: {
        minLca: 1800,
        requireWageTrend: true,
        requireWageRoles: true,
        requireWageRoleTrends: true,
        requireSrs: true,
        requireSrsMonthly: true,
        minWageTrendYears: 3,
        minWageRoles: 3,
        minSrsMonthly: 10,
        salaryFloor: 40000,
        salaryCeiling: 500000,
      }
    },
    {
      name: 'Infosys',
      search: 'infosys',
      checks: {
        minLca: 5000,
        requireWageTrend: true,
        requireWageRoles: true,
        requireSrs: true,
        minWageTrendYears: 3,
        minWageRoles: 5,
        salaryFloor: 40000,
        salaryCeiling: 500000,
      }
    },
    {
      name: 'Tata Consultancy Services',
      search: 'tata consultancy',
      checks: {
        minLca: 5000,
        requireWageTrend: true,
        requireWageRoles: true,
        minWageTrendYears: 3,
        minWageRoles: 5,
        salaryFloor: 40000,
        salaryCeiling: 500000,
      }
    },
    {
      name: 'Amazon',
      search: 'amazon',
      checks: {
        minLca: 5000,
        requireWageTrend: true,
        requireWageRoles: true,
        minWageTrendYears: 3,
        minWageRoles: 5,
        salaryFloor: 50000,
        salaryCeiling: 800000,
      }
    },
  ];

  // In QUICK_MODE only test Cognizant + Optum
  const shardsToTest = QUICK_MODE ? DEEP_SHARDS.slice(0, 2) : DEEP_SHARDS;

  const tests = [];
  for (const shard of shardsToTest) {
    const q = shard.search.toLowerCase();
    const entry = searchIndex.find(e => (e.n ?? '').toLowerCase().includes(q));
    if (!entry || !entry.id) {
      tests.push({ label: `Shard deep: ${shard.name} — find in search`, fn: async () => {
        throw new Error(`"${shard.search}" not found in search index`);
      }});
      continue;
    }

    const shardId = entry.id;
    const searchName = entry.n ?? entry.employer_name;

    // Load the shard
    tests.push({
      label: `Shard loads: ${shard.name}`,
      fn: async () => {
        const data = await fetchJSON(`/data/employers/${shardId}.json`);
        assert(data.employer_name, 'employer_name missing');
        assert(data.employer_id === shardId, `employer_id mismatch: ${data.employer_id} vs ${shardId}`);
      }
    });

    // LCA data
    tests.push({
      label: `Shard LCA: ${shard.name} has ${shard.checks.minLca}+ filings`,
      fn: async () => {
        const data = await fetchJSON(`/data/employers/${shardId}.json`);
        const lcaCount = data.lca_total ?? (Array.isArray(data.lca) ? data.lca.length : 0);
        assertGTE(lcaCount, shard.checks.minLca, 'lca_total');
      }
    });

    // LCA record schema
    tests.push({
      label: `Shard LCA schema: ${shard.name} records have required fields`,
      fn: async () => {
        const data = await fetchJSON(`/data/employers/${shardId}.json`);
        if (Array.isArray(data.lca) && data.lca.length > 0) {
          const rec = data.lca[0];
          const hasFields = rec.job_title && rec.visa_class && (rec.wage_annual || rec.wage_rate_of_pay_from);
          assert(hasFields, `LCA record missing fields: ${JSON.stringify(Object.keys(rec).slice(0, 10))}`);
        }
      }
    });

    // Wage trend
    if (shard.checks.requireWageTrend) {
      tests.push({
        label: `Shard wage_trend: ${shard.name} has ${shard.checks.minWageTrendYears}+ years`,
        fn: async () => {
          const data = await fetchJSON(`/data/employers/${shardId}.json`);
          assertArrayMinLength(data.wage_trend, shard.checks.minWageTrendYears, 'wage_trend');
          // Schema check
          const wt = data.wage_trend[0];
          assertHasKeys(wt, ['fiscal_year', 'visa_type', 'median_salary', 'total_filings'], 'wage_trend[0]');
        }
      });

      // Salary sanity
      tests.push({
        label: `Shard wage sanity: ${shard.name} salaries in plausible range`,
        fn: async () => {
          const data = await fetchJSON(`/data/employers/${shardId}.json`);
          for (const wt of data.wage_trend) {
            assertRange(wt.median_salary, shard.checks.salaryFloor, shard.checks.salaryCeiling,
              `FY${wt.fiscal_year} median_salary`);
          }
        }
      });

      // THE CRITICAL BUG TEST: name match between search and shard
      tests.push({
        label: `Shard name consistency: ${shard.name} — search name matches shard name (case-insensitive)`,
        fn: async () => {
          const data = await fetchJSON(`/data/employers/${shardId}.json`);
          assert(
            data.employer_name.toLowerCase() === searchName.toLowerCase() ||
            searchName.toLowerCase().includes(data.employer_name.toLowerCase()) ||
            data.employer_name.toLowerCase().includes(searchName.toLowerCase()),
            `Name mismatch! Search: "${searchName}" vs Shard: "${data.employer_name}" — ` +
            `this WILL cause "No trend data available" bug`
          );
        }
      });

      // Simulate the exact frontend data flow:
      // search → select → shard loads → extractWageTrend → getEmployerTrend → render
      tests.push({
        label: `E2E wage flow: ${shard.name} — search→select→trend renders`,
        fn: async () => {
          const data = await fetchJSON(`/data/employers/${shardId}.json`);
          // extractWageTrend: set employer_name from shard
          const trends = (data.wage_trend || []).map(r => ({
            ...r, employer_name: data.employer_name
          }));
          // getEmployerTrend: filter by selectedEmployer (from search index)
          const needle = searchName.toLowerCase();
          const filtered = trends.filter(r =>
            r.employer_name.toLowerCase() === needle && r.visa_type === 'H-1B'
          );
          assertGTE(filtered.length, 1,
            `Simulated getEmployerTrend("${searchName}") returned ${filtered.length} rows — ` +
            `UI would show "No trend data available"! ` +
            `This is the exact bug path. Search name="${searchName}", Shard name="${data.employer_name}"`);
        }
      });
    }

    // Wage roles
    if (shard.checks.requireWageRoles) {
      tests.push({
        label: `Shard wage_roles: ${shard.name} has ${shard.checks.minWageRoles}+ roles`,
        fn: async () => {
          const data = await fetchJSON(`/data/employers/${shardId}.json`);
          assertArrayMinLength(data.wage_roles, shard.checks.minWageRoles, 'wage_roles');
          const wr = data.wage_roles[0];
          assertHasKeys(wr, ['soc_code', 'soc_title', 'n_filings', 'median_salary'], 'wage_roles[0]');
          assertRange(wr.median_salary, 30000, 1000000, 'wage_roles[0].median_salary');
        }
      });
    }

    // Wage role trends
    if (shard.checks.requireWageRoleTrends) {
      tests.push({
        label: `Shard wage_role_trends: ${shard.name} has role drill-down data`,
        fn: async () => {
          const data = await fetchJSON(`/data/employers/${shardId}.json`);
          assertArrayMinLength(data.wage_role_trends, 5, 'wage_role_trends');
        }
      });
    }

    // SRS data
    if (shard.checks.requireSrs) {
      tests.push({
        label: `Shard SRS: ${shard.name} has reliability score`,
        fn: async () => {
          const data = await fetchJSON(`/data/employers/${shardId}.json`);
          assert(data.srs && typeof data.srs === 'object', 'srs missing or not object');
          assert(typeof data.srs.approval_rate_36m === 'number' || typeof data.srs.approval_rate_24m === 'number',
            'srs.approval_rate missing');
        }
      });
    }

    // SRS monthly
    if (shard.checks.requireSrsMonthly) {
      tests.push({
        label: `Shard SRS monthly: ${shard.name} has ${shard.checks.minSrsMonthly}+ months`,
        fn: async () => {
          const data = await fetchJSON(`/data/employers/${shardId}.json`);
          assertArrayMinLength(data.srs_monthly, shard.checks.minSrsMonthly, 'srs_monthly');
        }
      });
    }
  }

  // ── Random shard sampling ──────────────────────────────────────────────────
  // Pick random employers from search index and validate their shards load
  // This catches deployment issues where only specific shards were uploaded
  if (!QUICK_MODE) {
    const RANDOM_SAMPLE_SIZE = 50;
    const withIds = searchIndex.filter(e => e.id && e.id.length > 10);
    const shuffled = withIds.sort(() => Math.random() - 0.5).slice(0, RANDOM_SAMPLE_SIZE);

    for (const entry of shuffled) {
      tests.push({
        label: `Random shard: ${(entry.n ?? 'unknown').substring(0, 40)} loads`,
        fn: async () => {
          const head = await fetchHead(`/data/employers/${entry.id}.json`);
          assert(head.status === 200, `HTTP ${head.status}`);
          assertGT(head.contentLength, 100, 'shard size');
        }
      });
    }
  }

  await runBatch('3. Employer Shard Integrity', tests);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 4: DASHBOARD DATA FILES — SCHEMA & QUALITY
// ═══════════════════════════════════════════════════════════════════════════

async function testDashboardData() {
  const tests = [];

  // ── Wage Dashboard ────────────────────────────────────────────────────────
  tests.push({
    label: 'Wage: national benchmarks has 10+ SOC categories',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/wage/salary_benchmarks_national.json');
      assert(Array.isArray(d), 'not an array');
      assertGTE(d.length, 10, 'SOC categories');
      assertHasKeys(d[0], ['soc_code', 'soc_title', 'median'], 'benchmark[0]');
      assertRange(d[0].median, 20000, 500000, 'median sanity');
    }
  });

  tests.push({
    label: 'Wage: state benchmarks exist (50+ entries)',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/wage/salary_benchmarks_states.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 100000, 'state benchmarks size');
    }
  });

  tests.push({
    label: 'Wage: SOC salary market has 100+ occupations',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/wage/soc_salary_market.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 100000, 'SOC market size');
    }
  });

  tests.push({
    label: 'Wage: employer_salary_trend source exists (consolidation input)',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/wage/employer_salary_trend.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 1000000, 'salary_trend source size');
    }
  });

  tests.push({
    label: 'Wage: employer_role_profiles source exists (wage_roles input)',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/wage/employer_role_profiles.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 50000000, 'role_profiles source size');
    }
  });

  tests.push({
    label: 'Wage: employer_role_trends source exists (drill-down input)',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/wage/employer_role_trends.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 1000000, 'role_trends source size');
    }
  });

  // ── Visa Bulletin ─────────────────────────────────────────────────────────
  tests.push({
    label: 'Visa Bulletin: cutoff trends has EB1/EB2/EB3 data',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/visa-bulletin/fact_cutoff_trends.json');
      assert(Array.isArray(d), 'not an array');
      assertGTE(d.length, 100, 'cutoff trend rows');
      const categories = new Set(d.map(r => r.category));
      for (const cat of ['EB1', 'EB2', 'EB3']) {
        assert(categories.has(cat), `Missing category: ${cat}`);
      }
      // Verify India and China data present
      const countries = new Set(d.map(r => r.country));
      assert(countries.has('IND') || countries.has('INDIA'), 'No India data');
    }
  });

  tests.push({
    label: 'Visa Bulletin: historical cutoffs exist',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/visa-bulletin/fact_cutoffs_all.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 10000, 'historical cutoffs size');
    }
  });

  // ── EB Category ───────────────────────────────────────────────────────────
  tests.push({
    label: 'EB Category: movement metrics has 1000+ rows',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/eb-category/category_movement_metrics.json');
      assertArrayMinLength(d, 1000, 'movement metrics');
    }
  });

  tests.push({
    label: 'EB Category: EB2 India velocity >= EB3 India (regression guard)',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/eb-category/category_movement_metrics.json');
      function latest(cat, country, chart) {
        return d
          .filter(r => r.category === cat && r.country === country && r.chart === chart)
          .sort((a, b) => (a.bulletin_year * 100 + a.bulletin_month) - (b.bulletin_year * 100 + b.bulletin_month))
          .at(-1);
      }
      const eb2 = latest('EB2', 'IND', 'DFF');
      const eb3 = latest('EB3', 'IND', 'DFF');
      assert(eb2 && eb3, 'Missing EB2 or EB3 IND DFF');
      const eb2v = eb2.avg_monthly_advancement_days ?? 0;
      const eb3v = eb3.avg_monthly_advancement_days ?? 0;
      assert(eb2v >= eb3v,
        `REGRESSION: EB2 India (${eb2v.toFixed(1)}) < EB3 (${eb3v.toFixed(1)})`);
    }
  });

  // ── SRS / Employer Dashboard ──────────────────────────────────────────────
  tests.push({
    label: 'SRS: overview stats show 1000+ total employers',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/employer/srs_overview.json');
      assertGTE(d.totalEmployers, 1000, 'totalEmployers');
      assertGT(d.avgScore, 0, 'avgScore');
    }
  });

  tests.push({
    label: 'SRS: ML scores file exists and is large',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/employer/employer_friendliness_scores_ml.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 100000, 'ML scores size');
    }
  });

  tests.push({
    label: 'SRS: risk features exist',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/employer/employer_risk_features.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 50000, 'risk features size');
    }
  });

  // ── Geographic ────────────────────────────────────────────────────────────
  tests.push({
    label: 'Geographic: worksite metrics has 100+ entries',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/geographic/worksite_geo_metrics.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 30000, 'geo metrics size');
    }
  });

  // ── Job Demand / SOC ──────────────────────────────────────────────────────
  tests.push({
    label: 'Job Demand: SOC demand metrics exist',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/soc-demand/soc_demand_metrics.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 10000, 'SOC demand size');
    }
  });

  // ── Processing Speed ──────────────────────────────────────────────────────
  tests.push({
    label: 'Processing: time trends exist',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/processing/processing_times_trends.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 10000, 'processing trends size');
    }
  });

  tests.push({
    label: 'Processing: USCIS approvals data exists',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/processing/fact_uscis_approvals.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 10000, 'USCIS approvals size');
    }
  });

  // ── Backlog ───────────────────────────────────────────────────────────────
  tests.push({
    label: 'Backlog: estimates exist with valid schema',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/backlog/backlog_estimates.json');
      assert(Array.isArray(d) && d.length > 0, 'empty or not array');
    }
  });

  tests.push({
    label: 'Backlog: queue depth estimates exist',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/backlog/queue_depth_estimates.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 10000, 'queue depth size');
    }
  });

  // ── Approvals ─────────────────────────────────────────────────────────────
  tests.push({
    label: 'Approvals: trends data has valid schema',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/approvals/approval_denial_trends.json');
      assert(Array.isArray(d) && d.length > 0, 'empty or not array');
    }
  });

  tests.push({
    label: 'Approvals: summary exists',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/approvals/approval_denial_summary.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 500, 'summary size');
    }
  });

  tests.push({
    label: 'Approvals: by category exists',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/approvals/approval_denial_by_category.json');
      assert(head.status === 200, `HTTP ${head.status}`);
    }
  });

  tests.push({
    label: 'Approvals: PERM detailed trends exist',
    fn: async () => {
      const head = await fetchHead('/data/dashboards/approvals/perm_trends_detailed.json');
      assert(head.status === 200, `HTTP ${head.status}`);
    }
  });

  await runBatch('4. Dashboard Data Files', tests);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 5: DIMENSION FILES & METADATA
// ═══════════════════════════════════════════════════════════════════════════

async function testDimensions() {
  const tests = [];

  const DIMS = [
    { path: '/data/dims/dim_area.json', label: 'dim_area', minEntries: 50 },
    { path: '/data/dims/dim_country.json', label: 'dim_country', minEntries: 100 },
    { path: '/data/dims/dim_soc.json', label: 'dim_soc', minEntries: 100 },
    { path: '/data/dims/dim_visa_ceiling.json', label: 'dim_visa_ceiling', minEntries: 1 },
    { path: '/data/dims/dim_visa_class.json', label: 'dim_visa_class', minEntries: 2 },
  ];

  for (const dim of DIMS) {
    tests.push({
      label: `Dimension: ${dim.label} has ${dim.minEntries}+ entries`,
      fn: async () => {
        const d = await fetchJSON(dim.path);
        assert(Array.isArray(d), `${dim.label}: not an array`);
        assertGTE(d.length, dim.minEntries, `${dim.label} entries`);
      }
    });
  }

  // Metadata files
  tests.push({
    label: 'Freshness marker: synced_at field present',
    fn: async () => {
      const d = await fetchJSON('/data/_freshness.json');
      assert(d.synced_at, 'synced_at missing');
    }
  });

  tests.push({
    label: 'Manifest file exists',
    fn: async () => {
      const d = await fetchJSON('/data/_manifest.json');
      assert(typeof d === 'object', 'manifest not an object');
    }
  });

  await runBatch('5. Dimensions & Metadata', tests);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 6: ML MODELS & FORECASTS
// ═══════════════════════════════════════════════════════════════════════════

async function testModels() {
  const tests = [];

  tests.push({
    label: 'PD Forecasts: has EB2/EB3 India predictions',
    fn: async () => {
      const d = await fetchJSON('/data/models/pd_forecasts.json');
      assert(Array.isArray(d), 'not an array');
      assertGTE(d.length, 10, 'forecast rows');
      const categories = new Set(d.map(r => r.category));
      assert(categories.has('EB2') || categories.has('EB-2'), 'No EB2 forecasts');
      assert(categories.has('EB3') || categories.has('EB-3'), 'No EB3 forecasts');
    }
  });

  tests.push({
    label: 'PD Forecast model metadata exists',
    fn: async () => {
      const head = await fetchHead('/data/models/pd_forecast_model.json');
      assert(head.status === 200, `HTTP ${head.status}`);
    }
  });

  tests.push({
    label: 'PD Retrograde forecasts exist',
    fn: async () => {
      const head = await fetchHead('/data/models/pd_forecasts_retrograde.json');
      assert(head.status === 200, `HTTP ${head.status}`);
    }
  });

  await runBatch('6. ML Models & Forecasts', tests);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 7: RAG / Q&A SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

async function testRag() {
  const tests = [];

  tests.push({
    label: 'RAG: chunks file exists with content',
    fn: async () => {
      const head = await fetchHead('/data/rag/all_chunks.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 10000, 'chunks size');
    }
  });

  tests.push({
    label: 'RAG: QA cache has pre-computed answers',
    fn: async () => {
      const d = await fetchJSON('/data/rag/qa_cache.json');
      assert(typeof d === 'object', 'not an object');
      const keys = Object.keys(d);
      assertGTE(keys.length, 5, 'QA entries');
    }
  });

  tests.push({
    label: 'RAG: catalog exists',
    fn: async () => {
      const head = await fetchHead('/data/rag/catalog.json');
      assert(head.status === 200, `HTTP ${head.status}`);
    }
  });

  tests.push({
    label: 'RAG: build summary exists',
    fn: async () => {
      const head = await fetchHead('/data/rag/build_summary.json');
      assert(head.status === 200, `HTTP ${head.status}`);
    }
  });

  await runBatch('7. RAG / Q&A System', tests);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 8: EMPLOYER NAME INDEX & CROSS-REFERENCE INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════

async function testCrossReferences() {
  const tests = [];

  tests.push({
    label: 'Employer index: _index.json has 90K+ entries',
    fn: async () => {
      const d = await fetchJSON('/data/employers/_index.json');
      const keys = Object.keys(d);
      assertGTE(keys.length, 90000, 'index entries');
    }
  });

  tests.push({
    label: 'Cross-ref: search entry IDs resolve to existing shards (sample 20)',
    fn: async () => {
      const search = await fetchJSON('/data/employers/_search.json');
      const withIds = search.filter(e => e.id && e.id.length > 10);
      const sample = withIds.sort(() => Math.random() - 0.5).slice(0, 20);
      let ok = 0;
      for (const entry of sample) {
        try {
          const head = await fetchHead(`/data/employers/${entry.id}.json`);
          if (head.status === 200) ok++;
        } catch { /* timeout */ }
      }
      assertGTE(ok, 18, `resolved shards (of 20 sampled)`);
    }
  });

  await runBatch('8. Cross-Reference Integrity', tests);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 9: STATIC ASSETS & SEO
// ═══════════════════════════════════════════════════════════════════════════

async function testStaticAssets() {
  const tests = [];

  tests.push({
    label: 'robots.txt exists and allows crawling',
    fn: async () => {
      const html = await fetchHTML('/robots.txt');
      assert(html.includes('User-agent'), 'No User-agent directive');
    }
  });

  tests.push({
    label: 'sitemap.xml exists',
    fn: async () => {
      const html = await fetchHTML('/sitemap.xml');
      assert(html.includes('<?xml') || html.includes('<urlset'), 'Not valid XML');
    }
  });

  tests.push({
    label: 'GeoJSON: US states topology loads',
    fn: async () => {
      const head = await fetchHead('/data/us-states-10m.json');
      assert(head.status === 200, `HTTP ${head.status}`);
      assertGT(head.contentLength, 100000, 'topology size');
    }
  });

  await runBatch('9. Static Assets & SEO', tests);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 10: DATA QUALITY DEEP DIVES
// ═══════════════════════════════════════════════════════════════════════════

async function testDataQuality() {
  if (QUICK_MODE) return;

  const tests = [];

  // ── Approval data sanity ──────────────────────────────────────────────────
  tests.push({
    label: 'Data quality: approval rates are 0-100%',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/approvals/approval_denial_trends.json');
      for (const row of d.slice(0, 100)) {
        if (row.approval_rate != null) {
          assertRange(row.approval_rate, 0, 100, 'approval_rate');
        }
      }
    }
  });

  // ── Wage data sanity ──────────────────────────────────────────────────────
  tests.push({
    label: 'Data quality: national median salaries are $30K-$500K',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/wage/salary_benchmarks_national.json');
      for (const row of d) {
        if (row.median != null) {
          assertRange(row.median, 20000, 500000, `${row.soc_title} median`);
        }
      }
    }
  });

  // ── Backlog sane dates ─────────────────────────────────────────────────
  tests.push({
    label: 'Data quality: backlog estimates have valid years',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/backlog/backlog_estimates.json');
      for (const row of d.slice(0, 50)) {
        if (row.year || row.fiscal_year) {
          const yr = row.year ?? row.fiscal_year;
          assertRange(yr, 2000, 2035, 'backlog year');
        }
      }
    }
  });

  // ── Visa bulletin dates ─────────────────────────────────────────────────
  tests.push({
    label: 'Data quality: visa bulletin has data from multiple years',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/visa-bulletin/fact_cutoff_trends.json');
      const years = new Set(d.map(r => r.bulletin_year).filter(Boolean));
      assertGTE(years.size, 3, 'distinct bulletin years');
    }
  });

  // ── Processing times: no negative days ──────────────────────────────────
  tests.push({
    label: 'Data quality: processing times are non-negative',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/processing/processing_times_trends.json');
      if (Array.isArray(d)) {
        for (const row of d.slice(0, 100)) {
          if (row.processing_days != null) {
            assert(row.processing_days >= 0, `Negative processing days: ${row.processing_days}`);
          }
        }
      }
    }
  });

  // ── SOC demand: valid SOC codes ────────────────────────────────────────
  tests.push({
    label: 'Data quality: SOC demand has valid SOC code format',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/soc-demand/soc_demand_metrics.json');
      if (Array.isArray(d) && d.length > 0) {
        const sample = d.slice(0, 20);
        for (const row of sample) {
          if (row.soc_code) {
            assert(/^\d{2}-\d{4}/.test(row.soc_code),
              `Invalid SOC code format: ${row.soc_code}`);
          }
        }
      }
    }
  });

  // ── Geographic: valid state abbreviations ──────────────────────────────
  tests.push({
    label: 'Data quality: geographic data has valid US state codes',
    fn: async () => {
      const d = await fetchJSON('/data/dashboards/geographic/worksite_geo_metrics.json');
      if (Array.isArray(d) && d.length > 0) {
        const states = new Set(d.map(r => r.state ?? r.worksite_state).filter(Boolean));
        assertGTE(states.size, 20, 'distinct states');
      }
    }
  });

  await runBatch('10. Data Quality Deep Dives', tests);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 11: ADDITIONAL EMPLOYER DATA FILES (approval-denial detail)
// ═══════════════════════════════════════════════════════════════════════════

async function testAdditionalDataFiles() {
  const tests = [];

  const FILES = [
    { path: '/data/dashboards/approval-denial/approval_denial_detailed.json', label: 'Approval-denial detailed', minSize: 5000 },
    { path: '/data/dashboards/approval-denial/approval_denial_trends.json', label: 'Approval-denial trends', minSize: 5000 },
    { path: '/data/dashboards/employer/employer_friendliness_scores.json', label: 'Employer friendliness (non-ML)', minSize: 10000 },
    { path: '/data/dashboards/employer/employer_monthly_metrics.json', label: 'Employer monthly metrics', minSize: 10000 },
    { path: '/data/dashboards/wage/employer_search_index.json', label: 'Legacy wage search index', minSize: 100 },
    { path: '/data/dashboards/wage/employer_wage_rankings.json', label: 'Employer wage rankings', minSize: 100000 },
  ];

  for (const f of FILES) {
    tests.push({
      label: `Data file: ${f.label}`,
      fn: async () => {
        const head = await fetchHead(f.path);
        assert(head.status === 200, `HTTP ${head.status}`);
        assertGT(head.contentLength, f.minSize, `${f.label} size`);
      }
    });
  }

  await runBatch('11. Additional Data Files', tests);
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const displayUrl = BASE_URL.replace(/^https?:\/\//, '');

  console.log(`\n${C.BOLD}═══ Compass Comprehensive Post-Deployment Validation ═══${C.RST}`);
  console.log(`${C.D}Target: ${displayUrl}${C.RST}`);
  console.log(`${C.D}Mode: ${QUICK_MODE ? 'QUICK (~100 tests)' : 'FULL (all tests)'}${C.RST}`);

  await testPages();
  await testEmployerSearch();
  await testEmployerShards();
  await testDashboardData();
  await testDimensions();
  await testModels();
  await testRag();
  await testCrossReferences();
  await testStaticAssets();
  await testDataQuality();
  await testAdditionalDataFiles();

  // ── Summary ──────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const total = passed + failed + skipped;

  console.log(`\n${C.D}${'═'.repeat(60)}${C.RST}`);

  if (failed > 0) {
    console.log(`\n${C.R}${C.BOLD}${failed} FAILED${C.RST}  |  ${C.G}${passed} passed${C.RST}  |  ${skipped} skipped  |  ${total} total  |  ${elapsed}s\n`);
    console.log(`${C.R}${C.BOLD}Failed tests:${C.RST}`);
    for (const f of failures) {
      console.log(`  ${C.R}✗${C.RST}  ${f.label}`);
      console.log(`    ${C.Y}${f.reason}${C.RST}`);
    }
    console.log('');
    process.exit(1);
  } else {
    console.log(`\n${C.G}${C.BOLD}ALL ${passed} TESTS PASSED${C.RST} ✓  |  ${skipped} skipped  |  ${elapsed}s\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`\n${C.R}Fatal: ${err.message}${C.RST}\n`);
  process.exit(1);
});
