# Codebase Inventory Snapshot

**Read this file when:** Looking for where a feature lives, understanding code organization, or planning refactors.
**Auto-updated by:** Manual updates (add entry immediately when new file created).
**Referenced in:** copilot-instructions.md → "Refer to CODEBASE_INVENTORY.md"

---

## 🔄 How to Maintain This File

**When to update:**
- ✅ Immediately after creating a new file in `src/` directory
- ✅ When a file is deleted (remove the entry)
- ✅ Quarterly refresh of entire snapshot (run after large refactors)

**How to update:**
```bash
# Adding a new file?
# 1. Create the file in src/
# 2. Add 1 line to the appropriate section below (App Pages, Components, Data Loaders, etc.)
# 3. Commit both together: git add .github/CODEBASE_INVENTORY.md + your new file

# Quarterly refresh (after major refactors):
find src -type f \( -name "*.tsx" -o -name "*.ts" \) | wc -l  # Update file count
find src/__tests__ -name "*.test.*" | wc -l  # Update test file count
```

**Who should do it:** Developer adding the file (update inventory while committing).

**Frequency:** Every time a file is added/removed (not in copilot-instructions.md — this file gets updated instead).

---

## Snapshot Metadata

- **Generated**: 2026-03-20 14:35
- **Total Files**: 75+ source files + 32 tests + 2 E2E specs
- **Lines of Code**: ~15,000 (src/) + ~8,000 (tests)
- **Language**: TypeScript (strict mode)
- **Framework**: Next.js 16 (App Router, static export)

---

## App Pages (16 files)

| Path | Purpose | Status |
|------|---------|--------|
| `src/app/layout.tsx` | Root layout — Geist fonts, ThemeProvider, AppShell, blocking theme script | ✅ Stable |
| `src/app/page.tsx` | Landing page — hero, stats, 9 dashboards, value props | ✅ Stable |
| `src/app/globals.css` | Aurora design tokens — CSS custom properties, dark/light, gradients | ✅ Stable |
| `src/app/about/page.tsx` | About — personal story, principles, data sources, tech stack | ✅ Stable |
| `src/app/privacy/page.tsx` | Privacy Policy — zero data collection, localStorage only | ✅ Stable |
| `src/app/terms/page.tsx` | Terms of Use — liability, data accuracy, open source | ✅ Stable |
| `src/app/dashboard/employer/page.tsx` | SRS Dashboard — employer search, gauge, detail, trend | ✅ Stable |
| `src/app/dashboard/visa-bulletin/page.tsx` | PDI Dashboard — PD selectors, DFF/FAD chart, forecasts | ✅ Stable |
| `src/app/dashboard/wage/page.tsx` | Wage Intelligence Hub — dual-mode search, profiles | ✅ Stable |
| `src/app/dashboard/eb-category/page.tsx` | EB Category Comparison — velocity, volatility charts | ✅ Stable |
| `src/app/dashboard/geographic/page.tsx` | Geographic Heatmaps — choropleth, state drill-down | ✅ Stable |
| `src/app/dashboard/job-demand/page.tsx` | Occupation Demand — SOC trends, demand ranking | ✅ Stable |
| `src/app/dashboard/processing/page.tsx` | Processing Speed — throughput, approval rate, forms | ✅ Stable |
| `src/app/dashboard/backlog/page.tsx` | Backlog Visualization — timeline, queue position | ✅ Stable |
| `src/app/ask/page.tsx` | Ask (RAG Q&A) — search, results, AI answer, topics | ✅ Stable |
| `src/app/insights/page.tsx` | My Insights — profile form, 3 smart panels, localStorage | ✅ Active |

---

## Components — Layout (4 files)

