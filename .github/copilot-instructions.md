# Immigration Insights App — Copilot Context

> **START HERE — Cross-Project Context:**
> 
> **All NorthStar documentation is centralized in the shared repository:**
> ```
> /Users/vrathod1/dev/NorthStar/northstar-docs/
> ├── README.md                    ← Start here (program overview)
> ├── NORTHSTAR_VISION.md          ← Architecture & vision (shared)
> ├── BEST_PRACTICES.md            ← Engineering standards (shared)
> └── SETUP_GUIDE.md               ← Setup instructions
> ```
>
> **Before working on P3 Compass, read:**
> 1. **`../northstar-docs/README.md`** — Program structure and overview (5 min read)
> 2. **`../northstar-docs/NORTHSTAR_VISION.md`** — Program vision, architecture, guardrails
> 3. **`../northstar-docs/BEST_PRACTICES.md`** — Engineering conventions, design rules, testing strategy, agent checklist
> 4. **`ARCHITECTURE.md`** (this repo) — P3 technical design
> 5. **This file** — P3 detailed context
>
> **ℹ️ NOTE:** If you lose access to this machine, the vision docs are safely backed up in the northstar-docs repository on GitHub (ask the owner for access).
>
> **⚡ IMPORTANT: Terminal Commands Enabled**
> VS Code has been configured to auto-approve terminal commands. You can now:
> - Run `npm run dev`, `npm test`, `npx next build` directly (no approval needed)
> - Execute `python3` scripts, multi-line heredocs, piped commands
> - Use `git add/commit/push/pull` and process management (`pkill`, `killall`)
> - Chain commands with `&&`, `||`, and pipes without file workarounds
>
> **NorthStar Program Codenames**:
> | Internal | Codename | Repository | Role |
> |----------|----------|------------|------|
> | P1 | **Horizon** | fetch-immigration-data | Data collection — scans the horizon |
> | P2 | **Meridian** | immigration-model-builder | Analytics backbone — curates, measures, models |
> | P3 | **Compass** | immigration-insights-app (THIS REPO) | User experience — guides with insights |
>
> Use P1/P2/P3 in internal code and comments. Use Horizon/Meridian/Compass in public docs.
> **NorthStar** is the internal program name — never show it in the web app UI. The app is called **Compass**.

---

## Quick Start for This Agent (NEW SESSION)

### VS Code Configuration ✅
Your VS Code settings have been configured for AI agent workflows:
- **File operations**: Auto-approved (`chat.fileOperations.autoApprove: true`)
- **Terminal commands**: Expanded allowlist allows direct execution of:
  - Package managers: `npm run`, `npm test`, `npx`, `yarn`, `pnpm`
  - Runtimes: `node`, `python3`, `python`
  - Version control: `git add`, `git commit`, `git push`, `git pull`, `git fetch`
  - Process management: `pkill`, `killall`, `pgrep`
  - Multi-line commands: Heredocs (`python3 << 'EOF'`), piped chains (`| xargs`, `| grep`), logical operators (`&&`, `||`)
- **See**: `/Users/vrathod1/Library/Application Support/Code/User/settings.json`

**Result**: You can now run complex commands directly without file-creation workarounds.

### Switching Between Projects
When you need to work across P1/P2/P3:
```bash
# P3 (This Repo) — Current working directory
cd /Users/vrathod1/dev/NorthStar/immigration-insights-app

# P2 (Meridian) — Data & Models
cd /Users/vrathod1/dev/NorthStar/immigration-model-builder

# P1 (Horizon) — Data Collection (reference only)
cd /Users/vrathod1/dev/NorthStar/fetch-immigration-data
```

### Current Project Status (as of Mar 17, 2026)
- **P3**: ✅ **948 TESTS PASSING** (32 files), TypeScript strict, ESLint 0 errors, SRS detail card surfaces PERM/H-1B/GC signals, all 9 dashboards live with interactive tech stack, 94K+ employer shards with full wage + SRS + LCA + H1B data inline, EB category velocity 10-year rolling window, employer name normalization (ALL-CAPS→Title Case), live-data regression test suite for Optum + VB/PD pipeline, SEO (favicon, OG image, JSON-LD, canonical URLs, AI bot directives), AWS CloudFront deployed, GitHub Actions workflow stable
- **P2**: April 2026 Visa Bulletin ingested, artifacts rebuilt: category_movement_metrics (6,605 rows, 2016-04 to 2026-04), pd_forecasts (1,320 rows, 55 series × 24m), all 46 data artifacts + 341 RAG chunks export successfully
- **P1**: April 2026 Visa Bulletin fetched (169 PDFs total, 2011–2026)
- **Note**: Ask/Chat RAG feature deferred to future phases; Groq & OpenAI LLM tools removed from current scope

### Common Workflow Patterns
1. **Modify P3 code** → Run `npm test` → Run `npm run build` → Commit to git
2. **Sync new P2 data** → Run `python3 scripts/sync_p2_data.py` → Update types/loaders → Commit
3. **Check P2 artifacts** → `cd ../immigration-model-builder && python3 -c "import pandas as pd; ..."`
4. **Update documentation** → Edit `.md` files → Commit (must keep PROGRESS.md + copilot-instructions.md current)

### Recent Session Notes (Mar 17, 2026)
**Milestone 10.74 Complete**: MCRA FAD Fix + Copy Accessibility Rewrite
- **P2**: Fixed MCRA FAD "unable to estimate" — capped setback draws at 60d, added 30% velocity floor ✅
- **P3**: Re-synced `pd_forecasts_retrograde.json` — 0 negative velocities (was 9/24), FAD EB2/IND → Sep 2030 ✅
- **P3**: Rewrote "Understanding the Visa Bulletin" section for non-technical readers ✅
- **P3**: Fixed `browser-smoke-test.test.ts` for Vitest 4 API + server-guard ✅
- **Testing**: 948 tests passing (32 files), no regressions ✅
- **Deployment**: NOT pushed to AWS (per user standing instruction) ✅

**Key Metrics**:
- 12m rolling avg (current momentum) vs 10yr avg (long-run rate) both visible on cards
- Data window dynamic in P2 (always last 10 years), fixed at build in P3
- EB2 ≥ EB3 now holds correctly across all countries/charts in 10yr window

**Standing Instructions**:
- Do NOT deploy to AWS without explicit user request
- When deploying, **ALWAYS use `bash scripts/deploy.sh`** — NEVER run `aws s3 sync` directly
  - `deploy.sh` runs pre-flight checks, uses `--exact-timestamps`, and runs post-deploy smoke tests
  - Raw `aws s3 sync` without `--exact-timestamps` will skip re-uploading stale HTML, causing CSS hash mismatches that break all page styling (past incident: Mar 17, 2026)

