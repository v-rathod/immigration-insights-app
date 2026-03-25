# Compass (P3) — Technical Architecture

> **Project:** immigration-insights-app  
> **Role:** User experience layer — the public-facing web application  
> **Last Updated:** March 11, 2026

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
│  │ Model JSON        │      │ JSON slices  │     │ slices + 94K     │  │
│  │ RAG chunks        │      │ Apply filters│     │ employer shards  │  │
│  └──────────────────┘      │ Consolidate  │     │ (~28 MB + shards)│  │
│                             │ into shards  │     └────────┬─────────┘  │
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
│   ├── providers/                # ThemeProvider, PostHogProvider, ErrorMonitor
│   ├── srs/                      # Sponsor Reliability Score components
│   ├── pdi/                      # Priority Date Index components
│   └── wage/                     # Wage Intelligence components
│
├── lib/
│   ├── data/                     # Data loaders (one per dashboard topic)
│   │   ├── loader.ts             # Generic JSON fetcher
│   │   ├── employer-shard.ts     # Unified shard loader + extractors
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
│   ├── monitoring/               # Sentry init + reportError() helper
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

### Employer Shard Architecture

Employer-specific data (SRS scores, wage trends, LCA filings, H-1B petitions, monthly metrics) is consolidated into **95,151 per-employer JSON shard files** rather than served as monolithic JSONs. This ensures every file stays under CloudFront's 20MB auto-compression limit.

```
public/data/employers/
├── _index.json          # employer_name → SHA-1 hash mapping (6 MB)
├── _search.json         # Compact search index (14 MB, <20 MB limit)
│                        # Keys: n(name), id, f(filings), sc(soc_codes),
│                        #        ms(median_salary), y(year), ss(srs_score), st(tier)
├── {sha1_hash}.json     # Per-employer shard (avg 13.6 KB, max ~1 MB)
│   ├── employer_name
│   ├── employer_id
│   ├── lca[]            # LCA filing records
│   ├── h1b_petitions[]  # H-1B petition years
│   ├── wage_roles[]     # Top roles by filings
│   ├── wage_trend[]     # Annual salary trend
│   ├── wage_role_trends[]  # Per-role percentile data
│   ├── srs{}            # SRS scores + subscores (efs→srs remapped on read)
│   └── srs_monthly[]    # Monthly filing metrics
└── ... (95,151 shards total)
```

**Loading pattern** (implemented in `src/lib/data/employer-shard.ts`):

```
1. Page mounts → loadEmployerSearch()       # 14 MB search index (cached)
2. User selects employer → loadEmployerShard(id)  # 3-50 KB single shard
3. Extractors parse shard sections:
   - extractSrsFromShard()     → SponsorReliabilityScore (remaps efs→srs)
   - extractMonthlyMetrics()   → EmployerMonthlyMetric[]
   - extractWageTrend()        → EmployerSalaryTrend[]
   - extractWageRoles()        → LcaFiling[]
   - extractWageRoleTrends()   → EmployerRoleTrend[]
```

Pre-computed aggregates avoid loading shards for overview stats:
- `dashboards/employer/srs_overview.json` (214 bytes) — total/rated counts, avg score, tier distribution
- `_freshness.json` (49 bytes) — last sync timestamp

---

## Data Loader Modules

| Module | Small files (synced JSONs) | Shard-based (per-employer) |
|--------|--------------------------|---------------------------|
| `employer-shard.ts` | `_search.json`, `srs_overview.json`, `_freshness.json` | Individual shard files |
| `srs.ts` | `employer_friendliness_scores_ml.json`, `employer_risk_features.json` | — (delegated to employer-shard) |
| `wage.ts` | `salary_benchmarks_*.json`, `soc_salary_market.json`, `employer_wage_rankings.json` | — (delegated to employer-shard) |
| `pdi.ts` | `pd_forecasts.json`, `fact_cutoff_trends.json` | — |
| `eb-category.ts` | `category_movement_metrics.json` | — |
| `geographic.ts` | `worksite_geo_metrics.json` | — |
| `soc-demand.ts` | `soc_demand_metrics.json` | — |
| `processing.ts` | `processing_times_trends.json`, `fact_uscis_approvals.json` | — |
| `backlog.ts` | `backlog_estimates.json`, `queue_depth_estimates.json` | — |

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

## Error Monitoring

Production debug stack for a zero-backend SPA. No server logs exist, so all visibility comes from the client.

```
Unhandled JS error / Promise rejection
          │
          ▼
 ErrorMonitor (src/components/providers/error-monitor.tsx)
          │
    ┌─────┴──────────────┐
    │                    │
    ▼                    ▼
Sentry                PostHog
(stack trace,         (error_occurred event,
 source maps,          correlates with session:
 session replay,       which page, which filters,
 release tracking,     user's profile state)
 Slack alerts)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/monitoring/index.ts` | Sentry init + `reportError()` helper |
| `src/components/providers/error-monitor.tsx` | Global window error + unhandledrejection handlers |
| `src/lib/analytics/index.ts` → `errorOccurred()` | PostHog event for error correlation |

### Environment Variables

```env
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/12345
NEXT_PUBLIC_APP_VERSION=1.0.0          # optional; enables Sentry release tracking
NEXT_PUBLIC_APP_ENV=prod               # auto-tags every event
```

When `NEXT_PUBLIC_SENTRY_DSN` is absent, Sentry silently skips init — local dev and tests work without configuration.

### Debugging Production Issues

| Symptom | Where to look |
|---------|---------------|
| Crash / white screen | Sentry → Issues → Latest events + session replay |
| Error trend spike | PostHog → Events → filter `error_occurred` → breakdown by `page` or `error_type` |
| "It worked for me" | Sentry breadcrumbs → sequence of actions before the crash |
| Slow load | PostHog → `data_loaded.load_time_ms` + Sentry performance traces |
| User-reported bug | PostHog → Persons → find their session → replay |

### Manual Error Reporting

For known error boundaries (data load failures, caught exceptions), call `reportError()` directly:

```typescript
import { reportError } from '@/lib/monitoring';

try {
  const data = await loadEmployerShard(id);
} catch (err) {
  reportError(err as Error, { employerId: id, page: '/dashboard/employer' });
  // also update UI state
}
```

---

## Testing Strategy

- **Framework**: Vitest 4.x + React Testing Library + happy-dom
- **Location**: `src/__tests__/` (26 files, 601+ tests)
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
