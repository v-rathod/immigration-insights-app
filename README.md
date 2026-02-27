# NorthStar · Compass

> **Immigration Insights App** — the user experience layer of the NorthStar program

[![Tests](https://img.shields.io/badge/tests-338%20passing-brightgreen)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

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

### Dashboards (2/8 complete)
- **Visa Bulletin (PDC)** — Priority Date Cortex with category/country selectors, unified historical+forecast chart (DFF & FAD lines), optimistic/realistic toggle, prediction cards, velocity stats
- **Sponsor Reliability Score (SRS)** — Fuzzy employer search (243K employers), animated SVG gauge, subscore breakdown, trend chart, risk alerts, methodology section

### RAG-Powered Q&A (`/ask`)
- **3-tier search**: QA cache (182 pairs) → chunk retrieval (100 chunks) → LLM synthesis
- **4-backend LLM cascade**: Groq (free cloud, Llama 3.3 70B) → OpenAI → Ollama → Mock
- Search-as-you-type with Fuse.js, topic filter pills (10 topics), AI answer cards
- Zero-result searches auto-trigger AI answer — no dead-end screens

### Site Pages
- **Landing** — Hero with animated stat cards, 8-dashboard catalog grid, value propositions
- **About** — Personal story, guiding principles, data pipeline diagram, tech stack
- **Privacy** — Zero data collection policy (localStorage only)
- **Terms** — Not legal advice, data accuracy, open source license

### UI & UX
- **Aurora design system** — Dark-first glassmorphic UI inspired by Linear/Vercel/Raycast
- **25 custom components** — GlassCard, NumberTicker, StatCard, ScoreGauge, animations
- **Unified FAB** — Floating action button with Ask NorthStar + Send Feedback
- **Responsive** — Mobile hamburger menu, collapsible sidebar (240→60px)
- **Theme toggle** — Dark/Light/System with zero-FOUC blocking script
- **Security module** — XSS prevention, prototype pollution defense, URL sanitization, CSP headers

### Testing
- **338 tests** across 18 test files (Vitest + React Testing Library + happy-dom)
- Covers all components, utilities, data loaders, security, and page integrations

---

## Architecture

```
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

## Data Flow

```
Meridian artifacts/
├── tables/*.parquet     (46 tables, 18.5M+ rows)
├── models/*.json        (forecast model weights)
└── rag/                 (98 chunks, 178 QA pairs)
        │
        ▼
scripts/sync_p2_data.py  (Parquet → JSON conversion)
        │
        ▼
public/data/             (23 static JSON files)
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
| Testing | Vitest + React Testing Library + happy-dom | 4.x |
| Font | Geist (Sans + Mono) | System |

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

### LLM Configuration (optional)

To enable real AI-powered answers on the `/ask` page:

```bash
# Copy example env file
cp .env.local.example .env.local

# Add your free Groq API key (get one at https://console.groq.com)
echo "NEXT_PUBLIC_GROQ_API_KEY=gsk_your_key_here" >> .env.local

# Restart dev server
npm run dev
```

Without an API key, the app falls back to a mock LLM that stitches pre-computed data summaries — still useful, just not as natural.

## Project Structure

```
immigration-insights-app/
├── .github/
│   └── copilot-instructions.md    # AI assistant context (comprehensive)
├── public/
│   └── data/                      # Pre-built JSON (from sync_p2_data.py)
│       ├── dashboards/            # 8 dashboard data dirs
│       ├── dims/                  # Dimension lookups (employer, SOC, etc.)
│       ├── models/                # Forecast model outputs
│       └── rag/                   # RAG chunks + QA cache
├── scripts/
│   └── sync_p2_data.py            # Parquet → JSON converter
├── src/
│   ├── __tests__/                 # 18 test files, 338 tests
│   ├── app/
│   │   ├── layout.tsx             # Root layout (Geist font, theme)
│   │   ├── page.tsx               # Landing page
│   │   ├── globals.css            # Aurora design tokens
│   │   ├── about/                 # About page
│   │   ├── ask/                   # RAG Q&A page
│   │   ├── privacy/               # Privacy policy
│   │   ├── terms/                 # Terms of use
│   │   └── dashboard/
│   │       ├── employer/          # SRS dashboard
│   │       └── visa-bulletin/     # PDC dashboard
│   ├── components/
│   │   ├── layout/                # AppShell, Sidebar, Footer
│   │   ├── pdi/                   # PDC chart, quick-look, teaser
│   │   ├── providers/             # ThemeProvider
│   │   ├── srs/                   # Search, gauge, detail, trend, overview
│   │   └── ui/                    # GlassCard, NumberTicker, StatCard, etc.
│   ├── lib/
│   │   ├── data/                  # Data loaders (loader, srs, pdi)
│   │   ├── search/                # RAG engine + LLM service
│   │   ├── security/              # XSS, CSP, URL sanitization
│   │   └── utils/                 # cn(), formatters
│   └── types/
│       └── p2-artifacts.ts        # TypeScript types from Meridian schemas
├── PROGRESS.md                    # Detailed milestone log
├── next.config.ts                 # Static export config
├── vitest.config.mts              # Test configuration
└── package.json
```

## Dashboards

| # | Dashboard | Status | P2 Artifacts |
|---|-----------|--------|--------------|
| 1 | Visa Bulletin Trends (PDC) | ✅ Built | fact_cutoff_trends, pd_forecasts, fact_cutoffs_all |
| 2 | Sponsor Reliability Score (SRS) | ✅ Built | employer_friendliness_scores, employer_monthly_metrics, employer_features, employer_risk_features |
| 3 | EB Category Comparison | Planned | category_movement_metrics |
| 4 | Geographic Heatmaps | Planned | worksite_geo_metrics |
| 5 | Wage Competitiveness | Planned | salary_benchmarks, fact_oews |
| 6 | SOC Demand | Planned | soc_demand_metrics |
| 7 | Processing Speed | Planned | processing_times_trends, fact_uscis_approvals |
| 8 | Backlog Visualization | Planned | backlog_estimates, queue_depth_estimates |

## Personalized Panels (Planned)

Users will enter 8 fields (priority date, country, category, employer, job title, location, wage, experience) and receive:

- **A. Green Card Forecast** — Wait time, retrogression risk, PD-becomes-current projection
- **B. Employer Insights** — SRS score, audit risk, wage comparison, WARN overlay
- **C. Job Market** — Similar role locations, best employers for occupation, salary analysis
- **D. Recommendations** — Switch employer advice, EB2 vs EB3, layoff impact, start PERM early
- **E. Visual Dashboards** — Personalized chart mosaic

## Design System — "Aurora"

Dark-first, glassmorphic, Linear/Vercel/Raycast-inspired UI:
- **Glassmorphic cards**: backdrop-blur, subtle borders, frosted glass
- **Gradient accents**: blue→purple for primary, contextual colors per dashboard
- **Animated number tickers**: Count-up on stat cards via Framer Motion springs
- **Staggered reveals**: Cards animate in sequence on page load
- **Geist typography**: Sans for UI, Mono for data/numbers
- **Generous whitespace**: Data-dense but never cluttered

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