# Next Agent Context & Handoff Guide

**Created**: 2026-03-23 after Milestone 16.1 (Employer name normalization comprehensive fix)  
**Updated**: 2026-03-25 — **Deployment stability hardened + artifact promotion** (Milestone 20.0)  
**Purpose**: Quick reference for the next agent starting a session. This supplements but doesn't replace PROGRESS.md, copilot-instructions.md, or ARCHITECTURE.md.

---

## Current State Snapshot

**Project Status**: ✅ **🚀 PRODUCTION LIVE** — Deployment stability hardened, artifact promotion ready

| Aspect | Status | Details |
|--------|--------|---------|
| **Unit Tests** | 1224 passing | 41 files, 32 skipped. All failures = 0. ✅ |
| **Post-Deploy: Smoke** | 47/47 passing | All page loads, bundle integrity, critical data files ✅ |
| **Post-Deploy: Comprehensive** | 191/191 passing | All 11 sections verified ✅ |
| **Build** | 18 HTML files | 16 pages + 404 variants. Static export (no backend). ✅ |
| **Type Safety** | 0 errors | TypeScript strict mode across all 75+ source files ✅ |
| **Lint** | 0 errors | ESLint passing ✅ |
| **Stage Deploy** | Live ✅ | `d10immmzyp7xgr.cloudfront.net` — 15/15 pages HTTP 200 ✅ |
| **Prod Deploy** | **LIVE ✅** | `https://immigrationcompass.fyi` — commit `6e5b52f` pending deploy |
| **Zscaler Status** | **Approved ✅** | Corporate network firewall unblocked (2026-03-24 18:30) ✅ |
| **Data** | Fresh | P2 sync complete. 102K employer entries. ✅ |

### Multi-Environment Architecture

| Resource | Stage | Prod |
|----------|-------|------|
| **URL** | `d10immmzyp7xgr.cloudfront.net` (no custom domain) | `immigrationcompass.fyi` ✅ |
| **S3 Bucket** | `compass-stage-883107059193` | `compass-prod-883107059193` (live) ✅ |
| **CloudFront** | `E1LPLTVZ0035Q5` (`d10immmzyp7xgr.cloudfront.net`) | `EWRFYZRXA7HFE` (`d3sr5zz19rlvju.cloudfront.net`) |
| **ACM Cert** | None (removed: Zscaler blocks custom domains) | `3dbb1567...` (ISSUED & ACTIVE) |
| **Terraform** | Default workspace / `stage.tfvars` | Prod workspace / `prod.tfvars` |
| **CloudWatch** | `Compass-Stage-Operations` | `Compass-Prod-Operations` |
| **DNS Zone** | N/A | `Z08038301M0XIKARMVXCB` (Route 53) |

---

## Deployment Workflow (Updated Milestone 20.0)

### Stage Deploy
```bash
bash scripts/deploy.sh              # build + S3 sync + CF invalidation + smoke tests
bash scripts/deploy.sh --skip-build # skip npm build, redeploy existing out/
```

### Prod Deploy (Artifact Promotion — PREFERRED)
```bash
bash scripts/promote-to-prod.sh
# What it does:
#   1. Verify stage HTTP 200 + smoke check
#   2. Promote employer shards: stage S3 → prod S3 (server-side, ~30s)
#   3. Rebuild main site with NEXT_PUBLIC_APP_ENV=prod (~2 min)
#   4. Deploy via deploy.sh --skip-build (CF invalidation + smoke tests)
```

### NEVER do this (causes blank site)
```bash
# ❌ FORBIDDEN: bypasses CloudFront invalidation
aws s3 sync out/ s3://compass-prod-883107059193/
aws s3 cp out/index.html s3://...
```

---

## What Happened This Session (2026-03-25)

### Milestone 20.0: Deployment Stability + Artifact Promotion

**Root cause fixes** (commit `6e5b52f`):
- `animations.tsx`: `useMounted()` — SSR renders visible div, no opacity:0 blank pages
- `browser-smoke-test.mjs`: fixed URL arg (was hardcoded `localhost:3000`), https support, FAQ added
- `smoke-test.mjs`: FAQ page check added

**New capabilities** (this session, uncommitted):
- `src/lib/env.ts`: `getEnvironment()` — hostname detection overrides baked-in env var
  - Same bundle works on stage and prod, correct env tag based on runtime URL
  - `immigrationcompass.fyi` → "prod", `localhost` → "dev", anything else → "stage"
- `scripts/promote-to-prod.sh`: stage-gated artifact promotion for prod
- `src/__tests__/env.test.ts`: 16 tests — all pass
- GUARDRAILS.md: Commandments #4 and #11 updated with promote-to-prod.sh doctrine

