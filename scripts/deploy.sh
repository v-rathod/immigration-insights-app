#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Safe deployment script for Compass (P3)
#
# USAGE — Single Environment (Current):
#   ./scripts/deploy.sh              # Full deploy: build + sync + invalidate + verify
#   ./scripts/deploy.sh --skip-build # Skip build, deploy existing out/
#   ./scripts/deploy.sh --shards-only # Only sync employer shards
#
# MULTI-ENVIRONMENT DESIGN (Future Enhancement):
# ────────────────────────────────────────────────────────────────────────────
# To support local/staging/prod deployments, this script can be extended
# with environment awareness. Design pattern:
#
# 1. Environment variable: COMPASS_ENV (default: prod)
#    export COMPASS_ENV=staging
#    ./scripts/deploy.sh
#
# 2. Configuration per environment:
#    ┌────────────────────────────────────────────────────┐
#    │ Environment │ S3 Bucket                          │ CloudFront DIst      │
#    ├────────────────────────────────────────────────────┤
#    │ local       │ (skip S3, use 'npm run dev')       │ N/A                  │
#    │ staging     │ compass-staging-883107059193       │ E1LPLTVZ0035Q6 (TBD) │
#    │ prod        │ compass-immigration-insights-...   │ E1LPLTVZ0035Q5       │
#    └────────────────────────────────────────────────────┘
#
# 3. Implementation in deploy.sh (to be added):
#    - Parse ${COMPASS_ENV} at top of script
#    - Load environment-specific config from shell function
#    - Pass env to all AWS CLI calls
#    - Add --env=staging flag option for explicit override
#
# 4. GitHub Actions CI/CD integration:
#    - Dev branch → staging deployment (on push)
#    - Main branch → prod deployment (on merge)
#    - Environment secrets in GitHub: AWS_ROLE_ARN per environment
#
# Implementation deferred to Phase 6 (Post-MVP). Current focus: prod only.
# ─────────────────────────────────────────────────────────────────────────────
#
# This script prevents the "empty out/" footgun that previously caused Access
# Denied errors by deleting all HTML from S3.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BUCKET="compass-immigration-insights-883107059193"
CF_DIST="E1LPLTVZ0035Q5"
REGION="us-east-1"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$PROJECT_DIR/out"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log()   { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $*"; }
error() { echo -e "${RED}[deploy]${NC} $*" >&2; }

# Timing helpers
DEPLOY_START=0
BUILD_START=0; BUILD_DURATION=0
MAIN_SYNC_START=0; MAIN_SYNC_DURATION=0
SHARD_SYNC_START=0; SHARD_SYNC_DURATION=0
SMOKE_START=0; SMOKE_DURATION=0

_elapsed() { echo $(( SECONDS - $1 )); }

# ── Pre-flight checks ─────────────────────────────────────────────────────

preflight() {
  log "Running pre-flight checks..."

  # 1. AWS CLI available
  if ! command -v aws &>/dev/null; then
    error "AWS CLI not found. Install with: brew install awscli"
    exit 1
  fi

  # 2. Check AWS credentials
  if ! aws sts get-caller-identity --region "$REGION" &>/dev/null; then
    error "AWS credentials not configured or expired. Run: aws configure"
    exit 1
  fi

  # 3. out/ directory exists
  if [[ ! -d "$OUT_DIR" ]]; then
    error "Build output directory not found: $OUT_DIR"
    error "Run 'npm run build' first, or remove --skip-build flag."
    exit 1
  fi

  # 4. CRITICAL: index.html must exist in out/
  if [[ ! -f "$OUT_DIR/index.html" ]]; then
    error "CRITICAL: $OUT_DIR/index.html not found!"
    error "The build output is incomplete. Running 'aws s3 sync --delete' would"
    error "remove all HTML from S3 and cause Access Denied errors."
    error ""
    error "Fix: rm -rf out .next && npx next build"
    exit 1
  fi

  # 5. Check that dashboard HTML pages exist
  local EXPECTED_PAGES=(
    "dashboard/wage/index.html"
    "dashboard/employer/index.html"
    "dashboard/visa-bulletin/index.html"
    "dashboard/backlog/index.html"
  )
  for page in "${EXPECTED_PAGES[@]}"; do
    if [[ ! -f "$OUT_DIR/$page" ]]; then
      error "Missing expected page: $OUT_DIR/$page"
      error "Build output is incomplete. Aborting."
      exit 1
    fi
  done

  # 6. Count HTML files — should be at least 15
  local html_count
  html_count=$(find "$OUT_DIR" -name "*.html" | wc -l | tr -d ' ')
  if (( html_count < 15 )); then
    error "Only $html_count HTML files found in out/. Expected ≥15."
    error "Build output may be incomplete. Aborting."
    exit 1
  fi

  # 7. CRITICAL: _next/static/ must exist with CSS/JS bundles.
  #    If missing, deploying with --delete would remove CSS/JS from S3 and break
  #    page styling and functionality for all users.
  if [[ ! -d "$OUT_DIR/_next/static" ]]; then
    error "CRITICAL: $OUT_DIR/_next/static/ not found!"
    error "CSS and JavaScript bundles are missing from the build output."
    error "Deploying without them would break page styling for all users on S3."
    error ""
    error "Fix: rm -rf out .next && npx next build"
    exit 1
  fi
  local css_count
  css_count=$(find "$OUT_DIR/_next/static" -name "*.css" | wc -l | tr -d ' ')
  if (( css_count < 1 )); then
    error "No CSS files found in $OUT_DIR/_next/static/"
    error "Build output is missing CSS bundles. Aborting."
    exit 1
  fi

  log "Pre-flight passed: $html_count HTML files, ${css_count} CSS bundle(s), _next/static/ present ✓"
}

