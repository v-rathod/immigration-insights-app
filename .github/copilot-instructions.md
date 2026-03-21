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

## 🚨 V2 REDESIGN COMPLETE

**Status**: ALL 8 PHASES COMPLETE ✅
**Master Plan**: [REDESIGN_V2.md](./REDESIGN_V2.md) (strategy reference)
**Inspiration**: levels.fyi — data visible immediately, no marketing pitch

### Post-V2 Notes
- V2 redesign completed Phases 1-8 (landing rewrite → test overhaul)
- 1024 tests across 34 files, all passing
- If making further changes to insights or sidebar, see REDESIGN_V2.md for design rationale
- Key rule maintained: Each tool serves independently (employer→employer dashboard, PD→visa-bulletin dashboard). NOT driving users toward profile creation.

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

### Current Project Status

**Live Status**: Check [`PROGRESS.md`](../PROGRESS.md) for latest milestones and current state (updated with every change).

**Quick Facts** (baseline):
- **P3 Tests**: 1024 passing (34 files) | **TypeScript**: Strict mode ✅ | **ESLint**: 0 errors ✅
- **Architecture**: Static export (no backend). AWS cost ~$1–3/month (S3 + CloudFront)
- **Dashboards**: 8 deployed + Insights personalization + geographic heatmap
- **Data**: 102K+ employer shards, full wage/SRS/LCA/H1B metrics inline
- **SEO**: All 16 pages with metadata, JSON-LD structured data, llms.txt, manifest

### Common Workflow Patterns
1. **Modify P3 code** → Run `npm test` → Run `npm run build` → Commit to git
2. **Sync new P2 data** → Run `python3 scripts/sync_p2_data.py` → Update types/loaders → Commit
3. **Check P2 artifacts** → `cd ../immigration-model-builder && python3 -c "import pandas as pd; ..."`
4. **Update documentation** → Edit relevant `.md` files → Commit
   - **Session notes / milestones** → `PROGRESS.md` (source of truth, timestamped)
   - **Strategic guidance / patterns** → `copilot-instructions.md` (this file, high-level only)
   - **Other doc changes** → Parent directory `.md` files if needed (context matters)

### 📋 For Latest Project Status and Milestone History

**READ: [`PROGRESS.md`](../PROGRESS.md)** — Single source of truth for all work completed.
- Every milestone is **timestamped** (date + time) for easy reference
- Includes: objective, root causes, what was done, results, files modified, next steps
- Sessions are organized chronologically (newest first)

**Do NOT** seek latest status from this file — it becomes stale. Always check PROGRESS.md for current state.

### 🔧 Standing Instructions (Critical)

**Deployment:**
- Do NOT deploy to AWS without explicit user request
- When deploying, **ALWAYS use `bash scripts/deploy.sh`** — NEVER run `aws s3 sync` directly
  - `deploy.sh` runs pre-flight checks, uses `--exact-timestamps`, and runs post-deploy smoke tests
  - Raw `aws s3 sync` without `--exact-timestamps` will skip re-uploading stale HTML, causing CSS hash mismatches that break all page styling

**Documentation:**
- After completing ANY feature/fix: (1) Update PROGRESS.md with **timestamped milestone**, (2) Update parent docs if architectural changes, (3) DO NOT duplicate in copilot-instructions.md

**Test Quality:**
- All code changes require `npm test` passing (1024+ tests across 34 files as baseline)
- TypeScript strict mode + ESLint 0 errors (non-negotiable)
- Mobile tests required for UI changes (see Rule 21 in Mobile-First Development below)

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
| Analytics | PostHog (posthog-js) | Latest |
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

## 🎨 Design & UI Standards

**→ Read [UI_DESIGN_PRINCIPLES.md](./UI_DESIGN_PRINCIPLES.md)** for the complete Aurora design system, color tokens, component conventions, and visual philosophy.

**→ Read [SECURITY_UI_COPY_GUIDE.md](./SECURITY_UI_COPY_GUIDE.md)** for copy rules (no em-dashes, no AI markers) and UI text standards.

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

## UI Copy Rules (MANDATORY — applies to ALL future changes)