| Path | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/components/layout/sidebar.tsx` | Full nav — 13 items, 6 groups, collapse, mobile toggle | 230 | ✅ Stable |
| `src/components/layout/app-shell.tsx` | Root shell — sidebar + main + footer + widget | 45 | ✅ Stable |
| `src/components/layout/footer.tsx` | Footer — links, data sources, copyright | 80 | ✅ Stable |
| `src/components/layout/index.ts` | Barrel export | 3 | — |

---

## Components — UI (8 files)

| Path | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/components/ui/glass-card.tsx` | Glassmorphic card — variants, glow, animations | 65 | ✅ Stable |
| `src/components/ui/number-ticker.tsx` | Animated counter — useSpring, IntersectionObserver | 45 | ✅ Stable |
| `src/components/ui/stat-card.tsx` | Stat display — ticker + badge + icon | 32 | ✅ Stable |
| `src/components/ui/animations.tsx` | Animation primitives — Stagger, Fade, Scale, Glow | 80 | ✅ Stable |
| `src/components/ui/theme-toggle.tsx` | 3-way toggle — light/dark/system | 50 | ✅ Stable |
| `src/components/ui/feedback-widget.tsx` | FAB — feedback form, GitHub Issues link | 145 | ✅ Active |
| `src/components/ui/contact-modal.tsx` | Contact dialog — Formspree, email fallback | 110 | ✅ Stable |
| `src/components/ui/index.ts` | Barrel export | 10 | — |

---

## Components — SRS (6 files)

| Path | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/components/srs/employer-search.tsx` | Fuzzy search — Fuse.js, portal fix (M10.81) | 320 | ✅ Recent |
| `src/components/srs/score-gauge.tsx` | SVG arc gauge — Framer Motion spring | 180 | ✅ Stable |
| `src/components/srs/employer-detail-card.tsx` | Metrics grid — approval, wage ratio, breadth | 95 | ✅ Stable |
| `src/components/srs/trend-chart.tsx` | AreaChart — filings, approvals, denials | 110 | ✅ Stable |
| `src/components/srs/srs-overview.tsx` | Aggregate stats — tier distribution | 65 | ✅ Stable |
| `src/components/srs/index.ts` | Barrel export | 5 | — |

---

## Components — PDI (4 files)

| Path | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/components/pdi/priority-date-chart.tsx` | Timeline — DFF/FAD historical + forecast | 530 | ✅ Stable |
| `src/components/pdi/pdi-quick-look.tsx` | Interactive sparkline — selectors, stats | 95 | ⏳ Unused |
| `src/components/pdi/srs-teaser.tsx` | Static teaser — hardcoded stats | 65 | ⏳ Unused |
| `src/components/pdi/index.ts` | Barrel export | 4 | — |

---

## Components — Wage (4 files)

| Path | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/components/wage/WageIntelligenceHub.tsx` | Orchestrator — dual-mode search, profiles | 250 | ✅ Active |
| `src/components/wage/EmployerProfile.tsx` | Deep-dive — growth badges, FY trend, roles | 280 | ✅ Active |
| `src/components/wage/RolePercentileTrend.tsx` | Salary distribution — p10–p90 bands, OEWS line | 200 | ✅ Active |
| `src/components/wage/WageGrowthLeaderboard.tsx` | Leaderboard — CAGR ranking | 85 | ⏳ Hidden |

---

## Components — Geographic (2 files)

| Path | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/components/geo/usa-choropleth.tsx` | Choropleth map — 9-stop color, drill-down | 220 | ✅ Stable |
| `src/components/geo/index.ts` | Barrel export | 2 | — |

---

## Components — About (1 file)

| Path | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/components/about/tech-stack-chip.tsx` | Tech chip — hover tooltip, explanations | 95 | ✅ Stable |

---

## Components — Providers (2 files)

| Path | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/components/providers/theme-provider.tsx` | Theme state — localStorage, system pref, CSR guard | 85 | ✅ Stable |
| `src/components/providers/posthog-provider.tsx` | Analytics init — session recording, pageview tracking | 35 | ✅ Stable |

---

## Data Loaders (10 files)

| Path | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/lib/data/loader.ts` | Generic fetcher — loadDashboard, loadDimension, loadModel | 45 | ✅ Stable |
| `src/lib/data/srs.ts` | SRS helpers — efs→srs remap, stats, risk | 180 | ✅ Stable |
| `src/lib/data/pdi.ts` | PDI helpers — forecast series, velocity, MCRA | 210 | ✅ Stable |
| `src/lib/data/wage.ts` | Wage helpers — growth, rankings, benchmarks | 165 | ✅ Stable |
| `src/lib/data/eb-category.ts` | EB helpers — movement, summary | 95 | ✅ Stable |
| `src/lib/data/geographic.ts` | Geo helpers — state aggregates, summary | 78 | ✅ Stable |
| `src/lib/data/soc-demand.ts` | SOC helpers — demand filter, rankings | 85 | ✅ Stable |
| `src/lib/data/processing.ts` | Processing helpers — trends, KPIs | 72 | ✅ Stable |
| `src/lib/data/backlog.ts` | Backlog helpers — estimates, queue, summary | 88 | ✅ Stable |

---

## Search & Analytics (4 files)

| Path | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/lib/search/rag-search.ts` | RAG engine — Fuse.js, topic filter, getByTopic | 165 | ✅ Stable |
| `src/lib/search/llm-service.ts` | LLM backends — Groq, OpenAI, Ollama, Mock | 220 | ✅ Stable |
| `src/lib/analytics/index.ts` | Analytics helpers — 21 typed events | 180 | ✅ Stable |

