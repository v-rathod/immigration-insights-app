# Compass V2 Redesign — Master Strategy & Execution Plan

**Created**: 2026-03-20 16:30 UTC
**Status**: ✅ COMPLETED
**Codename**: Compass V2 — "Data-First"
**Inspiration**: levels.fyi (data visible immediately, tool IS the marketing)

---

## 🔄 Agent Handoff Protocol

**CRITICAL: Read this section first if you are a new agent picking up work.**

This is a multi-session redesign tracked across agent switches (Sonnet/Opus/Haiku).
Before making ANY changes, check:

1. **Current phase status** → See "Phase Execution Tracker" section below
2. **What's been completed** → Each phase has ✅/🟡/⬜ status markers
3. **What's currently in progress** → Look for 🟡 markers
4. **Test status** → Run `npm test 2>&1 | tail -5` before and after changes
5. **Build status** → Run `npx next build 2>&1 | tail -10` after major changes

**After completing ANY work:**
1. Update the phase status in this file (mark ✅ what you finished)
2. Update PROGRESS.md with timestamped milestone
3. Run `npm test` and record result
4. Commit your changes with descriptive message

**File change tracking**: Each phase lists exact files to create/modify/delete.

---

## Core Philosophy

### What We Are
A **consumer data reference tool** (like levels.fyi, Google Finance, Zillow).
Users arrive from Google with a specific question. We answer it immediately.

### What We Are NOT
- NOT a B2B SaaS platform (no "Get Started", no feature catalogs, no value props)
- NOT a portal requiring account creation or profile setup as entry gate
- NOT a tool that needs you to "learn the navigation" before getting value

### The levels.fyi Principle
> The data IS the product. Users should consume useful information from the moment
> they land, without typing anything, clicking anything, or reading any pitch copy.
> Input is optional and reveals more depth — never required for first-level value.

### Four User Journeys (Design For These)
1. **"When will my green card come?"** — Googled "EB2 India priority date forecast"
2. **"Is this employer safe for H1B?"** — Googled "Cognizant H1B approval rate"
3. **"Am I being paid fairly?"** — Googled "H1B software engineer salary"
4. **Returning user** — Types URL or bookmark, wants their data immediately

---

## Current State (Before Redesign)

### Landing Page (page.tsx) — THE PROBLEM
```
Section 1: Hero pitch ("Navigate Your Immigration Journey with Confidence")
Section 2: 4 stat cards (18.5M, 243K, 249, 56) — credibility, no data
Section 3: 3 "Start Here" feature cards — links to dashboards, no interaction
Section 4: 8 dashboard cards — product catalog grid
Section 5: "Built Different" value props (Real-Time, Privacy, AI-Powered)
```
**Problem**: 5 sections of DESCRIPTION before any useful DATA. Pure SaaS pitch.

### Navigation Sidebar (sidebar.tsx) — NEEDS REORDER
```
Home (Main)
Priority Date Cortex (Analytics)
Sponsor Score (Analytics)
Wage Intelligence (Analytics)
My Insights (Personal)        ← BURIED at position 5
EB Categories (Dashboards)
Geographic (Dashboards)
Occupation Demand (Dashboards)
Processing (Dashboards)
Approvals (Dashboards)
About (App)
```

---

## Target State (After Redesign)

### Landing Page — DATA-FIRST
```
Zone 1 (Hero): Left=headline+CTA | Right=LIVE Visa Bulletin table (real data!)
Zone 2 (Intent): 3 interactive mini-widgets (PD check, Employer check, Salary check)
Zone 3 (Showcase): Today's Bulletin full table + Featured Employers spotlight
Zone 4 (Explore): Compact 8-dashboard grid (for browsers, not primary)
— DELETED: "Built Different" value props section
— DELETED: Static "Start Here" feature cards (replaced by interactive ones)
```

### Navigation Sidebar — REORDERED
```
My Insights (ungrouped, FIRST, pinned)
Priority Date Cortex (Core Tools)
Sponsor Score (Core Tools)
Wage Intelligence (Core Tools)
EB Categories (Explore)
Geographic (Explore)
Occupation Demand (Explore)
Processing (Explore)
Approvals (Explore)
About (App)
— DELETED: "Home" as nav item (clicking Compass logo navigates home)
```

