# SEO & AI Agent Discovery Strategy

**Read this file when:** Creating new pages, updating content, deploying to production, or integrating with AI crawlers.
**Auto-updated by:** Manual updates when routes are added/removed.
**Referenced in:** copilot-instructions.md → "Refer to SEO_STRATEGY.md"

---

## 🔄 How to Maintain This File

**When to update:**
- ✅ Immediately after creating a new route/page (e.g., `/dashboard/new-feature`)
- ✅ When a page is deleted (remove from metadata table)
- ✅ When page title/purpose changes (update metadata)

**How to update:**
```bash
# Adding a new page?
# 1. Create src/app/new-route/page.tsx
# 2. Add metadata row to "Per-Page Metadata" table in this file
# 3. Implement metadata in your page's getMetadata function
# 4. Add route to public/sitemap.xml
# 5. Commit all together

# Before deployment:
# - Verify all pages have metadata in this file
# - Check sitemap.xml has all routes
# - Verify robots.txt and llms.txt are current
```

**Who should do it:** Developer adding the page (update SEO metadata while creating route).

**Frequency:** Every time a route is added/removed (not in copilot-instructions.md — this file gets updated instead).

---

## Overview

Compass is optimized for both human discovery (Google, Bing) and AI agent crawling (ChatGPT, Claude, Perplexity, etc.). Every page MUST follow metadata and JSON-LD standards.

---

## Per-Page Metadata Requirements

Every page MUST have either `layout.tsx` (for page groups) or metadata export in `page.tsx` (for individual pages) with:

### Required Metadata
- **title** — unique, descriptive, keyword-rich (50-60 chars)
- **description** — 150-300 chars, includes primary keywords, user-focused
- **keywords** — 8-19 relevant terms, comma-separated
- **canonical URL** — `alternates.canonical` pointing to production URL with trailing slash
- **Open Graph** — title, description, url, images (1200x630 `og-image.png` for each page)

### Example Metadata (from landing page)

```typescript
export const metadata: Metadata = {
  title: "Compass — Immigration Insights & Predictions",
  description: "Priority date forecasts, employer sponsorship scores, wage benchmarks, and live dashboards for employment-based immigration.",
  keywords: ["immigration", "priority date", "sponsorship score", "visa bulletin", "wage"],
  alternates: {
    canonical: "https://compass-immigration.app/",  // Production URL
  },
  openGraph: {
    title: "Compass — Immigration Insights & Predictions",
    description: "...",
    url: "https://compass-immigration.app/",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};
```

---

## JSON-LD Structured Data

Add appropriate JSON-LD `<script type="application/ld+json">` to enable rich snippets and AI understanding.

### By Page Type

| Page Type | JSON-LD Schema | Where | Purpose |
|-----------|----------------|-------|---------|
| **Dashboard** | `FAQPage` or `Dataset` | Root layout or dashboard page | Q&A schema for dashboards with natural user questions; Dataset for tabular data |
| **Interactive Tool** | `WebApplication` | `/insights`, `/ask` | Tool metadata, action URLs, sample requests |
| **About Page** | `AboutPage` | `/about` | Organization context, mission statement |
| **Root** | `@graph` with `WebSite` + `WebApplication` + `Organization` | Root layout | Comprehensive site structure |

### Dashboard Example (FAQPage)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is a priority date forecast?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "A priority date forecast predicts when your priority date will become current..."
      }
    }
  ]
}
```

### Root Example (@graph)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "name": "Compass",
      "url": "https://compass-immigration.app",
      "searchAction": {
        "@type": "SearchAction",
        "target": "https://compass-immigration.app/ask?q={search_term_string}"
      }
    },
    {
      "@type": "WebApplication",
      "name": "Compass",
      "applicationCategory": "BusinessApplication",
      "offers": [
        { "name": "Priority Date Forecasts", "@type": "Offer" },
        { "name": "Employer Sponsorship Scores", "@type": "Offer" }
      ]
    },
    {
      "@type": "Organization",
      "name": "Compass",
      "url": "https://compass-immigration.app",
      "sameAs": ["https://github.com/..."]
    }
  ]
}
```

---

## AI Agent Discoverability

### `public/llms.txt` (llmstxt.org standard)

Structured overview of site for LLM ingestion. Format:

```
# Compass — Immigration Insights & Predictions

## Page Overview
- Landing (/): Entry point, hero CTAs, 8 dashboards overview
- My Insights (/insights): Personalized 3-panel toolkit
- Visa Bulletin (/dashboard/visa-bulletin): Priority date forecasts
- [... other pages ...]

## Feature List
- Priority Date Forecasting (historical + 24-month forecast)
- Employer Sponsorship Scoring (70K+ employers rated)
- Salary Benchmarking (H-1B wage data by SOC)
- [... other features ...]

## Data Sources
- USCIS visa bulletin (monthly)
- LCA visa petition database (H-1B, L-1, etc.)
- Bureau of Labor Statistics (SOC wages)
- [... other sources ...]

## Contact
support@compass-immigration.app
```

**Updated when:**
- New page route added
- New dashboard launched
- Feature added or renamed
- Data sources updated

### `public/robots.txt`