---

## Security & Utilities (5 files)

| Path | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/lib/security/index.ts` | Security module — XSS, validation, sanitization, localStorage | 299 | ✅ Stable |
| `src/lib/security/headers.ts` | Security headers — CSP, HSTS, X-Frame, Permissions-Policy | 45 | ✅ Stable |
| `src/lib/utils/cn.ts` | Class merger — clsx + tailwind-merge | 8 | ✅ Stable |
| `src/lib/utils/format.ts` | Formatters — number, date, currency, SRS tier | 185 | ✅ Stable |
| `src/types/p2-artifacts.ts` | P2 types — artifact schemas | 420 | ✅ Stable |

---

## Test Files (32 files, 986 tests)

See **TEST_AUDIT.md** for detailed test inventory and coverage.

---

## Build & Deployment (4 key files)

| Path | Purpose | Notes |
|------|---------|-------|
| `next.config.ts` | Next.js configuration — static export, ESM | Latest |
| `tsconfig.json` | TypeScript config — strict mode, path aliases | Strict |
| `vitest.config.mts` | Test framework config — ESM, setup mocks | 4.x |
| `tailwind.config.ts` | Tailwind config — Aurora tokens, plugins | 4.x |

---

## Scripts (7 key files)

| Path | Purpose | Status |
|------|---------|--------|
| `scripts/sync_p2_data.py` | Parquet → JSON sync | ✅ Runs before build |
| `scripts/deploy.sh` | Full deployment — build, S3, CloudFront | ✅ Production-ready |
| `scripts/smoke-test.mjs` | Post-deploy verification | ✅ 42 checks |
| `scripts/employer_consolidation.py` | Consolidate employer names | ✅ Canonical dedup |
| `scripts/_fix_nan.py` | Normalize NaN → null in JSON | ✅ Data cleanup |
| `scripts/_regen_search.py` | Regenerate _search.json index | ✅ Search optimization |
| `scripts/_check_canonical.mjs` | Verify canonical names | ✅ Data QA |

---

## Directory Structure

```
src/
├── app/                    # 16 page files + layouts
├── components/             # 35+ component files (organized by domain)
├── lib/
│   ├── data/              # 9 dashboard-specific loaders
│   ├── search/            # RAG + LLM services
│   ├── security/          # Input validation, storage
│   ├── analytics/         # PostHog event helpers
│   └── utils/             # Format, combine, misc
├── types/                 # P2 artifact schemas
└── __tests__/             # 32 test files

public/data/               # Static JSON (gitignored, synced from P2)
├── dashboards/           # One JSON per dashboard
├── dims/                 # Dimension lookups
├── models/               # Model outputs
├── rag/                  # RAG chunks + QA
└── employers/            # Employer shards (102K+)

scripts/                  # Build, deploy, data processing
terraform/               # AWS infrastructure
.github/                 # Config + documentation
```

---

## Quick Navigation

**By Feature:**
- SRS: `src/components/srs/`, `src/lib/data/srs.ts`, `/dashboard/employer`
- PDI: `src/components/pdi/`, `src/lib/data/pdi.ts`, `/dashboard/visa-bulletin`
- Wage: `src/components/wage/`, `src/lib/data/wage.ts`, `/dashboard/wage`
- Dashboards (others): `src/lib/data/{eb-category,geographic,soc-demand,processing,backlog}.ts`
- RAG/Ask: `src/lib/search/`, `/app/ask`

**By Type:**
- Pages: `src/app/*/page.tsx`
- Shared UI: `src/components/ui/`
- Data Processing: `src/lib/data/`
- Testing: `src/__tests__/`

---

## Notes for Future Updates

- This file is a snapshot and should be refreshed periodically
- Add new files to relevant sections as they're created
- Mark components as "Active", "Stable", "Unused", or "Hidden" based on current state
- Update line counts quarterly for perspective on code growth