### Milestone 19.0: Production Go-Live Completion + Zscaler Approval ✅
- **Schema.org enhancement**: Added SearchAction, dates, images, author fields
- **Sitemap fixed**: Removed duplicate entries (78 lines), now parses correctly
- **CloudFront cache**: Full global invalidation completed
- **Facebook cache**: Cleared, updated meta tags live
- **✅ ZSCALER APPROVED**: Domain now accessible on corporate network (HTTP 200 confirmed)
- **All tests verified**: 238/238 post-deploy tests passing on production

### Milestone 18.0: Production Go-Live (Phase 2+3)
- **Stage simplified**: Removed custom domain (Zscaler blocks it), Terraform destroyed 5 resources
- **URL migration**: All 18+ files updated from CloudFront URL to `immigrationcompass.fyi`
- **Legal compliance**: Privacy policy (PostHog disclosure), Terms (liability limitation), security.txt
- **Security headers**: All 7 validated present via CloudFront function
- **Prod deploy completed**: 254 main files + 95K employer shards uploaded ✅

### Milestone 17.0: Multi-Environment Architecture (Previous Session)
- **Implemented**: Full AWS resource isolation between stage and prod
- **Terraform refactoring**: dns.tf rewritten with zone ownership model, main.tf cleaned up
- **New resources**: Stage S3 (`compass-stage-883107059193`), Stage ACM cert, Stage Route 53 records
- **CloudWatch**: Environment-prefixed dashboards and alarms
- **GUARDRAILS.md**: Added Commandment #9 (Environment Isolation)
- **Stage deployed**: 238/238 post-deploy tests passing
- **Known issue**: Custom domains blocked by Zscaler (corporate proxy); CloudFront URLs work fine
- **Old bucket**: `compass-immigration-insights-883107059193` cleanup initiated (no longer terraform-managed)

### Milestone 16.1: Employer Name Normalization - Comprehensive Fix + Widget Tests
- **Bug discovered**: Two places missing employer name normalization
  1. WageIntelligenceHub line 389 — Search enrichment lookup
  2. EmployerWageTable line 46 — Trend filtering for sparklines
  
- **Fixed & tested**: 8 new comprehensive test cases verify entire flow works
  - Commit: `c5a7954`
  - Tests: 1237 pass, +8 H1B widget tests

---

## Essential Reading (In Order)

1. **This file** — Quick reference. ✓
2. **PROGRESS.md** — Detailed history. Start at Milestone 16.0 and 16.1 (10 min).
3. **.github/GUARDRAILS.md** — 9 commandments including Commandment 9 (error monitoring).
4. **copilot-instructions.md** — Architecture and conventions (10 min).
5. **ARCHITECTURE.md** — Technical design + Error Monitoring section (15 min).

**For specific domains**:
- **Mobile dev**: See `.github/MOBILE_DEVELOPMENT_GUIDE.md` (11 rules).
- **UI design**: See `.github/UI_DESIGN_PRINCIPLES.md` (Aurora design system).
- **Security**: See `.github/SECURITY_UI_COPY_GUIDE.md` (8 principles).
- **SEO**: See `.github/SEO_STRATEGY.md` (per-page metadata).
- **Analytics**: See `.github/ANALYTICS_STRATEGY.md` (PostHog events).

---

## Quick Start Commands

```bash
# Verify everything works
npm test                        # All 1206 tests should pass
npm run build                   # Should generate 18 HTML files in out/
npx next build                  # Direct Next.js build (same as above)
npm run dev                     # Start dev server on http://localhost:3000

# Deploy (only with user permission)
bash scripts/deploy.sh          # Full deploy to stage (build + sync + smoke test)
bash scripts/deploy.sh --skip-build  # Use existing out/
bash scripts/deploy.sh --env prod --skip-build  # Prod deploy (rare)

# Data operations
python3 scripts/sync_p2_data.py # Sync latest P2 artifacts → public/data/
python3 scripts/_regen_search.py  # Regenerate employer search index

# Git workflow
git status                      # See uncommitted changes
git log --oneline -10           # Recent commits
git push origin main            # Push to remote (GitHub)
```

---

## Critical Constraints (DO NOT VIOLATE)

1. **Static export only**: No `getServerSideProps`, no API routes, no middleware. Config: `output: 'export'` in next.config.ts.
2. **Zero backend**: All data is pre-computed P2 artifacts as JSON. No runtime compute. No database queries.
3. **Build cost < $5/month**: S3 + CloudFront only. No Lambda, no RDS, no extra services.
4. **All tests must pass**: Before any commit: `npm test` → all 1206 must pass. No exceptions.
5. **TypeScript strict + 0 eslint errors**: Non-negotiable. Every file must be strict-compliant.
6. **No manual AWS CLI**: Always use `bash scripts/deploy.sh`. Raw `aws s3 sync` will break CSS bundle hashes on old HTML files.

---

## Architecture Overview (30-second summary)

