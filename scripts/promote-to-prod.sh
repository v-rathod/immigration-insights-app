#!/usr/bin/env bash
# scripts/promote-to-prod.sh
#
# Stage → Production Promotion (Same-Artifact, Zero Rebuild)
# ─────────────────────────────────────────────────────────────────────────────
# THE CORE PRINCIPLE: Prod gets exactly the same bytes as stage.
# No rebuild. No drift. Like deploying the same Docker image to prod.
#
#   Step 1  Verify stage smoke tests pass (gate before touching prod).
#   Step 2  S3-to-S3 sync: copy ALL files from stage bucket to prod bucket.
#           Server-side copy, no local download, instant for unchanged files.
#   Step 3  CloudFront invalidation on prod CDN.
#   Step 4  Run prod smoke tests + comprehensive post-deploy validation.
#   Step 5  (Optional) Run Playwright e2e against prod.
#
# Why no rebuild? getEnvironment() in src/lib/env.ts detects environment at
# runtime from window.location.hostname. The same JS bundle built for stage
# correctly identifies as "prod" when served from immigrationcompass.fyi.
# PostHog, Sentry, and analytics all use getEnvironment(), so events are
# tagged correctly regardless of the NEXT_PUBLIC_APP_ENV baked at build time.
#
# Usage:
#   bash scripts/promote-to-prod.sh
#
# Requirements:
#   - AWS credentials configured
#   - Node.js available
#   - Stage must be deployed and healthy
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Paths & constants ─────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_CONF="$SCRIPT_DIR/deploy-envs.conf"

if [[ ! -f "$DEPLOY_CONF" ]]; then
  echo "ERROR: $DEPLOY_CONF not found" >&2; exit 1
fi
source "$DEPLOY_CONF"

STAGE_BUCKET="$STAGE_S3_BUCKET"
PROD_BUCKET="$PROD_S3_BUCKET"
STAGE_CF_ID="$STAGE_CF_DIST"
PROD_CF_ID="$PROD_CF_DIST"
REGION="${PROD_REGION:-us-east-1}"
STAGE_SMOKE_URL="$STAGE_URL"
PROD_URL="$PROD_URL"

# ── Colours ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${GREEN}[PROMOTE]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}    $*"; }
error(){ echo -e "${RED}[ERROR]${NC}   $*" >&2; }
_elapsed() { echo $(( SECONDS - $1 )); }

PROMOTE_START=$SECONDS

# ── Banner ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${CYAN}  Compass Stage → Prod Promotion (Same-Artifact)${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Source (stage) : ${CYAN}s3://$STAGE_BUCKET/${NC}"
echo -e "  Dest   (prod)  : ${CYAN}s3://$PROD_BUCKET/${NC}"
echo -e "  Region         : ${CYAN}$REGION${NC}"
echo -e "  Model          : ${CYAN}Zero rebuild — same bytes promoted${NC}"
echo ""
warn "This will publish the CURRENT stage build to production."
warn "Ensure you have tested stage at: $STAGE_SMOKE_URL"
echo ""
read -r -p "  Are you sure you want to promote stage → prod? [yes/N] " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  log "Promotion cancelled."
  exit 0
fi
echo ""

# ── 1. Pre-flight ─────────────────────────────────────────────────────────────

log "Running pre-flight checks..."

if ! command -v aws &>/dev/null; then
  error "AWS CLI not found. Install with: brew install awscli"; exit 1
fi
if ! aws sts get-caller-identity --region "$REGION" &>/dev/null; then
  error "AWS credentials not configured or expired. Run: aws configure"; exit 1
fi
log "  ✓ AWS credentials valid"

# Verify stage has an index.html
if ! aws s3api head-object --bucket "$STAGE_BUCKET" --key "index.html" \
     --region "$REGION" &>/dev/null; then
  error "Stage index.html not found in S3. Stage may not be deployed. Aborting."
  exit 1