# ── Build ──────────────────────────────────────────────────────────────────

do_build() {
  BUILD_START=$SECONDS
  log "Building static site..."
  cd "$PROJECT_DIR"
  rm -rf out .next
  npx next build
  BUILD_DURATION=$(_elapsed $BUILD_START)
  local pages
  pages=$(find "$OUT_DIR" -name '*.html' | wc -l | tr -d ' ')
  log "Build complete: ${pages} HTML pages in ${BUILD_DURATION}s ✓"
}

# ── Deploy main site ───────────────────────────────────────────────────────

deploy_main() {
  MAIN_SYNC_START=$SECONDS
  log "Deploying main site to S3 (excluding employer shards)..."
  local upload_count
  upload_count=$(aws s3 sync "$OUT_DIR/" "s3://$BUCKET" \
    --delete \
    --exclude "data/employers/*" \
    --region "$REGION" \
    2>&1 | grep -c "upload:" || true)
  MAIN_SYNC_DURATION=$(_elapsed $MAIN_SYNC_START)
  log "Main site deployed: ${upload_count} files uploaded in ${MAIN_SYNC_DURATION}s ✓"
}

# ── Deploy employer shards ─────────────────────────────────────────────────

deploy_shards() {
  SHARD_SYNC_START=$SECONDS
  log "Deploying employer shards to S3..."
  local shard_count upload_count
  shard_count=$(find "$OUT_DIR/data/employers" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
  log "  Local shards: $shard_count files"
  upload_count=$(aws s3 sync "$OUT_DIR/data/employers/" "s3://$BUCKET/data/employers/" \
    --region "$REGION" \
    --size-only \
    2>&1 | grep -c "upload:" || true)
  SHARD_SYNC_DURATION=$(_elapsed $SHARD_SYNC_START)
  log "Employer shards deployed: ${upload_count} updated in ${SHARD_SYNC_DURATION}s ✓"
}

# ── CloudFront invalidation ───────────────────────────────────────────────

invalidate_cf() {
  log "Creating CloudFront invalidation..."
  local inv_id status elapsed
  inv_id=$(aws cloudfront create-invalidation \
    --distribution-id "$CF_DIST" \
    --paths "/*" \
    --region "$REGION" \
    --query 'Invalidation.Id' \
    --output text 2>&1)
  log "CloudFront invalidation created: $inv_id"

  # Wait for invalidation to complete so smoke tests see fresh data.
  # Typical propagation: 10–60s. Time out after 3 minutes.
  elapsed=0
  while [[ $elapsed -lt 180 ]]; do
    sleep 10
    elapsed=$((elapsed + 10))
    status=$(aws cloudfront get-invalidation \
      --distribution-id "$CF_DIST" \
      --id "$inv_id" \
      --region "$REGION" \
      --query 'Invalidation.Status' \
      --output text 2>/dev/null || echo "Unknown")
    log "  Invalidation status: $status (${elapsed}s elapsed)"
    if [[ "$status" == "Completed" ]]; then
      log "CloudFront invalidation complete ✓"
      return 0
    fi
  done
  warn "CloudFront invalidation timed out — smoke tests may see stale cache"
}

# ── Post-deploy verification ──────────────────────────────────────────────

verify_deployment() {
  log "Running post-deploy verification..."

  local PASS=0
  local FAIL=0

  # 1. Verify index.html in S3
  if aws s3api head-object --bucket "$BUCKET" --key "index.html" --region "$REGION" &>/dev/null; then
    log "  ✓ index.html exists in S3"
    (( PASS++ ))
  else
    error "  ✗ index.html NOT found in S3"
    (( FAIL++ ))
  fi

  # 2. Verify dashboard pages
  for page in "dashboard/wage/index.html" "dashboard/employer/index.html" "dashboard/visa-bulletin/index.html"; do
    if aws s3api head-object --bucket "$BUCKET" --key "$page" --region "$REGION" &>/dev/null; then
      log "  ✓ $page exists in S3"
      (( PASS++ ))
    else
      error "  ✗ $page NOT found in S3"
      (( FAIL++ ))
    fi
  done

  # 3. Verify a known employer shard
  local OPTUM_SHARD="data/employers/78a46d3917846d886ef35fe989075cb353f21a1d.json"
  if aws s3api head-object --bucket "$BUCKET" --key "$OPTUM_SHARD" --region "$REGION" &>/dev/null; then
    log "  ✓ Optum shard exists in S3"
    (( PASS++ ))
  else
    warn "  ⚠ Optum shard not yet in S3 (may still be syncing)"
  fi

  # 4. Verify data freshness marker
  if aws s3api head-object --bucket "$BUCKET" --key "data/_freshness.json" --region "$REGION" &>/dev/null; then
    log "  ✓ data/_freshness.json exists in S3"
    (( PASS++ ))
  else
    error "  ✗ data/_freshness.json NOT found in S3"
    (( FAIL++ ))
  fi

  # 5. Verify employer search index (critical — absence causes "failed to load page")
  if aws s3api head-object --bucket "$BUCKET" --key "data/employers/_search.json" --region "$REGION" &>/dev/null; then
    local SEARCH_SIZE
    SEARCH_SIZE=$(aws s3api head-object --bucket "$BUCKET" --key "data/employers/_search.json" --region "$REGION" \
      --query 'ContentLength' --output text 2>/dev/null || echo "0")
    if [[ "${SEARCH_SIZE:-0}" -lt 1000000 ]]; then
      error "  ✗ data/employers/_search.json is too small (${SEARCH_SIZE} bytes) — deploy may be corrupt"
      (( FAIL++ ))
    else
      log "  ✓ data/employers/_search.json exists in S3 (${SEARCH_SIZE} bytes)"
      (( PASS++ ))
    fi
  else
    error "  ✗ data/employers/_search.json NOT found in S3 — employer/wage/insights pages will fail!"
    (( FAIL++ ))
  fi

  # 5. Check CloudFront is serving (if curl available)
  local CF_URL
  CF_URL=$(aws cloudfront get-distribution --id "$CF_DIST" --region "$REGION" \
    --query 'Distribution.DomainName' --output text 2>/dev/null || echo "")
  if [[ -n "$CF_URL" ]] && command -v curl &>/dev/null; then
    local HTTP_STATUS
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$CF_URL/" 2>/dev/null || echo "000")
    if [[ "$HTTP_STATUS" == "200" ]]; then
      log "  ✓ CloudFront returning HTTP 200 at https://$CF_URL/"
      (( PASS++ ))
    elif [[ "$HTTP_STATUS" == "403" ]]; then
      error "  ✗ CloudFront returning HTTP 403 (Access Denied) — check S3 bucket policy"
      (( FAIL++ ))
    else
      warn "  ⚠ CloudFront returning HTTP $HTTP_STATUS (may need invalidation time)"
    fi
  fi

  echo ""
  if (( FAIL > 0 )); then
    error "Verification: $PASS passed, $FAIL failed"
    exit 1
  else
    log "Verification: $PASS/$PASS S3 checks passed ✓"
  fi
}

# ── Post-deploy smoke tests ──────────────────────────────────────────────────

run_smoke_tests() {
  if ! command -v node &>/dev/null; then
    warn "Node.js not found — skipping HTTP smoke tests"
    return 0
  fi

  if [[ ! -f "$PROJECT_DIR/scripts/smoke-test.mjs" ]]; then
    warn "smoke-test.mjs not found — skipping HTTP smoke tests"
    return 0
  fi

  SMOKE_START=$SECONDS
  log "Waiting 30s for CloudFront invalidation to propagate..."
  sleep 30

  log "Running HTTP smoke tests against CloudFront..."
  node "$PROJECT_DIR/scripts/smoke-test.mjs" || {
    error "Smoke tests FAILED — site may be degraded. Check CloudFront and S3."
    exit 1
  }
  SMOKE_DURATION=$(_elapsed $SMOKE_START)
}

# ── Notify GitHub Actions via repository_dispatch ─────────────────────────

notify_github() {
  local token="${GH_DEPLOY_TOKEN:-}"
  if [[ -z "$token" ]]; then
    # fall back to local gh CLI session token
    token=$(gh auth token 2>/dev/null || true)
  fi
  if [[ -z "$token" ]]; then
    warn "No GitHub token available — skipping GitHub Actions notification"
    return 0
  fi

  local total_duration=$(( SECONDS - DEPLOY_START ))
  local commit
  commit=$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
  local repo
  repo=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "v-rathod/immigration-insights-app")

  log "Notifying GitHub Actions (repository_dispatch → smoke-test workflow)..."
  local http_status
  http_status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Authorization: token ${token}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${repo}/dispatches" \
    -d "{\"event_type\":\"deploy-completed\",\"client_payload\":{\"cloudfront_url\":\"https://d10immmzyp7xgr.cloudfront.net\",\"commit\":\"${commit}\",\"build_duration_s\":${BUILD_DURATION},\"main_sync_duration_s\":${MAIN_SYNC_DURATION},\"shard_sync_duration_s\":${SHARD_SYNC_DURATION},\"total_duration_s\":${total_duration}}}" \
    2>/dev/null || echo "000")

  if [[ "$http_status" == "204" ]]; then
    log "GitHub Actions smoke test triggered ✓ (check Actions tab)"
  else
    warn "GitHub dispatch returned HTTP $http_status — workflow may not have triggered"
  fi
}

