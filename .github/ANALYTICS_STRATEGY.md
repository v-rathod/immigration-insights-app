# Analytics Strategy — PostHog Instrumentation

**Read this file when:** Adding new UI features, pages, dashboards, or user interactions.
**Auto-updated by:** Manual updates only (event types are stable).
**Referenced in:** copilot-instructions.md → "Refer to ANALYTICS_STRATEGY.md"

---

## Overview

**Every UI change must keep PostHog instrumentation in sync.** Broken tracking is a silent bug — it never throws an error but produces misleading data.

### Analytics Stack
- **SDK**: `posthog-js` — initialised in `src/components/providers/posthog-provider.tsx`
- **Event helpers**: `src/lib/analytics/index.ts` — all tracking calls go through `analytics.*`
- **Config**: `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` in `.env.local`
- **Dashboard**: `app.posthog.com` (free cloud, works identically on localhost and AWS/CloudFront)

---

## When you MUST update analytics

| Change | Required analytics update |
|--------|--------------------------|
| **New dashboard page** | Add `analytics.dashboardViewed('your-dashboard-name')` in the data-load `.finally()` block. Add the name to the `DashboardName` union type in `analytics/index.ts`. |
| **New filter / toggle / pill** | Add `analytics.filterChanged({ dashboard, filter, value })` in the handler or effect. |
| **New page route** | Add the page name to the `PageName` union type in `analytics/index.ts`. PostHogProvider autocaptures `$pageview` but named pages give cleaner PostHog queries. |
| **Employer / entity selection** | Add `analytics.employerSelected(...)` or create a new typed event helper. |
| **New user input that unlocks a panel** | Add `analytics.insightPanelUnlocked(panel)` when the panel becomes visible. |
| **New RAG/search interaction** | Add `analytics.ragQuestionAsked(...)`. |
| **New sidebar nav item** | No change needed — `analytics.navItemClicked` fires on all items automatically. |
| **Rename a dashboard route** | Update the `DashboardName` type and all `dashboardViewed` call sites. |
| **Remove a feature** | Remove the corresponding `analytics.*` call and update the type union if needed. |
| **New data file loaded** | Optionally call `analytics.dataLoaded({ source, bytes, loadTimeMs, dashboard })` after fetch to track payload sizes. |

---

## How to add a new custom event

Follow this pattern to add new analytics events:

```typescript
// 1. Add helper to src/lib/analytics/index.ts
function myNewEvent(params: { foo: string; bar: number }) {
  capture("my_new_event", { foo: params.foo, bar: params.bar });
}

// 2. Export it
export const analytics = {
  ...,
  myNewEvent,
};

// 3. Call it at the right moment (from use client component only)
analytics.myNewEvent({ foo: "value", bar: 42 });
```

---

## Critical Rules

### ❌ Never do this
- **Don't call `posthog.capture()` directly** — always go through `analytics.*` so events stay typed and consistent
- **Don't include PII** — no raw user-typed text, no employer names, no priority dates. Use buckets/tiers/counts instead.
- **Don't add analytics to server components** — PostHog SDK is client-only. Only call `analytics.*` from `"use client"` components or event handlers

### ✅ Always do this
- **Check `src/lib/analytics/index.ts` first** — see what event helpers already exist before creating new ones
- **Use typed events** — the `DashboardName`, `PageName`, `FilterName` unions enforce consistency
- **Test locally** — enable PostHog in `.env.local` and verify events appear in `app.posthog.com` before deploying

---

## Current Event Types (as of last update)

- `dashboardViewed(name: DashboardName)`
- `filterChanged(dashboard, filter, value)`
- `employerSelected(srsScore, employerName?, tierCount?)`
- `ragQuestionAsked(question, topicTag?, answerType?)`
- `navItemClicked(itemName, itemGroup?)`
- `contactSubmitted(category, hasEmail?)`
- `insightPanelUnlocked(panelName)`
- `dataLoaded(source, bytes, loadTimeMs, dashboard?)`

For complete list, see `src/lib/analytics/index.ts`.