---

## Project Overview

**Compass** is a statically-exported Next.js web app that consumes pre-computed Parquet-to-JSON artifacts from **Meridian** (P2). It provides personalized immigration insights — priority date forecasts, Sponsor Reliability Scores (SRS), salary benchmarks, and 8 interactive dashboards — with **zero runtime compute** and an AWS hosting cost of ~$1–3/month.

---

## Architecture Constraints (NON-NEGOTIABLE)

1. **Static export only** — `output: 'export'` in next.config.ts. No API routes, no server components that fetch at runtime, no middleware.
2. **Zero backend** — No Lambda, no database, no API Gateway. All data is pre-built JSON served from S3/CloudFront.
3. **AWS cost < $5/month** — S3 static hosting + CloudFront CDN + Route 53 DNS + ACM SSL. That's it.
4. **No heavy compute at runtime** — All ML models, forecasts, and aggregations are pre-computed in P2 Meridian. Compass only reads and renders.
5. **Client-side only** — All interactivity (search, filtering, personalization) runs in the browser.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, static export) | 16.x |
| Language | TypeScript (strict) | 5.x |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui (Radix UI primitives) | Latest |
| Charts | Recharts | 2.15.x |
| Maps | react-simple-maps | 3.x |
| Animations | Framer Motion | 12.x |
| Icons | Lucide React | 0.470.x |
| Search | Fuse.js (client-side fuzzy) | 7.x |
| URL State | nuqs | 2.4.x |
| Font | Geist (Sans + Mono) | System |
| Package Manager | npm | System |

---

## Key Paths

| What | Path |
|------|------|
| Project root | `/Users/vrathod1/dev/NorthStar/immigration-insights-app` |
| P2 Meridian (sibling) | `/Users/vrathod1/dev/NorthStar/immigration-model-builder` |
| P2 artifacts source | `../immigration-model-builder/artifacts/` |
| Static data (JSON) | `public/data/` |
| RAG data | `public/data/rag/` |

---

## Artifact Inventory (as of Mar 6, 2026)

- **Dimensions (6):** `dim_country`, `dim_soc`, `dim_area`, `dim_employer`, `dim_visa_ceiling`, `dim_visa_class`
- **Fact Tables (18):** `fact_perm`, `fact_lca`, `fact_oews`, `fact_cutoffs`, `fact_h1b_employer_hub`, `fact_niv_issuance`, `fact_visa_issuance`, `fact_visa_applications`, `fact_perm_unique_case`, `fact_perm_all`, `fact_cutoffs_all`, `fact_uscis_approvals`, `fact_dhs_admissions`, `fact_waiting_list`, `fact_warn_events`, `fact_bls_ces`, `fact_processing_times`, `fact_trac_adjudications`
- **Feature/Metric Tables (14):** `employer_features`, `employer_monthly_metrics`, `salary_benchmarks`, `visa_demand_metrics`, `worksite_geo_metrics`, `backlog_estimates`, `category_movement_metrics`, `fact_cutoff_trends`, `soc_demand_metrics`, `queue_depth_estimates`, `processing_times_trends`, `employer_risk_features`, `employer_salary_profiles`, `employer_salary_yearly`, `soc_salary_market`
- **Model Outputs (3):** `employer_friendliness_scores`, `employer_friendliness_scores_ml`, `pd_forecasts`
- **P3-Derived Exports (1):** `employer_role_trends` (multi-year p10–p90 percentile data per employer×SOC×year, 26,989 rows)
- **RAG/QA Artifacts (4):** `catalog.json`, `all_chunks.json`, `qa_cache.json`, `build_summary.json`
- **Stubs (4):** `employer_scores.parquet`, `oews_wages.parquet`, `visa_bulletin.parquet`, `fact_acs_wages.parquet`, `fact_processing_times.parquet`, `fact_trac_adjudications.parquet`

### RAG/QA Scale
- **Chunks:** 341 (across 10 topics)
- **QA pairs:** 719 (pre-computed, topic-tagged)
- **Catalog:** 49 artifacts

### How to Sync New Artifacts
```bash
# Sync all new P2 artifacts to P3 (run before build)
python3 scripts/sync_p2_data.py
# Then build static export
npm run build
```

All new tables and RAG/QA artifacts will appear in `public/data/` for static use in P3.
| App pages | `src/app/` |
| Components | `src/components/` |
| Data loaders | `src/lib/data/` |
| Type definitions | `src/types/` |
| Utilities | `src/lib/utils/` |
| Design tokens | `src/app/globals.css` |
| Data sync script | `scripts/sync_p2_data.py` |

---

## P2 → P3 Data Pipeline

### How data flows
```
P2 Meridian (artifacts/)
  │
  ├── tables/*.parquet          ← 41 Parquet files (17.4M+ rows)
  ├── models/*.json             ← Model weights
  └── rag/                      ← Pre-computed RAG chunks + QA
      ├── all_chunks.json       ← 98 text chunks
      ├── qa_cache.json         ← 178 Q&A pairs
      └── catalog.json          ← Artifact registry
          │
          ▼
  scripts/sync_p2_data.py       ← Converts Parquet → optimized JSON slices
          │
          ▼
  public/data/                  ← Static JSON (bundled into S3 deploy)
  ├── dashboards/               ← One JSON per dashboard
  ├── dims/                     ← Dimension lookups
  ├── models/                   ← Model outputs (forecasts, scores)
  └── rag/                      ← RAG chunks + QA cache
```

### Running the sync
```bash
# Sync P2 artifacts → public/data/ (run before build)
python3 scripts/sync_p2_data.py

# Then build
npm run build    # Outputs to out/ (static HTML/CSS/JS)
```

---

## Design System — "Aurora"

### Aesthetic
**Linear / Vercel / Raycast-inspired** — dark-first, glassmorphism, fluid micro-interactions, bold typography. Award-winning modern sleek UI.

### Color Tokens (CSS variables in globals.css)
```
--background:      Dark: #09090b    Light: #fafafa
--foreground:      Dark: #fafafa    Light: #09090b
--card:            Dark: rgba(255,255,255,0.03)
--accent-blue:     #3b82f6
--accent-purple:   #8b5cf6
--accent-emerald:  #10b981
--accent-amber:    #f59e0b
--accent-rose:     #f43f5e
--gradient-primary: linear-gradient(135deg, #3b82f6, #8b5cf6)
```