---

## Phase Execution Tracker

### Phase 1: Copy & Navigation Restructure ✅
**Risk**: Zero | **Effort**: Small | **Files**: 2 modified, 2 test files updated
**Status**: ✅ Completed

Changes:
- [x] `src/app/page.tsx`:
  - Replace hero headline: "Navigate Your Immigration Journey with Confidence" → new data-first copy
  - Replace "Get Started" CTA text → "Check My Situation"
  - Delete "Built Different" value props section entirely (VALUE_PROPS const + JSX)
  - Delete QUICK_ACCESS static link cards (replaced by interactive widgets in Phase 3)
  - Rename "8 Interactive Dashboards" → "Explore the Full Dataset"
  - Keep stat bar, moved below hero
- [x] `src/components/layout/sidebar.tsx`:
  - Reorder NAV_ITEMS: My Insights first (ungrouped), then Core Tools, Explore, App
  - Remove "Home" nav item (Compass logo already navigates home)
  - Rename group "Analytics" → "Core Tools"
  - Rename group "Dashboards" → "Explore"
  - Remove group "Personal" (My Insights moves to top, ungrouped)
- [x] `src/__tests__/landing-page.test.tsx`: Updated for new copy, removed value prop tests
- [x] `src/__tests__/sidebar.test.tsx`: Updated for new nav order/groups

**Test command**: `npm test -- landing-page sidebar`

### Phase 2: Live Visa Bulletin Pulse Widget ✅
**Risk**: Low | **Effort**: Medium | **Files**: 1 new component, 1 modified, 1 new test
**Status**: ✅ Completed

Changes:
- [x] Create `src/components/home/visa-bulletin-pulse.tsx`:
  - Loads `fact_cutoff_trends.json` via existing `loadCutoffTrends()` or direct fetch
  - Extracts latest bulletin month for key series: EB1/2/3 × IND/CHN/ROW
  - Renders compact table: category, country, cutoff date, momentum arrow + velocity
  - Color coding: green (advancing >60 days/mo), amber (0-60), red (retrogression)
  - "Live" green pip indicator + bulletin month/year label
  - Skeleton loading state
- [x] Modify `src/app/page.tsx`:
  - Restructure hero to split layout: left=copy, right=VisaBulletinPulse
  - Import and render the new component
- [x] Create `src/__tests__/visa-bulletin-pulse.test.tsx`: Unit tests for the component (13 tests)

**Test command**: `npm test -- visa-bulletin-pulse landing-page`

### Phase 3: Intent Interceptor Widgets ✅
**Risk**: Medium | **Effort**: Large | **Files**: 2 new components, 1 modified, 1 new test
**Status**: ✅ Completed (employer-quick-check + pd-quick-check; salary-quick-check deferred)

Changes:
- [x] Create `src/components/home/employer-quick-check.tsx`:
  - Fuse.js fuzzy search over 102K employers
  - Shows inline SRS score preview card when employer selected
  - "See full SRS breakdown →" links to /dashboard/employer
- [x] Create `src/components/home/pd-quick-check.tsx`:
  - Toggle buttons for category (EB1/EB2/EB3) and country (IND/CHN/ROW)
  - Shows current cutoff date + velocity for selection
  - "See full forecast →" links to /dashboard/visa-bulletin
- [ ] ~~Create `src/components/home/salary-quick-check.tsx`~~ — DEFERRED
- [x] Modify `src/app/page.tsx`: Replace old QUICK_ACCESS section with interactive cards
- [x] Create `src/__tests__/quick-check-widgets.test.tsx`: Tests for employer + PD widgets (13 tests)

**Key design decision**: All 3 widgets route to their respective dashboards (NOT /insights).
User explicitly said: NOT driving toward profile creation.

**Test command**: `npm test -- intent-interceptors landing-page`

