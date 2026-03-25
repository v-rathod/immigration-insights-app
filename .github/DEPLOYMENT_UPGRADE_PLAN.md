# Deployment Stability & Testing Upgrade Plan

**Date**: March 25, 2026  
**Status**: IMPLEMENTED — Deployed to stage  
**Milestone**: 21.0  
**Commit**: `1916a5c`

### Implementation Status

| Item | Status | Notes |
|------|--------|-------|
| Part 1: FAQ cost removal | ✅ Done | Deployed to stage, verified |
| Part 2: Playwright e2e in deploy pipeline | ✅ Done | `e2e/post-deploy.spec.ts` + `playwright.deploy.config.ts` |
| Part 2: Automated rollback | ✅ Done | S3 versioning + `snapshot_before_deploy()` / `rollback_deploy()` in `deploy.sh` |
| Part 3: Single deployment script | ✅ Already existed | `deploy.sh` + `deploy-envs.conf` |
| Part 4: `stage.immigrationcompass.fyi` | ✅ Done | Terraform applied, DNS resolves, HTTPS works |
| Part 5: True same-artifact promotion | ✅ Done | `promote-to-prod.sh` rewritten: S3-to-S3, zero rebuild |
| Part 6: Playwright post-deploy spec | ✅ Done | 20+ browser tests wired into `deploy.sh` |

---

## Part 1: FAQ Cost Information Removal

**Change**: Remove the `$5/month` and infrastructure cost details from the FAQ page.

**Current text** (page.tsx + layout.tsx JSON-LD):
> "The full infrastructure costs under $5/month (S3 static hosting + CloudFront CDN). There are no monetization plans."

**New text**:
> "The site is hosted on AWS and maintained as an open-source project. There are no monetization plans."

Files: `src/app/faq/page.tsx`, `src/app/faq/layout.tsx`

---

## Part 2: How Google/Microsoft Achieve Near-100% Availability

### What they do (and we can learn from)

| Practice | Google/Microsoft | Our equivalent | Gap |
|----------|-----------------|----------------|-----|
| **Unit tests** | Tens of thousands, mandatory before merge | 1,224 tests across 41 files ✅ | None — solid |
| **Integration tests** | Automated UI tests (Selenium/Playwright) run in CI against staging | 5 Playwright e2e specs (visual, mobile, perf) exist but **run manually** | **Not automated post-deploy** |
| **Smoke tests post-deploy** | Automated HTTP health checks for every page/API after deploy | 47 smoke + 191 comprehensive = 238 checks ✅ | None — solid |
| **Canary deploys** | Deploy to 1% of traffic, monitor, roll out gradually | N/A (static site, no canary concept for S3+CF) | Not applicable |
| **Blue/green deploy** | Two environments, instant switch | We have stage + prod isolation ✅ | None |
| **Immutable artifacts** | Same Docker image promoted from stage → prod | `promote-to-prod.sh` promotes shards + rebuilds main (functionally equivalent) ✅ | Minor — see Part 4 |
| **Automated rollback** | If error rate spikes, auto-revert to previous version | **No rollback mechanism** | **Gap** |
| **Visual regression** | Screenshot comparison in CI (Percy, Chromatic) | Playwright visual.spec.ts exists but **manual** | **Not automated post-deploy** |
| **Uptime monitoring** | 24/7 external synthetic monitors (Pingdom, etc.) | None | **Gap** (but low priority — CF has 99.9% SLA) |

### What we DON'T need (and why)

- **Kubernetes / container orchestration**: We serve static files from S3/CloudFront. No containers.
- **Load balancers / auto-scaling**: CloudFront IS the load balancer + CDN. Handles any traffic.
- **Database migration tools**: No database.
- **Feature flags**: No runtime code branching needed for a static site.
- **Separate QA team**: The automated test suite (1,224 unit + 238 post-deploy + e2e) covers more than a manual QA person ever could.

### Recommended additions (in priority order)

1. **Playwright e2e in deploy pipeline** — After CF invalidation completes, run Playwright against the live stage URL. This tests actual browser rendering, JS hydration, click interactions, and visual correctness. Catches the exact "blank page" bug we just fixed.

