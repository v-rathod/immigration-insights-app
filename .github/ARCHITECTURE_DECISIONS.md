# Architecture Decisions Log

**Read this file when:** Understanding why technical choices were made, evaluating alternatives, or planning major refactors.
**Auto-updated by:** Manual updates when major architectural decisions are made (quarterly review).
**Referenced in:** copilot-instructions.md → "Refer to ARCHITECTURE_DECISIONS.md"

---

## 🔄 How to Maintain This File

**When to update:**
- ✅ After a major architectural decision is made (new tech choice, new pattern, etc.)
- ✅ Quarterly review to verify decisions are still valid
- ✅ When a previous decision is superseded (mark old decision as DEPRECATED)

**When NOT to update:**
- ❌ Bug fixes or feature additions (update other files instead)
- ❌ Test additions (update TEST_AUDIT.md instead)
- ❌ Component styling (update UI_DESIGN_PRINCIPLES.md instead)

**How to update:**
```bash
# Making a major architectural change?
# 1. Document the decision in this file with:
#    - Decision: What was chosen?
#    - Rationale: Why this choice?
#    - Trade-offs: What's the cost?
#    - Alternatives considered: What else could we do?
# 2. Implement the decision in code
# 3. Commit architecture file + code together
```

**Who should do it:** Tech lead or senior developer (after design review).

**Frequency**: Not frequent (strategic decisions, not per-commit).

---

## Rationale for Key Technical Choices

### Frontend Architecture

| Decision | Rationale |
|----------|----------|
| **Static export only** (`output: 'export'` in next.config.ts) | No API routes, no server-side rendering, no server components that fetch at runtime. All data is pre-built JSON served from S3/CloudFront. Zero backend infrastructure. |
| **Zero backend** | No Lambda, no database, no API Gateway. Cost efficiency ($1–3/month vs $100+/month for traditional backend). Every piece of data is pre-computed in P2 Meridian and consumed as JSON. |
| **AWS cost < $5/month** | S3 static hosting ($0.02/month) + CloudFront CDN (free tier for modest traffic) + Route 53 ($0.50 for DNS) + ACM (free SSL). No compute, no data transfer charges. Trade-off: no personalization at runtime (accept it). |
| **No heavy compute at runtime** | All ML models, forecasts, aggregations pre-computed in P2. Compass only reads and renders. Browser-side filtering/searching via Fuse.js is ~150ms and acceptable. |
| **Client-side only interactivity** | Search, filtering, personalization all run in browser. Reduces latency, eliminates backend dependency, lowers cost. Trade-off: data must fit in browser memory (mitigation: paginate, lazy-load, compress). |

### Technology Stack

| Decision | Rationale |
|----------|----------|
| **Next.js 16 (App Router)** | ESM-native, modern DX, built-in static export support, TypeScript-first, React 19 ready. |
| **TypeScript strict mode** | Catches type errors at build time, prevents `any` types, forces explicit contracts. Reduces runtime bugs. Zero technical debt debt in type system. |
| **Tailwind CSS 4.x** | Utility-first, no build overhead with static export, generates only used classes, consistent design system, mobile-first responsive. Alternative (CSS Modules) => more boilerplate. |
| **shadcn/ui (Radix UI)** | Unstyled, accessible primitives. Avoid Material-UI (too heavy, opinionated). Avoid Chakra (runtime overhead). shadcn wins: ship only what you use, full control, Aurora design system overlay. |
| **Recharts** | React-native charting (no Canvas/SVG gymnastics), responsive, legend + tooltip support, small bundle (~65KB gzipped). Alternative (D3) => steep learning curve, verbose, often overkill. |
| **react-simple-maps** | Lightweight SVG maps, TopoJSON support, drill-down via click, no API key needed (open US atlas). Alternative (Google Maps) => $0.007/request, overkill for static choropleth. |
| **Framer Motion** | Declarative animations, spring physics, easy easing control, TypeScript support. Alternative (react-spring) => verbose, complex syntax. Alternative (CSS animations) => can't respond to user state. |
| **Fuse.js** | Client-side fuzzy search, no server needed, ~7KB, works with large arrays (402K employers in memory), fast (~150ms for full search). Trade-off: data in browser. |

