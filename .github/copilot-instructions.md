# Immigration Insights App — Copilot Context

> **NorthStar Program Codenames**:
> | Internal | Codename | Repository | Role |
> |----------|----------|------------|------|
> | P1 | **Horizon** | fetch-immigration-data | Data collection — scans the horizon |
> | P2 | **Meridian** | immigration-model-builder | Analytics backbone — curates, measures, models |
> | P3 | **Compass** | immigration-insights-app (THIS REPO) | User experience — guides with insights |
>
> Use P1/P2/P3 in internal code and comments. Use Horizon/Meridian/Compass in public docs.

---

## Project Overview

**Compass** is a statically-exported Next.js web app that consumes pre-computed Parquet-to-JSON artifacts from **Meridian** (P2). It provides personalized immigration insights — priority date forecasts, employer friendliness scores, salary benchmarks, and 8 interactive dashboards — with **zero runtime compute** and an AWS hosting cost of ~$1–3/month.

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
/setup                      → User input form (8 fields)
/insights                   → Personalized panels (A–E)
/dashboard/visa-bulletin     → Dashboard 1: Visa Bulletin Trends
/dashboard/employer          → Dashboard 2: Employer Friendliness
/dashboard/eb-category       → Dashboard 3: EB Category Comparison
/dashboard/geographic        → Dashboard 4: Geographic Heatmaps
/dashboard/wage              → Dashboard 5: Wage Competitiveness
/dashboard/soc-demand        → Dashboard 6: SOC Demand
/dashboard/processing        → Dashboard 7: Processing Speed
/dashboard/backlog           → Dashboard 8: Backlog Visualization
/ask                         → RAG-powered Q&A search
/ops                         → QA center (artifact inventory, test results)
```

---

## Dashboard → P2 Artifact Mapping

| Dashboard | P2 Artifacts Consumed |
|-----------|----------------------|
| 1. Visa Bulletin Trends | fact_cutoff_trends, pd_forecasts, fact_cutoffs_all |
| 2. Employer Friendliness | employer_friendliness_scores, employer_monthly_metrics, employer_features, employer_risk_features |
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
| B. Employer Insights | employer_name | employer_friendliness_scores, employer_risk_features, employer_monthly_metrics |
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

## RAG Q&A Architecture

| Layer | Implementation |
|-------|---------------|
| Pre-computed answers | `qa_cache.json` — 178 pairs, exact/fuzzy match first |
| Chunk retrieval | `all_chunks.json` — 98 chunks, filtered by topic via Fuse.js |
| Topics | pd_forecast, employer, salary, visa_bulletin, geographic, occupation, processing, visa_demand, filings, general |
| LLM (optional) | GPT-4o-mini via API route or client-side fetch — ~$0.15/month for 100 users |

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
# Build static site
npm run build                     # → out/

# Deploy to S3
aws s3 sync out/ s3://BUCKET_NAME --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"
```

---

## Development Commands

```bash
npm run dev          # Local dev server (http://localhost:3000)
npm run build        # Static export to out/
npm run lint         # ESLint
npm run sync-data    # Sync P2 → public/data/ (calls scripts/sync_p2_data.py)
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

## Important P2 Context (from Meridian)

### Data Scale
- **46+ artifact tables** — 18.5M+ total rows
- **6 dimensions**: employer (243K), SOC (1,801), country (249), area (587), visa_class (6), visa_ceiling (14)
- **15 fact tables**: PERM (1.7M), LCA (9.6M), OEWS (446K), cutoffs (14K), visa issuances, DHS admissions...
- **12 feature tables**: employer_features, salary_benchmarks, worksite_geo_metrics, soc_demand_metrics...
- **3 model outputs**: pd_forecasts (56 series × 24 months), EFS rules (70K), EFS ML (1,695)
- **RAG**: 98 chunks across 10 topics, 178 pre-computed QA pairs

### Stub Tables (0 rows — expected)
- `fact_trac_adjudications` — TRAC requires paid subscription
- `fact_acs_wages` — Census API HTTP 404 (available ~Sep 2026)
- `fact_processing_times` — USCIS SPA, no P1 source

### Stale Data
- `fact_h1b_employer_hub` — USCIS discontinued after FY2023. Historical only.

---

## Execution Plan (Phases)

### Phase 0: Bootstrap ✅
- [x] Next.js 16 + TypeScript + Tailwind + App Router + static export
- [x] All dependencies installed
- [x] Project structure created
- [x] Design tokens configured
- [x] README + copilot-instructions

### Phase 1: Data Bridge
- [ ] `scripts/sync_p2_data.py` — Parquet → JSON converter
- [ ] TypeScript types from P2 schemas
- [ ] RAG data copy
- [ ] Data loader utilities

### Phase 2: App Shell & Landing
- [ ] Sidebar navigation with glassmorphic styling
- [ ] Landing page with animated stat cards
- [ ] Theme toggle (dark/light)
- [ ] User input form (8 fields)

### Phase 3: 8 Dashboards
- [ ] 1. Visa Bulletin Trends
- [ ] 2. Employer Friendliness
- [ ] 3. EB Category Comparison
- [ ] 4. Geographic Heatmaps
- [ ] 5. Wage Competitiveness
- [ ] 6. SOC Demand
- [ ] 7. Processing Speed
- [ ] 8. Backlog Visualization

### Phase 4: Personalized Panels
- [ ] A. Green Card Forecast
- [ ] B. Employer Insights
- [ ] C. Job Market Insights
- [ ] D. Actionable Recommendations
- [ ] E. Visual Dashboard Mosaic

### Phase 5: RAG Q&A
- [ ] Search-as-you-type with Fuse.js
- [ ] Topic-filtered browsing
- [ ] Source attribution

### Phase 6: Deploy
- [ ] S3 + CloudFront + Route53 Terraform/CDK
- [ ] GitHub Actions CI/CD
- [ ] Data freshness banner
