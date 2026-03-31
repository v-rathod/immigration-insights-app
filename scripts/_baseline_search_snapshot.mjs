/**
 * Baseline snapshot of search index state BEFORE employer activity changes.
 * Run: node scripts/_baseline_search_snapshot.mjs
 * Output: /tmp/search_baseline.json
 *
 * Captures:
 *   - Total entry count
 *   - Top 12 results for key test queries (same as Fuse.js MAX_RESULTS)
 *   - Distribution of entries by year bucket
 *   - SRS-rated vs unrated counts
 */
import { readFileSync, writeFileSync } from 'fs';

const raw = readFileSync('public/data/employers/_search.json', 'utf-8')
  .replace(/\bNaN\b|-?\bInfinity\b/g, 'null');
const data = JSON.parse(raw);

// --- Counts ---
const total = data.length;
const rated = data.filter(e => e.ss != null).length;
const unrated = total - rated;

// --- Year distribution ---
const yearBuckets = { active_2023plus: 0, legacy_2018_2022: 0, historical_pre2018: 0, no_year: 0 };
for (const e of data) {
  const y = e.y || 0;
  if (y >= 2023) yearBuckets.active_2023plus++;
  else if (y >= 2018) yearBuckets.legacy_2018_2022++;
  else if (y > 0) yearBuckets.historical_pre2018++;
  else yearBuckets.no_year++;
}

// --- Key search queries: simple substring match sorted by filing count ---
// This mimics what Fuse.js + smart-sort produces (approx)
function searchTop12(query) {
  const q = query.toLowerCase();
  const matches = data
    .filter(e => (e.n || '').toLowerCase().includes(q))
    .sort((a, b) => {
      // Prefer prefix matches, then by filing count (rough approximation of smart-sort)
      const aPrefix = (a.n || '').toLowerCase().startsWith(q) ? 1 : 0;
      const bPrefix = (b.n || '').toLowerCase().startsWith(q) ? 1 : 0;
      if (bPrefix !== aPrefix) return bPrefix - aPrefix;
      // Then prefer rated
      const aRated = a.ss != null ? 1 : 0;
      const bRated = b.ss != null ? 1 : 0;
      if (bRated !== aRated) return bRated - aRated;
      return (b.f || 0) - (a.f || 0);
    })
    .slice(0, 12);
  return matches.map(e => ({
    name: e.n,
    filings: e.f || 0,
    year: e.y || 0,
    srs: e.ss,
    tier: e.st || 'Unrated'
  }));
}

const testQueries = ['capgemini', 'google', 'syntel', 'infosys', 'amazon', 'mckinsey', 'yahoo', 'satyam'];
const queryResults = {};
for (const q of testQueries) {
  queryResults[q] = searchTop12(q);
}

const baseline = {
  capturedAt: new Date().toISOString(),
  counts: { total, rated, unrated },
  yearBuckets,
  queryResults,
};

writeFileSync('/tmp/search_baseline.json', JSON.stringify(baseline, null, 2));
console.log('Baseline captured to /tmp/search_baseline.json');
console.log(`  Total: ${total}, Rated: ${rated}, Unrated: ${unrated}`);
console.log(`  Year buckets: ${JSON.stringify(yearBuckets)}`);
console.log(`  Queries captured: ${testQueries.join(', ')}`);
for (const q of testQueries) {
  const results = queryResults[q];
  console.log(`\n  "${q}" → ${results.length} results:`);
  for (const r of results.slice(0, 5)) {
    console.log(`    ${r.name.padEnd(55)} f=${String(r.filings).padEnd(8)} y=${r.year}  srs=${r.srs}`);
  }
  if (results.length > 5) console.log(`    ... and ${results.length - 5} more`);
}
