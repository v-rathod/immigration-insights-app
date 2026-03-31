/**
 * Compare new search index against baseline to verify activity changes.
 * Run: node scripts/_compare_search_baseline.mjs
 */
import { readFileSync } from 'fs';

const baseline = JSON.parse(readFileSync('/tmp/search_baseline.json', 'utf-8'));
const raw = readFileSync('public/data/employers/_search.json', 'utf-8')
  .replace(/\bNaN\b|-?\bInfinity\b/g, 'null');
const data = JSON.parse(raw);

console.log('=== COMPARISON: Baseline vs New Search Index ===\n');

// 1. Count check
console.log(`Total entries: ${baseline.counts.total} → ${data.length} (${data.length === baseline.counts.total ? 'SAME ✓' : 'CHANGED ✗'})`);
const rated = data.filter(e => e.ss != null).length;
console.log(`Rated: ${baseline.counts.rated} → ${rated}`);
console.log(`Unrated: ${baseline.counts.unrated} → ${data.length - rated}`);

// 2. New "ac" field distribution
const acDist = {};
for (const e of data) {
  const ac = e.ac || 'missing';
  acDist[ac] = (acDist[ac] || 0) + 1;
}
console.log('\nActivity status distribution (NEW field):');
for (const [k, v] of Object.entries(acDist).sort()) {
  const label = k === 'a' ? 'active' : k === 'l' ? 'legacy' : k === 'h' ? 'historical' : k;
  console.log(`  ${label.padEnd(15)} ${v.toLocaleString()}`);
}

// 3. Verify key employers have correct activity status
const testCases = [
  { name: 'Capgemini America', expect: 'a' },
  { name: 'Capgemini Financial Services Usa', expect: 'h' },
  { name: 'Google', expect: 'a' },
  { name: 'Syntel', expect: 'l' },
  { name: 'Satyam Computer Services', expect: 'h' },
  { name: 'Yahoo!', expect: 'h' },
  { name: 'Microsoft', expect: 'a' },
  { name: 'Infosys', expect: 'a' },
  { name: 'Infosys Technologies', expect: 'h' },
  { name: 'Amazon Com Services', expect: 'a' },
];
console.log('\nSpot-check activity status:');
let allPass = true;
for (const tc of testCases) {
  const match = data.find(e => (e.n || '') === tc.name);
  if (!match) {
    console.log(`  ✗ ${tc.name} — NOT FOUND`);
    allPass = false;
    continue;
  }
  const ok = match.ac === tc.expect;
  const label = match.ac === 'a' ? 'active' : match.ac === 'l' ? 'legacy' : 'historical';
  console.log(`  ${ok ? '✓' : '✗'} ${tc.name.padEnd(45)} ac=${match.ac} (${label}) ${ok ? '' : `EXPECTED ${tc.expect}`}`);
  if (!ok) allPass = false;
}

// 4. Verify existing fields are UNCHANGED (no regression)
const queries = ['capgemini', 'google', 'syntel', 'infosys', 'amazon'];
console.log('\nRegression check — existing fields unchanged:');
for (const q of queries) {
  const baseResults = baseline.queryResults[q] || [];
  for (const br of baseResults) {
    const match = data.find(e => e.n === br.name);
    if (!match) {
      console.log(`  ✗ ${br.name} — MISSING from new index`);
      allPass = false;
      continue;
    }
    const fMatch = (match.f || 0) === br.filings;
    const yMatch = (match.y || 0) === br.year;
    const sMatch = match.ss === br.srs;
    if (!fMatch || !yMatch || !sMatch) {
      console.log(`  ✗ ${br.name}: filings ${br.filings}→${match.f}, year ${br.year}→${match.y}, srs ${br.srs}→${match.ss}`);
      allPass = false;
    }
  }
}
if (allPass) {
  console.log('  All fields match baseline ✓');
}

// 5. Size check
const sizeKB = readFileSync('public/data/employers/_search.json').length / 1024;
const baselineSizeKB = baseline.counts.total * 150 / 1024; // approx
console.log(`\nFile size: ${sizeKB.toFixed(0)} KB (was ~${(15117832/1024).toFixed(0)} KB)`);
console.log(`Size increase from ac field: ~${((sizeKB - 14762) / 14762 * 100).toFixed(1)}%`);

console.log(`\n${allPass ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