### Signature Patterns
- **Glassmorphic cards**: `backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl`
- **Gradient text**: `bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent`
- **Number tickers**: Animated count-up on stat cards (Framer Motion)
- **Staggered reveals**: Dashboard cards animate in sequence on page load
- **Chart glow**: Subtle glow effect on chart hover states
- **Typography**: Geist Sans for UI, Geist Mono for data/numbers
- **Generous whitespace**: Let the data breathe

### Component Conventions
- All components in `src/components/` use `"use client"` only when needed (event handlers, state, effects)
- Naming: PascalCase files matching component name (`StatCard.tsx`, `ChartContainer.tsx`)
- shadcn/ui primitives in `src/components/ui/` — do not modify these directly
- Custom components wrap shadcn/ui with Aurora design tokens
- All charts wrapped in `<ChartContainer>` with consistent theming

---

## Page Structure

```
/                           → Landing page (hero + key stats)
/about                      → About page (personal story, principles, tech stack)
/privacy                    → Privacy Policy (zero data collection)
/terms                      → Terms of Use
/insights                   → My Insights — 7-field profile card + 3 smart panels (Green Card Forecast, Sponsor, Salary)
/dashboard/visa-bulletin     → Dashboard 1: Visa Bulletin Trends
/dashboard/employer          → Dashboard 2: Sponsor Reliability Score (SRS)
/dashboard/eb-category       → Dashboard 3: EB Category Comparison
/dashboard/geographic        → Dashboard 4: Geographic Heatmaps
/dashboard/wage              → Dashboard 5: Wage Competitiveness
/dashboard/soc-demand        → Dashboard 6: SOC Demand
/dashboard/processing        → Dashboard 7: Processing Speed
/dashboard/backlog           → Dashboard 8: Backlog Visualization
/ops                         → QA center (artifact inventory, test results)

**Future Routes (Phase 5, when Ask/Chat is implemented):**
- `/ask` → RAG-powered Q&A search (deferred to future phase)
```

---

## Dashboard → P2 Artifact Mapping

| Dashboard | P2 Artifacts Consumed |
|-----------|----------------------|
| 1. Visa Bulletin Trends | fact_cutoff_trends, pd_forecasts, fact_cutoffs_all |
| 2. Sponsor Reliability Score | employer_friendliness_scores (remapped efs→srs), employer_friendliness_scores_ml, employer_monthly_metrics, employer_risk_features |
| 3. EB Category Comparison | category_movement_metrics |
| 4. Geographic Heatmaps | worksite_geo_metrics |
| 5. Wage Competitiveness | salary_benchmarks, fact_oews |
| 6. SOC Demand | soc_demand_metrics |
| 7. Processing Speed | processing_times_trends, fact_uscis_approvals |
| 8. Backlog Visualization | backlog_estimates, queue_depth_estimates, dim_visa_ceiling |

---

## Personalized Panels → P2 Artifact Mapping

| Panel | User Input Used | P2 Artifacts |
|-------|----------------|--------------|
| A. Green Card Forecast | priority_date, country, category | pd_forecasts, fact_cutoff_trends |
| B. Employer Insights | employer_name | employer_friendliness_scores (remapped efs→srs), employer_risk_features, employer_monthly_metrics |
| C. Job Market Insights | job_title, location, soc | worksite_geo_metrics, soc_demand_metrics, salary_benchmarks |
| D. Recommendations | All inputs | Composite logic from A–C |
| E. Visual Dashboards | All inputs | Personalized chart mosaic |

---

## User Input Schema (localStorage)

```typescript
interface UserProfile {
  priorityDate: string;          // ISO date: "2020-03-15"
  countryOfChargeability: string; // ISO-3166: "IND", "CHN", "ROW"
  category: string;              // "EB2", "EB3", etc.
  employerName: string;          // Free text, fuzzy-matched to dim_employer
  jobTitle: string;              // Free text
  location: string;              // "San Francisco, CA"
  wageOffered: number;           // Annual USD
  yearsOfExperience: number;     // Integer
}
```

---

## RAG Q&A Architecture (Future Reference — Phase 5)

**Status**: This section describes the planned architecture for Ask/Chat feature, deferred to a future phase.

| Layer | Implementation |
|-------|---------------|
| Pre-computed answers | `qa_cache.json` — 719 pairs, exact/fuzzy match first |
| Chunk retrieval | `all_chunks.json` — 341 chunks, filtered by topic via Fuse.js |
| Topics | pd_forecast, employer, salary, visa_bulletin, geographic, occupation, processing, visa_demand, filings, general |
| LLM (Future) | Groq (free cloud, Llama 3.3 70B) for dev; OpenAI GPT-4o-mini reserved for prod; Ollama local; Mock fallback |

---

## AWS Deployment

```
S3 Bucket (static site)  ←  out/ directory from `next build`
    │
    ▼
CloudFront (CDN)         ←  Edge caching, HTTPS, gzip
    │
    ▼
Route 53 (DNS)           ←  Custom domain (optional)
    │
    ▼
ACM (SSL cert)           ←  Free HTTPS certificate
```

**Estimated cost: ~$0.52–3.00/month** (S3 $0.02 + CloudFront free tier + Route53 $0.50)

### Deploy commands
```bash
# Full deploy (build + sync + invalidate + smoke test)
bash scripts/deploy.sh

# Deploy without rebuilding (use existing out/)
bash scripts/deploy.sh --skip-build

# Only sync employer shards (no rebuild)
bash scripts/deploy.sh --shards-only
```

> ⚠️ **NEVER run `aws s3 sync` directly.** The deploy script uses `--exact-timestamps` to prevent stale HTML from being served with mismatched CSS/JS bundle hashes. It also runs pre-flight checks and post-deploy smoke tests automatically.

---

## Development Commands

```bash
npm run dev          # Local dev server (http://localhost:3000)
npm run build        # Static export to out/
npm run lint         # ESLint
npm run sync-data    # Sync P2 → public/data/ (calls scripts/sync_p2_data.py)
npm test             # Run all 940+ tests (Vitest)
npm test -- pdi      # Run PDI tests only
npm test -- browser-smoke-test  # Run browser smoke tests (Vitest + HTTP)
bash scripts/browser-smoke-test.sh  # Run simple curl-based smoke test (alternative)
```

---

## Coding Conventions

1. **TypeScript strict mode** — no `any`, no type assertions unless documented
2. **Server components by default** — add `"use client"` only for interactivity
3. **Co-locate data loaders** — `src/lib/data/[topic].ts` per dashboard
4. **Tailwind only** — no CSS modules, no styled-components
5. **Framer Motion for all animations** — consistent easing: `ease: [0.25, 0.1, 0.25, 1]`
6. **Number formatting** — use `Intl.NumberFormat` with commas for all counts
7. **Dates** — display as "Month YYYY" in UI, ISO-8601 in data
8. **Accessibility** — all interactive elements have aria labels, keyboard navigation, WCAG 2.1 AA