fi
log "  ✓ Stage index.html found in S3"

# Verify stage employer search index (critical data file)
SEARCH_SIZE=$(aws s3api head-object --bucket "$STAGE_BUCKET" \
  --key "data/employers/_search.json" --region "$REGION" \
  --query 'ContentLength' --output text 2>/dev/null || echo "0")
if [[ "${SEARCH_SIZE:-0}" -lt 1000000 ]]; then
  error "Stage _search.json missing or too small (${SEARCH_SIZE} bytes)."
  error "Stage may not be fully deployed. Aborting."
  exit 1
fi
log "  ✓ Stage _search.json found (${SEARCH_SIZE} bytes)"

# ── 2. Verify stage smoke tests ───────────────────────────────────────────────

# Use the direct CloudFront domain to avoid proxy issues
STAGE_CF_DOMAIN=$(aws cloudfront get-distribution --id "$STAGE_CF_ID" \
  --region "$REGION" --query 'Distribution.DomainName' --output text 2>/dev/null || echo "")
if [[ -n "$STAGE_CF_DOMAIN" ]]; then
  STAGE_SMOKE_URL="https://$STAGE_CF_DOMAIN"
fi

if command -v node &>/dev/null && [[ -f "$SCRIPT_DIR/browser-smoke-test.mjs" ]]; then
  log "Running stage smoke check against $STAGE_SMOKE_URL ..."
  if ! node "$SCRIPT_DIR/browser-smoke-test.mjs" "$STAGE_SMOKE_URL"; then
    error "Stage smoke check FAILED. Fix stage before promoting to prod."
    exit 1
  fi
  log "  ✓ Stage smoke check passed"
else
  warn "Node.js or browser-smoke-test.mjs not found — skipping HTTP smoke check"
fi

echo ""

# ── 3. S3-to-S3 promotion: stage → prod ──────────────────────────────────────
#
# Server-side copy. No local download/upload. AWS moves bytes within the region.
# --exact-timestamps ensures HTML files (same key, different content) get updated.
# --delete removes files from prod that no longer exist on stage.
# Employer shards use --size-only (content-addressed names, 95K+ files).

MAIN_START=$SECONDS
log "Promoting main site: s3://$STAGE_BUCKET/ → s3://$PROD_BUCKET/ (excluding employer shards)..."
MAIN_COUNT=$(aws s3 sync \
  "s3://$STAGE_BUCKET/" \
  "s3://$PROD_BUCKET/" \
  --delete \
  --exclude "data/employers/*" \
  --exact-timestamps \
  --no-progress \
  --region "$REGION" \
  2>&1 | grep -c "copy:" || true)
MAIN_DURATION=$(_elapsed "$MAIN_START")
log "  ✓ Main site promoted: $MAIN_COUNT files updated in ${MAIN_DURATION}s"

SHARD_START=$SECONDS
log "Promoting employer shards: s3://$STAGE_BUCKET/data/employers/ → s3://$PROD_BUCKET/data/employers/"
SHARD_COUNT=$(aws s3 sync \
  "s3://$STAGE_BUCKET/data/employers/" \
  "s3://$PROD_BUCKET/data/employers/" \
  --size-only \
  --no-progress \
  --region "$REGION" \
  2>&1 | grep -c "copy:" || true)
SHARD_DURATION=$(_elapsed "$SHARD_START")
log "  ✓ Employer shards promoted: $SHARD_COUNT updated in ${SHARD_DURATION}s"

# ── 4. CloudFront invalidation ───────────────────────────────────────────────

