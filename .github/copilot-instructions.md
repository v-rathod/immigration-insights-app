# Compass (P3) — Copilot Instructions

> This file contains **stable rules, conventions, and pointers** for AI agents working on P3 Compass.
> It should NOT contain live data (test counts, build status, artifact inventories, deploy URLs).
> Live data lives in satellite files referenced below. **Update those files, not this one.**

---

## Identity & Program Context

**NorthStar** is the internal program name (never shown in UI). The web app is called **Compass**.

| Internal | Codename | Repository | Role |
|----------|----------|------------|------|
| P1 | **Horizon** | fetch-immigration-data | Data collection |
| P2 | **Meridian** | immigration-model-builder | Analytics & ML |
| P3 | **Compass** | immigration-insights-app (THIS REPO) | User experience |

Use P1/P2/P3 in code and internal comments. Use Horizon/Meridian/Compass in public-facing text.

### Cross-Project Documentation
```
/Users/vrathod1/dev/NorthStar/northstar-docs/
├── README.md              ← Program overview (start here)
├── NORTHSTAR_VISION.md    ← Architecture & vision
├── BEST_PRACTICES.md      ← Engineering standards
└── SETUP_GUIDE.md         ← Setup instructions
```

---

## Architecture Constraints (NON-NEGOTIABLE)

1. **Static export only** — `output: 'export'` in next.config.ts. No API routes, no server components that fetch at runtime, no middleware.
2. **Zero backend** — No Lambda, no database, no API Gateway. All data is pre-built JSON served from S3/CloudFront.
3. **AWS cost < $5/month** — S3 static hosting + CloudFront CDN + Route 53 DNS + ACM SSL. Nothing else.
4. **No heavy compute at runtime** — All ML models, forecasts, and aggregations are pre-computed in P2 Meridian. Compass only reads and renders.
5. **Client-side only** — All interactivity (search, filtering, personalization) runs in the browser.

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

### UI Copy Rules (MANDATORY)

9. **No em-dashes** — NEVER use `—` or `&mdash;` in user-facing text or JSX. Use `:` for labels, `,` or `;` for prose, `|` for metadata separators. En-dashes in numeric ranges are correct and must stay.
10. **No AI markers** — NEVER use: *unlock*, *discover*, *journey*, *empower*, *leverage*, *seamless*, *comprehensive*, *cutting-edge*, *revolutionize*, *delve*, *dive*, *holistic*, *tailored*, *supercharge*, *game-changing*, *transform* (as marketing filler). Use plain, direct language.

---

## Smart Visibility Principle (MANDATORY)

**Never render a widget whose only possible output is a "please provide input" message.** If a component requires user input to be meaningful, hide it entirely until input exists. Replace with a single clear CTA.

| Widget type | Rule |
|-------------|------|
| Input-gated results (predictions, personal forecasts) | Hidden until required input present. Show tasteful CTA. |
| Always-useful context (aggregate stats, search boxes) | Always visible. |
| State-dependent details (score gauges, detail cards) | Rendered only after entity selected. Rich empty state below the control. |

```tsx
{/* GOOD pattern */}
{hasData && !pd && (
  <div className="... rounded-2xl border border-dashed ...">
    <Target className="h-5 w-5 text-blue-400/70" />
    <p>Enter your priority date to see predictions</p>
  </div>
)}
{hasData && !!pd && <PredictionCard ... />}
```

---

## Standing Instructions (CRITICAL)

### Deployment
- Do NOT deploy to AWS without explicit user request
- **ALWAYS use `bash scripts/deploy.sh`** — NEVER run `aws s3 sync` directly
  - deploy.sh uses `--exact-timestamps` to prevent stale HTML with mismatched CSS/JS bundle hashes
  - It runs pre-flight checks and post-deploy smoke tests automatically

### Quality Gates (before every commit)
- `npm test` must pass with zero failures
- TypeScript strict mode: 0 errors
- ESLint: 0 errors
- Mobile tests required for UI changes (see MOBILE_DEVELOPMENT_GUIDE.md)

### Documentation Maintenance
After completing ANY feature, fix, or milestone:

1. **`PROGRESS.md`** — Add timestamped milestone entry (source of truth for all work)
2. **`NEXT_AGENT_CONTEXT.md`** — Update current state snapshot and session notes
3. Update the **relevant satellite file** from the table below if its domain was affected
4. **DO NOT update this instructions file** unless a fundamental rule or convention changes

---

## Satellite File Registry

> **This is the key design principle of our documentation system.**
> Live data, metrics, inventories, and status belong in satellite files, not here.
> This file only contains stable rules and pointers to those files.

### Where to Find What