2. **Automated rollback** — Before each deploy, save the current S3 state hash. If post-deploy smoke tests fail, auto-revert by restoring the previous version. (Simple: `aws s3 sync s3://backup/ s3://prod/`)

3. **External uptime monitor** — A free service like UptimeRobot (free tier: 50 monitors, 5-min interval) pinging `immigrationcompass.fyi` every 5 minutes. Sends email/Slack on downtime. Not critical since CloudFront has 99.9%+ SLA but adds peace of mind.

---

## Part 3: Understanding Our Current Setup

### Three environments

| Env | Where | URL | Purpose |
|-----|-------|-----|---------|
| **Dev** | Your MacBook | `http://localhost:3000` | Local development, `npm run dev` |
| **Stage** | AWS S3 + CloudFront | `https://stage.immigrationcompass.fyi` (also `https://d10immmzyp7xgr.cloudfront.net`) | Pre-production testing |
| **Prod** | AWS S3 + CloudFront | `https://immigrationcompass.fyi` | Public-facing site |

### Are stage and prod the same deployment?

**Mostly yes**, with one difference:

**What's identical**:
- Same Terraform code (different `.tfvars` for resource names)
- Same S3 bucket configuration (website hosting, versioning, encryption)
- Same CloudFront distribution setup (caching, compression, security headers)
- Same deploy.sh script (parameterized by `--env stage|prod`)
- Same smoke test suite runs against both

**What's different**:
- Prod has a custom domain (`immigrationcompass.fyi`) with ACM certificate + Route 53 DNS
- Stage uses the raw CloudFront URL (`d10immmzyp7xgr.cloudfront.net`)
- `NEXT_PUBLIC_APP_ENV` is `stage` vs `prod` (baked into the JS bundle at build time — but now overridden at runtime by hostname detection in `getEnvironment()`)

**Current deployment scripts**:
- `deploy.sh` — Single script, parameterized via `--env` flag. Reads `deploy-envs.conf` for bucket/CF/region per env. **Already works identically for stage and prod.** ✅
- `promote-to-prod.sh` — Gates on stage health, promotes shards, rebuilds with prod env vars, then calls `deploy.sh --skip-build --env prod`

**Answer: we already have a single deployment script.** `deploy.sh` does the same steps regardless of environment. The only variable is the config in `deploy-envs.conf`.

---

## Part 4: Adding `stage.immigrationcompass.fyi` Back

### Does it cost extra?

**No.** Literally $0 additional cost:
- **ACM certificate**: Free (AWS charges $0 for public SSL certificates)
- **Route 53 DNS record**: Already included in our hosted zone ($0.50/month for the zone, which we already pay for prod)
- **CloudFront alias**: Free (just a CNAME configuration on the existing distribution)

We removed it before because Zscaler (corporate proxy) was blocking custom domains. Now that Zscaler has approved `immigrationcompass.fyi`, `stage.immigrationcompass.fyi` should also work (same parent domain = same Zscaler policy).

### Is it recommended?

**Yes**, for several reasons:
1. **Consistent URLs**: `stage.immigrationcompass.fyi` is easier to share and remember than `d10immmzyp7xgr.cloudfront.net`
2. **Simpler smoke tests**: Can use the same base domain pattern for both environments
3. **Cookie/CORS consistency**: If we ever add features that care about the domain (e.g., cookies), both envs share the same parent
4. **Professional**: Looks proper when sharing stage links for testing

### Implementation

Terraform change only (2 values in `stage.tfvars`):
```hcl
domain_name        = "stage.immigrationcompass.fyi"
route53_zone_id    = "Z08038301M0XIKARMVXCB"   # prod's zone (stage adds a subdomain record)
create_certificate = true
```

Then `terraform apply` creates: ACM cert (auto-validates via DNS), Route 53 A/AAAA records, CloudFront alias. The existing CloudFront URL continues to work alongside the custom domain.

Also update `getEnvironment()` in `src/lib/env.ts` to recognize `stage.immigrationcompass.fyi` as stage (it already does — falls through to the "not prod, not localhost" branch = "stage").