log "Creating CloudFront invalidation on prod ($PROD_CF_ID)..."
INV_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$PROD_CF_ID" \
  --paths "/*" \
  --region "$REGION" \
  --query 'Invalidation.Id' \
  --output text 2>&1)
log "  Invalidation created: $INV_ID"

# Poll until complete (max 3 minutes)
ELAPSED=0
while [[ $ELAPSED -lt 180 ]]; do
  sleep 10
  ELAPSED=$((ELAPSED + 10))
  STATUS=$(aws cloudfront get-invalidation \
    --distribution-id "$PROD_CF_ID" \
    --id "$INV_ID" \
    --region "$REGION" \
    --query 'Invalidation.Status' \
    --output text 2>/dev/null || echo "Unknown")
  log "  Invalidation status: $STATUS (${ELAPSED}s elapsed)"
  if [[ "$STATUS" == "Completed" ]]; then
    log "  ✓ CloudFront invalidation complete"
    break
  fi
done

# ── 5. Post-promotion verification ───────────────────────────────────────────

# Use the direct CloudFront domain for smoke tests (avoids proxy issues)
PROD_CF_DOMAIN=$(aws cloudfront get-distribution --id "$PROD_CF_ID" \
  --region "$REGION" --query 'Distribution.DomainName' --output text 2>/dev/null || echo "")
PROD_SMOKE_URL="${PROD_URL}"
if [[ -n "$PROD_CF_DOMAIN" ]]; then
  PROD_SMOKE_URL="https://$PROD_CF_DOMAIN"
fi

log "Running prod smoke tests against $PROD_SMOKE_URL ..."

# Quick browser smoke (15 pages, HTTP 200)
if [[ -f "$SCRIPT_DIR/browser-smoke-test.mjs" ]]; then
  node "$SCRIPT_DIR/browser-smoke-test.mjs" "$PROD_SMOKE_URL" || {
    error "Prod smoke check FAILED. Check S3 and CloudFront."
    exit 1
  }
fi

# Full smoke suite (47 checks)
if [[ -f "$SCRIPT_DIR/smoke-test.mjs" ]]; then
  log "Running full smoke test suite..."
  SMOKE_TEST_URL="$PROD_SMOKE_URL" node "$SCRIPT_DIR/smoke-test.mjs" || {
    error "Prod smoke tests FAILED. Check above output."
    exit 1
  }
fi

# Comprehensive post-deploy (191 checks)
if [[ -f "$SCRIPT_DIR/comprehensive-post-deploy.mjs" ]]; then
  log "Running comprehensive post-deploy validation..."
  SMOKE_TEST_URL="$PROD_SMOKE_URL" node "$SCRIPT_DIR/comprehensive-post-deploy.mjs" || {
    error "Comprehensive post-deploy tests FAILED. Check above output."
    exit 1
  }
fi

log "  ✓ All prod smoke tests passed"

# ── 6. Playwright e2e (if available) ─────────────────────────────────────────

if [[ -f "$PROJECT_DIR/playwright.deploy.config.ts" ]] && command -v npx &>/dev/null; then
  log "Running Playwright e2e tests against $PROD_SMOKE_URL ..."
  DEPLOY_URL="$PROD_SMOKE_URL" npx playwright test --config=playwright.deploy.config.ts 2>&1 || {
    warn "Playwright e2e tests failed — site may have visual regressions"
    # Don't exit 1 — smoke tests already passed, Playwright failures are non-fatal warnings
  }
fi

# ── 7. Print summary ──────────────────────────────────────────────────────────

TOTAL=$(( SECONDS - PROMOTE_START ))
echo ""
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${CYAN}  Promotion Complete (Same-Artifact)${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
printf "  %-30s %s\n" "Main site (S3→S3):"      "${MAIN_DURATION}s"
printf "  %-30s %s\n" "Shard promotion (S3→S3):" "${SHARD_DURATION}s"
printf "  %-30s %s\n" "CF invalidation + smoke:"  "(see above)"
echo -e "${BOLD}${CYAN}  ─────────────────────────────────────────────────────────${NC}"
printf "  ${BOLD}%-30s %s${NC}\n" "Total:" "${TOTAL}s ($(( TOTAL / 60 ))m $(( TOTAL % 60 ))s)"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
log "Prod is live at $PROD_URL (same bytes as stage)"
