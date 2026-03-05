# Compass (P3) — Technical Architecture

> **Project:** immigration-insights-app  
> **Role:** User experience layer — the public-facing web application  
> **Last Updated:** March 5, 2026

---

## Prerequisite Reading

Before working on this project, read these documents in order:

1. **`/Users/vrathod1/dev/NorthStar/NORTHSTAR_VISION.md`** — Program vision, 3-project architecture, guardrails
2. **`.github/copilot-instructions.md`** — Detailed P3 context (500+ lines): tech stack, file inventory, data mappings, design system, coding conventions
3. **`PROGRESS.md`** — Session-by-session work history with milestone entries

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BUILD TIME (Developer Machine)                  │
│                                                                        │
│  P2 Meridian artifacts/     sync_p2_data.py      public/data/          │
│  ┌──────────────────┐      ┌──────────────┐     ┌──────────────────┐  │
│  │ Parquet tables    │─────▶│ Convert to   │────▶│ Optimized JSON   │  │
│  │ Model JSON        │      │ JSON slices  │     │ slices           │  │
│  │ RAG chunks        │      │ Apply filters│     │ (~85 MB total)   │  │
│  └──────────────────┘      └──────────────┘     └────────┬─────────┘  │
│                                                           │            │
│                                                           ▼            │
│                                                  ┌──────────────────┐  │
│                            npm run build ───────▶│ Static HTML/JS/  │  │
│                                                  │ CSS in out/      │  │
│                                                  │ (16 pages)       │  │
│                                                  └────────┬─────────┘  │
└───────────────────────────────────────────────────────────┼────────────┘
                                                            │
                                                   aws s3 sync
                                                            │