### Phase 4: Data Showcase Sections ✅
**Risk**: Low | **Effort**: Medium | **Files**: 1 new component, 1 modified
**Status**: ✅ Completed (featured-employers; bulletin-table deferred as VisaBulletinPulse covers it)

Changes:
- [ ] ~~Create `src/components/home/bulletin-table.tsx`~~ — DEFERRED (VisaBulletinPulse covers this)
- [x] Create `src/components/home/featured-employers.tsx`:
  - Top 6 employer spotlight cards from live data
  - Shows: employer name, SRS score, tier badge, filing count
  - "See all 102K+ employers →" link
- [x] Modify `src/app/page.tsx`: Added featured-employers between interceptors and dashboard grid

**Test command**: `npm test -- landing-page`

### Phase 5: Returning User Banner ✅
**Risk**: Low | **Effort**: Small | **Files**: 1 new component, 1 modified
**Status**: ✅ Completed

Changes:
- [x] Create `src/components/home/welcome-back-banner.tsx`:
  - Checks localStorage via `secureGet()` for existing profile
  - If exists: renders compact banner with category, country, current cutoff
  - "Go to My Insights →" link
  - Session-dismissible
- [x] Modify `src/app/page.tsx`: Renders at top of page if profile exists

**Test command**: `npm test -- landing-page`

### Phase 6: My Insights Progressive Form ✅
**Risk**: Medium | **Effort**: Medium | **Files**: 1 modified (insights page.tsx)
**Status**: ✅ Completed

Changes:
- [x] Restructure profile form in `src/app/insights/page.tsx`:
  - Tier 1 (immediate, shown on load): Priority Date + Category + Country → Green Card panel
  - Tier 2 (expandable): Employer name → SRS panel
  - Tier 3 (expandable, reveals when employer set): Salary + Job Title + YoE → Salary panel
  - Progressive animation: Tier 3 animates in when employer is selected
  - TierLabel sub-component shows step number and which panel it unlocks
  - All fields still accessible, just visually grouped
- [x] Update `src/__tests__/insights-page.test.tsx` (38 tests, all pass)

**Test command**: `npm test -- insights-page`

### Phase 7: Mobile Navigation Enhancement ✅
**Risk**: Medium | **Effort**: Medium | **Files**: 1 modified
**Status**: ✅ Completed

Changes:
- [x] Modify `src/components/layout/sidebar.tsx`:
  - Mobile overlay: full-screen glassmorphic with backdrop-blur-xl (not partial sidebar slide)
  - My Insights as prominent card-style CTA with gradient icon and subtext
  - 44px minimum touch targets (min-h-[44px]) on all mobile nav items + close button
  - Separate mobileNavContent with mobile-optimized layout
  - Collapsible "Explore" group (default collapsed, expandable with ChevronDown)
  - Close button with aria-label and proper touch target sizing
- [x] Update `src/__tests__/sidebar.test.tsx` (14 tests, 5 new Phase 7 tests)

**Test command**: `npm test -- sidebar`

### Phase 8: Test Suite Overhaul ✅
**Risk**: Low | **Effort**: Medium | **Files**: Multiple test files
**Status**: ✅ Completed

Changes:
- [x] Audit all test files for references to deleted V1 content (none found)
- [x] Fixed em-dash test expectations (format.test.ts + srs-comprehensive.test.tsx)
- [x] Added 6 new tests: 1 tier-reveal test (insights), 5 mobile nav tests (sidebar)
- [x] Full test suite: 1024 tests (995 passed + 29 skipped) across 34 files
- [x] TypeScript strict: 0 errors | ESLint: 0 errors (1 pre-existing warning)
- [x] AI marker scan: clean | Em-dash audit: clean (40 fixed across 13 files)

**Test command**: `npm test`

---

## Files Inventory (What Changes Where)