---

## Part 5: True Immutable Artifact Promotion (Build Once)

### Your org's pattern

> "We build an image, deploy to stage. Once everything looks great, we deploy the same image to prod without any change."

### Does it make sense here?

**Partially.** Here's the nuance:

For a Docker container, the "image" contains the full runtime — code, config, data. Promoting the exact image to prod means zero rebuild, zero drift.

For our static site, the equivalent of an "image" is the `out/` directory (HTML + JS + CSS + data). The complication is:

1. **`NEXT_PUBLIC_APP_ENV` is baked into JS at build time** — A stage-built bundle has `stage` hardcoded in compiled JS. However, **we already solved this** with `getEnvironment()` (hostname-based detection). The runtime hostname overrides the baked-in value for analytics and monitoring.

2. **Data files (employer shards, dashboards)** are identical between stage and prod — no env-specific content.

3. **The only thing that truly benefits from a prod-specific build** is the Sentry `release` tag, which is cosmetic (helps filter Sentry events by release, but `getEnvironment()` already tags events correctly).

### Recommendation

**We can do true same-artifact promotion.** Instead of rebuilding for prod, we can copy the exact `out/` directory from the stage build (or from stage S3) to prod S3. The `getEnvironment()` hostname detection handles environment tagging correctly at runtime.

Updated `promote-to-prod.sh` flow:
1. Verify stage smoke tests pass
2. `aws s3 sync s3://stage-bucket/ s3://prod-bucket/ --delete --exact-timestamps` (server-side copy of everything — HTML, JS, CSS, data)
3. CloudFront invalidation on prod
4. Run smoke tests against prod

**No rebuild. No drift. Same bytes. ~2 minutes total.**

---

## Part 6: Recommended Playwright Post-Deploy Integration

### What to add

A new script that runs Playwright against the deployed stage/prod URL (not localhost). This tests what the user actually sees in a real browser:

- Page loads and renders (not blank / not opacity:0)
- Navigation works (click sidebar → page changes)
- Search works (type employer name → results appear)
- Charts render (SVG elements present)
- Responsive layout (mobile viewport)
- No console errors

### How

Playwright already supports running against any URL via `baseURL`. We'd create a lightweight `e2e/post-deploy.spec.ts` that:
- Verifies all 16 pages render visible content (not just HTTP 200, but actual DOM assertions)
- Checks 3-4 critical user flows (search employer, open dashboard, toggle theme)
- Runs in headless Chromium (~30 seconds total)

Add to `deploy.sh` as an optional step after smoke tests pass.

### Do we need a new tool?

**No.** We already have Playwright installed and configured. We just need to:
1. Create the post-deploy e2e spec
2. Add a `playwright.deploy.config.ts` that accepts a URL parameter
3. Wire it into `deploy.sh` after the existing smoke tests

---

## Summary of Changes to Make

| # | Change | Effort | Files |
|---|--------|--------|-------|
| 1 | Remove cost info from FAQ | Trivial | `page.tsx`, `layout.tsx` |
| 2 | Restore `stage.immigrationcompass.fyi` | Small | `stage.tfvars` + `terraform apply` |
| 3 | True same-artifact promotion (no rebuild) | Small | `promote-to-prod.sh` |
| 4 | Playwright post-deploy e2e tests | Medium | New `e2e/post-deploy.spec.ts`, new config, wire into `deploy.sh` |
| 5 | Auto-rollback on smoke test failure | Small | `deploy.sh` (save + restore previous version) |
| 6 | Update `getEnvironment()` test for `stage.immigrationcompass.fyi` | Trivial | `env.test.ts` |

### What I recommend we do NOW vs LATER

**Now** (this session):
- #1: FAQ cost removal
- #3: True same-artifact promotion (simplify `promote-to-prod.sh` to skip rebuild)
- #4: Playwright post-deploy e2e tests (the biggest confidence boost)
- #6: Update env tests

**Later** (separate session):
- #2: Restore `stage.immigrationcompass.fyi` — needs Zscaler verification first
- #5: Auto-rollback — nice to have, not urgent (deploy.sh already blocks on smoke test failure)