| Need to know... | Read this file | When to update it |
|-----------------|---------------|-------------------|
| **Current project status, metrics, deploy state** | [NEXT_AGENT_CONTEXT.md](.github/NEXT_AGENT_CONTEXT.md) | Every session (update snapshot + session notes) |
| **Milestone history, what was done when** | [PROGRESS.md](../PROGRESS.md) | After every feature/fix (timestamped entry) |
| **Test counts, coverage, test patterns** | [TEST_AUDIT.md](./TEST_AUDIT.md) | When tests are added/removed |
| **P2 artifacts, data pipeline, dashboard mappings** | [DATA_CATALOG.md](./DATA_CATALOG.md) | When artifacts change or dashboards get new data sources |
| **File inventory, routes, component list** | [CODEBASE_INVENTORY.md](./CODEBASE_INVENTORY.md) | When files are created/deleted |
| **Deploy URLs, environments, S3/CF config** | [../ENVIRONMENTS.md](../ENVIRONMENTS.md) | When infra changes |
| **Technical architecture, data flow** | [../ARCHITECTURE.md](../ARCHITECTURE.md) | When architectural patterns change |
| **Full product guide, feature docs** | [../PRODUCT_GUIDE.md](../PRODUCT_GUIDE.md) | When features are added/changed |
| **UI design system (Aurora), color tokens** | [UI_DESIGN_PRINCIPLES.md](./UI_DESIGN_PRINCIPLES.md) | When design system changes |
| **Mobile rules, touch targets, responsive** | [MOBILE_DEVELOPMENT_GUIDE.md](./MOBILE_DEVELOPMENT_GUIDE.md) | When mobile rules change |
| **Security principles, input sanitization** | [SECURITY_UI_COPY_GUIDE.md](./SECURITY_UI_COPY_GUIDE.md) | When security standards evolve |
| **SEO metadata, JSON-LD, AI crawler config** | [SEO_STRATEGY.md](./SEO_STRATEGY.md) | When pages/routes are added |
| **Analytics events, PostHog setup** | [ANALYTICS_STRATEGY.md](./ANALYTICS_STRATEGY.md) | When event types change |
| **Architecture decisions, trade-offs** | [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) | When strategic choices change |
| **V2 redesign rationale** | [REDESIGN_V2.md](./REDESIGN_V2.md) | Reference only (completed) |

### Security Quick Reference (stable helpers, not counts)
- Use `sanitizeTextInput()` for user text
- Use `secureGet/Set/Remove/ClearAll()` for localStorage
- Use `escapeHtml()` for DOM output
- Never store API keys or passwords in client code

---

## New Session Checklist

When starting a new session, do these in order:

1. **Read [NEXT_AGENT_CONTEXT.md](.github/NEXT_AGENT_CONTEXT.md)** — Current state snapshot (5 min)
2. **Read [PROGRESS.md](../PROGRESS.md)** — Latest milestone for detailed context
3. **Run `npm test`** — Verify everything passes
4. **Check `git status`** — See if anything is uncommitted
5. Consult satellite files above as needed for your specific task

### Key Paths
```bash
# P3 (This Repo)
cd /Users/vrathod1/dev/NorthStar/immigration-insights-app

# P2 (Meridian) — Data & Models
cd /Users/vrathod1/dev/NorthStar/immigration-model-builder

# P1 (Horizon) — Data Collection (reference only)
cd /Users/vrathod1/dev/NorthStar/fetch-immigration-data
```

### Common Commands
```bash
npm run dev          # Local dev server (localhost:3000)
npm run build        # Static export to out/
npm test             # Run all tests (Vitest)
npm run lint         # ESLint
python3 scripts/sync_p2_data.py   # Sync P2 artifacts -> public/data/
bash scripts/deploy.sh             # Full deploy (build + S3 + CloudFront + smoke test)
bash scripts/deploy.sh --skip-build  # Deploy existing build
```

### Workflow Patterns
1. **Code change** -> `npm test` -> `npm run build` -> commit -> push
2. **Data sync** -> `python3 scripts/sync_p2_data.py` -> update types/loaders if needed -> commit
3. **Deploy** -> Only with explicit user request -> `bash scripts/deploy.sh`

---

## VS Code Configuration

Terminal commands are auto-approved for AI agent workflows:
- Package managers: `npm run`, `npm test`, `npx`
- Runtimes: `node`, `python3`
- Version control: `git add/commit/push/pull`
- Process management: `pkill`, `killall`, `pgrep`
- Multi-line commands: heredocs, pipes, `&&`/`||`

---

## V2 Redesign Context

The V2 redesign is complete. Key design rules that persist:
- **levels.fyi inspiration**: Data visible immediately, no marketing pitch
- **Independent tools**: Each dashboard serves independently (employer -> employer dashboard, PD -> visa-bulletin dashboard). NOT driving users toward profile creation.
- See [REDESIGN_V2.md](./REDESIGN_V2.md) for design rationale if modifying insights or sidebar.