Allow 9 major AI crawlers: `Googlebot`, `Bingbot`, `Claudebot`, `Perplexity`, `CCBot`, `GPTBot`, `ChatGPT`, `Gemini`, `Llama`.

```
User-agent: *
Allow: /
Disallow: /.next/
Disallow: /pages/api/

User-agent: GPTBot
Allow: /

User-agent: Claudebot
Allow: /

[... other crawlers ...]
```

**Updated when:**
- New AI crawler emerges (e.g., Anthropic adds new bot)
- Release new API endpoints (currently none, but future-proof)

### `public/manifest.webmanifest`

PWA metadata for mobile "Add to Home Screen" and app discovery.

```json
{
  "name": "Compass — Immigration Insights",
  "short_name": "Compass",
  "description": "...",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

---

## When to Update SEO Files

| Change | Required Updates |
|--------|-----------------|
| **New page route** | 1) Create `layout.tsx` with full metadata. 2) Add to `sitemap.xml`. 3) Add description to `llms.txt`. 4) Add JSON-LD if applicable. |
| **New dashboard** | 1) Add FAQPage or Dataset JSON-LD. 2) Update `sitemap.xml`. 3) Update `llms.txt` (page list + feature list). |
| **Dashboard renamed** | 1) Update title, description, URLs in all metadata. 2) Update `sitemap.xml`. 3) Update `llms.txt`. 4) Redirect old URL (if applicable). |
| **Feature added** | 1) Update featureList in root layout JSON-LD. 2) Update `llms.txt` feature section. 3) Update page-specific metadata descriptions. |
| **Page removed** | 1) Remove from `sitemap.xml`. 2) Remove from `llms.txt`. 3) Add 301 redirect if high-traffic (e.g., `/old-page` → `/new-page`). |
| **Data sources updated** | 1) Update root JSON-LD `sameAs` links. 2) Update `llms.txt` data sources. 3) Update `/about` page (data sources section). |

---

## Metadata Checklist (Before Commit)

For **every new page or page update**:

- [ ] Title (50-60 chars, keyword-rich)
- [ ] Description (150-300 chars, matches user intent)
- [ ] Keywords (8-19 terms, realistic)
- [ ] Canonical URL (trailing slash, production domain)
- [ ] Open Graph image (1200x630, on `public/`)
- [ ] JSON-LD schema (FAQPage, Dataset, WebApplication, etc.)
- [ ] `sitemap.xml` updated (if new route)
- [ ] `llms.txt` updated (if new route or feature)
- [ ] `robots.txt` updated (if new disallowed path)

---

## Multi-Environment Deployment

### Three Tiers via `NEXT_PUBLIC_APP_ENV`

| Environment | URL | Config | Use Case |
|-------------|-----|--------|----------|
| `dev` | `http://localhost:3000` | `.env.local` | Local development |
| `stage` | `https://stage.immigrationcompass.fyi` | `.env.stage` + `scripts/deploy-envs.conf` | Staging, pre-prod validation |
| `prod` | `https://immigrationcompass.fyi` | `.env.production` + `scripts/deploy-envs.conf` | Production, live site |

### Deployment

```bash
# Deploy to staging
bash scripts/deploy.sh --env stage

# Deploy to production
bash scripts/deploy.sh --env prod
```

See `ENVIRONMENTS.md` for full multi-env guide.

---

## Common SEO Mistakes (Avoid!)

❌ **No metadata on page** → Tool crawlers skip it, no rich snippets, SEO penalty
❌ **Duplicate titles** → Confuses search algorithms, reduces CTR
❌ **Vague descriptions** → Low click-through rate from search results
❌ **No canonical URL** → Search engines may penalize as duplicate content
❌ **Missing Open Graph** → No preview in social media shares
❌ **Hard-coded URLs in metadata** → Breaks on staging/multi-env deploys (use production domain)
❌ **JSON-LD only on root** → Crawlers expect page-specific schema
❌ **robots.txt too restrictive** → AI crawlers can't ingest your content

---

## SEO Testing Checklist (Before Production Deploy)

1. **Metadata presence**: Run `npm run predeploy-checks` to validate all pages have metadata
2. **JSON-LD validity**: Use schema.org JSON-LD validator
3. **Open Graph preview**: Share a link on Twitter/LinkedIn, verify preview image
4. **Canonical URLs**: Verify all point to production domain (HTTPS, trailing slash)
5. **sitemap.xml**: Validate with `https://www.sitemaps.org/validators.html`
6. **robots.txt**: Test that AI crawlers aren't blocked (`curl -I -A "GPTBot" https://...`)
7. **Mobile rendering**: Test on mobile (Google Mobile-Friendly Test)

---

## Notes for Future AI Crawler Integration

- **OpenAI SearchGPT**: Respects `robots.txt` + `User-Agent: GPTBot`. Monitor Search Generative Experience (SGE) traffic.
- **Perplexity**: Crawls aggressively, respects `robots.txt` but may bypass. Consider blocking if abuse detected.
- **Custom Bots**: When new AI service emerges (e.g., xAI's Grok), add to `robots.txt` + test crawlability.
- **Rate Limiting**: No rate limiting currently (static site), but monitor for future abuse.
- **Content Freshness**: Update `dcterms:modified` in pages regularly so crawlers know when to re-fetch.
