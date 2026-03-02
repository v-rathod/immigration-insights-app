## 2026-03-01 — Milestone 10: P2 Employer Name Normalization + P3 Data Integrity Tests

### Objective
Fix employer name deduplication end-to-end: multiple raw variants of the same employer ("GOOGLE INC", "Google Inc.", "GOOGLE LLC") were appearing as separate autocomplete results in P3. Implement proper entity resolution in P2 so all downstream artifacts and P3 JSON use canonical Title Case names.

### Problem Diagnosed
- `dim_employer` was **already correct** (canonical "Google", "Google Public Sector") — built with SHA1 normalization
- `employer_salary_profiles`, `employer_salary_yearly` stored raw LCA `employer_name` values without joining back to `dim_employer` canonical names
- `employer_monthly_metrics` had a similar residual raw name issue
- Root cause: builders aggregated `employer_name=("employer_name", "first")` from raw LCA data, losing the canonical name during groupby

### What Was Done

**P2 — `src/normalize/mappings.py` (fully implemented)**
- `normalize_employer_name()`: lowercase → strip punctuation → remove legal suffixes (corporation/inc/llc/llp/ltd/limited/co/plc…) → collapse whitespace
- `normalize_soc_code()`: handles "15-1252.00"→"15-1252", "151252"→"15-1252", "15125200"→"15-1252"
- `normalize_country_code()`: maps 20+ variants → ISO-3166 alpha-3 ("CHINA-mainland born"→"CHN", "All Chargeability Areas…"→"ROW")
- `normalize_visa_category()`: EB-2/eb2/EB2 NIW→"EB2", H1B/h1b/H-1B→"H-1B" etc.
- `title_case_employer_name()`: lowercase normalized → Title Case display

**P2 — `scripts/make_employer_salary_profiles.py` (canonical name replacement)**
- `_canonical_employer_names()`: two-pass post-build replacement:
  - Pass 1: `employer_id` → canonical name from `dim_employer` (for PERM-sourced employers)
  - Pass 2: fallback `normalize_employer_name()` + title_case for LCA-only employers not in `dim_employer`
- Applied to **both** `employer_salary_profiles` and `employer_salary_yearly` before writing parquet
- Logs: `canonical_name_dedup_profiles` and `canonical_name_dedup_yearly` reduction counts

**P2 — Artifacts rebuilt**
- `employer_salary_profiles.parquet` — 2,524,521 rows, canonical employer names
- `employer_salary_yearly.parquet` — 1,432,611 rows, canonical employer names
- `employer_monthly_metrics.parquet` — rebuilt (already joined dim_employer, re-run for freshness)

**P2 — New tests (72 tests)**
- `tests/test_normalization_mappings.py` — 57 pure unit tests for all 4 normalize functions
- `tests/test_employer_name_normalization.py` — 15 integration tests verifying canonical names in actual artifacts

**P3 — Artifacts synced**
- `employer_salary_trend.json` — now shows "Google" (single entry, not "GOOGLE INC" / "Google LLC" / etc.)
- `employer_wage_rankings.json` — canonical names throughout
- All 34 public/data JSON files refreshed

**P3 — New tests (15 tests)**
- `src/__tests__/employer-normalization.test.ts` — data integrity tests using `fs.readFileSync` to read public JSON directly
  - Checks: no raw Google variants, top-50 employers not ALL-CAPS, canonical 'Google' present, cross-file contract

### Results
| Metric | Value |
|--------|-----------|
| Affected artifacts | 3 rebuilt (`employer_salary_profiles`, `employer_salary_yearly`, `employer_monthly_metrics`) |
| P2 new tests | **72** (57 unit + 15 integration) |
| P3 new tests | **15** (data integrity) |
| P3 total tests | **381 passing** (20 test files) |
| TypeScript | ✅ clean (0 errors) |
| Example improvement | "Google" variants: 12 → 1 in `employer_salary_yearly` |

### Files Created / Modified
- (P2) `src/normalize/mappings.py` — complete implementation (was all TODOs)
- (P2) `scripts/make_employer_salary_profiles.py` — canonical name replacement step
- (P2) `tests/test_normalization_mappings.py` — new
- (P2) `tests/test_employer_name_normalization.py` — new
- (P3) `src/__tests__/employer-normalization.test.ts` — new
- (P3) `public/data/dashboards/wage/*.json` — refreshed via sync
- (P3) `public/data/dims/dim_employer.json` — refreshed

### Next Steps
- Dashboard 3: EB Category Comparison (`category_movement_metrics`)
- Dashboard 4: Geographic Heatmaps (`worksite_geo_metrics`)
- Dashboard 6: SOC Demand (`soc_demand_metrics`)
- /setup user input form (Phase 2 remaining item)

---

## 2026-02-28 — Milestone 9.1: Wage Hub — Dual-Mode Search Redesign

### Objective
Fundamental UX redesign of the Wage Intelligence Hub: employer-first dual-mode search, rich employer profile with YoY trend chart, and a "Rising Stars" salary-growth leaderboard.

### What Was Done