### New Files to Create
```
src/components/home/visa-bulletin-pulse.tsx     ← Phase 2
src/components/home/employer-quick-check.tsx    ← Phase 3
src/components/home/pd-quick-check.tsx          ← Phase 3
src/components/home/salary-quick-check.tsx      ← Phase 3
src/components/home/bulletin-table.tsx          ← Phase 4
src/components/home/featured-employers.tsx      ← Phase 4
src/components/home/welcome-back-card.tsx       ← Phase 5
src/__tests__/visa-bulletin-pulse.test.tsx      ← Phase 2
src/__tests__/intent-interceptors.test.tsx      ← Phase 3
```

### Files to Modify
```
src/app/page.tsx                               ← Phases 1,2,3,4,5 (major rewrite)
src/components/layout/sidebar.tsx              ← Phase 1,7
src/app/insights/page.tsx                       ← Phase 6
src/__tests__/landing-page.test.tsx            ← Phase 1,2,3,4 (major rewrite)
src/__tests__/sidebar.test.tsx                 ← Phase 1,7
src/__tests__/insights-page.test.tsx           ← Phase 6
```

### Files NOT Changed (explicitly preserved)
```
All dashboard pages (visa-bulletin, employer, wage, etc.)
All dashboard components (pdi/, srs/, wage/, approvals/)
All data loaders (src/lib/data/*)
All types (src/types/*)
All security/utils (src/lib/security/*, src/lib/utils/*)
Design tokens (globals.css)
Layout shell (app-shell.tsx)
Footer component
```

---

## P2 Artifact Assessment

**Current data is sufficient for all phases.** No P2 changes needed because:
- `fact_cutoff_trends.json` has April 2026 data for all EB×country series ✅
- `pd_forecasts.json` has 24-month forecasts for 56 series ✅
- `_search.json` has 102K employers with SRS scores, tiers, median salaries ✅
- `salary_benchmarks_national.json` (if exists) or can compute from existing wage data ✅
- All data loaders already exist and are tested ✅

**If needed later**: We may want a lightweight "homepage summary" JSON pre-computed
from P2 for faster loading, but this is an optimization, not a requirement.

---

## Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Employer quick-check destination | `/dashboard/employer` | User said: NOT driving toward profile creation. Each tool serves independently. |
| PD quick-check destination | `/dashboard/visa-bulletin` | Same: stateless, serve the intent. |
| Salary check destination | `/dashboard/wage` | Same pattern. |
| Homepage data loading | Client-side fetch on mount | Static export constraint. Data is small enough. |
| "Home" nav item | REMOVE | Compass logo already navigates home. Saves a nav slot. |
| Value props section | DELETE | "Built Different" is pure SaaS marketing. Doesn't serve the user. |
| Stat bar | KEEP, below hero | Credibility signal, but earned after showing data first. |
| Dashboard grid | KEEP, compact, bottom | For explorers, not primary content. |
| Mobile nav | Full-screen overlay | Better touch targets, room for hierarchy |
| Profile creation | NOT a goal | User explicit: we're a tool, not an enterprise platform |

---

## Test Baseline

**Before redesign (recorded 2026-03-20 16:40 UTC):**
```
Total tests: 986
Passing: 986
Files: 32
Duration: 7.97s
```
**After each phase, record test status here.**

**After Phase 1-5 (2026-03-21):**
```
Total tests: 1018
Passing: 1018
Files: 34
Duration: 7.78s
```

---

## Quick Reference: Files to Read Before Each Phase

| Phase | Read These First |
|-------|------------------|
| 1 | `src/app/page.tsx`, `src/components/layout/sidebar.tsx`, both test files |
| 2 | `src/lib/data/pdi.ts` (loadCutoffTrends), `src/lib/data/loader.ts` |
| 3 | `src/components/srs/employer-search.tsx`, `src/lib/data/pdi.ts`, `src/lib/data/wage.ts` |
| 4 | `src/lib/data/pdi.ts`, `src/lib/data/employer-shard.ts` |
| 5 | `src/lib/security/index.ts` (secureGet), `src/app/insights/page.tsx` (STORAGE_KEY) |
| 6 | `src/app/insights/page.tsx` (full file) |
| 7 | `src/components/layout/sidebar.tsx` (full file including mobile section) |
| 8 | All test files in `src/__tests__/` |
