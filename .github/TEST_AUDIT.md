# Test Audit & Strategy

**Read this file when:** Understanding test coverage, debugging test failures, or adding new tests.
**Auto-updated by:** `npm test` script (test counts refreshed on every test run).
**Referenced in:** copilot-instructions.md → "Refer to TEST_AUDIT.md"

---

## 🔄 How to Maintain This File

**When to update:**
- ✅ After every `npm test` run (test counts change)
- ✅ When a new test file is created (add to inventory)
- ✅ When a new test pattern is discovered (document it)

**How to update:**
```bash
# Run tests and capture output
npm test 2>&1 | grep -E 'passing|failing'

# Update the test counts in the table above (line 8–15)
# If new test file created, add entry to "Test File Inventory" section below
```

**Who should do it:** Developer adding tests or running test suite (don't batch updates; do it immediately).

**Frequency:** After every test run (not in copilot-instructions.md — this file gets updated instead).

---

## Test Status (Updated 2026-03-20 14:35)

| Metric | Count | Status |
|--------|-------|--------|
| **Total Tests** | 986 | ✅ All passing |
| **Test Files** | 32 | ✅ Comprehensive coverage |
| **E2E Tests** | 85 (2 files) | ✅ Mobile-first |
| **Unit Tests** | ~600 | ✅ Components + utilities |
| **Integration Tests** | ~300+ | ✅ Data loaders + features |
| **TypeScript Coverage** | Strict mode | ✅ No `any` types |
| **ESLint Compliance** | 0 errors | ✅ Clean |
| **Coverage Target** | 80%+ | ✅ Codepaths verified |

---

## Testing Strategy

### Framework Stack
- **Framework**: Vitest 4.x + React Testing Library + happy-dom
- **E2E**: Playwright (mobile + desktop)
- **Config**: `vitest.config.mts` (ESM required for Vite 7+)

### Test Organization
- **Location**: `src/__tests__/` — colocated by feature
- **Naming**: `[feature].test.ts` or `[component].test.tsx`
- **Setup**: `src/__tests__/setup.ts` — global mocks for matchMedia, IntersectionObserver, localStorage

### Test Execution

```bash
# Full test suite (single run)
npm test

# Watch mode (dev)
npm run test:watch

# Coverage report
npm run test:coverage

# Specific test file
npm test -- srs-components

# E2E tests (Playwright)
npx playwright test
npx playwright test [name]-mobile  # Mobile tests only
```

---

## Test File Inventory

### Unit Tests (24 files, ~600 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `cn.test.ts` | 6 | Tailwind class merger utility |
| `format.test.ts` | 33 | Number/date/currency formatters |
| `security.test.ts` | 48 | XSS, validation, localStorage, URL safety |
| `security-headers.test.ts` | 11 | CSP and security headers |
| `loader.test.ts` | 12 | Data loaders with mocked fetch |
| `srs-data.test.ts` | 18 | SRS helpers, efs→srs remapping |
| `pdi-data.test.ts` | 28 + 8 | PDI constants, forecast series, MCRA |
| `smart-sort.test.ts` | 27 | Sort functions, ranking logic |
| `employer-normalization.test.ts` | 23 | Employer name canonicalization |
| `optum-regression.test.ts` | 18 | Optum Services LCA data integrity |
| `visa-bulletin-regression.test.ts` | 62 | Live-data VB/PD artifact consistency |

### Component Tests (8 files, ~200 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `theme-provider.test.tsx` | 6 | Theme state, toggle, persistence |
| `theme-toggle.test.tsx` | 4 | Accessibility, aria |
| `glass-card.test.tsx` | 6 | Variants, glow effects |
| `sidebar.test.tsx` | 8 | Nav items, active state, mobile |
| `srs-components.test.tsx` | 21 | Search, gauge, detail, chart |
| `srs-comprehensive.test.tsx` | 97 | Complete SRS feature suite |
| `pdi-components.test.tsx` | 19 | PdiQuickLook, SrsTeaser |

### Page Tests (6 files, ~150 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `landing-page.test.tsx` | 10 | Hero, stats, dashboard grid |
| `visa-bulletin.test.tsx` | 33 | PriorityDateChart, VisaBulletinPage |
| `insights-page.test.tsx` | 27 | Profile card, panels, persistence |
| `site-pages.test.tsx` | 42 | Footer, Contact, Feedback, About, Privacy, Terms |
| `ask-page.test.tsx` | 19 | RAG search, results, AI answer |
| `wage-dashboard.test.tsx` | 52 | Hub orchestration, profiles, loaders |

### Dashboard Tests (3 files, ~100 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `dashboard-data-loaders.test.ts` | 47 | EB, Geo, SOC, Processing, Backlog loaders |
| `new-dashboards.test.tsx` | 41 | All 5 dashboard pages |
| `browser-smoke-test.test.ts` | 8 | Live server connectivity |

### Other Tests (4 files, ~50 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `rag-search.test.ts` | 25 | RAG engine, LLM service |
| `tech-stack-chip.test.tsx` | 7 | UI toolkit component |
| `real-data-integration.test.ts` | — | Live P2 data validation (pending) |
| `predeploy-checks.test.ts` | — | Pre-deploy validations (pending) |

---

## E2E Tests (Playwright, 2 files, 85 tests)

| File | Tests | Scope |
|------|-------|-------|
| `pd-cortex-mobile.spec.ts` | 44 | `/dashboard/visa-bulletin` on iPhone 14 |
| `home-mobile.spec.ts` | 41 | `/` landing page on iPhone 14 |

---

## Coverage Patterns

### Live-Data Tests (MANDATORY Pattern)
Tests that load from `public/data/` (gitignored, absent in CI) MUST use the `DATA_AVAILABLE` guard pattern:

```typescript
const DATA_AVAILABLE = existsSync(dataPath);
if (!DATA_AVAILABLE) console.warn("[test] public/data/ not found — tests will be SKIPPED");
describe.skipIf(!DATA_AVAILABLE)("suite name", () => { ... });
```

**Why:** Prevents CI crashes before Vitest can skip. Never call `readFileSync` at module top level on gitignored paths.

### Component Test Mocks
- **Framer Motion**: Mocked to skip animations (see `setup.ts`)
- **Next Navigation**: Mocked for routing tests
- **localStorage**: Cleared between tests via `beforeEach`

### Fixtures & Helpers
- `src/__tests__/setup.ts` — Global test environment
- Match media mock for responsive tests
- IntersectionObserver mock for viewport tests

---

## Quick Testing Checklist

✅ **Before committing:**
1. Run `npm test` — all tests passing
2. Run `npm run lint` — 0 ESLint errors
3. TypeScript strict mode clean (no warnings)
4. If page UI changed: run `npx playwright test [page]-mobile`

✅ **Before deploying:**
1. Run full test suite locally
2. Run E2E tests for changed pages
3. Check coverage report (`npm run test:coverage`)

---

## Notes for Future Updates

- Test counts update daily as new tests are added
- This file replaces manual updates to copilot-instructions.md
- E2E specs should be added for every new page (copy `home-mobile.spec.ts` template)
- Live-data regression tests pinpoint data stale dates and artifact staleness
