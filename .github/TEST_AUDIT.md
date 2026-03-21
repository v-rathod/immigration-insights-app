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

## Test Status (Updated 2026-03-21)

| Metric | Count | Status |
|--------|-------|--------|
| **Total Tests** | 1,068 (1,036 passing, 32 skipped) | ✅ All passing |
| **Test Files** | 37 | ✅ +1 navigation-flows.test.tsx |
| **E2E Tests** | ~55 (3 files) + visual regression | ✅ Mobile-first + visual |
| **Visual Tests** | 93 (1 file, 90 PNG baselines) | ✅ Expanded from 22 last session |
| **Unit Tests** | ~640 | ✅ Components + utilities |
| **Integration / Navigation Flow Tests** | ~330+ | ✅ Data loaders + cross-page flows |
| **TypeScript Coverage** | Strict mode | ✅ No `any` types |
| **ESLint Compliance** | 0 errors | ✅ Clean |
| **Coverage Target** | 80%+ | ✅ Codepaths verified |

---

## ⚠️ Test Gap History — Root Causes & Lessons

### Root Cause: Component Mocking Hides Real Bugs

**Found 2026-03-21**: Employer URL pre-load was broken for weeks.
`landing-page.test.tsx` mocked `WelcomeBackBanner` and `FeaturedEmployers` as static `<div>` stubs.
This made the page render tests pass, but hid all bugs inside those real components.

**Lesson**: Page-level tests that mock child components only verify page structure, not functionality.

**Rule added**: Critical user-facing home components must have their own dedicated real test (not just a mock stub at page level). See `navigation-flows.test.tsx`.

### What Failed in Production
1. `WelcomeBackBanner` — SSR hydration mismatch (localStorage in `useState` initializer) caused PostHog "1 Issue" debug alert
2. `FeaturedEmployers` / `EmployerQuickCheck` — "Full Report" link generated correct URL but employer dashboard didn't read `?q=` param on load → no pre-selection

### Gaps Fixed This Session
- ✅ `WelcomeBackBanner` — 6 real component tests covering show/hide behavior, profile summary, link target
- ✅ `FeaturedEmployers` — 5 tests covering URL format, loading state, empty state, tile content
- ✅ Navigation URL contracts — 3 tests verifying publisher/consumer agreement for `?q=`, `?category=`, `?country=` params
- ✅ `EmployerSearch initialValue` — 2 tests for pre-populated search box from URL
- ✅ Employer dashboard auto-selection from `?q=` URL param (added `useSearchParams` + `useEffect`)

---

## Known Remaining Gaps (Prioritized)

### P0 — Critical (user-visible, must be added before next feature work)

| Flow | Gap | Recommended Test |
|------|-----|-----------------|
| Employer dashboard `?q=` → auto-selects AND loads shard | The `useEffect` that calls `handleSelect()` has no unit test | Add test in `srs-comprehensive.test.tsx` mocking `useSearchParams` |
| `/ops` page rendering | No tests at all | Add `ops-page.test.tsx` |

### P1 — Important (add within next sprint)

| Flow | Gap | Recommended Test |
|------|-----|-----------------|
| Insights form saves to localStorage | Tested in `insights-page.test.tsx` but saving/loading not fully verified | Expand insights tests |
| Mobile hamburger → page navigation | Sidebar tests cover toggle, not actual nav click | Add to `sidebar.test.tsx` |
| Theme persists across hard-reload (localStorage key) | `theme-provider.test.tsx` tests state, not persistence key | Add persistence test |

### P2 — Nice to Have

| Flow | Gap | Note |
|------|-----|------|
| Geographic dashboard tooltip position | Portal fix has no unit test (only visual regression) | Hard to unit test; visual baseline covers it |
| Visa bulletin → URL params preserved on initial load | `?category=&country=` read on mount? | Visual test covers this |
| `new-dashboards.test.tsx` depth | Tests only verify page header renders | Very shallow — needs interaction testing |

---

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

# Visual regression tests
npm run test:visual                # Compare against baselines
npm run test:visual:update         # Update baselines after intentional UI changes
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
| `sidebar.test.tsx` | 14 | Nav items, active state, V2 groups, mobile 44px touch, Explore collapse |
| `srs-components.test.tsx` | 21 | Search, gauge, detail, chart |
| `srs-comprehensive.test.tsx` | 97 | Complete SRS feature suite |
| `pdi-components.test.tsx` | 19 | PdiQuickLook, SrsTeaser |

### Page Tests (6 files, ~150 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `landing-page.test.tsx` | 16 | V2 hero, stats, dashboard grid, quick-check mocks |
| `visa-bulletin.test.tsx` | 33 | PriorityDateChart, VisaBulletinPage |
| `insights-page.test.tsx` | 38 | Profile card (3-tier form), panels, persistence, SOC matching |
| `site-pages.test.tsx` | 42 | Footer, Contact, Feedback, About, Privacy, Terms |
| `ask-page.test.tsx` | 19 | RAG search, results, AI answer |
| `wage-dashboard.test.tsx` | 52 | Hub orchestration, profiles, loaders |

### V2 Home Widget Tests (2 files, ~31 tests)

| File | Tests | Coverage | Notes |
|------|-------|----------|-------|
| `visa-bulletin-pulse.test.tsx` | 13 | Live bulletin table, skeleton, velocity, color coding | |
| `quick-check-widgets.test.tsx` | 14 | Employer fuzzy search, PD quick check, inline previews, URL param generation | +1 URL param test 2026-03-21 |

### Navigation Flow Tests (1 file, 17 tests) — NEW 2026-03-21

| File | Tests | Coverage | Notes |
|------|-------|----------|-------|
| `navigation-flows.test.tsx` | 17 | WelcomeBackBanner (6), FeaturedEmployers (5), URL contracts (3), EmployerSearch initialValue (2) | Added after employer pre-load bug found |

**Why this file exists**: Mocking child components at page level (as done in `landing-page.test.tsx`) hides bugs in those components. These tests cover the REAL component logic — `WelcomeBackBanner` localStorage/hydration behavior, `FeaturedEmployers` URL generation, cross-page URL parameter contracts.

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

## E2E Tests (Playwright, 3 files + visual regression)

| File | Tests | Scope |
|------|-------|-------|
| `pd-cortex-mobile.spec.ts` | 44 | `/dashboard/visa-bulletin` on iPhone 14 |
| `home-mobile.spec.ts` | ~34 | `/` landing page on iPhone 14 (V2 updated) |
| `dropdown-alignment.spec.ts` | ~5 | Dropdown positioning tests |

### Visual Regression Tests (Playwright, 1 file)

| File | Tests | Scope |
|------|-------|-------|
| `visual.spec.ts` | 22 | Full-page screenshots for all 13 pages (Desktop + Mobile), component-level hero/stats/grid, interaction states, theme toggle |

**Config**: `playwright.visual.config.ts` — dedicated config with `maxDiffPixelRatio: 0.01`, animations disabled

**Commands:**
```bash
npm run test:visual              # Compare against baselines
npm run test:visual:update       # Update baseline screenshots
```

**Baselines**: Stored in `e2e/visual.spec.ts-snapshots/` — first run creates them, subsequent runs compare

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