**Employer-first search (`WageIntelligenceHub.tsx` — full rewrite)**
- Default search mode: **By Employer** (not SOC — users don't know SOC codes)
- Mode tab switcher `[By Employer] [By Role]` embedded inline in the search bar
- Two Fuse.js indices: `employerFuseRef` (employer names from `employer_salary_trend`) + `socFuseRef` (SOC titles only — no codes required)
- Employer mode placeholder: "Search by company name (e.g. Google, Amazon, Deloitte)…"
- Role mode placeholder: "Search by job title (e.g. Software Developer, Data Scientist)…"
- `switchModeAndClear()` clears selection and re-focuses input on mode switch
- `selectEmployer()` / `selectSoc()` handlers with mutual exclusion
- `EmptyStateEmployer` → smart fallback to actual top employers from trend data
- `EmptyStateRole` → popular SOC quick picks (title only, no code required)
- `EmployerProfile` → `onSelectSoc` callback switches mode to "role" and drills into SOC detail

**New types in `EmployerSalaryTrend` interface**
- Added `n_soc_codes?: number` and `employer_id?: string | number` fields that exist in the actual JSON

**EmployerProfile component (`src/components/wage/EmployerProfile.tsx` — new)**
- 4-up growth badge grid: Median Salary | 5yr CAGR | Last YoY | Consecutive Raise Streak
- Recharts `AreaChart` — multi-year H-1B salary trend with `url(#empGrad)` fill gradient
- `SalaryTooltip` showing FY + salary + YoY% delta
- Top roles table: from `employer_wage_rankings`, shows SOC top job title + state + filings + median + premium%; click row → drill into SOC

**WageGrowthLeaderboard component (`src/components/wage/WageGrowthLeaderboard.tsx` — new)**
- "Rising Stars" always-visible bottom section (renders when `trends.length > 0` and qualifying employers found)
- Mode toggle: 5yr Growth | Latest YoY | Filing Volume
- H-1B | PERM visa type toggle
- Animated rank bars, 🏆 trophy icon for #1, 🔥 fire icon for streak ≥ 3
- Click row → triggers `onSelectEmployer` which switches hub to employer mode
- Employer filter: `minYears=5`, `minFilings=30` (ensures meaningful CAGR)

**Employer helpers added to `src/lib/data/wage.ts`**
- `EmployerGrowthStats` interface (employer_name, latest_median, cagr_5yr, yoy_latest, streak, total_filings, n_soc_codes)
- `getEmployerList()` — unique employers sorted by filing volume
- `getEmployerTrend()` — year series for one employer + visa type
- `computeEmployerGrowth()` — CAGR over 5yr, last YoY%, consecutive raise streak
- `getTopWageGrowers()` — top N by 5yr CAGR with min filters
- `getEmployerRoles()` — SOC breakdown per employer from rankings
- `annotateWithYoy()` — adds `yoy_pct` field to each row in a series

**Tests updated (`src/__tests__/wage-dashboard.test.tsx`)**
- Added helper `switchToRoleMode()` test helper
- Tests now reflect dual-mode: employer default → role mode → SOC drill-down
- New tests: mode toggle buttons visible, employer empty state heading, role mode placeholder
- Fixed: removed stale SOC-only test assumptions

### Results
| Metric | Value |
|--------|-------|
| New components | 2 (EmployerProfile, WageGrowthLeaderboard) |
| New wage.ts helpers | 7 (EmployerGrowthStats + 6 functions) |
| Tests | **366 passing** (19 test files) |
| TypeScript | ✅ clean (0 new errors) |

### Files Modified/Created
- `src/components/wage/WageIntelligenceHub.tsx` — Full rewrite (dual-mode search, employer flow, leaderboard)
- `src/components/wage/EmployerProfile.tsx` — New (~250 lines)
- `src/components/wage/WageGrowthLeaderboard.tsx` — New (~280 lines)
- `src/lib/data/wage.ts` — Extended with employer helpers + EmployerSalaryTrend fields
- `src/__tests__/wage-dashboard.test.tsx` — Updated tests (366 total)

---

## 2026-02-28 — Milestone 9: Wage Intelligence Hub (Dashboard 5 — Wage Competitiveness)

### Objective
Completely rebuild the wage dashboard using all 5 new P2 wage artifacts. Design a state-of-the-art searchable/filterable wage intelligence page matching the quality bar of PDC and SRS dashboards.

### What Was Done

**P2 Data Pipeline (sync_p2_data.py)**
- Fixed `NameError: state_codes not defined` by deriving state codes dynamically from `dim_area` (area_type == "STATE")
- Added `sync_wage_dashboard()` function producing 5 optimized JSON slices from P2 Parquet artifacts:
  - `salary_benchmarks_national.json` (141 KB, 831 rows) — national P10/P25/median/P75/P90 per SOC
  - `salary_benchmarks_states.json` (2.1 MB, 12,236 rows) — top-15 states per SOC
  - `soc_salary_market.json` (2.2 MB, 10,427 rows) — H-1B & PERM market medians FY2008–2025
  - `employer_wage_rankings.json` (1.1 MB, 2,736 rows) — top-25 employers per SOC per year
  - `employer_salary_trend.json` (529 KB, 2,492 rows) — multi-year employer salary trends

**Data Layer (`src/lib/data/wage.ts` — fully rewritten)**
- 5 typed loaders: `loadSalaryBenchmarksNational`, `loadSalaryBenchmarksStates`, `loadSocSalaryMarket`, `loadEmployerWageRankings`, `loadEmployerSalaryTrend`
- 8 pure helper functions: `getNationalBenchmark`, `getMarketTrend`, `getLatestMarket`, `getYoyGrowth`, `computePercentile`, `getTopStates`, `getSocList`, `getSocGroupStats`
- New types: `SalaryBenchmark`, `SocSalaryMarket`, `EmployerWageRanking`, `EmployerSalaryTrend`, `SocGroupStat`

**Sub-components (src/components/wage/)**
- `MarketTrendChart.tsx` — 10-year area chart with P25/P75 band, user wage reference line, Recharts gradient fills
- `PercentileLadder.tsx` — Horizontal P10→P90 gradient bar with staggered animation and user wage pin
- `EmployerWageTable.tsx` — Sortable ranked table with expandable rows, inline sparklines, premium badges
- `RegionalBreakdown.tsx` — Animated horizontal bar chart for top-paying states

**Hub Component (`src/components/wage/WageIntelligenceHub.tsx` — ~788 lines)**
- Fuse.js SOC search with dropdown autocomplete
- `VisaType` toggle (H-1B | PERM) shown only after SOC selection
- Default state (no SOC): Popular quick-pick grid + `getSocGroupStats` horizontal bar chart
- SOC selected: 4 stat cards → 4 tabs (Trend | Distribution | Employers | Regional)
- Conditional personal context card: only shown if user has `wageOffered` in localStorage profile AND benchmark exists
- Uses `secureGet` for localStorage access; `computePercentile` for personalized annotation

**Route (`src/app/dashboard/wage/page.tsx` — rewritten)**
- Next.js server component with `export const metadata`
- Breadcrumb navigation + gradient page title

**Old components deleted**: `WageDashboardPage.tsx`, `WageDistributionChart.tsx`, `WageDrilldownCard.tsx`, `WageSearchBar.tsx`

**Tests (`src/__tests__/wage-dashboard.test.tsx` — full rewrite)**
- 24 tests across 4 describe blocks: wage data helpers (9), WageIntelligenceHub (7), PercentileLadder (4), RegionalBreakdown (2)
- Fixed ESM import ordering issues (vi.mock hoisting with MOCK_* const TDZ)
- Fixed: vi.mock factory uses inline data to avoid temporal dead zone
- Fixed: `vi.clearAllMocks()` removed from beforeEach (was resetting mockResolvedValue)
- Fixed: `NumberTicker` mock added to prevent MotionValue objects being rendered as React children
- Fixed: RegionalBreakdown CSS selector → `getAllByText` pattern
- Fixed: `getByText("Software Developers")` → `getAllByText` (appears in multiple places)

### Results
| Metric | Value |
|--------|-------|
| New JSON artifacts | 5 (total: ~6 MB for wage dashboard) |
| New components | 5 (WageIntelligenceHub + 4 sub-components) |
| Data helper functions | 8 |
| Tests added | 24 (total: **362 passing**) |
| TypeScript | ✅ clean (no new errors) |

### Files Created/Modified
- `scripts/sync_p2_data.py` — Fixed + added `sync_wage_dashboard()`
- `src/lib/data/wage.ts` — Fully rewritten (5 loaders + 8 helpers + types)
- `src/components/wage/WageIntelligenceHub.tsx` — New (~788 lines)
- `src/components/wage/MarketTrendChart.tsx` — New
- `src/components/wage/PercentileLadder.tsx` — New
- `src/components/wage/EmployerWageTable.tsx` — New
- `src/components/wage/RegionalBreakdown.tsx` — New
- `src/app/dashboard/wage/page.tsx` — Rewritten
- `src/__tests__/wage-dashboard.test.tsx` — Full rewrite (24 tests)
- `public/data/dashboards/wage/` — 5 new JSON files

### Next Steps
1. Dashboard 3: EB Category Comparison (`category_movement_metrics`)
2. Dashboard 4: Geographic Heatmaps (`worksite_geo_metrics`)
3. Dashboard 6: SOC Demand (`soc_demand_metrics`)
4. Dashboard 7: Processing Speed (`processing_times_trends`, `fact_uscis_approvals`)
5. Dashboard 8: Backlog Visualization (`backlog_estimates`, `queue_depth_estimates`)

---

## 2026-02-27 — Milestone 8.4: Full P2 Artifact Sync & RAG/QA Expansion

### Objective
Sync all new P2 artifacts (49 tables, 22.5M+ rows, 341 RAG chunks, 684 QA pairs) to P3, update documentation, and ensure Ask NorthStar is ready for new data scale.

### What Was Done
- Ran `python3 scripts/sync_p2_data.py` to sync all new artifacts from P2 to P3 (`public/data/` now has 28 JSON files)
- Updated README.md and .github/copilot-instructions.md with new artifact inventory, RAG/QA scale, and sync instructions
- Confirmed RAG/QA artifacts: 341 chunks, 684 QA pairs, 49 artifacts in catalog
- Attempted to run/test Ask NorthStar (site temporarily unavailable due to dev server lock; user will restart VS Code)

### Results
| Metric | Value |
|--------|-------|
| Artifacts synced | 49 tables, 22.5M+ rows |
| RAG/QA scale | 341 chunks, 684 QA pairs |
| Docs updated | README.md, copilot-instructions.md |
| Next steps | User will restart VS Code and agent |

### Files Created/Modified
- `public/data/` — 28 JSON files (synced)
- `README.md` — Updated artifact inventory, RAG/QA scale, sync instructions
- `.github/copilot-instructions.md` — Updated artifact inventory, RAG/QA scale, sync instructions
- `PROGRESS.md` — This entry

### Next Steps
1. User restarts VS Code and agent
2. Test Ask NorthStar with new data
3. Continue with dashboards and personalized panels
# NorthStar · Compass — Progress Log

> **PURPOSE**: Chronological record of work completed, decisions made, and implementation progress for the Compass (P3) app.  
> **UPDATE**: Add entries after completing significant work (not every small change).  
> **INSPIRED BY**: [P2 Meridian PROGRESS.md](../immigration-model-builder/PROGRESS.md) — same format for consistency across the NorthStar program.

---

## Quick Reference (Current State as of Milestone 10 — 2026-03-01)

| Metric | Value |
|--------|-------|
| **Current Phase** | Phase 3 — 8 Dashboards (3/8) + Phase 5 — RAG Q&A ✅ |
| Framework | Next.js 16.1.6 (App Router, static export) |
| TypeScript | 5.x (strict mode) |
| Styling | Tailwind CSS 4.x |
| Design System | Aurora (dark-first, glassmorphic) |
| Test Framework | Vitest 4.0.18 + RTL + happy-dom |
| Tests | **381 passing** across 20 test files |
| P2 data synced | ✅ 34 JSON files via `sync_p2_data.py` |
| Pages scaffolded | 9 (`/`, `/about`, `/privacy`, `/terms`, `/ask`, `/dashboard/employer/`, `/dashboard/visa-bulletin/`, `/dashboard/wage/`, `/_not-found`) |
| Components | 33 custom (layout, UI, SRS, PDI, wage, providers) |
| Security | Full defense-in-depth (XSS, proto pollution, CSP, URL sanitization) |
| Flagship features | **PDC** (Priority Date Cortex) + **SRS** (Sponsor Reliability Score) + **Wage Hub** + **Ask** (RAG Q&A) |
| Sidebar structure | Main → **Insights** (PDC, SRS) → Dashboards (6) → **Tools** (Ask) → **Project** (About) → Personal |
| Dashboards built | **3 / 8** (SRS ✅, Visa Bulletin/PDC ✅, Wage ✅) |
| Personalized panels | 0 / 5 |
| RAG Q&A | ✅ 3-tier architecture (QA cache + chunk retrieval + Cloud LLM via Groq) |
| LLM backends | Groq (free cloud, Llama 3.3 70B) → OpenAI (reserved) → Ollama (local) → Mock |
| FAB | Unified FAB (Quick Actions → Ask NorthStar + Send Feedback) |
| AWS deploy | Not started |
| **Build status** | Compiles ✅ · Tests ✅ · Static export ✅ (10 pages) |
| **Data quality** | ✅ Canonical employer names (no ALL-CAPS variants) in all wage JSON files |

### Quick Commands
```bash
npm run dev          # Local dev server (http://localhost:3000)
npm run build        # Static export to out/
npm run lint         # ESLint
npm test             # Run all tests (single run)
npm run test:watch   # Tests in watch mode
npm run test:coverage # Tests with coverage report
npm run sync-data    # Sync P2 artifacts → public/data/
```

### P2 Data Available (23 JSON files synced)
| Category | Files | Total Size |
|----------|-------|------------|
| Models | `pd_forecasts.json`, `pd_forecast_model.json` | ~382 KB |
| RAG | `all_chunks.json`, `qa_cache.json`, `catalog.json`, `build_summary.json` | ~364 KB |
| Dimensions | `dim_employer.json`, `dim_soc.json`, `dim_country.json`, `dim_area.json`, `dim_visa_ceiling.json`, `dim_visa_class.json` | ~52.8 MB |
| Visa Bulletin | `fact_cutoff_trends.json`, `fact_cutoffs_all.json` | ~4.9 MB |
| Employer | `employer_features.json`, `employer_friendliness_scores.json`, `employer_friendliness_scores_ml.json`, `employer_risk_features.json`, `employer_monthly_metrics.json` | ~138 MB |
| Geographic | `worksite_geo_metrics.json` | ~44.7 MB |
| Wage | `salary_benchmarks.json` | ~26.1 MB |
| EB Category | `category_movement_metrics.json` | ~2.2 MB |
| SOC Demand | `soc_demand_metrics.json` | ~2.5 MB |
| Processing | `processing_times_trends.json`, `fact_uscis_approvals.json` | ~49 KB |
| Backlog | `backlog_estimates.json`, `queue_depth_estimates.json` | ~2.6 MB |

---

## Execution Phases

### Phase 0: Bootstrap ✅
- [x] Next.js 16 + TypeScript + Tailwind 4 + App Router + static export
- [x] All dependencies installed (React 19, Recharts, Framer Motion, Fuse.js, etc.)
- [x] Project structure created (`src/app/`, `src/lib/`, `src/types/`, `public/data/`)
- [x] Design tokens configured in `globals.css` (Aurora dark-first palette)
- [x] README + `.github/copilot-instructions.md` (336 lines of context)
- [x] Geist font (Sans + Mono) configured
- [x] Radix UI primitives installed (dialog, dropdown-menu, tooltip, tabs, select, etc.)

### Phase 1: Data Bridge ✅
- [x] `scripts/sync_p2_data.py` — Parquet → JSON converter (functional, 23 files synced)
- [x] `public/data/_manifest.json` — Sync manifest with timestamps
- [x] TypeScript types from P2 schemas (`src/types/p2-artifacts.ts`)
- [x] Data loader utilities (`src/lib/data/loader.ts`)
- [x] RAG search utility (`src/lib/search/rag-search.ts`)

### Phase 2: App Shell & Landing 🔄
- [x] Sidebar navigation with glassmorphic styling
- [x] Landing page with animated stat cards (hero + key metrics)
- [x] Theme toggle (dark/light/system)
- [x] Security module (XSS, proto pollution, CSP, URL sanitization)
- [x] Test infrastructure (Vitest 4.x + RTL + happy-dom, 181 tests)
- [x] UI component library (GlassCard, NumberTicker, StatCard, animations)
- [x] Responsive layout (mobile hamburger + collapsible sidebar)
- [ ] User input form (/setup — 8 fields, localStorage persistence)

### Phase 3: 8 Dashboards 🔄
- [x] 1. Visa Bulletin Trends (PDI) — category/country/PD selectors, DFF vs FAD chart, prediction cards, velocity stats
- [x] 2. Sponsor Reliability Score (SRS) — employer search, score gauge, detail card, trend chart, methodology
- [ ] 3. EB Category Comparison — movement metrics across EB1/EB2/EB3
- [ ] 4. Geographic Heatmaps — worksite distribution via react-simple-maps
- [x] 5. Wage Competitiveness — WageIntelligenceHub with Fuse.js SOC search, 5 P2 artifacts, 4 tabs, personal context card
- [ ] 6. SOC Demand — occupation demand metrics across time windows
- [ ] 7. Processing Speed — USCIS approval trends, processing times
- [ ] 8. Backlog Visualization — backlog estimates, queue depth charts

### Phase 4: Personalized Panels (/insights)
- [ ] A. Green Card Forecast — priority date prediction using pd_forecasts
- [ ] B. Employer Insights — friendliness score, risk features for user's employer
- [ ] C. Job Market Insights — geo metrics, SOC demand, salary for user's profile
- [ ] D. Actionable Recommendations — composite logic from A–C
- [ ] E. Visual Dashboard Mosaic — personalized chart grid

### Phase 5: RAG Q&A (/ask) ✅
- [x] Search-as-you-type with Fuse.js (182 pre-computed QA pairs)
- [x] Topic-filtered browsing (10 topics, pill filters)
- [x] Source attribution (100 text chunks)
- [x] Cloud LLM service (Groq free tier, Llama 3.3 70B)
- [x] 4-backend cascade: Groq → OpenAI → Ollama → Mock
- [x] 3-tier architecture: QA cache → chunk retrieval → LLM synthesis

### Phase 6: Ops & QA (/ops)
- [ ] Artifact inventory dashboard
- [ ] Data freshness indicators
- [ ] Test results display

### Phase 7: Deploy
- [ ] S3 + CloudFront + Route53 infrastructure (Terraform or CDK)
- [ ] GitHub Actions CI/CD pipeline
- [ ] Data freshness banner in app
- [ ] Performance optimization (lazy loading, code splitting)

---

## Milestone History

| # | Date | Title | Key Outcome |
|---|------|-------|-------------|
| 1 | 2026-02-25 | Project Bootstrap (Phase 0) | Next.js 16 scaffold, Tailwind 4, all deps, Aurora design tokens, P2 data sync |
| 2 | 2026-02-26 | App Shell & Testing (Phase 1+2) | Security module, theme system, sidebar, landing page, 133 tests passing |
| 3 | 2026-02-26 | Sponsor Reliability Score (Phase 3) | SRS dashboard with search, gauge, details, trends, 181 tests, EFS→SRS remap |
| 4 | 2026-02-26 | PDI + Homepage Redesign | Priority Date Index feature, PDI data loader, homepage elevated PDI+SRS as hero features, 218 tests |
| 5 | 2026-02-26 | Sidebar Restructure + Homepage Cleanup | User rejected opinionated hero layout; promoted PDI+SRS to sidebar Insights group; restored neutral 8-dashboard homepage; 217 tests |
| 6 | 2026-02-26 | Visa Bulletin Dashboard (PDI) | Full PDI dashboard: reactive pill selectors, DFF vs FAD chart, prediction cards, velocity stats; ForecastChart component; 240 tests |
| 6.1 | 2026-02-26 | PDI UX Improvements | Toggle, extrapolation beyond 24mo, X-axis fix, estimated dates; 249 tests |
| 6.2 | 2026-02-26 | Priority Date Cortex Rework | Rebrand PDI→PDC; velocity-based optimistic/realistic toggle (not DFF/FAD); compact layout; chart always shows both lines; X-axis years; 250 tests |
| 6.3 | 2026-02-26 | Historical Cutoff Chart | Added HistoricalChart showing ~10 years of monthly cutoff movement from fact_cutoff_trends; shown by default on PDC; new data loaders; 265 tests |
| 6.4 | 2026-02-26 | Unified Priority Date Chart | Consolidated HistoricalChart + ForecastChart into single PriorityDateChart; continuous timeline with solid actual + dashed forecast lines; 264 tests |
| 6.5 | 2026-02-26 | Zero-Error Cleanup | Fixed 19 ESLint/TS issues (6 errors + 12 warnings + 1 TS error); displayName on mocks, import over require, unused imports removed; 264 tests |
| 6.6 | 2026-02-26 | Hydration Mismatch Fix | Fixed 5 console errors from useSyncExternalStore theme approach; blocking `<script>` in `<head>` for theme, reverted to useState+useEffect; 264 tests |
| 7 | 2026-02-26 | Site-Wide Pages & Feedback Widget | Footer, About, Privacy, Terms pages; FeedbackWidget floating modal; sidebar "Project" group; 291 tests (16 files); 9 static pages |
| 8 | 2026-02-27 | RAG Q&A Ask Page (Phase 5) | 3-tier RAG: QA cache (182 pairs) + chunk retrieval (100 chunks) + mock LLM; /ask page with search, topic filters, AI answer; 335 tests (18 files); 10 pages |
| 8.1 | 2026-02-27 | UX Polish: Unified FAB + Ask Improvements | Merged feedback + ask into single FAB with mini-menu (Plus/X trigger → Ask NorthStar link + Send Feedback dialog); off-topic questions get natural immigration-redirect replies (4 variations); AI Answer always visible; removed P1/P2/P3 codenames from About page; 338 tests |
| 8.2 | 2026-02-27 | Ollama Local LLM Integration | Connected Ollama (llama3.2) as real LLM backend for Tier 3 RAG; auto-detects Ollama at localhost:11434, falls back to mock; backend status shown in Ask page ("Ollama connected" / "Mock mode"); model name badge on AI answer cards; zero-result searches auto-trigger AI; 338 tests |
| 8.3 | 2026-02-27 | Groq Cloud LLM Backend | Added Groq (free cloud Llama 3.3 70B) as primary LLM backend; 4-backend cascade: Groq → OpenAI → Ollama → Mock; env-var config via `NEXT_PUBLIC_GROQ_API_KEY`; Ask page shows "Groq connected"; `.env.local.example` template; 338 tests |

---

## Detailed Session Log

## 2026-02-25 — Milestone 1: Project Bootstrap (Phase 0 Complete)

### Objective
Set up the complete Compass (P3) project scaffold with Next.js 16, static export, and all required dependencies. Establish the data bridge from P2 Meridian artifacts.

### What Was Done

**Project Initialization**
- Created Next.js 16.1.6 project with App Router and TypeScript strict mode
- Configured `next.config.ts` with `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`
- Installed all dependencies: React 19, Recharts 2.15, Framer Motion 12, Fuse.js 7, react-simple-maps 3, Lucide React, nuqs 2.4, clsx, tailwind-merge, class-variance-authority
- Installed Radix UI primitives: dialog, dropdown-menu, tooltip, tabs, select, separator, switch, label, slot

**Design System (Aurora)**
- Configured Geist Sans + Geist Mono fonts
- Set up dark-first theme (`<html className="dark">`)
- Defined CSS design tokens in `globals.css` (gradients, glassmorphic effects, accent colors)

**Data Bridge (Phase 1 — partial)**
- `scripts/sync_p2_data.py` — Parquet → JSON converter syncing 23 files from P2
- `public/data/_manifest.json` — tracks sync timestamps and file sizes
- Initial TypeScript types in `src/types/p2-artifacts.ts`
- Data loader skeleton in `src/lib/data/loader.ts`
- RAG search skeleton in `src/lib/search/rag-search.ts`
- Utility functions in `src/lib/utils/` (cn, format, index)

**Documentation**
- `.github/copilot-instructions.md` — 336-line comprehensive project context
- `README.md` — project overview
- `PROGRESS.md` — this file

### P2 Dependency
Compass consumes 23 pre-computed JSON files from Meridian (P2 Milestone 18):
- 2 model files (pd_forecasts, pd_forecast_model)
- 4 RAG files (chunks, QA cache, catalog, build summary)
- 6 dimension tables (employer, SOC, country, area, visa_ceiling, visa_class)
- 11 dashboard data files across 7 dashboard categories

P2 is at 469 tests passing, 18 milestones complete, with all artifacts verified.

### Current State
- Build compiles successfully
- Dev server runs at localhost:3000
- Landing page shows default Next.js content (no custom UI yet)

### Next Steps
1. Complete Phase 1: finalize TypeScript types and data loaders
2. Begin Phase 2: app shell, sidebar nav, landing page with stat cards

### Files Created/Modified
- `next.config.ts` — static export configuration
- `package.json` — all dependencies
- `tsconfig.json` — TypeScript strict config
- `src/app/layout.tsx` — root layout with Geist fonts, dark theme
- `src/app/globals.css` — Aurora design tokens
- `src/app/page.tsx` — landing page placeholder
- `src/types/p2-artifacts.ts` — P2 artifact type definitions
- `src/lib/data/loader.ts` — data loader utilities
- `src/lib/search/rag-search.ts` — RAG search utility
- `src/lib/utils/cn.ts`, `format.ts`, `index.ts` — utility functions
- `scripts/sync_p2_data.py` — P2 → P3 data sync script
- `public/data/` — 23 synced JSON files + manifest
- `PROGRESS.md` — this file

---

## 2026-02-26 — Milestone 2: App Shell & Testing (Phase 1 Complete, Phase 2 In Progress)

### Objective
Build the complete app shell, security infrastructure, test framework, and Apple-quality landing page. Test-driven approach: every component and utility has full test coverage.

### What Was Done

**Test Infrastructure**
- Installed Vitest 4.x, React Testing Library, happy-dom, @testing-library/jest-dom, @testing-library/user-event
- Created `vitest.config.mts` (ESM required for Vite 7+ compatibility)
- Created `src/__tests__/setup.ts` — global mocks for matchMedia, IntersectionObserver, localStorage
- Added test scripts to package.json: `test`, `test:watch`, `test:coverage`, `test:ui`
- **Resolved ESM issue**: jsdom pulls `@exodus/bytes` (ESM-only) via html-encoding-sniffer; switched to happy-dom
- **Resolved localStorage leak**: Added `beforeEach` localStorage clear for test isolation

**Security Module (`src/lib/security/`)**
- `index.ts` — 299 lines of defense-in-depth security:
  - XSS prevention: `escapeHtml()`, `stripHtml()`, `sanitizeTextInput()`
  - Input validation: `validateDate()`, `validateCountryCode()`, `validateCategory()`, `validateNumber()`
  - Secure localStorage: `secureGet/Set/Remove/ClearAll()` with `compass_` prefix, blocks `__proto__` and `constructor` injection
  - Route allowlisting: `isAllowedPath()` with exact + prefix matching
  - URL sanitization: `sanitizeUrl()` blocks `javascript:`, `data:`, `vbscript:` protocols
  - CSP nonce generation: `generateNonce()` via Web Crypto API
- `headers.ts` — Security headers config for CloudFront: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy

**Theme System**
- `src/components/providers/theme-provider.tsx` — ThemeProvider with light/dark/system support, localStorage persistence, system preference listener, hydration-safe (always provides context)
- `src/components/ui/theme-toggle.tsx` — Three-way toggle (Sun/Moon/Monitor) with role="radiogroup" accessibility

**App Shell & Layout**
- `src/components/layout/sidebar.tsx` — Full navigation sidebar with 12 items in 4 groups (Main, Personal, Dashboards, Tools), collapse toggle (240px→60px), mobile hamburger + overlay, keyboard escape, aria-current for active
- `src/components/layout/app-shell.tsx` — Root layout shell with sidebar + scrollable main, responsive breakpoints
- `src/components/layout/index.ts` — Barrel export

**UI Component Library**
- `src/components/ui/glass-card.tsx` — Glassmorphic card with variants (default/elevated/interactive/accent), padding options, Framer Motion animations, optional glow
- `src/components/ui/number-ticker.tsx` — Animated number counter with useSpring, IntersectionObserver viewport trigger
- `src/components/ui/animations.tsx` — StaggerContainer, StaggerItem, FadeIn (4 directions), ScaleIn, GlowPulse
- `src/components/ui/stat-card.tsx` — Stat card with NumberTicker, trend badges (up/down/neutral)
- `src/components/ui/index.ts` — Barrel export

**Landing Page**
- `src/app/page.tsx` — Complete redesign with Apple-quality UI:
  - Ambient gradient backdrop with blur effects
  - Hero section with badge, gradient headline, dual CTAs
  - Stats bar with 4 animated stat cards (18.5M+ data points, 243K employers, etc.)
  - Value propositions (Real-Time Data, Privacy First, AI-Powered)
  - Dashboard grid (8 interactive GlassCards linking to dashboards)
  - Data sources footer with source badges
- `src/app/layout.tsx` — Updated to use ThemeProvider + AppShell wrapper, suppressHydrationWarning

### Test Results

| Test Suite | Tests | Status |
|------------|-------|--------|
| `cn.test.ts` | 6 | ✅ |
| `format.test.ts` | 24 | ✅ |
| `security.test.ts` | 48 | ✅ |
| `security-headers.test.ts` | 11 | ✅ |
| `loader.test.ts` | 10 | ✅ |
| `theme-provider.test.tsx` | 6 | ✅ |
| `theme-toggle.test.tsx` | 4 | ✅ |
| `glass-card.test.tsx` | 6 | ✅ |
| `sidebar.test.tsx` | 7 | ✅ |
| `landing-page.test.tsx` | 11 | ✅ |
| **Total** | **133** | **All passing** |

### Key Technical Decisions
1. **happy-dom over jsdom**: jsdom's dependency chain (html-encoding-sniffer → @exodus/bytes) is ESM-only but loaded via CJS require(). happy-dom is lighter and ESM-compatible.
2. **Context always provided**: ThemeProvider wraps children in context even before mount (uses visibility:hidden for SSR), preventing useTheme() throws in nested components.
3. **UTC date formatting**: All date formatters use `timeZone: 'UTC'` to prevent timezone-dependent test failures.
4. **Exact + prefix path matching**: `isAllowedPath()` uses exact match for `/`, `/setup`, etc. and prefix match only for `/dashboard/`, preventing overly permissive matching.
5. **Test isolation**: localStorage cleared via `beforeEach` to prevent theme state leaking between tests.

### Next Steps
1. Build user input form (`/setup` — 8 fields with validation + localStorage persistence)
2. Begin Phase 3: first dashboard (Visa Bulletin Trends)

---

## 2026-02-26 — Milestone 3: Sponsor Reliability Score (Phase 3 — Dashboard 2)

### Objective
Build the flagship SRS (Sponsor Reliability Score) dashboard — rename EFS→SRS throughout, create 5 interactive components, data loaders with field remapping, and full test coverage. First of 8 dashboards.

### What Was Done

**EFS → SRS Rename (Codebase-Wide)**
- Renamed `EmployerFriendlinessScore` → `SponsorReliabilityScore` in TypeScript types
- Added `SponsorReliabilityScoreML`, `EmployerFeatures` interfaces matching actual JSON schemas
- Updated `DimEmployer` (employer_id is string hash, not number), `EmployerMonthlyMetric`, `EmployerRiskFeature`
- Updated sidebar label: "Employers" → "Sponsor Score"
- Updated landing page card: "Employer Friendliness" → "Sponsor Reliability Score"
- Added `srsTierColor()`, `srsTierBg()`, `srsTierHex()`, `srsScoreToTier()` to format utils

**Data Loaders (`src/lib/data/srs.ts` — ~230 lines)**
- `loadSrsScores()` — 70,206 records with efs→srs field remapping at load boundary
- `loadSrsScoresML()` — 1,695 ML scores with efs_ml→srs_ml remapping
- `loadEmployerMonthlyMetrics()` — 224,114 monthly time-series records
- `loadEmployerRiskFeatures()` — 668 WARN Act flagged employers
- `loadEmployerFeatures()` — 70,206 raw feature records
- `remapEfsToSrs()` / `remapEfsMlToSrs()` — exported remap functions with NaN→null normalization
- Helper functions: `filterOverallScores`, `filterRatedEmployers`, `mergeMLScores`, `getEmployerMetrics`, `getEmployerRisk`, `computeSrsStats`

**SRS Components (5 new — `src/components/srs/`)**
- `employer-search.tsx` — Fuzzy search autocomplete (Fuse.js, 150ms debounce, keyboard nav, ARIA combobox, glassmorphic dropdown)
- `score-gauge.tsx` — Animated SVG arc gauge (270° arc, Framer Motion spring, subscore bars, ML badge)
- `employer-detail-card.tsx` — Key metrics grid (approval/denial rates, cases, wage ratio, SOC/site breadth, WARN alert)
- `trend-chart.tsx` — Recharts AreaChart (monthly filings/approvals/denials, gradient fills, custom tooltip)
- `srs-overview.tsx` — Aggregate stats bar + tier distribution stacked bar chart

**Dashboard Page (`src/app/dashboard/employer/page.tsx` — ~300 lines)**
- Parallel data loading (4 concurrent fetches)
- Overview stats section, employer search, score gauge + detail card (responsive grid)
- Trend chart, loading spinner, error state with retry, empty state
- Methodology section explaining scoring formula (50% outcomes, 30% wages, 20% sustainability)

**Critical Bug Fix: EFS→SRS Data Mapping**
- P2 JSON uses `efs`/`efs_tier`/`efs_ml` field names, but P3 TypeScript uses `srs`/`srs_tier`/`srs_ml`
- Added `remapEfsToSrs()` and `remapEfsMlToSrs()` at the data loader boundary
- NaN values (common for unrated employers) normalized to `null` for safe JS comparisons
- All downstream components see consistent `srs`/`srs_tier`/`srs_ml` naming

**React 19 Compatibility Fix**
- `useRef()` without initial value fails in React 19 strict mode → fixed with `useRef(undefined)`

### Test Results

| Test Suite | Tests | Status |
|------------|-------|--------|
| `cn.test.ts` | 6 | ✅ |
| `format.test.ts` | 33 | ✅ (+9 SRS tier/score tests) |
| `security.test.ts` | 48 | ✅ |
| `security-headers.test.ts` | 11 | ✅ |
| `loader.test.ts` | 10 | ✅ |
| `theme-provider.test.tsx` | 6 | ✅ |
| `theme-toggle.test.tsx` | 4 | ✅ |
| `glass-card.test.tsx` | 6 | ✅ |
| `sidebar.test.tsx` | 7 | ✅ (updated: "Sponsor Score") |
| `landing-page.test.tsx` | 11 | ✅ (updated: "Sponsor Reliability Score") |
| `srs-data.test.ts` | 18 | ✅ (NEW — helpers + efs→srs remap) |
| `srs-components.test.tsx` | 21 | ✅ (NEW — search, gauge, detail, chart, overview) |
| **Total** | **181** | **All passing** |

### Key Technical Decisions
1. **EFS→SRS remap at load boundary**: P2 JSON retains original `efs`/`efs_tier`/`efs_ml` field names. Remapping happens in `srs.ts` loaders, not in the JSON files, so P2 sync is non-destructive.
2. **NaN normalization**: P2 produces `NaN` for unrated employers. Remapper converts to `null` since JS `NaN !== NaN` causes subtle bugs.
3. **React 19 useRef**: `useRef<T>()` without initial value is a type error in React 19. Timer refs use `useRef<T>(undefined)`.
4. **Recharts for charts**: Added as dependency for trend visualization. AreaChart with gradient fills and custom tooltips.

### Files Created
- `src/lib/data/srs.ts` — SRS data loaders + remapping + helpers
- `src/components/srs/employer-search.tsx` — Fuzzy search autocomplete
- `src/components/srs/score-gauge.tsx` — Animated SVG gauge
- `src/components/srs/employer-detail-card.tsx` — Key metrics grid
- `src/components/srs/trend-chart.tsx` — Recharts trend chart
- `src/components/srs/srs-overview.tsx` — Aggregate stats + tier distribution
- `src/components/srs/index.ts` — Barrel export
- `src/app/dashboard/employer/page.tsx` — SRS dashboard page
- `src/__tests__/srs-data.test.ts` — 18 data helper tests
- `src/__tests__/srs-components.test.tsx` — 21 component tests

### Files Modified
- `src/types/p2-artifacts.ts` — Renamed interfaces, updated schemas
- `src/lib/utils/format.ts` — Added SRS tier color/score functions
- `src/lib/utils/index.ts` — Added SRS exports
- `src/components/layout/sidebar.tsx` — "Employers" → "Sponsor Score"
- `src/app/page.tsx` — "Employer Friendliness" → "Sponsor Reliability Score"
- `src/__tests__/format.test.ts` — Added 9 SRS tests
- `src/__tests__/sidebar.test.tsx` — Updated label expectation
- `src/__tests__/landing-page.test.tsx` — Updated label expectation

### Next Steps
1. Build remaining 7 dashboards (Visa Bulletin Trends next)
2. Build user input form (`/setup` — 8 fields)
3. Begin personalized panels (Phase 4)

---

## 2026-02-26 — Milestone 4: PDI Feature & Homepage Redesign

### Objective
Name and implement the "Priority Date Index" (PDI) feature — the crown jewel forecast tool — and redesign the homepage to elevate PDI and SRS as flagship features rather than generic dashboard links.

### What Was Done

**PDI Feature Naming**
- Explored themed names (PACE, ATLAS, VECTOR) — user rejected forcing themes
- Explored GC-based names (GCT, GCE, GPI) — user wanted PD-based naming
- User selected **PDI** (Priority Date Index) from final options PDI/PDE/PDT/PDF

**PdForecast Type Update**
- Updated `PdForecast` interface in `p2-artifacts.ts` to match actual `pd_forecasts.json` schema
- Fields: `forecast_month` (string), `months_ahead`, `chart`, `category`, `country`, `projected_cutoff_date`, `confidence_low`, `confidence_high`, `velocity_days_per_month`, `cumulative_advancement_days`

**PDI Data Loader** (`src/lib/data/pdi.ts`)
- Constants: `PDI_CHARTS`, `PDI_CATEGORIES`, `PDI_COUNTRIES`, `COUNTRY_LABELS`, `CHART_LABELS`
- Types: `PdiChart`, `PdiCategory`, `PdiCountry`, `PdiResult`
- Functions: `loadPdForecasts()`, `getForecastSeries()`, `computePdi()`, `getVelocitySummary()`
- `computePdi()` finds when a user's priority date becomes current within the 24-month forecast window

**PDI Quick-Look Widget** (`src/components/pdi/pdi-quick-look.tsx`)
- Interactive homepage component loading `pd_forecasts.json` (342KB) on mount
- Category pills (EB1/EB2/EB3), Country pills (IND/CHN/ROW/PHL/MEX), Chart toggle (DFF/FAD)
- Animated SVG sparkline of cumulative advancement over 24 months
- Stats: velocity (days/mo), total advancement, projected cutoff date
- Defaults: EB2/IND/DFF — the most common EB immigrant profile
- No-data fallback for missing combinations

**SRS Teaser Card** (`src/components/pdi/srs-teaser.tsx`)
- Static teaser for homepage — no data loading (employer dataset is 138MB)
- Hardcoded highlight stats: 70,206 employers scored, 1,695 ML-verified, 668 WARN flagged
- Decorative animated SVG gauge (score "72 Good")
- 4-item feature checklist (Bayesian rates, wage comp, WARN risk, XGBoost ML)
- Search placeholder (non-functional — CTA guides user to dashboard)

**Homepage Redesign** (`src/app/page.tsx`)
- NEW "Hero Features" section: PDI + SRS side-by-side in responsive 2-column grid
- Hero subheadline now explicitly mentions PDI and SRS with semantic callouts
- Dashboard grid reduced from 8 → 6 (Visa Bulletin + Employer elevated to hero)
- Dashboard grid layout changed from 4-col to 3-col for visual balance
- Section heading changed: "8 Interactive Dashboards" → "Explore Dashboards"
- Section flow: Hero → Hero Features → Stats → Dashboards → Value Props → Data Sources

### Results
| Metric | Before | After |
|--------|--------|-------|
| Tests | 181 (12 files) | 218 (14 files) |
| PDI tests | 0 | 35 (16 data + 19 component) |
| Homepage tests | 11 | 13 (+ hero features, PDI/SRS mentions) |
| Components | 18 | 22 (+4 PDI components) |
| Build | ✅ 3 pages | ✅ 3 pages |

### Test Breakdown
| File | Tests | Status |
|------|-------|--------|
| `pdi-data.test.ts` | 16 | ✅ (NEW — constants, series, computePdi, velocity, loader) |
| `pdi-components.test.tsx` | 19 | ✅ (NEW — PdiQuickLook: 11, SrsTeaser: 8) |
| `landing-page.test.tsx` | 13 | ✅ (UPDATED — hero features, 6 dashboards, PDI/SRS labels) |
| All others | 170 | ✅ (unchanged) |
| **Total** | **218** | **All passing** |

### Key Design Decisions
1. **PDI loads data on homepage (342KB)**: Forecast data is small enough for client-side fetch. SRS data (138MB) is NOT loaded — only a static teaser is shown.
2. **EB2/IND/DFF as defaults**: Most common EB immigrant profile — provides immediate value without configuration.
3. **6 dashboards in grid, 2 in hero**: Visa Bulletin (PDI) and Employer (SRS) are the two most important tools — they deserve hero placement, not dashboard grid cards.
4. **3-column dashboard grid**: With 6 cards instead of 8, a 3×2 grid looks better than 4×2.
5. **Static SRS teaser**: Loading 138MB on the homepage would be terrible UX. Hardcoded stats + visual gauge + CTA is the right tradeoff.

### Files Created
- `src/lib/data/pdi.ts` — PDI data loader + forecast helpers (~185 lines)
- `src/components/pdi/pdi-quick-look.tsx` — Interactive PDI widget (~324 lines)
- `src/components/pdi/srs-teaser.tsx` — Static SRS teaser (~160 lines)
- `src/components/pdi/index.ts` — Barrel export
- `src/__tests__/pdi-data.test.ts` — 16 PDI data helper tests
- `src/__tests__/pdi-components.test.tsx` — 19 PDI/SRS component tests

### Files Modified
- `src/types/p2-artifacts.ts` — Updated PdForecast interface to match actual JSON schema
- `src/app/page.tsx` — Homepage redesign with hero features section
- `src/__tests__/landing-page.test.tsx` — Updated for new homepage structure (13 tests)
- `.github/copilot-instructions.md` — Updated file inventory, added PDI components
- `PROGRESS.md` — This entry

### Next Steps
1. Build Visa Bulletin Trends dashboard (Dashboard 1 — full PDI experience)
2. Build user input form (`/setup` — 8 fields, localStorage persistence)
3. Continue remaining 6 dashboards (Phase 3)

---

## 2026-02-26 — Milestone 5: Sidebar Restructure & Homepage Cleanup

### Objective
User rejected the "Two Tools That Matter Most" homepage layout as presumptuous and the floating PDI/SRS widgets as clumsy. Restructure navigation to promote PDI and SRS via sidebar instead, and restore a neutral informational homepage.

### User Feedback
- "This whole layout saying two tools that matter most looks childish. We cannot say this is what matters most — that's the user's preference or decision."
- "I kind of like the overall design of the widgets for SRS and PDI but I don't like that they are just floating on home page. Design looks clumsy now."
- "Maybe we can add it in sidebar as top link or something."
- "Not user profile based system. It is mainly informative app."

### What Was Done

**Sidebar Restructure** (`src/components/layout/sidebar.tsx`)
- Created new **"Insights"** navigation group (positioned after Home, before Dashboards)
- Added "Priority Date Index" (Calendar icon → `/dashboard/visa-bulletin`) to Insights
- Added "Sponsor Score" (Shield icon → `/dashboard/employer`) to Insights
- Removed "Visa Bulletin" and "Sponsor Score" from Dashboards group (no duplication)
- Dashboards group now has 6 items: EB Categories, Geographic, Wages, Occupations, Processing, Backlog
- Renamed "Setup Profile" → "Setup" in Personal group
- Moved Personal group to bottom of sidebar
- Added `Calendar` and `Shield` icon imports from lucide-react

**Homepage Cleanup** (`src/app/page.tsx`)
- Removed `PdiQuickLook` and `SrsTeaser` component imports
- Removed entire "Hero Features" section (two-column PDI/SRS widget row)
- Restored all 8 dashboard cards in grid (Visa Bulletin and Employer back in grid)
- Restored 4-column `lg:grid-cols-4` layout (was 3-col with 6 cards)
- Restored "8 Interactive Dashboards" heading (was "Explore Dashboards")
- Reverted hero subheadline to neutral copy (no PDI/SRS callouts)
- Added comment: "All 8 dashboards — presented equally as an informational catalog"

**Test Updates**
- `landing-page.test.tsx`: Removed PDI data mock, restored 8-dashboard test, removed 3 Hero Features tests, restored Visa Bulletin link test (11 tests, was 13)
- `sidebar.test.tsx`: Updated dashboard labels (6 items), added "renders Insights group with PDI and SRS" test (8 tests, was 7)

**PDI Components Preserved** (not deleted — will be used on dashboard pages)
- `src/components/pdi/pdi-quick-look.tsx` — For Visa Bulletin dashboard
- `src/components/pdi/srs-teaser.tsx` — For potential use elsewhere
- `src/__tests__/pdi-data.test.ts` — 16 tests still passing
- `src/__tests__/pdi-components.test.tsx` — 19 tests still passing

### Results
| Metric | Before (M4) | After (M5) |
|--------|-------------|------------|
| Tests | 218 (14 files) | 217 (14 files) |
| Landing page tests | 13 | 11 (-2: removed Hero Features tests) |
| Sidebar tests | 7 | 8 (+1: Insights group test) |
| Sidebar groups | 4 (Main, Personal, Dashboards, Tools) | 5 (Main, Insights, Dashboards, Tools, Personal) |
| Homepage dashboards | 6 (2 elevated to hero) | 8 (all equal) |
| Build | ✅ 3 pages | ✅ 3 pages |

### Key Design Decisions
1. **Sidebar promotion over homepage widgets**: PDI and SRS are discoverable via the "Insights" group at the top of the sidebar, giving them prominence without being prescriptive about their importance.
2. **Neutral homepage**: All 8 dashboards are presented equally — the homepage serves as an informational catalog, not an opinion on what matters most.
3. **Widgets preserved for dashboards**: PdiQuickLook and SrsTeaser components are kept (with tests) for future use on their dedicated dashboard pages.
4. **No duplication**: PDI and SRS are in the Insights sidebar group only — not repeated in the Dashboards group.
5. **Informational app first**: The app is primarily a data exploration tool. Personalization (setup/insights) is secondary and lives at the bottom of the sidebar.

### Files Modified
- `src/components/layout/sidebar.tsx` — Restructured nav groups, added Insights
- `src/app/page.tsx` — Removed Hero Features, restored 8-dashboard grid
- `src/__tests__/landing-page.test.tsx` — Adjusted to match new homepage (11 tests)
- `src/__tests__/sidebar.test.tsx` — Added Insights group test (8 tests)

### Next Steps
1. Build Visa Bulletin Trends dashboard (Dashboard 1 — PDI widget lives here)
2. Build user input form (`/setup` — 8 fields, localStorage persistence)
3. Continue remaining 6 dashboards (Phase 3)

---

## 2026-02-26 — Milestone 6: Visa Bulletin Dashboard (PDI)

### Objective
Build the full Priority Date Index (PDI) dashboard with reactive selectors (no submit button), dual-timeline chart (DFF vs FAD), personalized prediction cards, and velocity stats.

### What Was Done

**ForecastChart Component** (`src/components/pdi/forecast-chart.tsx`)
- Recharts ComposedChart with dual lines: DFF (blue, `#3b82f6`) and FAD (amber, `#f59e0b`)
- Gradient area fills below each line for depth
- Optional user priority date as dashed green `ReferenceLine`
- Custom tooltip showing DFF/FAD cutoff dates + user PD
- Inline legend (no Recharts Legend — custom design for Aurora consistency)
- 350px responsive chart with date-formatted Y-axis
- Empty state fallback for missing combinations

**Visa Bulletin Page** (`src/app/dashboard/visa-bulletin/page.tsx`)
- **Category pills**: EB1, EB2, EB3 primary + expandable "More" for EB3-Other, EB4, EB5 (AnimatePresence)
- **Country pills**: India, China, ROW, Philippines, Mexico, El Salv./Guat./Hond. — all 6 chargeability regions
- **Priority date input**: Glassmorphic `<input type="date">` with calendar icon, styled WebKit picker indicator for dark mode
- **All reactive — no submit button**: Change any selector and chart + predictions update instantly
- **Two prediction cards** (PredictionCard sub-component):
  - "Date for Filing" (DFF) — blue accent, optimistic timeline, shows crossing month + months away + velocity + confidence range
  - "Final Action" (FAD) — amber accent, realistic timeline, same metrics
  - States: no PD entered → prompt, already current → celebration, found in 24mo → exact date, beyond window → ">24 months"
  - Corner glow effect, gradient icons
- **Velocity stats strip**: 4 mini-stat cards (DFF velocity, FAD velocity, DFF 24mo gain, FAD 24mo gain)
- **Methodology section**: Explains DFF vs FAD, velocity, confidence ranges
- Loading spinner, error state with retry, no-data state per combination

**Barrel Export** — Added `ForecastChart` to `src/components/pdi/index.ts`

### Results
| Metric | Before (M5) | After (M6) |
|--------|-------------|------------|
| Tests | 217 (14 files) | 240 (15 files) |
| New tests | — | 23 (6 ForecastChart + 17 VisaBulletinPage) |
| Components | 22 | 23 (+ForecastChart) |
| Pages | 3 (/, /404, /dashboard/employer) | 4 (+/dashboard/visa-bulletin) |
| Dashboards built | 1/8 | 2/8 |
| Build | ✅ 3 pages | ✅ 4 pages |

### Test Breakdown
| File | Tests | Status |
|------|-------|--------|
| `visa-bulletin.test.tsx` | 23 | ✅ (NEW — 6 chart + 17 page) |
| All others | 217 | ✅ (unchanged) |
| **Total** | **240** | **All passing** |

### Key Design Decisions
1. **No submit button**: All selectors are reactive — category, country, and priority date changes immediately update the chart and prediction cards. This feels like a modern interactive tool, not a boring form.
2. **Prediction cards ABOVE chart**: The user's primary question ("when will my PD become current?") is answered first with prediction cards. The chart provides the detailed visual below.
3. **DFF = Optimistic, FAD = Realistic**: DFF (Date for Filing) lets you file I-485 earlier; FAD (Final Action Date) is when the green card is actually approved. DFF cutoffs are always ahead of FAD.
4. **Progressive disclosure**: Chart shows forecasts even without a priority date. Entering PD adds the reference line and populates prediction cards with personalized dates.
5. **Extended categories behind "More" toggle**: EB3-Other, EB4, EB5 are less common — hidden by default to reduce visual noise for the 90% use case (EB1/EB2/EB3).

### Files Created
- `src/components/pdi/forecast-chart.tsx` — Recharts dual-line chart component
- `src/app/dashboard/visa-bulletin/page.tsx` — PDI dashboard page
- `src/__tests__/visa-bulletin.test.tsx` — 23 tests for chart + page

### Files Modified
- `src/components/pdi/index.ts` — Added ForecastChart export
- `.github/copilot-instructions.md` — Updated file inventory and test counts
- `PROGRESS.md` — This entry

### Next Steps
1. Build remaining 6 dashboards (EB Category, Geographic, Wage, SOC Demand, Processing, Backlog)
2. Build user input form (`/setup` — 8 fields, localStorage persistence)
3. Begin personalized panels (Phase 4)

---

## 2026-02-26 — Milestone 6.1: PDI Dashboard UX Improvements

### Objective
Adress user feedback on the Visa Bulletin dashboard:
1. Fix 4 VS Code red errors (`vi` not imported in 2 test files)
2. Add Optimistic/Realistic/Both toggle for DFF vs FAD chart filtering
3. Fix X-axis to show month labels with dynamic interval (not just start/end)
4. Remove 24-month prediction cap — extrapolate using velocity for any priority date
5. Show exact estimated dates for distant priority dates instead of "Beyond 24 months"

### What Was Done

**Data Layer** (`src/lib/data/pdi.ts`)
- Added `extrapolated: boolean` field to `PdiResult` interface
- Modified `computePdi()` to extrapolate beyond 24-month model window using avg velocity
  - Computes remaining days, divides by velocity, calculates estimated month
  - Returns `found: true, extrapolated: true` with estimated date
  - Falls back to `found: false` only when velocity is zero/negative
  - Guards against invalid date parsing with `isNaN()` check
- Added `ExtrapolatedPoint` interface (`month: string`, `cutoffTimestamp: number`)
- Added `extrapolateForChart()` function — generates extended chart data points beyond the model's 24-month horizon until cutoff crosses the user's PD (capped at 120 months)

**ForecastChart** (`src/components/pdi/forecast-chart.tsx`)
- Added `ChartMode` type export: `'dff' | 'fad' | 'both'`
- Added `mode`, `dffExtrapolation`, `fadExtrapolation` props
- Conditional rendering: only shows Area/Line components matching the active mode
- Chart data merges real series + extrapolated points into unified timeline
- X-axis uses computed `interval` (data length / 12) instead of `preserveStartEnd`
- Y-axis domain respects mode (only considers visible lines)
- Legend items conditionally shown based on mode
- Title changed from "24-Month Cutoff Forecast" → "Cutoff Date Forecast"
- Lines use `connectNulls` for smooth extrapolation continuity

**Visa Bulletin Page** (`src/app/dashboard/visa-bulletin/page.tsx`)
- Added 3-way segmented toggle: Optimistic (DFF) / Realistic (FAD) / Both
  - Glassmorphic inline toggle in config strip, below country selector
  - Active state uses accent blue with shadow glow
- Prediction cards conditional on mode — only shows relevant card(s)
  - Single card uses `max-w-xl`, both use `sm:grid-cols-2`
- New `foundExtrapolated` display state in PredictionCard:
  - Shows "Estimated" badge (9px uppercase pill)
  - Displays estimated month in large mono text with accent color
  - Shows "~N months away" + velocity + "Extrapolated beyond model forecast" note
- New `notPredictable` state: "Unable to estimate" when velocity is zero
- Removed old `beyondWindow` / `extrapolatedMonths` logic and "Beyond 24 months" text
- Velocity stats conditional on mode (DFF-only, FAD-only, or all 4)
- Renamed "DFF 24mo Gain" → "DFF Total Gain", "FAD 24mo Gain" → "FAD Total Gain"
- Header subtitle: "24-month cutoff forecast" → "Cutoff date forecast"
- Computes `dffExtrapolation` / `fadExtrapolation` via useMemo + `extrapolateForChart()`

**Test Fixes**
- Added `vi` to import in `glass-card.test.tsx` and `theme-provider.test.tsx` (fixes 3 VS Code errors)
- Fixed test fixtures in both `pdi-data.test.ts` and `visa-bulletin.test.tsx` to generate valid month strings (was `2026-27` for month >9, now properly rolls to `2027-01` etc.)

### Results
| Metric | Before (M6) | After (M6.1) |
|--------|-------------|--------------|
| Tests | 240 (15 files) | 249 (15 files) |
| New tests | — | 9 (2 ForecastChart mode + 3 toggle + 4 extrapolateForChart) |
| VS Code errors | 4 | 0 |
| Build | ✅ 4 pages | ✅ 4 pages |

### Test Breakdown (new/changed)
| Test | Status |
|------|--------|
| ForecastChart: hides FAD line when mode is dff | ✅ NEW |
| ForecastChart: hides DFF line when mode is fad | ✅ NEW |
| VisaBulletinPage: renders forecast view toggle | ✅ NEW |
| VisaBulletinPage: toggling to Realistic hides DFF | ✅ NEW |
| VisaBulletinPage: toggling to Optimistic hides FAD | ✅ NEW |
| computePdi: extrapolates when PD beyond window | ✅ UPDATED |
| computePdi: already current checks extrapolated | ✅ UPDATED |
| extrapolateForChart: 4 tests | ✅ NEW |
| VB: estimated prediction for PD beyond model | ✅ UPDATED |
| **Total** | **249 passing** |

### Files Modified
- `src/lib/data/pdi.ts` — PdiResult.extrapolated, computePdi extrapolation, extrapolateForChart
- `src/components/pdi/forecast-chart.tsx` — ChartMode, conditional rendering, extrapolation merge
- `src/app/dashboard/visa-bulletin/page.tsx` — Toggle, extrapolation, prediction card states
- `src/__tests__/pdi-data.test.ts` — Fixed fixtures, updated beyond-window test, added extrapolation tests
- `src/__tests__/visa-bulletin.test.tsx` — Fixed fixtures, updated text expectations, added toggle tests
- `src/__tests__/glass-card.test.tsx` — Added `vi` import
- `src/__tests__/theme-provider.test.tsx` — Added `vi` import
- `.github/copilot-instructions.md` — Updated test counts
- `PROGRESS.md` — This entry

### Key Design Decisions
1. **Extrapolation uses avg velocity**: Rather than fitting a curve, we use the simple average velocity from the 24-month model forecast. This is transparent and easy to explain to users.
2. **Chart extends with extrapolated data**: Extrapolated points merge seamlessly into the chart data array. `connectNulls` ensures the line is continuous even when DFF and FAD extend different distances.
3. **No 24-month cap**: Any PD, no matter how far in the future, gets an estimated date. Prediction cards clearly label these as "Estimated" with an explanation note.
4. **3-way toggle, not radio buttons**: Segmented control feels modern and matches the pill selector pattern already used for category/country.

---

## 2026-02-26 — Milestone 6.2: Priority Date Cortex Rework

### Objective
Major UX rework based on user feedback:
1. **Rebrand** "Priority Date Index" → "Priority Date Cortex" (sounds more AI/intelligence-focused)
2. **Fix toggle semantics** — Optimistic/Realistic should control velocity assumption, NOT which chart type (DFF/FAD) is displayed. Both DFF and FAD must always be visible.
3. **Compact layout** — Chart is the most important element; user shouldn't have to scroll to see it
4. **Year-labeled X-axis** — Show years instead of monthly labels for cleaner readability
5. **Simple toggle** — Pill/switch near chart header instead of full segmented control

### What Was Done

**Rebranding** (3 files)
- `src/components/layout/sidebar.tsx` — Nav item: "Priority Date Index" → "Priority Date Cortex"
- `src/components/pdi/pdi-quick-look.tsx` — Header text updated
- `src/__tests__/sidebar.test.tsx` — Test assertion updated

**Data Layer** (`src/lib/data/pdi.ts`)
- `computePdi()` now accepts `velocityMultiplier: number = 1.0` as 6th parameter
  - When multiplier < 1.0 (realistic), recomputes cutoff positions using discounted velocity from series start instead of using model projections directly
- `extrapolateForChart()` now accepts `velocityMultiplier: number = 1.0` as 4th parameter (after maxExtraMonths)
  - Scales rawAvgVelocity by multiplier for realistic extrapolation
- Doc comment updated: "Priority Date Cortex"
- `REALISTIC_VELOCITY_MULTIPLIER = 0.65` constant defined in page (65% of data-driven velocity)

**ForecastChart** (`src/components/pdi/forecast-chart.tsx`) — Complete rewrite (393 lines)
- **Removed**: `ChartMode` type export, `mode` prop, `showDff`/`showFad` conditional rendering
- **Added**: `yearLabel` field in ChartDataPoint computed via `getYear()` helper
- X-axis uses `dataKey="yearLabel"` with computed interval for year-boundary readability
- Both DFF (blue) and FAD (amber) lines/areas always rendered unconditionally
- Chart height: 350px for optimal above-fold visibility
- Simplified ForecastChartProps interface (no mode, no type filtering)

**Visa Bulletin Page** (`src/app/dashboard/visa-bulletin/page.tsx`) — Complete rewrite (737 lines)
- **Header**: "Priority Date Cortex" with compact calendar icon
- **Config strip**: 2-row compact layout
  - Row 1: Category + Country inline with divider (labels: "Category" / "Country")
  - Row 2: Priority date input with "Your PD" label
- **Toggle**: Styled switch (`role="switch"`, `aria-checked`) overlaid at top-right of chart area
  - Optimistic (blue) = model velocity (1.0x); Realistic (amber) = 65% discount (0.65x)
  - Visual: sliding dot with color transition between blue/amber
- **Prediction cards**: Always shows both DFF + FAD cards side-by-side (`sm:grid-cols-2`)
  - Sublabels: "File I-485 (Adjustment of Status)" / "Green Card Approval"
  - Mode badge (Optimistic/Realistic) on each card
  - All display states preserved: no PD, already current, found in window, estimated, not predictable
- **Velocity stats**: Always shows all 4 stats (DFF velocity, DFF total, FAD velocity, FAD total)
- **Methodology**: Explains optimistic uses model velocity, realistic applies 65% discount
- Spacing reduced throughout: `space-y-4` instead of `space-y-8`, `p-4` instead of `p-6`

**Tests** (updated 3 test files)
- `visa-bulletin.test.tsx` — Rewritten (22 tests):
  - Removed: 3 tests (forecast view toggle, toggling hides DFF/FAD cards, mode-based chart filtering)
  - Added: 3 tests (toggle switch renders with aria-checked, realistic badges after toggle, both cards always visible)
  - Updated: assertions for new labels (Category, Country, Your PD, sublabels, methodology text)
- `pdi-data.test.ts` — Added 2 new tests:
  - `computePdi` with velocity multiplier increases months until current
  - `extrapolateForChart` generates more points with realistic multiplier
- `pdi-components.test.tsx` — Updated 2 assertions: "Priority Date Index" → "Priority Date Cortex"

### Results
| Metric | Before (M6.1) | After (M6.2) |
|--------|--------------|--------------|
| Tests | 249 (15 files) | 250 (15 files) |
| Build | ✅ 4 pages | ✅ 4 pages |
| ForecastChart lines | 425 | 393 |
| Page lines | 758 | 737 |
| ChartMode references | 2 files | 0 files |
| Branding | Priority Date Index | Priority Date Cortex |

### Key Design Decisions
1. **Velocity multiplier, not chart filtering**: User clarified "optimistic" means data-driven velocity (17 days/mo), "realistic" means conservative (65% = ~11 days/mo). Both DFF and FAD should always be visible — they answer different questions (filing vs. approval).
2. **65% discount factor**: Based on user's observation that real-world movement is typically 65% of model-predicted velocity due to retrogression, policy shifts, and seasonal slowdowns.
3. **Switch toggle, not segmented control**: A simple on/off switch better represents the binary optimistic/realistic choice. Positioned in chart area for spatial proximity.
4. **Year labels on X-axis**: Monthly labels were too dense for 24+ month forecasts. Year labels provide clean readability.
5. **Compact config strip**: Two-row layout (category+country | priority date) uses ~120px vertical space vs ~300px in M6.1, ensuring the chart is visible without scrolling.

### Files Modified
- `src/lib/data/pdi.ts` — velocityMultiplier parameter for computePdi + extrapolateForChart
- `src/components/pdi/forecast-chart.tsx` — Complete rewrite (removed ChartMode, year labels, always both lines)
- `src/app/dashboard/visa-bulletin/page.tsx` — Complete rewrite (compact layout, velocity toggle, rebranded)
- `src/components/layout/sidebar.tsx` — Rebranded nav item
- `src/components/pdi/pdi-quick-look.tsx` — Rebranded header
- `src/__tests__/visa-bulletin.test.tsx` — Rewritten tests for new UI
- `src/__tests__/pdi-data.test.ts` — Added velocity multiplier tests
- `src/__tests__/pdi-components.test.tsx` — Updated brand name assertions
- `src/__tests__/sidebar.test.tsx` — Updated brand name assertion
- `.github/copilot-instructions.md` — Updated inventory
- `PROGRESS.md` — This entry

### Next Steps
1. Dashboard 3: EB Category Comparison
2. Dashboard 4: Geographic Heatmaps
3. User input form (/setup) for personalized panels

---

## 2026-02-26 — Milestone 6.4: Unified Priority Date Chart

### Objective
Consolidate the two separate charts (HistoricalChart + ForecastChart) into a single unified "Priority Date Movement" chart. The user requested one continuous timeline showing historical actual cutoff movement (solid lines) flowing into projected forecast (dashed lines), with the user's priority date as a horizontal reference line.

### What Was Done
1. **Created `PriorityDateChart` component** — Single unified chart replacing both `ForecastChart` and `HistoricalChart`. Shows 4 data series:
   - DFF Actual (solid blue #3b82f6) — historical DOS Visa Bulletin cutoff movement
   - FAD Actual (solid amber #f59e0b) — historical Final Action dates
   - DFF Forecast (dashed lighter blue #60a5fa) — projected advancement
   - FAD Forecast (dashed lighter amber #fbbf24) — projected advancement
   - User's Priority Date (horizontal green dashed reference line)
2. **Bridge logic** — Connects last historical data point to first forecast point so the dashed line starts exactly where the solid line ends.
3. **Data merge** — Merges historical trends, model forecasts, and extrapolated points into a single sorted `ChartPoint[]` timeline keyed by "YYYY-MM".
4. **Updated Visa Bulletin page** — Replaced two chart sections with single `<PriorityDateChart>` render. Toggle overlay only shown when forecast data exists.
5. **Deleted old components** — Removed `forecast-chart.tsx` (394 lines) and `historical-chart.tsx` (392 lines).
6. **Updated tests** — Replaced 14 HistoricalChart+ForecastChart tests with 11 PriorityDateChart tests. Updated page tests to match new text ("Priority Date Movement" instead of "Cutoff Date Forecast"/"Historical Cutoff Movement").

### Results
| Metric | Value |
|--------|-------|
| Tests | 264 passing (15 files) |
| Build | ✅ Static export succeeds (4 pages) |
| Components | 23 (removed 2, added 1 = net -1) |
| Chart height | 400px (continuous timeline ~2016–2028+) |

### Key Design Decisions
1. **Solid vs dashed** — Historical lines are solid (authoritative data), forecast lines are dashed (projections). Clear visual separation.
2. **Lighter forecast colors** — DFF forecast uses #60a5fa (vs #3b82f6 actual), FAD forecast uses #fbbf24 (vs #f59e0b actual). Visually distinguishes forecast from historical.
3. **Bridge points** — When last historical month < first forecast month, the forecast line gets a starting point at the last historical value. This creates visual continuity.
4. **connectNulls** — All Line elements use `connectNulls` so historical and forecast data series (which have null gaps) render as continuous line segments.
5. **Area fills only for historical** — Gradient area fills under the actual lines only, not forecast, to avoid visual clutter.

### Files Created/Modified
- `src/components/pdi/priority-date-chart.tsx` — **CREATED** (530 lines) — Unified chart component
- `src/components/pdi/forecast-chart.tsx` — **DELETED**
- `src/components/pdi/historical-chart.tsx` — **DELETED**
- `src/components/pdi/index.ts` — Updated barrel export
- `src/app/dashboard/visa-bulletin/page.tsx` — Replaced two chart sections with single PriorityDateChart
- `src/__tests__/visa-bulletin.test.tsx` — Updated: PriorityDateChart tests (11), page test assertions
- `PROGRESS.md` — This entry
- `.github/copilot-instructions.md` — Updated inventory

### Next Steps
1. Dashboard 3: EB Category Comparison
2. Dashboard 4: Geographic Heatmaps
3. User input form (/setup) for personalized panels

---

## 2026-02-26 — Milestone 6.5: Zero-Error Cleanup

### Objective
Eliminate all ESLint errors, warnings, and TypeScript compilation issues.

### What Was Done
- Fixed 6 ESLint errors: missing `displayName` on `forwardRef` mocks (5), `require()` → `import` (1)
- Fixed 12 ESLint warnings: unused imports and variables across test files
- Fixed 1 TypeScript error: possibly-null `containerRef.current` in NumberTicker
- Applied `React.lazy`-style state initializer pattern where applicable
- Added `useSyncExternalStore` mock with correct signature

### Results
| Metric | Value |
|--------|-------|
| Tests | 264 passing (15 files) |
| ESLint | 0 errors, 0 warnings |
| TSC | 0 errors |
| Build | ✅ Static export succeeds (4 pages) |

### Files Modified
- `src/__tests__/pdi-components.test.tsx` — displayName on framer-motion mock, removed unused imports
- `src/__tests__/srs-components.test.tsx` — displayName on forwardRef mocks, removed unused imports
- `src/__tests__/visa-bulletin.test.tsx` — displayName on forwardRef mocks, removed unused imports
- `src/__tests__/sidebar.test.tsx` — require→import, removed unused
- `src/__tests__/landing-page.test.tsx` — removed unused import
- `src/components/ui/number-ticker.tsx` — null assertion on containerRef

---

## 2026-02-26 — Milestone 6.6: Hydration Mismatch Fix

### Objective
Eliminate 5 console hydration errors caused by `useSyncExternalStore` theme approach where server rendered `theme:"dark"` but client read `"system"` from localStorage during first render.

### What Was Done
1. **Reverted ThemeProvider** — Replaced `useSyncExternalStore` with `useState("dark")` + `useEffect` post-hydration sync
2. **Blocking theme script** — Added `themeScript` export from ThemeProvider: inline `<script>` that reads localStorage and applies correct CSS class before React hydrates
3. **Injected in layout.tsx** — `<script dangerouslySetInnerHTML={{ __html: themeScript }} />` in `<head>`
4. **Removed** — `useSyncExternalStore`, `mounted` flag, `visibility:hidden` wrapper

### Key Design Decision
The blocking `<script>` pattern (used by next-themes, Tailwind docs, Vercel.com) prevents FOUC by applying the correct theme class to `<html>` before React hydration. This is the industry-standard solution for theme persistence in SSR/SSG apps.

### Results
| Metric | Value |
|--------|-------|
| Tests | 264 passing (15 files) |
| Console errors | 0 (was 5) |
| Build | ✅ Static export succeeds |

### Files Modified
- `src/components/providers/theme-provider.tsx` — Reverted to useState+useEffect, added themeScript export
- `src/app/layout.tsx` — Added blocking theme script in `<head>`

---

## 2026-02-26 — Milestone 7: Site-Wide Pages & Feedback Widget

### Objective
Add standard website sections: About Us (personal immigration story), Privacy Policy, Terms of Use, site-wide Footer, and a floating feedback/feature-request/bug-report widget.

### What Was Done

**New Pages (3)**
1. **About page** (`/about`) — Hero, personal story ("passionate engineer going through immigration journey, saw gap in data/tools"), Guiding Principles (Privacy First, Open Source, Free Forever, Community Driven), Data Sources, How It Works pipeline (P1→P2→P3), Tech Stack pills, Get Involved CTA
2. **Privacy Policy** (`/privacy`) — 6 sections emphasizing zero data collection, all-local storage, no cookies/tracking
3. **Terms of Use** (`/terms`) — 6 sections with not-legal-advice disclaimer, open source license info

**New Components (2)**
4. **Footer** (`src/components/layout/footer.tsx`) — Brand section, 3 link columns (Dashboards/Tools/Project), data source badges (DOL PERM/LCA, DOS Visa Bulletin, BLS OEWS, USCIS, DHS), copyright line with year. Data sources section moved here from landing page.
5. **FeedbackWidget** (`src/components/ui/feedback-widget.tsx`) — Floating button (bottom-right corner), modal with 3 categories (General Feedback, Feature Request, Bug Report), textarea with 2,000 char limit + counter, submit opens pre-filled GitHub Issues URL (or mailto fallback). Escape key & backdrop dismiss.

**Integration**
6. **App shell** — Footer renders after `{children}`, FeedbackWidget floats globally
7. **Sidebar** — Added "About" link under new "Project" group (13 nav items, 6 groups)
8. **Security** — Added `/about`, `/privacy`, `/terms` to `ALLOWED_EXACT_PATHS`
9. **Landing page** — Removed data-sources section (now in Footer)
10. **Barrel exports** — Updated `layout/index.ts` and `ui/index.ts`

**Tests**
11. **New test file** (`src/__tests__/site-pages.test.tsx`) — 28 tests covering Footer (7), FeedbackWidget (8), AboutPage (7), PrivacyPage (3), TermsPage (3)
12. **Updated** `landing-page.test.tsx` — Removed data-source badge test, fixed section label assertion

### Results
| Metric | Value |
|--------|-------|
| Tests | 291 passing (16 files) |
| New tests | +28 (site-pages.test.tsx), -1 updated (landing-page) |
| ESLint | 0 errors, 0 warnings |
| TSC | 0 errors |
| Build | ✅ Static export succeeds (9 pages) |
| Components | 25 (was 23, +2: Footer, FeedbackWidget) |
| Pages | 7 routes (was 3, +4: /about, /privacy, /terms, /_not-found) |

### Placeholders to Update Later
- `GITHUB_REPO_URL` in `feedback-widget.tsx` — currently `"https://github.com"`
- GitHub link in `footer.tsx` — currently `"https://github.com"`
- GitHub link in `about/page.tsx` CTA — currently `"https://github.com"`
- `CONTACT_EMAIL` in `feedback-widget.tsx` — currently `"northstar-compass@example.com"`
- Contact email in `about/page.tsx` — currently `"northstar-compass@example.com"`

### Files Created
- `src/components/layout/footer.tsx` — Site-wide footer (~170 lines)
- `src/components/ui/feedback-widget.tsx` — Floating feedback button + modal (~280 lines)
- `src/app/about/page.tsx` — About page (~310 lines)
- `src/app/privacy/page.tsx` — Privacy policy (~125 lines)
- `src/app/terms/page.tsx` — Terms of use (~125 lines)
- `src/__tests__/site-pages.test.tsx` — 28 tests (~280 lines)

### Files Modified
- `src/components/layout/app-shell.tsx` — Added Footer + FeedbackWidget
- `src/components/layout/sidebar.tsx` — Added About link in Project group
- `src/components/layout/index.ts` — Added Footer export
- `src/components/ui/index.ts` — Added FeedbackWidget export
- `src/lib/security/index.ts` — Added /about, /privacy, /terms to allowlist
- `src/app/page.tsx` — Removed data-sources section
- `src/__tests__/landing-page.test.tsx` — Updated for removed section

### Next Steps
1. Dashboard 3: EB Category Comparison
2. Dashboard 4: Geographic Heatmaps
3. User input form (/setup) for personalized panels

---

## 2026-02-27 — Milestone 8: RAG Q&A Ask Page (Phase 5 Complete)

### Objective
Build the `/ask` page — a RAG-powered Q&A search experience with 3-tier answer architecture: (1) pre-computed QA cache fuzzy match, (2) knowledge chunk retrieval, (3) LLM synthesis (mocked locally for $0 cost).

### What Was Done

**RAG Infrastructure Fixes**
- Fixed `RagChunk` TypeScript interface to match actual P2 JSON: `chunk_id`, `source_artifact`, `label`, `text`, `metadata`, `generated_at`
- Fixed `RagQaPair` TypeScript interface: `sources: string[]`, `confidence: string`
- Fixed `loadRagQaPairs()` return type from `{ pairs: RagQaPair[] }` to `RagQaPair[]`
- Fixed Fuse.js search keys in `rag-search.ts`: chunks use `label`/`text` (not `title`/`content`), QA sources mapped correctly

**LLM Service (Tier 3)**
- Created `src/lib/search/llm-service.ts` — Mock LLM service for local dev
- `buildPrompt()` constructs structured system+context+question prompt (ready for prod OpenAI proxy)
- `mockLlmAnswer()` uses high-score QA matches directly, or stitches top chunk summaries with intro/footer
- `isLlmEnabled()` returns false for mock mode; in production would check CloudFront proxy endpoint
- Simulates 800ms delay for realistic UX

**/ask Page UI**
- Created `src/app/ask/page.tsx` — 628-line page with full RAG Q&A functionality
- Search bar with 200ms debounce, glassmorphic styling, clear button
- 10 topic filter pills with icon/color metadata from `TOPIC_META` config
- 6 suggested questions shown before first search
- Result cards with type badges (Q&A vs Chunk), score %, topic tags, expand/collapse
- LLM response card with gradient styling, source attribution, mock indicator badge
- "How It Works" explainer section (3 tiers with numbered steps)
- Loading spinner and error state with retry button
- Knowledge base stats in header (chunk count, topic count, QA pair count)

**Tests (44 new tests)**
- `src/__tests__/rag-search.test.ts` — 25 tests: RagSearchEngine initialization, search, topic filtering, score ranges, result shapes, source mapping, getTopics, getByTopic
- `src/__tests__/ask-page.test.tsx` — 19 tests: loading/error states, search bar, clear, suggested questions, topic pills, result display, type badges, AI answer trigger, How It Works section, knowledge base stats

### Results
| Metric | Before | After |
|--------|--------|-------|
| Tests | 291 (16 files) | 335 (18 files) |
| Pages | 9 (7 routes) | 10 (8 routes) |
| Phase 5 | Not started | ✅ Complete |
| RAG tiers | 0 | 3 (QA cache + chunks + mock LLM) |
| Data | 23 files | 28 files |

### Files Created
- `src/lib/search/llm-service.ts` — Mock LLM service (144 lines)
- `src/app/ask/page.tsx` — Ask page with RAG Q&A (628 lines)
- `src/__tests__/rag-search.test.ts` — RAG + LLM service tests (25 tests)
- `src/__tests__/ask-page.test.tsx` — Ask page component tests (19 tests)

### Files Modified
- `src/types/p2-artifacts.ts` — Fixed RagChunk and RagQaPair interfaces
- `src/lib/data/loader.ts` — Fixed loadRagQaPairs return type
- `src/lib/search/rag-search.ts` — Fixed Fuse.js keys and source mappings

### Key Technical Decisions
| Decision | Rationale |
|----------|----------|
| Mock LLM locally | $0 cost for dev/testing; prod would use GPT-4o-mini via CloudFront proxy (~$0.0006/query) |
| QA-first search | 182 pre-computed QA pairs provide instant, high-quality answers without LLM cost |
| 200ms debounce | Balances responsiveness with search efficiency for Fuse.js |
| Topic pills from engine | `getTopics()` derives from actual data, not hardcoded — adapts to P2 updates |
| Source attribution | Every result shows source P2 artifact names for transparency |
| `waitFor` + `act` in tests | React 19 controlled inputs in happy-dom require explicit async state handling |

### Next Steps
1. Dashboard 3: EB Category Comparison
2. Dashboard 4: Geographic Heatmaps
3. User input form (/setup) for personalized panels
4. Production LLM integration (GPT-4o-mini via CloudFront Function)

---

## 2026-02-27 — Milestone 8.3: Groq Cloud LLM Backend

### Objective
Replace mock LLM with a free cloud LLM service (Groq) since local Ollama is blocked in the corporate environment. Provide a real AI-powered Q&A experience at zero cost.

### What Was Done

**LLM Service Rewrite** (`src/lib/search/llm-service.ts`)
- Added Groq as primary cloud LLM backend (Llama 3.3 70B, free tier: 30 RPM / 14,400 RPD)
- Added OpenAI as secondary cloud backend (GPT-4o-mini, reserved for production)
- Unified `openAiCompatibleChat()` function — works for both Groq and OpenAI (same API schema)
- Updated `LlmBackend` type: `"groq" | "openai" | "ollama" | "mock"`
- Detection order: Groq (env var) → OpenAI (env var) → Ollama (auto-detect) → Mock
- Groq/OpenAI API calls use Bearer token auth with `NEXT_PUBLIC_GROQ_API_KEY` / `NEXT_PUBLIC_OPENAI_API_KEY`
- Graceful fallback: if Groq call fails, tries OpenAI → Ollama → Mock in cascade

**Environment Configuration**
- Created `.env.local.example` with setup instructions for Groq API key
- API keys configured via `NEXT_PUBLIC_` env vars (baked at build time for static export)
- `.env*` already in `.gitignore` — keys stay local

**Ask Page UI Update** (`src/app/ask/page.tsx`)
- Added "Groq connected" status in How It Works section
- Updated mock mode message: "Mock mode — add API key for real AI" (was "install Ollama")
- Reordered backend status display: Groq → OpenAI → Ollama → Mock

**Tests Updated**
- Updated ask-page test LLM status regex to include "Groq connected"
- All 338 tests pass, build clean

### Results
| Metric | Value |
|--------|-------|
| Tests | 338 passing (18 files) |
| Build | ✅ Clean (10 pages) |
| LLM backends | 4 (Groq → OpenAI → Ollama → Mock) |
| Groq cost | $0 (free tier: 30 RPM, 14,400 RPD) |
| New files | `.env.local.example` |

### Files Modified
- `src/lib/search/llm-service.ts` — Rewrote with 4-backend cascade (Groq/OpenAI/Ollama/Mock)
- `src/app/ask/page.tsx` — Added Groq status, updated mock message
- `src/__tests__/ask-page.test.tsx` — Updated LLM status regex
- `.env.local.example` — Created with API key setup instructions
- `PROGRESS.md` — This entry
- `.github/copilot-instructions.md` — Updated LLM docs, RAG architecture, file inventory

### How to Enable Groq
```bash
# 1. Get a free API key at https://console.groq.com
# 2. Copy the example env file
cp .env.local.example .env.local
# 3. Add your key
echo "NEXT_PUBLIC_GROQ_API_KEY=gsk_your_key_here" >> .env.local
# 4. Restart dev server
npm run dev
```

### Next Steps
1. Get Groq API key and test real LLM answers
2. Dashboard 3: EB Category Comparison
3. Dashboard 4: Geographic Heatmaps
4. For go-live: swap to OpenAI GPT-4o-mini with CloudFront proxy (hides API key)

---

<!-- 
TEMPLATE FOR NEW MILESTONES (copy below this line):

## YYYY-MM-DD — Milestone N: Title

### Objective
What we set out to do and why.

### What Was Done
- Detailed list of changes

### Results
| Metric | Value |
|--------|-------|
| ... | ... |

### Files Created/Modified
- `path/to/file` — brief description

### Next Steps
1. ...

-->