---

## Smart Visibility Principle (MANDATORY)

**Never render a widget whose only possible output is a "please provide input" message.** If a component requires user input to be meaningful, hide it entirely until that input exists and replace it with a single, clear call-to-action instead.

### Rules

| Widget type | Visibility rule |
|-------------|----------------|
| **Input-gated results** (predictions, personal forecasts, scores for a specific selection) | Hidden until required input is present. Show a tasteful CTA placeholder. |
| **Always-useful context** (aggregate stats, historical charts, search boxes, overview bars) | Always visible — they provide value independently of user input. |
| **State-dependent details** (score gauges, trend charts, detail cards for a selected entity) | Rendered only after the relevant entity is selected. Show a rich empty state below the search/select control. |

### Implementation pattern

```tsx
{/* BAD — widget that shows "enter your data above" */}
{hasData && <PredictionCard hasPriorityDate={!!pd} ... />}

{/* GOOD — hide the widget; show CTA; reveal on input */}
{hasData && !pd && (
  <div className="... rounded-2xl border border-dashed border-blue-500/[0.15] py-8 text-center">
    <Target className="h-5 w-5 text-blue-400/70" />
    <p>Enter your priority date to see predictions</p>
  </div>
)}
{hasData && !!pd && <PredictionCard ... />}
```

### Applied so far

| Page | Widget | Trigger |
|------|--------|---------|
| `/dashboard/visa-bulletin` | DFF + FAD Prediction Cards | Hidden until priority date is entered; animated reveal on input |
| `/dashboard/employer` | Score gauge, detail card, trend chart | Hidden until employer is selected; rich empty state with icon guides next action |

---

## Important P2 Context (from Meridian)

### Data Scale
- **46+ artifact tables** — 18.5M+ total rows
- **6 dimensions**: employer (243K), SOC (1,801), country (249), area (587), visa_class (6), visa_ceiling (14)
- **15 fact tables**: PERM (1.7M), LCA (9.6M), OEWS (446K), cutoffs (14K), visa issuances, DHS admissions...
- **12 feature tables**: employer_features, salary_benchmarks, worksite_geo_metrics, soc_demand_metrics...
- **3 model outputs**: pd_forecasts (56 series × 24 months), SRS rules (70K), SRS ML (1,695)
- **RAG**: 98 chunks across 10 topics, 178 pre-computed QA pairs

### Stub Tables (0 rows — expected)
- `fact_trac_adjudications` — TRAC requires paid subscription
- `fact_acs_wages` — Census API HTTP 404 (available ~Sep 2026)
- `fact_processing_times` — USCIS SPA, no P1 source

### Stale Data
- `fact_h1b_employer_hub` — USCIS discontinued after FY2023. Historical only.

---

## Execution Plan (Phases)

### Phase 0: Bootstrap ✅ (Milestone 1 — 2026-02-25)
- [x] Next.js 16 + TypeScript + Tailwind + App Router + static export
- [x] All dependencies installed
- [x] Project structure created
- [x] Design tokens configured
- [x] README + copilot-instructions

### Phase 1: Data Bridge ✅ (Milestone 2 — 2026-02-25)
- [x] `scripts/sync_p2_data.py` — Parquet → JSON converter (23 files synced)
- [x] `public/data/_manifest.json` — Sync manifest with timestamps
- [x] TypeScript types from P2 schemas (`src/types/p2-artifacts.ts`)
- [x] Data loader utilities (`src/lib/data/loader.ts`)
- [x] RAG search utility (`src/lib/search/rag-search.ts`)

### Phase 2: App Shell & Landing ✅ (Milestone 2–10.13 — 2026-02-25 → 2026-03-02)
- [x] Sidebar navigation with glassmorphic styling
- [x] Landing page with animated stat cards (hero + key metrics + dashboard grid)
- [x] Theme toggle (dark/light/system — 3-way toggle)
- [x] Security module (XSS, proto pollution, CSP, URL sanitization)
- [x] Test infrastructure (Vitest 4.x + RTL + happy-dom, 472 tests)
- [x] UI component library (GlassCard, NumberTicker, StatCard, animations)
- [x] Responsive layout (mobile hamburger + collapsible sidebar)
- [x] My Insights page (/insights — 7-field profile card, 3 smart panels, localStorage persistence, responsive chart scaling, proper layout spacing)

### Phase 3: 9 Dashboards ✅
- [x] 1. Visa Bulletin Trends (PDI)
- [x] 2. Sponsor Reliability Score (SRS)
- [x] 3. EB Category Comparison
- [x] 4. Geographic Heatmaps
- [x] 5. Wage Competitiveness
- [x] 6. SOC Demand
- [x] 7. Processing Speed
- [x] 8. Backlog Visualization

### Phase 4: Personalized Panels
- [x] My Insights page (`/insights`) — profile form + 3 smart panels (Green Card, Sponsor, Salary)
- [ ] A. Green Card Forecast (full standalone panel)
- [ ] B. Employer Insights
- [ ] C. Job Market Insights
- [ ] D. Actionable Recommendations
- [ ] E. Visual Dashboard Mosaic

### Phase 5: RAG Q&A ⏳ (Deferred to Future)
- **Status**: Deferred — Ask/Chat feature not part of current MVP
- **Reason**: Requires LLM integration (Groq, OpenAI) adding complexity without core value
- **Data Ready**: P2 Meridian exports 341 RAG chunks + 719 QA pairs for future implementation
- **Note**: When/if implemented in future, will follow: QA cache → chunk retrieval → LLM synthesis

### Phase 6: Deploy ✅
- [x] S3 + CloudFront + Route53 Terraform/CDK (Milestone 10.48)
- [x] GitHub Actions CI/CD (Milestone 10.61 — 628 tests, 0 lint errors, TypeScript strict)
- [ ] Data freshness banner

---

## Testing Strategy

- **Framework**: Vitest 4.x + React Testing Library + happy-dom
- **Coverage**: Every component, utility, and data loader must have tests
- **Test location**: `src/__tests__/` — colocated by feature
- **Config**: `vitest.config.mts` (ESM required for Vite 7+)
- **Run**: `npm test` (single run), `npm run test:watch` (dev), `npm run test:coverage`
- **Setup**: `src/__tests__/setup.ts` — mocks for matchMedia, IntersectionObserver, localStorage
- **Mocking**: Mock `framer-motion` for component tests, mock `next/navigation` and `next/link` for routing
- **Isolation**: localStorage is cleared between tests via `beforeEach`
- **Current count**: 929 tests across 31 files (all passing)

---

## Security Principles