```
┌─ Compass (P3) — This Repo ──────────────────┐
│  Next.js 16 static export → out/             │
│  • 50 React components                       │
│  • 9 dashboards + insights                   │
│  • 16 pages pre-rendered as HTML             │
│      ↓                                        │
│  S3 Bucket → CloudFront CDN → Global edge   │
│  • 95K employer shards                       │
│  • 102K employer search index                │
│  • ~500 MB total static site                 │
│  • Cost: ~$1-3/month                         │
└─────────────────────────────────────────────┘
         ↓ consumes
    P2 Meridian Artifacts
    (Parquet → JSON pre-computed)
```

**Data Flow**:
1. P2 produces 40+ parquet files + models
2. `sync_p2_data.py` converts to optimized JSON
3. `consolidate_employer_shards()` embeds data into 95K JSON shards
4. `next build` bundles everything into static HTML/CSS/JS
5. `deploy.sh` syncs to S3 + invalidates CloudFront
6. Users GET from CloudFront (globally distributed, instant)

---

## Common Tasks & Playbooks

### Adding a new dashboard
1. Create page in `src/app/dashboard/[name]/page.tsx`
2. Create data loader in `src/lib/data/[name].ts`
3. Create components in `src/components/[name]/`
4. Write unit tests for components
5. Write E2E test in `e2e/*.spec.ts`
6. Add to `DATA_CATALOG.md` artifact mapping
7. Run `npm test` → `npm run build` → commit

### Fixing a bug
1. Write test that reproduces bug (test should fail)
2. Fix code
3. Verify test passes
4. `npm test` (all 1206 must pass)
5. Commit with clear message

### Updating P2 data
1. Run `python3 scripts/sync_p2_data.py`
2. Verify new JSON in `public/data/`
3. Run `npm test` (real-data anchor tests validate)
4. If data is corrupt, run regeneration scripts (see PROGRESS.md Milestone 11.5)
5. `npm run build`
6. Deploy with `bash scripts/deploy.sh`

### Adding a new test
1. Create file: `src/__tests__/[feature].test.tsx` or `.test.ts`
2. Write tests (see TEST_AUDIT.md for patterns)
3. Run `npm test -- [feature]` to test just that file
4. Run `npm test` (all tests must pass)
5. Note: E2E tests go in `e2e/` and use Playwright

### Adding a regression test (after defect discovery)
1. **Identify the defect** — Document root cause in code comments
2. **Export helpers** — Make previously private functions testable (e.g., `normalizeEmployerName` export)
3. **Create test suite** — Add `describe("feature name (Milestone N regression)")` with:
   - Mock data that reproduces the bug (old code fails, new code passes)
   - Edge case tests for the normalization/fix logic
   - All affected cases in a parameterized test loop
   - Symmetry verification (if applicable)
4. **Update docs** — Add case study to TEST_AUDIT.md, decision note to ARCHITECTURE_DECISIONS.md
5. **Commit together** — Never commit hot-fix without regression suite
6. **Example**: Employer name mismatch (Milestone 14.0) — 25 tests covering case + spacing for 7 employers

### Updating documentation
1. For session milestones: Update `PROGRESS.md` with timestamped entry
2. For architecture changes: Update `ARCHITECTURE.md` and/or `PRODUCT_GUIDE.md`
3. For coding patterns: Update `copilot-instructions.md` only if a fundamental rule changes, otherwise update specialized `.github/*.md` files
4. Don't duplicate live data in copilot-instructions.md — it's a routing doc to satellite files
5. Commit all doc changes together

---

## Testing Patterns & Strategies

### Regression Test Pattern (Milestone 14.0+)
After a defect is discovered in production or pre-deploy testing:

1. **Root Cause**: Document clearly (e.g., "search index case 'US' vs shard data 'Us'")
2. **Fix**: Apply the fix to source code (normalize, validate, etc.)
3. **Regression Suite**: Add permanent test coverage in the relevant test file
   - Must cover ALL known affected cases (e.g., all 7 employers with the mismatch)
   - Use parameterized tests to avoid duplication
   - Include edge cases (spacing, casing, special characters)
4. **Exports**: Export any private helpers needed for unit testing
5. **Documentation**: Update TEST_AUDIT.md with the pattern, add decision to ARCHITECTURE_DECISIONS.md
6. **Commit**: Bundle fix + regression suite + doc updates together

**Why**: Prevents silent recurrence. Future agents see the pattern and replicate it for similar bugs.

### Key Test Files by Domain
- **Wage filtering**: `wage-dashboard.test.tsx` (includes employer name normalization suite)
- **SRS scoring**: `srs-data.test.ts`, `srs-components.test.tsx`
- **PDI forecasts**: `pdi-data.test.ts`, `pdi-components.test.tsx`
- **Security**: `security.test.ts` (XSS, validation, localStorage)
- **Data loading**: `loader.test.ts`, `dashboard-data-loaders.test.ts`
- **Components**: `[feature].test.tsx` following RTL patterns with `render()`, `screen`, `fireEvent`, `userEvent`