# ── Print timing summary ───────────────────────────────────────────────────

print_timing_summary() {
  local total_duration=$(( SECONDS - DEPLOY_START ))
  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${CYAN}  Compass Deploy Timing Summary${NC}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  if (( BUILD_DURATION > 0 )); then
    printf "  %-28s %s\n" "Build (next build):" "${BUILD_DURATION}s"
  fi
  if (( MAIN_SYNC_DURATION > 0 )); then
    printf "  %-28s %s\n" "S3 main sync:" "${MAIN_SYNC_DURATION}s"
  fi
  if (( SHARD_SYNC_DURATION > 0 )); then
    printf "  %-28s %s\n" "S3 shard sync:" "${SHARD_SYNC_DURATION}s"
  fi
  if (( SMOKE_DURATION > 0 )); then
    printf "  %-28s %s\n" "Smoke tests (+30s wait):" "${SMOKE_DURATION}s"
  fi
  echo -e "${BOLD}${CYAN}  ─────────────────────────────────────────────────────────${NC}"
  printf "  ${BOLD}%-28s %s${NC}\n" "Total:" "${total_duration}s ($(( total_duration / 60 ))m $(( total_duration % 60 ))s)"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# ── Main ───────────────────────────────────────────────────────────────────

main() {
  local SKIP_BUILD=false
  local SHARDS_ONLY=false

  for arg in "$@"; do
    case "$arg" in
      --skip-build)  SKIP_BUILD=true ;;
      --shards-only) SHARDS_ONLY=true ;;
      --help|-h)
        echo "Usage: $0 [--skip-build] [--shards-only]"
        echo "  --skip-build   Skip npm build, deploy existing out/"
        echo "  --shards-only  Only sync employer shards"
        exit 0
        ;;
      *) error "Unknown option: $arg"; exit 1 ;;
    esac
  done

  cd "$PROJECT_DIR"
  DEPLOY_START=$SECONDS
  echo ""
  log "═══════════════════════════════════════════════════════"
  log "  Compass Deploy — $(date '+%Y-%m-%d %H:%M:%S')"
  log "═══════════════════════════════════════════════════════"
  echo ""

  if $SHARDS_ONLY; then
    preflight
    deploy_shards
    invalidate_cf
    verify_deployment
    run_smoke_tests
  else
    if ! $SKIP_BUILD; then
      do_build
    fi
    preflight
    deploy_main
    deploy_shards
    invalidate_cf
    verify_deployment
    run_smoke_tests
  fi

  print_timing_summary
  notify_github

  log "Deploy complete! 🚀"
}

main "$@"