┌───────────────────────────────────────────────────────────┼────────────┐
│                        RUNTIME (AWS)                      │            │
│                                                           ▼            │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────────────┐ │
│  │ Route 53 │───▶│ CloudFront   │───▶│ S3 Bucket (static hosting)  │ │
│  │ DNS      │    │ CDN + HTTPS  │    │ HTML + JS + CSS + JSON data │ │
│  └──────────┘    └──────────────┘    └──────────────────────────────┘ │
│                                                                       │
│  Cost: ~$1-3/month (S3 $0.02 + CloudFront free tier + Route53 $0.50) │
└───────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                        CLIENT (User's Browser)                        │
│                                                                       │
│  ┌─────────────────┐  ┌─────────────┐  ┌──────────────────────────┐ │
│  │ Next.js App      │  │ JSON Data   │  │ Client-Side Logic        │ │
│  │ (Static HTML +   │  │ (fetched on │  │ • Fuse.js fuzzy search   │ │
│  │  React hydration)│  │  demand)    │  │ • localStorage profile   │ │
│  │                  │  │             │  │ • Recharts rendering     │ │
│  │ 8 Dashboards     │  │ Dimensions  │  │ • Framer Motion anims   │ │
│  │ My Insights      │  │ Facts       │  │ • Theme toggle           │ │
│  │ Ask (RAG Q&A)    │  │ Models      │  │ • URL state (nuqs)       │ │
│  └─────────────────┘  └─────────────┘  └──────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Non-Negotiable Constraints

| Constraint | Rationale |
|-----------|-----------|
| `output: 'export'` in next.config.ts | Zero server cost — pure static files |
| No API routes | S3 cannot serve server-side code |
| No middleware | Not supported in static exports |
| No server-side data fetching | All data must be pre-built JSON |
| No database | AWS cost constraint ($1-3/month) |
| No Lambda/API Gateway | AWS cost constraint |
| No heavy client-side computation | Battery life + mobile performance |
| No API keys in source code | Security (except PostHog + optional Groq) |

---

## Component Architecture

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout: fonts, theme, PostHog, AppShell
│   ├── page.tsx                  # Landing page
│   ├── dashboard/                # 8 dashboard pages
│   │   ├── visa-bulletin/        # Priority Date Cortex
│   │   ├── employer/             # Sponsor Reliability Score
│   │   ├── wage/                 # Wage Intelligence Hub
│   │   ├── eb-category/          # EB Category Comparison
│   │   ├── geographic/           # Geographic Heatmaps
│   │   ├── job-demand/           # Occupation Demand
│   │   ├── processing/           # Processing Speed
│   │   └── approvals/            # USCIS Approvals
│   ├── insights/                 # My Insights (personalized)
│   ├── ask/                      # RAG-powered Q&A
│   ├── about/                    # About page
│   ├── privacy/                  # Privacy Policy
│   └── terms/                    # Terms of Use
│
├── components/
│   ├── layout/                   # AppShell, Sidebar, Footer
│   ├── ui/                       # Reusable primitives (GlassCard, NumberTicker, StatCard)
│   ├── providers/                # ThemeProvider, PostHogProvider
│   ├── srs/                      # Sponsor Reliability Score components
│   ├── pdi/                      # Priority Date Index components
│   └── wage/                     # Wage Intelligence components
│
├── lib/
│   ├── data/                     # Data loaders (one per dashboard topic)
│   │   ├── loader.ts             # Generic JSON fetcher
│   │   ├── srs.ts                # SRS data loading + efs→srs remap
│   │   ├── pdi.ts                # PD forecast loading + computation
│   │   ├── wage.ts               # Wage data loading + helpers
│   │   ├── eb-category.ts        # EB category movement data
│   │   ├── geographic.ts         # Geographic heatmap data
│   │   ├── soc-demand.ts         # SOC demand data
│   │   ├── processing.ts         # Processing speed data
│   │   └── backlog.ts            # Backlog estimates data
│   ├── search/                   # RAG search + LLM service
│   ├── security/                 # XSS prevention, input sanitization, CSP
│   ├── analytics/                # PostHog event helpers (typed)
│   └── utils/                    # cn(), formatting, barrel exports
│
├── types/
│   └── p2-artifacts.ts           # TypeScript interfaces for all P2 data schemas
│
└── __tests__/                    # Vitest test files (24 files, 545+ tests)
```

---

## Data Flow Pattern

Every dashboard follows the same pattern:

```
1. Page component mounts (src/app/dashboard/[name]/page.tsx)
      │
      ▼
2. useEffect triggers data loader (src/lib/data/[topic].ts)
      │
      ▼
3. Loader calls fetch('/data/dashboards/[topic]/[file].json')
      │
      ▼
4. JSON response parsed into TypeScript interfaces
      │
      ▼
5. State updated → React re-renders dashboard with real data
      │
      ▼
6. User interacts (filters, search, tooltips) → client-side only
```

All data files are served statically from `public/data/`. The browser fetches them like any other static asset. CloudFront caches and gzip-compresses them at the edge.

---

## Design System — "Aurora"

### Philosophy
Dark-first, glassmorphic, inspired by Linear/Vercel/Raycast. Every pixel must justify its existence.

### Key Tokens
- **Glass cards**: `backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl`
- **Gradient text**: `bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent`
- **Animations**: Framer Motion, easing `[0.25, 0.1, 0.25, 1]`, 50ms stagger
- **Typography**: Geist Sans (UI), Geist Mono (data/numbers)
- **Colors**: Blue (#3b82f6), Purple (#8b5cf6), Emerald (#10b981), Amber (#f59e0b), Rose (#f43f5e)

### Smart Visibility Principle
Never render a widget that would only show "please provide input". Hide input-gated components until input exists; show a CTA placeholder instead.

---

## Security Model

| Layer | Implementation |
|-------|---------------|
| XSS prevention | `escapeHtml()`, `stripHtml()`, `sanitizeTextInput()` |
| Prototype pollution | `secureSet()` blocks `__proto__` and `constructor` |
| Route validation | `isAllowedPath()` with prefix matching |
| URL sanitization | `sanitizeUrl()` blocks `javascript:`, `data:`, `vbscript:` |
| Secure storage | `secureGet/Set/Remove/ClearAll` with `compass_` prefix |
| CSP headers | Configured for CloudFront deployment |
| No secrets | Zero API keys in client bundle (except PostHog + optional Groq) |

---

## Testing Strategy

- **Framework**: Vitest 4.x + React Testing Library + happy-dom
- **Location**: `src/__tests__/` (24 files, 545+ tests)
- **Run**: `npm test` (single run), `npm run test:watch` (dev)
- **Mocking**: framer-motion, next/navigation, next/link, localStorage, fetch
- **Coverage**: Components, utilities, data loaders, security module

---

## Deployment

```bash
# 1. Sync data from P2
python3 scripts/sync_p2_data.py

# 2. Build static site
npm run build                    # → out/ (16 pages)

# 3. Deploy to S3
aws s3 sync out/ s3://BUCKET_NAME --delete

# 4. Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"
```

---

## Extension Points

To add a new dashboard:
1. Create P2 artifact (Parquet table)
2. Add to P3 sync script (`scripts/sync_p2_data.py`)
3. Create data loader (`src/lib/data/[topic].ts`)
4. Create page (`src/app/dashboard/[name]/page.tsx`)
5. Add TypeScript interfaces (`src/types/p2-artifacts.ts`)
6. Add analytics tracking (`analytics.dashboardViewed('name')`)
7. Add sidebar nav item
8. Add tests
9. Update `copilot-instructions.md` and `PROGRESS.md`