1. **Input sanitization** — All user input validated and sanitized before use (`src/lib/security/index.ts`)
2. **XSS prevention** — `escapeHtml()`, `stripHtml()`, `sanitizeTextInput()` for all user-facing text
3. **Prototype pollution defense** — `secureSet()` blocks `__proto__` and `constructor` in serialized data
4. **Route allowlisting** — `isAllowedPath()` prevents open redirect attacks
5. **URL sanitization** — `sanitizeUrl()` blocks `javascript:`, `data:`, `vbscript:` protocols
6. **Secure storage** — All localStorage access through `secureGet/Set/Remove/ClearAll` with `compass_` prefix
7. **CSP headers** — Content-Security-Policy configured for CloudFront deployment (`src/lib/security/headers.ts`)
8. **No secrets in client** — Zero API keys, tokens, or credentials in the codebase

---

## Design Editorial — "Apple Quality Standard"

### Visual Bar
Every pixel must justify its existence. The UI should feel like it was crafted by Apple's design team — precise, intentional, and delightful. Zero clutter, zero noise.

### Key Principles
- **Clarity over cleverness** — Data should be immediately comprehensible
- **Generous whitespace** — Let content breathe; never crowd
- **Purposeful animation** — Every motion communicates state change, never decorative
- **Dark-first luxury** — The dark theme is the primary experience; it should feel premium
- **Glass and depth** — Glassmorphic layers create visual hierarchy without heavy borders
- **Typography hierarchy** — Geist Sans for UI text, Geist Mono for data/numbers; clear size steps
- **Color restraint** — Use accent colors sparingly and meaningfully; gradient text for headlines only

### Animation Standards
- Easing: `[0.25, 0.1, 0.25, 1]` (cubic bezier) for all transitions
- Stagger: 50ms between sequential card reveals
- Duration: 200ms for micro-interactions, 400ms for page transitions
- Number tickers: Spring animation for stat counters on viewport entry
- Never block interaction for animation completion

---

### Current File Inventory (as of Milestone 10.73)

### Source Files (75+ files)

**App Pages**
| File | Purpose |
|------|------|
| `src/app/layout.tsx` | Root layout — Geist fonts, ThemeProvider + AppShell wrapper, blocking theme script in `<head>`, suppressHydrationWarning |
| `src/app/page.tsx` | Landing page — hero, stats, 9 dashboards (neutral catalog), value props |
| `src/app/globals.css` | Aurora design tokens — CSS custom properties for dark/light, gradients, glassmorphic effects |
| `src/app/about/page.tsx` | About page — personal story, guiding principles, data sources, pipeline, tech stack, CTA |
| `src/app/privacy/page.tsx` | Privacy Policy — zero data collection, local storage only, no cookies/tracking |
| `src/app/terms/page.tsx` | Terms of Use — not legal advice, data accuracy, open source license |
| `src/app/dashboard/employer/page.tsx` | SRS Dashboard — employer search, score gauge, detail card, trend chart, methodology |
| `src/app/dashboard/visa-bulletin/page.tsx` | PDI Dashboard — reactive category/country/PD selectors, DFF vs FAD chart, prediction cards, velocity stats, methodology |
| `src/app/dashboard/wage/page.tsx` | Wage Intelligence Hub — dual-mode search (employer default / role), EmployerProfile drill-down, WageGrowthLeaderboard, SOC stat cards + benchmark tabs |
| `src/app/dashboard/eb-category/page.tsx` | EB Category Comparison — country pills, DFF/FAD toggle, EB1/EB2/EB3 summary cards, velocity AreaChart, volatility BarChart |
| `src/app/dashboard/geographic/page.tsx` | Geographic Heatmaps — dataset selector, sort-by metric, KPI cards, top 15 states BarChart, sortable data table |
| `src/app/dashboard/job-demand/page.tsx` | Occupation Demand — window/source pills, top 15 occupations BarChart, major group summary, searchable detail table |
| `src/app/dashboard/processing/page.tsx` | Processing Speed — KPI cards, ComposedChart (EB pending + approval rate), throughput BarChart, USCIS forms table |
| `src/app/dashboard/backlog/page.tsx` | Backlog Visualization — country/chart selectors, summary cards, AreaChart timeline, queue position lookup |
| `src/app/ask/page.tsx` | Ask page — RAG-powered Q&A with 3-tier search (QA cache + chunks + cloud LLM via Groq), topic filter pills, suggested questions, AI answer button, result cards with expand/collapse |
| `src/app/insights/page.tsx` | My Insights page — 7-field collapsible profile card, 3 smart panels (Green Card Forecast, Sponsor, Salary), localStorage persistence via secureGet/secureSet |

**Components — Layout**
| File | Purpose |
|------|------|
| `src/components/layout/sidebar.tsx` | Full sidebar nav — 13 items in 6 groups (Main/Insights/Dashboards/Tools/Project/Personal), Insights group promotes PDI + SRS, collapse (240→60px), mobile hamburger + overlay, keyboard escape, aria-current |
| `src/components/layout/app-shell.tsx` | Root shell — Sidebar + scrollable main with `lg:ml-[240px]`, `max-w-7xl`, Footer after content, FeedbackWidget floating |
| `src/components/layout/footer.tsx` | Site-wide footer — brand, 3 link columns (Dashboards/Tools/Project), data source badges, copyright |
| `src/components/layout/index.ts` | Barrel export |

**Components — UI**
| File | Purpose |
|------|------|
| `src/components/ui/glass-card.tsx` | Glassmorphic card — variants: default/elevated/interactive/accent, padding: none/sm/md/lg, Framer Motion fade-in, optional glow |
| `src/components/ui/number-ticker.tsx` | Animated counter — useSpring + IntersectionObserver viewport trigger, configurable format/prefix/suffix |
| `src/components/ui/stat-card.tsx` | Stat display — NumberTicker + TrendBadge (up/down/neutral), LucideIcon prop |
| `src/components/ui/animations.tsx` | StaggerContainer, StaggerItem, FadeIn (up/down/left/right), ScaleIn, GlowPulse |
| `src/components/ui/theme-toggle.tsx` | 3-way toggle — Sun/Moon/Monitor icons, role="radiogroup", aria-checked |
| `src/components/ui/feedback-widget.tsx` | Unified FAB (Floating Action Button) — Plus/X rotating trigger, mini-menu with 2 items (Ask NorthStar link + Send Feedback button), glassmorphic feedback dialog with 3 categories (feedback/feature/bug), textarea with char limit, GitHub Issues integration; auto-hides Ask item on /ask page; route-change detection closes menu |
| `src/components/ui/contact-modal.tsx` | ContactModal — Framer Motion dialog with Name/Email/Subject/Message fields; Formspree submission → email to v.s.rathod@gmail.com; fallback to mailto: if NEXT_PUBLIC_FORMSPREE_ID not set; success/error states; ContactButton self-contained trigger for use in server components |
| `src/components/ui/index.ts` | Barrel export |

