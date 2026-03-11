# NorthStar · Compass

> **Immigration Insights App** — the user experience layer of the NorthStar program

[![Tests](https://img.shields.io/badge/tests-579%20passing-brightgreen)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)]()
[![Dashboards](https://img.shields.io/badge/dashboards-9%2F9-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

## For AI Assistants — Read Before Changing Anything

1. **[`NORTHSTAR_VISION.md`](../NORTHSTAR_VISION.md)** — Program vision, architecture, guardrails
2. **[`BEST_PRACTICES.md`](../BEST_PRACTICES.md)** — Engineering conventions, design system, testing rules, agent checklist
3. **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — P3 technical design, component map, security model
4. **[`.github/copilot-instructions.md`](.github/copilot-instructions.md)** — Current file inventory, test counts, phase status
5. **[`PROGRESS.md`](PROGRESS.md)** (last 100 lines) — Pick up from the last milestone

## The NorthStar Program

NorthStar is a three-part immigration data intelligence platform. The codenames follow a **celestial navigation** metaphor — the same way sailors once used the sky to cross oceans, NorthStar helps immigrants navigate the complex U.S. immigration system.

| Codename | Role | Repository |
|----------|------|------------|
| **Horizon** | Data collection | `fetch-immigration-data` |
| **Meridian** | Modeling & analytics | `immigration-model-builder` |
| **Compass** | User experience ← **THIS REPO** | `immigration-insights-app` |

### Why these names?

**Horizon** — *"Scan the horizon before you set sail."*
Continuously scans authoritative government sources (DOL, DOS, USCIS, DHS, BLS) and collects every filing, bulletin, and statistic into a raw data archive.

**Meridian** — *"The reference line from which all measurements are taken."*
The analytical backbone: takes raw material from Horizon and establishes canonical facts, dimensions, features, and ML models.

**Compass** — *"Point the way forward."*
Translates Meridian's curated models into personalized guidance: When will my priority date become current? Is my employer immigration-friendly? How does my salary compare? It turns data into decisions.

> **Together:** Horizon gathers what's out there → Meridian makes sense of it → Compass points the way.

---

## What's Built

### Dashboards — 9 / 9 ✅

| # | Dashboard | Key Feature |
|---|-----------|-------------|
| 1 | **Visa Bulletin / Priority Date Cortex (PDC)** | Unified historical+forecast chart, DFF/FAD lines, prediction cards, velocity stats |
| 2 | **Sponsor Reliability Score (SRS)** | Fuzzy search 243K employers, animated SVG gauge, subscore breakdown, trend chart |
| 3 | **EB Category Comparison** | Country pills, DFF/FAD toggle, velocity AreaChart, volatility BarChart |
| 4 | **Geographic Heatmaps** | Dataset selector, top-15 states BarChart, sortable state table |
| 5 | **Wage Intelligence Hub** | Dual-mode search (employer/role), 5-year salary percentile chart (p10–p90) |
| 6 | **Occupation Demand** | BLS major groups, demand percentiles, occupations chart with filter |
| 7 | **Processing Speed** | USCIS form throughput, approval trends, FY range table |
| 8 | **Backlog Visualization** | Category AreaChart, queue position lookup, country filter |
| 9 | **USCIS Approvals** | I-485/I-765/I-140 volume FY1992–2025 |

### Personalized Panel (`/insights`)
- 7-field profile form (priority date, country, category, employer, job title, location, wage)
- Green Card Forecast, Sponsor Reliability, and Salary Benchmark smart panels
- Session persistence via localStorage (`compass_` prefix)

### RAG-Powered Q&A (`/ask`)
- **3-tier search**: QA cache (719 pairs) → chunk retrieval (341 chunks) → LLM synthesis
- **4-backend LLM cascade**: Groq (Llama 3.3 70B) → OpenAI → Ollama → Mock fallback
- Topic filter pills (10 topics), AI answer cards, source attribution

### Site & UX
- **Landing** — animated stat cards, 9-dashboard catalog, value propositions
- **About / Privacy / Terms / Contact Us** — Contact Us opens a modal → Formspree → email
- **Aurora design system** — Dark-first glassmorphic UI (Linear/Vercel/Raycast-inspired)
- **35 custom components** — GlassCard, NumberTicker, StatCard, ScoreGauge, ContactModal, ...
- **Feedback FAB** — floating Send Feedback button (PostHog-tracked)
- **Responsive** — mobile hamburger, collapsible sidebar (240→60px)
- **Theme toggle** — Dark/Light/System, zero-FOUC blocking script
- **Security** — XSS prevention, proto pollution defense, URL sanitization, CSP headers

### Testing
- **557 tests** across 24 test files (Vitest 4 + React Testing Library + happy-dom)
- Covers all components, data loaders, utilities, security, and page integrations

---

## Architecture

```

## Latest Session Snapshot (2026-03-10)

- See [LATEST_STATUS.md](../LATEST_STATUS.md) for the full handoff, test status, and data sync details.
- Snapshot highlights:
        - **P3 (Compass)**: fiscal-year filter fix applied in `scripts/sync_p2_data.py`; Optum shard updated to 1,928 rows (FY2023–2026); full test suite: **579/579** passing.
        - **P2 (Meridian)**: artifacts exported and verified; test suite: **562/562** passing.
- For automated agents: read [LATEST_STATUS.md](../LATEST_STATUS.md) first — it is the authoritative session summary and contains verification commands and deployment steps.

┌─────────────────────────────────────────────────────────────┐
│                    NorthStar Program                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ★ Horizon  (fetch-immigration-data)                       │
│   │  Scans & collects raw data: PDFs, Excel, CSV            │
│   │                                                         │
│   ▼                                                         │
│   ★ Meridian (immigration-model-builder)                    │
│   │  Curates, engineers features, trains models             │
│   │  46 artifacts · 18.5M+ rows · 98 RAG chunks            │
│   │                                                         │
│   ▼                                                         │
│   ★ Compass  (immigration-insights-app) ← THIS REPO        │
│      Static Next.js app · S3 + CloudFront                   │
│      8 dashboards · 5 personalized panels · RAG Q&A         │
│      Hosting cost: ~$1–3/month on AWS                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```


## Data Flow & Artifact Inventory

```
Meridian artifacts/
├── tables/*.parquet     (49 tables, 22.5M+ rows)
├── models/*.json        (forecast model weights)
└── rag/                 (341 chunks, 719 QA pairs)
        │
        ▼
scripts/sync_p2_data.py  (Parquet → JSON conversion)
        │
        ▼
public/data/             (28 static JSON files)
├── dashboards/          (one dir per dashboard)
├── dims/                (dimension lookups)
├── models/              (forecast outputs)
└── rag/                 (chunks + QA cache)
        │
        ▼
next build → out/        (Pure HTML/CSS/JS)
        │
        ▼
S3 + CloudFront          (Static hosting, ~$1–3/mo)
```

### Artifact Inventory (as of 2026-02-27)

- **Dimensions (6):** `dim_country`, `dim_soc`, `dim_area`, `dim_employer`, `dim_visa_ceiling`, `dim_visa_class`
- **Fact Tables (18):** `fact_perm`, `fact_lca`, `fact_oews`, `fact_cutoffs`, `fact_h1b_employer_hub`, `fact_niv_issuance`, `fact_visa_issuance`, `fact_visa_applications`, `fact_perm_unique_case`, `fact_perm_all`, `fact_cutoffs_all`, `fact_uscis_approvals`, `fact_dhs_admissions`, `fact_waiting_list`, `fact_warn_events`, `fact_bls_ces`, `fact_processing_times`, `fact_trac_adjudications`
- **Feature/Metric Tables (14):** `employer_features`, `employer_monthly_metrics`, `salary_benchmarks`, `visa_demand_metrics`, `worksite_geo_metrics`, `backlog_estimates`, `category_movement_metrics`, `fact_cutoff_trends`, `soc_demand_metrics`, `queue_depth_estimates`, `processing_times_trends`, `employer_risk_features`, `employer_salary_profiles`, `employer_salary_yearly`, `soc_salary_market`
- **Model Outputs (3):** `employer_friendliness_scores`, `employer_friendliness_scores_ml`, `pd_forecasts`
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

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, static export) | 16.x |
| Language | TypeScript (strict) | 5.x |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui (Radix UI) | Latest |
| Charts | Recharts | 2.15.x |
| Maps | react-simple-maps | 3.x |
| Animations | Framer Motion | 12.x |
| Icons | Lucide React | 0.470.x |
| Search | Fuse.js (client-side fuzzy) | 7.x |
| LLM | Groq (Llama 3.3 70B) / OpenAI (GPT-4o-mini) | — |
| Analytics | PostHog (free cloud) | Latest |
| Contact Form | Formspree | Free tier |
| Testing | Vitest 4 + React Testing Library + happy-dom | 4.x |
| Font | Geist Sans + Geist Mono | System |

## Setup

```bash
# Prerequisites: Node.js ≥ 22, Python 3.12 (for data sync)
npm install

# Sync data from Meridian (sibling directory)
python3 scripts/sync_p2_data.py

# Run dev server
npm run dev

# Run tests
npm test

# Build static export
npm run build    # → out/
```

### Environment Variables (`.env.local`)

```bash
# AI-powered Q&A — free at https://console.groq.com
NEXT_PUBLIC_GROQ_API_KEY=gsk_...

# Product analytics — free at https://app.posthog.com
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Contact form email delivery — formspree.io/f/xojkabny → v.s.rathod@gmail.com
NEXT_PUBLIC_FORMSPREE_ID=xojkabny
```

## Project Structure

```
immigration-insights-app/
├── .github/
│   └── copilot-instructions.md    # AI assistant context (auto-loaded by Copilot)
├── public/
│   └── data/                      # ~85 MB pre-built JSON (from sync_p2_data.py)
│       ├── dashboards/            # 9 dashboard data dirs
│       ├── dims/                  # Dimension lookups (employer, SOC, country, area)
│       ├── models/                # Forecast model outputs (pd_forecasts.json)
│       └── rag/                   # RAG chunks + QA cache
├── scripts/
│   └── sync_p2_data.py            # Parquet → JSON converter with optimization transforms
├── src/
│   ├── __tests__/                 # 24 test files, 557 tests
│   ├── app/
│   │   ├── layout.tsx             # Root layout (Geist font, theme, PostHog)
│   │   ├── page.tsx               # Landing page
│   │   ├── globals.css            # Aurora design tokens (CSS variables)
│   │   ├── about/ ask/ privacy/ terms/ insights/
│   │   └── dashboard/
│   │       ├── employer/          # SRS dashboard
│   │       ├── visa-bulletin/     # PDC dashboard
│   │       ├── wage/              # Wage Intelligence Hub
│   │       ├── eb-category/       # EB Category Comparison
│   │       ├── geographic/        # Geographic Heatmaps
│   │       ├── job-demand/        # Occupation Demand
│   │       ├── processing/        # Processing Speed
│   │       ├── backlog/           # Backlog Visualization
│   │       └── approvals/         # USCIS Approvals
│   ├── components/
│   │   ├── layout/                # AppShell, Sidebar, Footer
│   │   ├── pdi/                   # PriorityDateChart, PdiQuickLook
│   │   ├── providers/             # ThemeProvider, PostHogProvider
│   │   ├── srs/                   # EmployerSearch, ScoreGauge, TrendChart, SrsOverview
│   │   ├── wage/                  # WageIntelligenceHub, EmployerProfile, RolePercentileTrend
│   │   └── ui/                    # GlassCard, NumberTicker, StatCard, ContactModal, FeedbackWidget, ...
│   ├── lib/
│   │   ├── analytics/             # PostHog typed event helpers (21 events)
│   │   ├── data/                  # Data loaders per dashboard (9 files)
│   │   ├── search/                # RAG engine + LLM service (4 backends)
│   │   ├── security/              # XSS, CSP, URL sanitization, secure localStorage
│   │   └── utils/                 # cn(), formatters
│   └── types/
│       └── p2-artifacts.ts        # TypeScript interfaces for all Meridian schemas
├── ARCHITECTURE.md                # P3 technical design diagrams
├── PROGRESS.md                    # Detailed milestone log (Milestones 1–10.25)
├── next.config.ts                 # Static export config (output: 'export')
└── vitest.config.mts              # Test config (happy-dom, path aliases)
```

## Dashboards (9 / 9 Built ✅)

| # | Dashboard | P2 Artifacts |
|---|-----------|-------------|
| 1 | Visa Bulletin / PDC | fact_cutoff_trends, pd_forecasts, fact_cutoffs_all |
| 2 | Sponsor Reliability Score (SRS) | employer_friendliness_scores, employer_monthly_metrics, employer_risk_features |
| 3 | EB Category Comparison | category_movement_metrics |
| 4 | Geographic Heatmaps | worksite_geo_metrics |
| 5 | Wage Intelligence Hub | employer_salary_profiles, employer_role_trends, soc_salary_market |
| 6 | Occupation Demand | soc_demand_metrics, dim_soc |
| 7 | Processing Speed | processing_times_trends, fact_uscis_approvals |
| 8 | Backlog Visualization | backlog_estimates, queue_depth_estimates, dim_visa_ceiling |
| 9 | USCIS Approvals | fact_uscis_approvals |

## Personalized Panel (`/insights`) ✅

Users enter a 7-field profile and receive:

- **Green Card Forecast** — Priority date tracking against current Visa Bulletin
- **Sponsor Reliability** — SRS score, tier, and risk alerts for their employer
- **Salary Benchmark** — Percentile position vs. market for their role and location

*Full Phases C–E (Recommendations, Visual Mosaic) planned for Phase 4 completion.*

## Design System — "Aurora"

Dark-first, glassmorphic, Linear/Vercel/Raycast-inspired. Full patterns in [`BEST_PRACTICES.md §5`](../BEST_PRACTICES.md).

- **Glassmorphic cards** — `backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl`
- **Gradient text** (headlines only) — `bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent`
- **All colors via CSS variables** — never hardcoded hex; supports dark/light theme
- **Framer Motion easing** — `[0.25, 0.1, 0.25, 1]` throughout; 50ms stagger between card sequences
- **Recharts theming** — `stroke="rgba(255,255,255,0.05)"` grid, `fill="var(--muted-foreground)"` axis ticks

## AWS Hosting (~$1–3/month)

| Service | Purpose | Cost |
|---------|---------|------|
| S3 | Static site hosting | ~$0.02/mo |
| CloudFront | CDN (1TB free tier) | ~$0.00 |
| Route 53 | DNS | ~$0.50/mo |
| ACM | SSL certificate | Free |

No Lambda, no database, no API Gateway, no EC2.

## Data Sources (via Horizon + Meridian)

| Source | Records | Coverage |
|--------|---------|----------|
| DOL PERM | 1.7M filings | FY2008–2026 |
| DOL LCA (H-1B) | 9.6M filings | FY2008–2026 |
| DOS Visa Bulletin | 14K cutoff records | 2011–2026 |
| BLS OEWS | 446K wage records | 3 annual datasets |
| DOS Visa Statistics | 200K+ issuance records | ~600 PDFs |
| USCIS Employment | 146 approval records | ~245 files |
| DHS Yearbook | 45 admission records | 1 XLSX |
| WARN Act | 985 layoff events | 2 state files |

## License

MIT

## Temporary File Usage for Automation

To streamline operations and avoid repeated permission prompts during temporary script execution, 10 reusable temporary files have been pre-created in the workspace:

- `tmp_script_1.py`
- `tmp_script_2.py`
- `tmp_script_3.py`
- `tmp_script_4.py`
- `tmp_script_5.py`
- `tmp_script_6.py`
- `tmp_script_7.py`
- `tmp_script_8.py`
- `tmp_script_9.py`
- `tmp_script_10.py`

### Purpose
These files are used for:
- Running temporary Python scripts.
- Avoiding the need for new file creation prompts.

### Guidelines
- These files will be reused for all temporary script needs.
- Do not delete these files unless absolutely necessary.
- If additional temporary files are required, create them following the same naming convention (`tmp_script_11.py`, etc.).