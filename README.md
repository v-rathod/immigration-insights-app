# NorthStar · Compass

> **Immigration Insights App** — the user experience layer of the NorthStar program

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

## Purpose

**Compass** is a statically-exported Next.js web app that sits directly on top of **Meridian** artifacts (Parquet tables, JSON models, RAG chunks). It provides:

- **8 Interactive Dashboards** — Visa Bulletin, Employer Friendliness, EB Categories, Geographic Heatmaps, Wages, SOC Demand, Processing Speed, Backlog
- **5 Personalized Panels** — Green Card Forecast, Employer Insights, Job Market, Recommendations, Visual Dashboard
- **RAG-Powered Q&A** — 98 text chunks + 178 pre-computed answers, searchable with Fuse.js
- **Zero Runtime Compute** — All data pre-built by Meridian, served as static JSON from S3/CloudFront

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
public/data/             (Static JSON slices)
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

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, static export) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui (Radix UI) |
| Charts | Recharts |
| Maps | react-simple-maps |
| Animations | Framer Motion |
| Icons | Lucide React |
| Search | Fuse.js (client-side) |
| URL State | nuqs |
| Font | Geist (Sans + Mono) |

## Setup

```bash
# Prerequisites: Node.js ≥ 22, Python 3.12 (for data sync)
npm install

# Sync data from P2 Meridian (sibling directory)
python3 scripts/sync_p2_data.py

# Run dev server
npm run dev

# Build static export
npm run build    # → out/
```

## Project Structure

```
immigration-insights-app/
├── .github/
│   └── copilot-instructions.md    # AI assistant context (comprehensive)
├── public/
│   └── data/                      # Pre-built JSON (from sync_p2_data.py)
├── scripts/
│   └── sync_p2_data.py            # Parquet → JSON converter
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── layout.tsx             # Root layout (Geist font, dark mode)
│   │   ├── page.tsx               # Landing page (hero + dashboards)
│   │   ├── globals.css            # Aurora design system tokens
│   │   ├── dashboard/[slug]/      # 8 dashboard pages
│   │   ├── insights/              # Personalized panels (A–E)
│   │   ├── ask/                   # RAG Q&A search
│   │   └── ops/                   # QA center
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives
│   │   ├── charts/                # Themed chart wrappers
│   │   ├── cards/                 # Glassmorphic stat cards
│   │   └── layout/                # Sidebar, nav, header
│   ├── lib/
│   │   ├── data/                  # Data loaders (fetch JSON)
│   │   ├── search/                # Fuse.js RAG search engine
│   │   └── utils/                 # cn(), formatters, constants
│   └── types/
│       └── p2-artifacts.ts        # TypeScript types from P2 schemas
├── next.config.ts                 # Static export config
├── tsconfig.json                  # Strict TypeScript
└── package.json
```

## Dashboards

| # | Dashboard | P2 Artifacts |
|---|-----------|--------------|
| 1 | Visa Bulletin Trends | fact_cutoff_trends, pd_forecasts |
| 2 | Employer Friendliness | employer_friendliness_scores, employer_monthly_metrics |
| 3 | EB Category Comparison | category_movement_metrics |
| 4 | Geographic Heatmaps | worksite_geo_metrics |
| 5 | Wage Competitiveness | salary_benchmarks, fact_oews |
| 6 | SOC Demand | soc_demand_metrics |
| 7 | Processing Speed | processing_times_trends, fact_uscis_approvals |
| 8 | Backlog Visualization | backlog_estimates, queue_depth_estimates |

## Personalized Panels

Users enter 8 fields (priority date, country, category, employer, job title, location, wage, experience) and receive:

- **A. Green Card Forecast** — Wait time, retrogression risk, PD-becomes-current projection
- **B. Employer Insights** — GC friendliness score, audit risk, wage comparison, WARN overlay
- **C. Job Market** — Similar role locations, best employers for occupation, salary analysis
- **D. Recommendations** — Switch employer advice, EB2 vs EB3, layoff impact, start PERM early
- **E. Visual Dashboards** — Personalized chart mosaic

## Design System — "Aurora"

Dark-first, glassmorphic, Linear/Vercel/Raycast-inspired UI:
- **Glassmorphic cards**: backdrop-blur, subtle borders, frosted glass
- **Gradient accents**: blue→purple for primary, contextual colors per dashboard
- **Animated number tickers**: Count-up on stat cards
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
| DOL PERM | 1.7M filings, FY2008–2026 | 21 Excel files |
| DOL LCA (H-1B) | 9.6M filings, FY2008–2026 | 19 files |
| DOS Visa Bulletin | 14K cutoff records, 2011–2026 | ~180 PDFs |
| BLS OEWS | 446K wage records | 3 annual datasets |
| DOS Visa Statistics | 200K+ issuance records | ~600 PDFs |
| USCIS Employment | 146 approval records | ~245 files |
| DHS Yearbook | 45 admission records | 1 XLSX |
| WARN Act | 985 layoff events | 2 state files |

## License

MIT