9. **No em-dashes** — NEVER use `—` or `&mdash;` in user-facing text or JSX. Use `:` for labels, `,` or `;` for prose, `|` for metadata separators. En-dashes (`–`, `&ndash;`) in numeric ranges are correct and must stay.
10. **No AI markers** — NEVER use the following words in user-facing copy: *unlock*, *discover*, *journey*, *empower*, *leverage*, *seamless*, *comprehensive*, *cutting-edge*, *revolutionize*, *delve*, *dive*, *holistic*, *tailored*, *supercharge*, *game-changing*, *transform* (when used as marketing filler). Use plain, direct language instead.

## 📱 Mobile Development

**→ Read [MOBILE_DEVELOPMENT_GUIDE.md](./MOBILE_DEVELOPMENT_GUIDE.md)** for 11 mandatory mobile rules (44px touch targets, responsive grids, no horizontal scroll), Playwright E2E testing patterns for iPhone 14, and responsive implementation examples.

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

## 🧪 Testing & Quality Assurance

**→ Read [TEST_AUDIT.md](./TEST_AUDIT.md)** for test status (986 tests passing), test organization, execution commands, and live-data test patterns.

**Quick facts:**
- **986 tests across 32 files** — All passing
- **Framework**: Vitest 4.x + React Testing Library + Playwright
- **Run**: `npm test` (unit/component), `npx playwright test` (E2E)
- **Coverage**: Every component, utility, and data loader tested
- **CI/CD**: GitHub Actions validates before merge (zero failures required)

## 🔒 Security

**→ Read [SECURITY_UI_COPY_GUIDE.md](./SECURITY_UI_COPY_GUIDE.md)** for 8 non-negotiable security principles (input sanitization, XSS prevention, prototype pollution defense, route allowlisting, URL sanitization, secure storage, CSP headers, no secrets in client).

**Quick checklist:**
- Use `sanitizeTextInput()` for user text
- Use `secureGet/Set/Remove/ClearAll()` for localStorage
- Use `escapeHtml()` for DOM output
- Never store API keys or passwords in client code
- Run `npm test -- security` before commit

---

## 🔍 SEO & AI Agent Discovery

**→ Read [SEO_STRATEGY.md](./SEO_STRATEGY.md)** for per-page metadata requirements, JSON-LD structured data, AI crawler optimization, and multi-environment deployment strategy.

---

## 🏗️ Architecture & Decisions

**→ Read [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md)** for rationale behind key technical choices, technology stack decisions, data flow patterns, and strategic trade-offs.

---

## 📂 Codebase Organization

**→ Read [CODEBASE_INVENTORY.md](./CODEBASE_INVENTORY.md)** for complete file inventory, directory structure, and quick navigation by feature/type.


---

## 📋 Analytics Strategy

**→ Read [ANALYTICS_STRATEGY.md](./ANALYTICS_STRATEGY.md)** for analytics stack setup, event types, and when to update tracking for new features.

---

## 📋 Session Workflow & Documentation

**Key rule:** After completing ANY feature, fix, or milestone:
1. Update `PROGRESS.md` with a timestamped entry (source of truth)
2. Update relevant parent docs (ARCHITECTURE.md, PRODUCT_GUIDE.md if applicable)
3. DO NOT duplicate milestone details in copilot-instructions.md — always reference PROGRESS.md for current status

**Documentation responsibility:** Each specialized file is maintained independently:
- **TEST_AUDIT.md** — Updated when tests are added/removed
- **CODEBASE_INVENTORY.md** — Refresh quarterly or after major refactors
- **UI_DESIGN_PRINCIPLES.md** — Updated when design system changes
- **MOBILE_DEVELOPMENT_GUIDE.md** — Updated when mobile rules change
- **ANALYTICS_STRATEGY.md** — Updated when event types change
- **ARCHITECTURE_DECISIONS.md** — Updated when strategic choices change
- **SEO_STRATEGY.md** — Updated when pages/routes are added/removed
- **SECURITY_UI_COPY_GUIDE.md** — Updated when security/copy standards evolve