**Components — SRS (Sponsor Reliability Score)**
| File | Purpose |
|------|------|
| `src/components/srs/employer-search.tsx` | Fuzzy search autocomplete — Fuse.js, 150ms debounce, keyboard nav, ARIA combobox, glassmorphic dropdown |
| `src/components/srs/score-gauge.tsx` | Animated SVG arc gauge — 270° arc, Framer Motion spring, subscore breakdown bars, ML badge |
| `src/components/srs/employer-detail-card.tsx` | Key metrics grid — approval/denial rates, cases, wage ratio, SOC/site breadth |
| `src/components/srs/trend-chart.tsx` | Recharts AreaChart — monthly filings/approvals/denials with gradient fills, custom tooltip |
| `src/components/srs/srs-overview.tsx` | Aggregate stats bar — total/rated employer counts, avg score, tier distribution stacked bar |
| `src/components/srs/index.ts` | Barrel export |

**Components — PDI (Priority Date Index)**
| File | Purpose |
|------|------|
| `src/components/pdi/pdi-quick-look.tsx` | Interactive PDC widget — category/country/chart selectors, SVG sparkline, velocity stats, loads pd_forecasts.json (342KB). Currently unused; reserved for Visa Bulletin dashboard. |
| `src/components/pdi/srs-teaser.tsx` | Static SRS teaser card — hardcoded stats (70K employers), decorative gauge, feature checklist, search placeholder. Currently unused; reserved for future use. |
| `src/components/pdi/priority-date-chart.tsx` | Unified PriorityDateChart — single continuous timeline: historical DFF/FAD (solid lines) + forecast DFF/FAD (dashed lines) + PD reference (green); bridge logic connects last actual point to first forecast; 530 lines |
| `src/components/pdi/index.ts` | Barrel export |

**Components — Wage Intelligence**
| File | Purpose |
|------|------|
| `src/components/wage/WageIntelligenceHub.tsx` | Main orchestrator — dual-mode search (`employer` default / `role`), two Fuse.js indices, EmptyStateEmployer (Top H-1B quick picks) + EmptyStateRole (popular SOC quick picks), mode-exclusive selection (selectedEmployer XOR selectedSoc), loads `employer_role_profiles.json` (employer-centric 485 employers × top-25 roles) and `employer_role_trends.json` (multi-year percentile data), passes both as props to EmployerProfile |
| `src/components/wage/EmployerProfile.tsx` | Employer deep-dive — 4-up growth badges (CAGR, YoY, streak, total filings), AreaChart (FY trend), top roles table with search + clickable drill-down; accepts `roleTrends?: EmployerRoleTrend[]` for inline percentile charts; shows expand chevrons when trend data available |
| `src/components/wage/RolePercentileTrend.tsx` | 5-year salary distribution chart — stacked area bands (p10/p25/median/p75/p90), OEWS reference line, TrendSummary badges (median growth, salary range, filings), rich tooltip with all percentiles |
| `src/components/wage/WageGrowthLeaderboard.tsx` | "Rising Stars" leaderboard — ranks employers by 5-yr CAGR; currently hidden from render but kept in codebase for future use |

**Components — About**
| File | Purpose |
|------|------|
| `src/components/about/tech-stack-chip.tsx` | Interactive tech stack chip — Framer Motion hover tooltip revealing 3-4 line explanation of why/where a tech tool is used; responsive tooltip with arrow; accessible aria-labels and keyboard navigation; shows Info icon on hover |

**Components — Providers**
| File | Purpose |
|------|------|
| `src/components/providers/theme-provider.tsx` | ThemeProvider — light/dark/system, localStorage persistence (key: compass_theme), system preference listener, blocking themeScript for `<head>` to prevent FOUC |
| `src/components/providers/posthog-provider.tsx` | PostHogProvider — initialises posthog-js once, enables session recording (text masked), tracks `$pageview` on every route change via `usePathname`. Wraps the whole app in root layout. |

**Libraries**
| File | Purpose |
|------|------|
| `src/lib/data/loader.ts` | Generic JSON fetcher — loadDashboardData, loadDimensionData, loadModelData, loadRAGData |
| `src/lib/data/srs.ts` | SRS data loaders — field remapping (efs→srs), filterOverallScores, filterRatedEmployers, mergeMLScores, getEmployerMetrics, getEmployerRisk, computeSrsStats |
| `src/lib/data/pdi.ts` | PDI + MCRA data loaders — loadPdForecasts, loadPdForecastsRetrograde (NEW), getForecastSeries, getRetrogradeSeries (NEW), computePdi, getVelocitySummary, getRetrogradeRiskSummary (NEW), constants (charts/categories/countries/labels) |
| `src/lib/data/wage.ts` | Wage data loaders + helpers — loadWageData, getSocBenchmarks, getEmployerRankings, getEmployerTrends, getEmployerList, computeEmployerGrowth, getTopWageGrowers, getEmployerRoles, annotateWithYoy |
| `src/lib/data/eb-category.ts` | EB Category data loader — loadCategoryMovement, filterMovementSeries, buildCategorySummary, getAvailableCountries, COUNTRY_LABELS, EB_CATEGORIES |
| `src/lib/data/geographic.ts` | Geographic data loader — loadGeoMetrics, getStateAggregates, getTopStates, getNationalSummary, STATE_NAMES (50+ states) |
| `src/lib/data/soc-demand.ts` | SOC Demand data loader — loadSocDemand, loadDimSoc, enrichWithTitles, filterDemand, getTopOccupations, getMajorGroupSummary |
| `src/lib/data/processing.ts` | Processing Speed data loader — loadProcessingTrends, loadUscisApprovals, computeProcessingKpis, aggregateByForm |
| `src/lib/data/backlog.ts` | Backlog data loader — loadBacklogEstimates, loadQueueDepth, filterBacklog, buildBacklogSummary, getQueuePosition |
| `src/lib/search/rag-search.ts` | RAG search engine — Fuse.js over 100 chunks + 182 QA pairs, topic filtering, getTopics, getByTopic |
| `src/lib/search/llm-service.ts` | LLM service — 4 backends: Groq (free cloud, Llama 3.3 70B), OpenAI (prod, reserved), Ollama (local), Mock (fallback); env-var config via NEXT_PUBLIC_GROQ_API_KEY / NEXT_PUBLIC_OPENAI_API_KEY; OpenAI-compatible chat API; off-topic redirect; cached detection; exports getLlmAnswer, detectLlmBackend, getLlmBackend, isLlmEnabled |
| `src/lib/security/index.ts` | Security module (299 lines) — escapeHtml, stripHtml, sanitizeTextInput, validateDate/CountryCode/Category/Number, secureGet/Set/Remove/ClearAll, isAllowedPath, sanitizeUrl, generateNonce |
| `src/lib/security/headers.ts` | Security headers for CloudFront — CSP, HSTS, X-Frame-Options, Permissions-Policy |
| `src/lib/analytics/index.ts` | PostHog analytics helpers — 21 typed event functions (`dashboardViewed`, `filterChanged`, `employerSelected`, `ragQuestionAsked`, `navItemClicked`, `contactSubmitted`, etc.). All tracking goes through `analytics.*`. Never call posthog.capture() directly. |
| `src/lib/utils/cn.ts` | Tailwind class merger (clsx + tailwind-merge) |
| `src/lib/utils/format.ts` | Number/date/currency formatting — formatNumber, formatCurrency, formatPercent, formatCompact, formatMonthYear, formatFullDate (UTC), formatWaitTime, srsTierColor/Bg/Hex, srsScoreToTier |
| `src/lib/utils/index.ts` | Barrel export |
| `src/types/p2-artifacts.ts` | TypeScript interfaces for all P2 artifact schemas |

