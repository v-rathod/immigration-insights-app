# Next Agent Context

**Updated**: 2026-03-25 | **Milestone**: 21.1
**Purpose**: Quick reference for the next agent. Supplements PROGRESS.md and copilot-instructions.md.

---

## Current State

**Status**: Production and Stage are live, stable, and fully tested. Both at commit `5c7ddd5`.

| Aspect | Value | Notes |
|--------|-------|-------|
| **Unit Tests** | 1,265 passing (3 skipped) | 42 test files |
| **Post-Deploy: Smoke** | 48/48 | Pages + data files + rendering |
| **Post-Deploy: Comprehensive** | 191/191 | 11 validation sections |
| **Post-Deploy: Playwright e2e** | 23/23 | Navigation, data integrity, theme |
| **Build** | 19 HTML files | 16 pages + 404 variants |
| **TypeScript** | 0 errors | Strict mode |
| **ESLint** | 0 errors | |
| **Stage** | `stage.immigrationcompass.fyi` | Basic auth (CF Function), Zscaler-approved |
| **Prod** | `immigrationcompass.fyi` | Public, live traffic |
| **Data** | Fresh | 95,151 employer shards, 14.4 MB search index |
| **Theme** | Light-first | Dark/system via toggle |
| **PD Forecast** | v2.2 | Windowed 8yr + anomaly weighting. V1 deleted. |

### Infrastructure

| Resource | Stage | Prod |
|----------|-------|------|
| **URL** | `https://stage.immigrationcompass.fyi` | `https://immigrationcompass.fyi` |
| **S3** | `compass-stage-883107059193` | `compass-prod-883107059193` |
| **CloudFront** | `E1LPLTVZ0035Q5` | `EWRFYZRXA7HFE` |
| **Auth** | Basic auth (CloudFront Function) | None (public) |
| **Terraform** | Default workspace + `stage.tfvars` | Prod workspace + `prod.tfvars` |

---

## Deployment

### Stage
```bash
bash scripts/deploy.sh                    # Build + S3 sync + CF invalidation + smoke
bash scripts/deploy.sh --skip-build       # Redeploy existing out/
```

### Prod (Same-Artifact Promotion)
```bash
bash scripts/promote-to-prod.sh
# Copies S3 bytes from stage to prod (no rebuild). Full smoke + comprehensive + Playwright.
```

### Rules
- **Always** deploy stage first, verify, then promote to prod
- **Never** run raw `aws s3 sync` (use deploy.sh)
- **Never** deploy to prod without explicit user approval

---

## Quick Start

```bash
npm test -- --run                 # 1,265 tests (42 files)
npm run build                     # 19 HTML files in out/
npm run dev                       # localhost:3000
python3 scripts/sync_p2_data.py   # Sync P2 -> public/data/
bash scripts/deploy.sh            # Deploy to stage
bash scripts/promote-to-prod.sh   # Promote stage -> prod
```

---

## Key Files

| Purpose | File |
|---------|------|
| Architecture and coding rules | `.github/copilot-instructions.md` |
| Project guardrails | `.github/GUARDRAILS.md` |
| Milestone history | `PROGRESS.md` |
| Test inventory | `.github/TEST_AUDIT.md` |
| Data pipeline | `.github/DATA_CATALOG.md` |
| Environments | `ENVIRONMENTS.md` |
| Architecture | `ARCHITECTURE.md` |
| Product guide | `PRODUCT_GUIDE.md` |

---

## Milestone 21.1 (2026-03-25): CI/Agent Stability + Doc Cleanup

- Fixed agent commit crash: Copilot agents were calling image-vision tools on PNG filenames in git status, crashing with "vision is not enabled". Prevention: playwright-report/ and test-results/ are in .gitignore.
- Fixed `visa-bulletin.test.tsx`: wrapped Philippines no-data assertion in `waitFor()` for async stability
- Deployed to stage (262/262 tests green) and promoted to prod (262/262 tests green)
- All docs updated: commit hash, milestone, CI test count
- Last commit: `5c7ddd5` on main

## Milestone 21.0 (2026-03-25): Freeze Point

- Promoted stage to prod (same-artifact S3-to-S3 copy)
- 262 post-deploy tests on prod (48 + 191 + 23)
- V1 PD forecast deleted (P2 + P3 cleanup)
- Light-first theme (globals.css media query fix)
- Mobile toggle: 44px touch targets, active feedback
- Stage custom domain: stage.immigrationcompass.fyi (Zscaler-approved)
- CloudFront direct domain decommissioned from all scripts
- BSD sed bug fixed in deploy.sh + promote-to-prod.sh
- Stale docs deleted (5 files), all docs reviewed and updated

---

## Critical Constraints

1. **Static export only**: `output: 'export'` in next.config.ts
2. **Zero backend**: Pre-computed JSON from P2
3. **AWS cost < $5/month**: S3 + CloudFront only
4. **All 1,265 tests must pass** before commit
5. **TypeScript strict + 0 ESLint errors**
6. **Stage-first deployment**: Never deploy directly to prod

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CSS broken after deploy | Use `deploy.sh` not raw `aws s3 sync` |
| Dark theme on first load | Check globals.css `.light` class, theme-provider blocking script |
| Smoke tests 401 on stage | Check `BASIC_AUTH_B64` extraction (BSD sed pattern) |
| Build outputs 0 HTML | Run `python3 scripts/sync_p2_data.py` |

---

**Last commit**: `811a471` | **Branch**: main | **Stage + Prod both deployed and stable**