### Data & State

| Decision | Rationale |
|----------|----------|
| **EFS→SRS remap at load boundary** | P2 JSON uses `efs`, `efs_tier`, `efs_ml` field names. P3 remaps to `srs`, `srs_tier`, `srs_ml` in data loaders so all downstream code uses consistent SRS naming. Prevents name coupling to P2 internals. |
| **NaN normalization** | P2 JSON contains `NaN` values for unrated employers. JavaScript `NaN == NaN` is false, breaks logic. Remapper converts `NaN` → `null` at load boundary. Filters use `srsScore !== null`. |
| **PDI loads on homepage** | `pd_forecasts.json` is 342KB — small enough for client-side fetch on page load. SRS data (138MB) is too large; use static teaser instead. Strategy: load what's needed, lazy-load heavy data. |
| **EB2/IND/DFF as PDI defaults** | Most common EB immigrant profile. Provides immediate value without user configuration. User can adjust; defaults are smart. |
| **localStorage for profile** | User inputs (priority date, employer, category, etc.) stored in browser. No backend cookies, no tracking. User controls their data. Use `secureGet/Set/Remove/ClearAll` wrappers with `compass_` prefix to avoid conflicts. |

### Testing

| Decision | Rationale |
|----------|----------|
| **Vitest + happy-dom (not jsdom)** | jsdom's `html-encoding-sniffer` → `@exodus/bytes` is ESM-only but loaded via CJS require() — creates module resolution mess. happy-dom is lighter, ESM-compatible, sufficient for RTL tests. |
| **Setup.ts global mocks** | Mocks `matchMedia`, `IntersectionObserver`, `localStorage` once per suite. localStorage cleared in `beforeEach` to prevent state leaking. Prevents test interdependencies. |
| **Playwright for E2E** | Fast, runs real browser, mobile testing out-of-box, screenshots on failure, no flakiness. Mobile-first: iPhone 14 baseline (390px). |
| **Live-data tests with DATA_AVAILABLE guard** | Tests that load from `public/data/` must skip gracefully in CI (data is gitignored). Guard pattern prevents `readFileSync` crashes before Vitest can skip. |

### Security

| Decision | Rationale |
|----------|----------|
| **Input sanitization at boundary** | All user input (search text, dates, numbers) validated in `src/lib/security/index.ts`. Prevents XSS, injection, overflow attacks. |
| **XSS prevention** | `escapeHtml()`, `stripHtml()`, `sanitizeTextInput()` for any user text. React's `dangerouslySetInnerHTML` never used (except in MDX, which is sanitized). |
| **Prototype pollution defense** | `secureSet()` blocks `__proto__` and `constructor` in serialized data. Prevents object mutation attacks. |
| **Route allowlisting** | `isAllowedPath()` prevents open redirects. Exact match for `/`, prefix match for `/dashboard/`. Never use untrusted URLs in `href`. |
| **localStorage with prefix** | All keys prefixed with `compass_` to avoid collisions. `secureGet/Set/Remove/ClearAll` wrappers enforce this. No sensitive data stored (no API keys, passwords, tokens). |
| **CSP headers** | Content-Security-Policy configured for CloudFront deployment. Blocks inline scripts, restricts font/image sources, prevents clickjacking. |

### Deployment

