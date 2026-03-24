# Next Agent Context & Handoff Guide

**Created**: 2026-03-23 after Milestone 16.1 (Employer name normalization comprehensive fix)  
**Updated**: 2026-03-23 — Multi-environment architecture complete  
**Purpose**: Quick reference for the next agent starting a session. This supplements but doesn't replace PROGRESS.md, copilot-instructions.md, or ARCHITECTURE.md.

---

## Current State Snapshot

**Project Status**: ✅ **Production Quality** — Multi-environment architecture, error monitoring (Sentry + PostHog), employer name normalization, enterprise-grade post-deploy validation.

| Aspect | Status | Details |
|--------|--------|---------|
| **Unit Tests** | 1237 passing | 40 files, 3 skipped. All real-data assertions pass. |
| **Post-Deploy: Smoke** | 47 checks | Page loads, bundle integrity, critical data files. |
| **Post-Deploy: Comprehensive** | 191 tests | 11 sections: pages, search index, shard integrity, dashboard schemas, dimensions, ML models, RAG, cross-refs, SEO, data quality. |
| **Build** | 18 HTML files | 16 pages + 404 variants. Static export (no backend). |
| **Type Safety** | 0 errors | TypeScript strict mode across all 75+ source files. |
| **Lint** | 0 errors | ESLint passing. |
| **Stage Deploy** | Live ✅ | Stage: `compass-stage-883107059193` → `stage.immigrationcompass.fyi`. All 238 post-deploy tests pass. |
| **Prod Deploy** | Empty | Prod bucket `compass-prod-883107059193` exists but no content deployed yet. |
| **Data** | Fresh | P2 sync complete. 102K employer entries. |

### Multi-Environment Architecture

| Resource | Stage | Prod |
|----------|-------|------|
| **URL** | `stage.immigrationcompass.fyi` | `immigrationcompass.fyi` |
| **S3 Bucket** | `compass-stage-883107059193` | `compass-prod-883107059193` |
| **CloudFront** | `E1LPLTVZ0035Q5` (`d10immmzyp7xgr.cloudfront.net`) | `EWRFYZRXA7HFE` (`d3sr5zz19rlvju.cloudfront.net`) |
| **ACM Cert** | `32f7f9f4...` (ISSUED) | `3dbb1567...` (ISSUED) |
| **Terraform** | Default workspace / `stage.tfvars` | Prod workspace / `prod.tfvars` |
| **CloudWatch** | `Compass-Stage-Operations` | `Compass-Prod-Operations` |

Route 53 zone `Z08038301M0XIKARMVXCB` shared — owned by prod workspace, referenced by stage.

---

## What Happened This Session (2026-03-23, cont'd)

### Milestone 17.0: Multi-Environment Architecture (THIS SESSION)
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

1. **Monitor Deploy**: Keep checking smoke tests are all 47/47 passing.
2. **Expand Tests**: Cover remaining untested utilities (e.g., search helpers, analytics).
3. **Performance**: E2E performance tests (Lighthouse, Core Web Vitals).
4. **Public Launch**: When ready, deploy to prod CloudFront (requires user approval).
5. **WAF Rules**: If public, apply Azure WAF rules from `.github/` docs.

---

## Contact / Resources

- **Current Deploy**: `d10immmzyp7xgr.cloudfront.net`
- **Local Dev**: http://localhost:3000 (when `npm run dev` is running)
- **Test Command**: `npm test` (1206 tests)
- **Build Command**: `npm run build` (18 HTML pages)
- **CI/CD**: GitHub Actions (checks before merge)

---

**Last Updated**: 2026-03-22 20:30 UTC  
**Next Agent**: Read this file first (5 min), then start with PROGRESS.md Milestone 12.0 for full context.