**Tests (32 files, 948 tests)**
| File | Tests | Covers |
|------|-------|--------|
| `src/__tests__/setup.ts` | — | Global mocks: matchMedia, IntersectionObserver, localStorage (cleared via beforeEach) |
| `src/__tests__/cn.test.ts` | 6 | cn() utility |
| `src/__tests__/format.test.ts` | 33 | All format functions + srsTierColor/Bg/Hex, srsScoreToTier |
| `src/__tests__/security.test.ts` | 48 | XSS, validation, localStorage, URL safety, nonce |
| `src/__tests__/security-headers.test.ts` | 11 | Header values |
| `src/__tests__/loader.test.ts` | 12 | Data loaders with mocked fetch |
| `src/__tests__/theme-provider.test.tsx` | 6 | Theme state, toggle, persistence |
| `src/__tests__/theme-toggle.test.tsx` | 4 | Accessibility, aria attributes |
| `src/__tests__/glass-card.test.tsx` | 6 | Variants, glow, children |
| `src/__tests__/sidebar.test.tsx` | 8 | Nav items, Insights group (PDI+SRS), active state, mobile |
| `src/__tests__/landing-page.test.tsx` | 10 | Hero, stats, 9 dashboards (neutral catalog) |
| `src/__tests__/srs-data.test.ts` | 18 | SRS data helpers + efs→srs remapping |
| `src/__tests__/srs-components.test.tsx` | 21 | SRS components (search, gauge, detail, chart, overview) |
| `src/__tests__/pdi-data.test.ts` | 28 + 8 MCRA** | PDI constants, getForecastSeries, computePdi, getVelocitySummary, **getRetrogradeSeries, getRetrogradeRiskSummary** |
| `src/__tests__/pdi-components.test.tsx` | 19 | PdiQuickLook (11 tests), SrsTeaser (8 tests) |
| `src/__tests__/visa-bulletin.test.tsx` | 33 + 3 MCRA** | PriorityDateChart (14, incl. 3-way mode selector), VisaBulletinPage |
| `src/__tests__/site-pages.test.tsx` | 42 | Footer (8 incl. Contact button), ContactModal (7), ContactButton (2), FeedbackWidget (11), AboutPage (7), PrivacyPage (3), TermsPage (3) |
| `src/__tests__/rag-search.test.ts` | 25 | RagSearchEngine (init, search, topic filter, getTopics, getByTopic, source mapping), LLM service (mock answers, QA priority, dedup) |
| `src/__tests__/ask-page.test.tsx` | 19 | AskPage loading/error, search bar, clear, suggested questions, topic pills, results, type badges, AI answer, How It Works, stats |
| `src/__tests__/wage-dashboard.test.tsx` | 52 | WageIntelligenceHub: employer/role modes, EmployerProfile (loading skeleton, auto-collapse), WageGrowthLeaderboard, data loaders, getEmployerRoles (multi-year dedup, IMO pattern, Optum ≥10 baseline, minFilings=1 default) |
| `src/__tests__/employer-normalization.test.ts` | 23 | Data integrity tests for canonical employer names in public JSON files; JSON spec compliance (no bare NaN); 200-shard sample test |
| `src/__tests__/insights-page.test.tsx` | 27 | InsightsPage: profile card, field interactions, persistence, Green Card/Sponsor/Salary panels, loading state |
| `src/__tests__/dashboard-data-loaders.test.ts` | 47 | All 5 new data loaders: eb-category (10), geographic (6), soc-demand (11), processing (8), backlog (12) |
| `src/__tests__/new-dashboards.test.tsx` | 34 | All 5 new dashboard pages: EB Category (8), Geographic (6), Occupation Demand (6), Processing (5), Backlog (9) |
| `src/__tests__/tech-stack-chip.test.tsx` | 7 | TechStackChip component: render, hover tooltip reveal, unhover hide, accessibility, explanation display |
| `src/__tests__/optum-regression.test.ts` | 18 | **NEW** — Optum Services live-data regression: baseline count ≥1,928 LCA records, name normalization, metadata integrity, field validation, no 10%+ data shrinkage |
| `src/__tests__/smart-sort.test.ts` | 27 | Smart-sort regression: all 4 sort functions (employer, SOC, wage-employer, RAG), name-match ranking, volume/SRS tiebreakers, non-alphabetical guarantees, null/NaN handling |
| `src/__tests__/srs-comprehensive.test.tsx` | 97 | **Comprehensive SRS feature suite**: search rendering (5), accessibility (7), search behavior (6), result layout fields (8), clear (4), selection (3), keyboard nav (7), Optum regression (3), smart-sort edge cases (7), score gauge (8), detail card (13), trend chart (5), overview (4), shard extractors (6), asScores mapping (6), wage/SOC sort extras (4) |
| `src/__tests__/visa-bulletin-regression.test.ts` | 62 | **Live-data VB/PD regression**: fact_cutoff_trends structure (10), pd_forecasts structure (11), cross-artifact consistency (4), cutoff continuity EB2/IND+EB3/IND+EB2/CHN (9), forecast accuracy bounds (7), computePdi() on real data (9), data freshness (5), getHistoricalSeries (4), getVelocitySummary (2) |
| `src/__tests__/browser-smoke-test.test.ts` | 8 | **NEW** — Vitest HTTP tests: server accessibility, page loads, dashboard loads, info pages, timing, visa-bulletin modes, employer SRS, homepage sections; skips gracefully when no server running |