| Decision | Rationale |
|----------|----------|
| **deploy.sh (always use, never raw aws s3 sync)** | Script uses `--exact-timestamps` to prevent stale HTML. Raw `aws s3 sync` will skip re-uploading unchanged files, causing CSS hash mismatches that break styling. Script runs pre-flight checks, post-deploy smoke tests. Prevents deployment disasters. |
| **S3 + CloudFront + Route 53** | Terraform-managed infrastructure. S3 for static hosting, CloudFront for CDN + caching + HTTPS, Route 53 for DNS. All managed services, no servers. Cost: ~$1–3/month. |
| **Blocking theme script in <head>** | Industry-standard (next-themes, Vercel.com) — reads localStorage and applies CSS class in `<head>` BEFORE React hydrates. Prevents Flash of Unstyled Content (FOUC). suppressHydrationWarning set on `<html>`. |

### Analytics

| Decision | Rationale |
|----------|----------|
| **PostHog (not Segment/Mixpanel)** | PostHog self-hosted or cloud, free tier sufficient, session recording (text masked), event-based, Slack integration, API-driven. Alternative (Google Analytics) => overly complex for single-page app. |
| **QA cache → chunk retrieval → LLM (future Ask feature)** | Tier 1 (QA cache): pre-computed answers, instant, free. Tier 2 (chunks): Fuse.js search, higher recall, still free. Tier 3 (LLM): only if no tier 1/2 match, costs money. Minimizes LLM calls. |
| **Groq free cloud LLM** | Groq runs Llama 3.3 70B on custom LPU hardware. Free tier: 30 RPM / 14,400 RPD (enough for dev/testing). OpenAI (GPT-4o-mini) reserved for production (behind CloudFront proxy, ~$0.0006/query, cached). |

---

## Strategic Trade-offs

### Throughput vs Cost
- **Choice**: Client-side search (Fuse.js) in browser memory
- **Trade-off**: Data must fit in browser RAM (~500MB for employer shards), search latency ~150ms
- **Justification**: Saves backend server cost (~$100+/month), zero infrastructure, user controls privacy

### UX Simplicity vs Data Freshness
- **Choice**: Static export, refresh weekly via P2 automation
- **Trade-off**: No real-time data updates, users see data up to 7 days stale
- **Justification**: Immigration data changes slowly (USCIS publishes monthly), weekly refresh is sufficient. No real-time value for user audience.

### Feature Completion vs Deployment Speed
- **Choice**: Launch MVP with 8 dashboards + SRS + PDI, defer Ask/Chat (Phase 5)
- **Trade-off**: RAG data ready (341 chunks, 719 QA pairs) but LLM integration deferred
- **Justification**: Core dashboards deliver immediate value. Ask feature adds complexity (LLM API, cost, latency) without clearing blocker. Revisit Q2 2026.

---

## Known Limitations & Future Improvements

1. **H-1B SRS Extension** — Current SRS scores PERM-only. H-1B-only employers show "Unrated". Strategic options documented in H1B_SRS_EXTENSION_ANALYSIS.md. Blocked: data staleness (FY2023, wait for FY2024+).

2. **Data Freshness Banner** — P2 publishes sync date in `_freshness.json`. Future: add banner on app showing "Last updated: March 20". Currently in backlog (Phase 6).

3. **Personalized Visual Dashboard** — Insights page has profile form + 3 panels (Green Card, Sponsor, Salary) but full custom dashboard mosaic deferred to Phase 4E.

4. **Performance Budget** — No explicit Lighthouse targets set yet. Page loads ~1.5s locally, ~2-3s on CloudFront. Future: set 90+ Lighthouse scores, implement lazy-loading for employer shards.

5. **Accessibility Cover** — WCAG 2.1 AA targeted. Full audit pending (no known blockers). Mobile touch targets verified (44px minimum).

---

## Decision Review Cadence

- **Quarterly**: Review test coverage, performance metrics, error rates
- **Semi-annually**: Review feature backlog (Phase 4/5), cost vs value (AWS bill, user engagement)
- **Annually**: Architecture assessment (static export still optimal? LLM costs? Data freshness?), technology refresh (Next.js upgrades, React patches)