### Live-Data Tests (Gitignored Data)
Tests loading from `public/data/` must guard gracefully in CI:
```typescript
const DATA_AVAILABLE = existsSync(dataPath);
describe.skipIf(!DATA_AVAILABLE)("suite name", () => { ... });
```

---

## Project Structure at a Glance

```
immigration-insights-app/
├── PROGRESS.md                      ← Milestone history (start here for status)
├── ARCHITECTURE.md                  ← Technical design
├── PRODUCT_GUIDE.md                 ← Full user guide (large)
├── .github/
│   ├── copilot-instructions.md     ← AI agent instructions (this supplement)
│   ├── TEST_AUDIT.md               ← Test strategy + inventory
│   ├── MOBILE_DEVELOPMENT_GUIDE.md ← 11 mobile rules
│   ├── UI_DESIGN_PRINCIPLES.md     ← Aurora design system
│   ├── SECURITY_UI_COPY_GUIDE.md   ← 8 security principles
│   ├── ANALYTICS_STRATEGY.md       ← PostHog event tracking
│   ├── SEO_STRATEGY.md             ← Per-page metadata
│   ├── REDESIGN_V2.md              ← V2 redesign rationale
│   └── NEXT_AGENT_CONTEXT.md       ← This file
├── src/
│   ├── app/                        ← Next.js pages (/ /about /insights /dashboard/*)
│   ├── components/                 ← 50 React components (UI + feature)
│   ├── lib/                        ← Data loaders, search, security, utilities
│   ├── types/                      ← TypeScript definitions
│   └── __tests__/                  ← 41 test files (1206 tests)
├── public/
│   └── data/                       ← P2 artifacts as JSON (95K employer shards + metadata)
├── e2e/                            ← Playwright E2E tests
├── scripts/
│   ├── deploy.sh                   ← Safe deployment script (use this, not aws cli)
│   ├── sync_p2_data.py             ← P2 Parquet → JSON converter
│   ├── _regen_search.py            ← Regenerate employer search index
│   └── smoke-test.mjs              ← Post-deploy verification (47 checks)
└── terraform/                      ← IaC for AWS infra (S3 + CloudFront)
```

---

## Troubleshooting Quick Reference

| Issue | Cause | Fix |
|-------|-------|-----|
| `npm test` fails | New code broke tests or old tests are brittle | Run individual test: `npm test -- [file]`. Check for real bugs vs mock issues. |
| Build outputs 0 HTML files | P2 data is corrupt (e.g., _search.json is 2 bytes) | Run: `python3 scripts/sync_p2_data.py && python3 scripts/_regen_search.py` |
| CSS doesn't load on deploy | Old HTML has stale bundle hash. Raw `aws s3 sync` was used instead of deploy.sh | Only use `bash scripts/deploy.sh`. It uses `--exact-timestamps` to force re-upload. |
| TypeScript error: "Object is not valid as React child" | NumberTicker or motion component mock issue in test | Add mock: `vi.mock("@/components/ui/number-ticker", { ... })` |
| Dev server won't start | Port 3000 already in use | `pkill -f "next dev"` then `npm run dev` |
| Test times out | Data file fetch is slow or missing | Check `public/data/` exists. Verify S3 connectivity. May need to mock fetch in test. |

---

## Next Session Priorities (If Continuing)

1. **Check first prod deploy**: `tail -20 /tmp/prod-deploy2.txt` + `ps aux | grep deploy`
2. **Verify prod works**: `curl -s -o /dev/null -w "%{http_code}" https://immigrationcompass.fyi/`
3. **Redeploy prod with updated code**: `bash scripts/deploy.sh --env prod` (includes privacy/URL fixes)
4. **Redeploy stage**: `bash scripts/deploy.sh --env stage` (updated legal/URL code)
5. **Run prod smoke tests**: Verify 238/238 pass on production
6. **Update docs**: Finalize PROGRESS.md and NEXT_AGENT_CONTEXT.md after deploys succeed

---

## Contact / Resources

- **Prod Deploy**: `https://immigrationcompass.fyi` (deploying)
- **Stage Deploy**: `d10immmzyp7xgr.cloudfront.net`
- **Local Dev**: http://localhost:3000 (when `npm run dev` is running)
- **Test Command**: `npm test` (1237 tests)
- **Build Command**: `npm run build` (18 HTML pages)
- **CI/CD**: GitHub Actions (checks before merge)

---

**Last Updated**: 2026-03-24  
**Next Agent**: Read this file first (5 min), then check if prod deploy is done. Reference GO_LIVE_STATUS.md for phase tracking.