### Key Technical Decisions Log
| Decision | Rationale |
|----------|----------|
| happy-dom over jsdom | jsdom's `html-encoding-sniffer` → `@exodus/bytes` is ESM-only but loaded via CJS require(). happy-dom is lighter and ESM-compatible. |
| ThemeProvider always provides context | Wraps children in context even before mount (visibility:hidden for SSR), preventing useTheme() throws in nested components. |
| UTC date formatting | All date formatters use `timeZone: 'UTC'` to prevent timezone-dependent test failures. |
| Exact + prefix path matching | `isAllowedPath()` uses exact match for `/` and prefix match for `/dashboard/` to prevent overly permissive matching. |
| localStorage cleared in beforeEach | Prevents theme state leaking between tests. |
| Theme defaults to dark | Dark-first luxury aesthetic per Aurora design system. User can switch to light/system via toggle. |
| EFS→SRS remap at load boundary | P2 JSON uses `efs`/`efs_tier`/`efs_ml` field names. P3 remaps to `srs`/`srs_tier`/`srs_ml` in data loaders so all downstream code uses consistent SRS naming. |
| NaN normalization | P2 JSON contains `NaN` values for unrated employers. Remapper normalizes `NaN` to `null` for safe JS comparisons. |
| PDI loads on homepage | pd_forecasts.json is 342KB — small enough for client-side fetch. SRS data (138MB) uses static teaser instead. |
| EB2/IND/DFF as PDI defaults | Most common EB immigrant profile — provides immediate value without user configuration. |
| Blocking theme script | Industry-standard (next-themes, Vercel.com) — reads localStorage and applies CSS class in `<head>` before React hydrates to prevent FOUC. |
| Feedback via GitHub Issues | No backend needed — FeedbackWidget opens pre-filled GitHub Issues URL. Zero runtime cost, leverages existing GitHub infrastructure. |
| Mock LLM for local dev | $0 cost; prod would use GPT-4o-mini via CloudFront proxy (~$0.0006/query). Mock uses QA matches or stitches chunk summaries. |
| Groq free cloud LLM | Groq runs Llama 3.3 70B on custom LPU hardware; free tier: 30 RPM / 14,400 RPD; OpenAI-compatible API; `NEXT_PUBLIC_GROQ_API_KEY` in `.env.local`; for go-live, swap to OpenAI with CloudFront proxy. |
| QA-first RAG search | 182 pre-computed QA pairs are searched first (Tier 1) — instant, high-quality answers without LLM cost. |
| 200ms search debounce | Balances responsiveness with Fuse.js search efficiency on /ask page. |

---

## PostHog Analytics — MANDATORY Rules

**Every UI change must keep PostHog instrumentation in sync.** Broken tracking is a silent bug — it never throws an error but produces misleading data.

### Analytics stack
- **SDK**: `posthog-js` — initialised in `src/components/providers/posthog-provider.tsx`
- **Event helpers**: `src/lib/analytics/index.ts` — all tracking calls go through `analytics.*`
- **Config**: `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` in `.env.local`
- **Dashboard**: `app.posthog.com` (free cloud, works identically on localhost and AWS/CloudFront)

### When you MUST update analytics

| Change | Required analytics update |
|--------|--------------------------|
| **New dashboard page** | Add `analytics.dashboardViewed('your-dashboard-name')` in the data-load `.finally()` block. Add the name to the `DashboardName` union type in `analytics/index.ts`. |
| **New filter / toggle / pill** | Add `analytics.filterChanged({ dashboard, filter, value })` in the handler or effect. |
| **New page route** | Add the page name to the `PageName` union type in `analytics/index.ts`. PostHogProvider autocaptures `$pageview` but named pages give cleaner PostHog queries. |
| **Employer / entity selection** | Add `analytics.employerSelected(...)` or create a new typed event helper. |
| **New user input that unlocks a panel** | Add `analytics.insightPanelUnlocked(panel)` when the panel becomes visible. |
| **New RAG/search interaction** | Add `analytics.ragQuestionAsked(...)`. |
| **New sidebar nav item** | No change needed — `analytics.navItemClicked` fires on all items automatically. |
| **Rename a dashboard route** | Update the `DashboardName` type and all `dashboardViewed` call sites. |
| **Remove a feature** | Remove the corresponding `analytics.*` call and update the type union if needed. |
| **New data file loaded** | Optionally call `analytics.dataLoaded({ source, bytes, loadTimeMs, dashboard })` after fetch to track payload sizes. |

### How to add a new custom event

```ts
// 1. Add helper to src/lib/analytics/index.ts
function myNewEvent(params: { foo: string; bar: number }) {
  capture("my_new_event", { foo: params.foo, bar: params.bar });
}

// 2. Export it
export const analytics = {
  ...,
  myNewEvent,
};

// 3. Call it at the right moment
analytics.myNewEvent({ foo: "value", bar: 42 });
```

### Never do this
- **Don't call `posthog.capture()` directly** — always go through `analytics.*` so events stay typed and consistent.
- **Don't include PII** — no raw user-typed text, no employer names, no priority dates. Use buckets/tiers/counts instead.
- **Don't add analytics to server components** — PostHog SDK is client-only. Only call `analytics.*` from `"use client"` components or event handlers.

---

## Session Workflow Rules (MANDATORY)

These rules apply to **every coding session**, regardless of scope:

1. **Update `PROGRESS.md` after every milestone** — Any significant work (new feature, dashboard, component, bug fix batch, refactor) must be logged as a milestone entry with date, objective, what was done, test results, files changed, and next steps. Do NOT wait to be reminded.
2. **Update `copilot-instructions.md` when inventory changes** — If files are created/deleted or test counts change, update the "Current File Inventory" section.
3. **Update the Quick Reference table** in `PROGRESS.md` — Keep test count, component count, dashboard count, and phase status current.
4. **Update the Milestone History table** in `PROGRESS.md` — Add a row for each new milestone.
5. **Update the Execution Phases** checklists in both `PROGRESS.md` and `copilot-instructions.md` — Mark items `[x]` as completed.
6. **Update `PRODUCT_GUIDE.md` whenever the UI changes** — Any new page, new dashboard, new chart, new filter, renamed label, removed feature, or updated methodology must be reflected in the corresponding section of `PRODUCT_GUIDE.md` in plain, user-friendly language. Use the same tone as the existing guide (no technical jargon, explain every element as if writing for a non-engineer end user). Sections to update: add a new `##` section for new pages/dashboards; update the relevant section for modified charts/filters; remove or mark deprecated any removed content.
