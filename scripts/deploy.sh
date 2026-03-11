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
NC='\033[0m' # No Color

log()   { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $*"; }
error() { echo -e "${RED}[deploy]${NC} $*" >&2; }

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

  log "Pre-flight passed: $html_count HTML files, index.html present ✓"
}

# ── Build ──────────────────────────────────────────────────────────────────

do_build() {
  log "Building static site..."
  cd "$PROJECT_DIR"
  rm -rf out .next
  npx next build
  log "Build complete. $(find "$OUT_DIR" -name '*.html' | wc -l | tr -d ' ') HTML files generated."
}

# ── Deploy main site ───────────────────────────────────────────────────────

deploy_main() {
  log "Deploying main site to S3 (excluding employer shards)..."
  aws s3 sync "$OUT_DIR/" "s3://$BUCKET" \
    --delete \
    --exclude "data/employers/*" \
    --region "$REGION" \
    2>&1 | grep -c "upload:" | xargs -I{} echo "  {} files uploaded"
  log "Main site deployed ✓"
}

# ── Deploy employer shards ─────────────────────────────────────────────────

deploy_shards() {
  log "Deploying employer shards to S3..."
  local shard_count
  shard_count=$(find "$OUT_DIR/data/employers" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
  log "  Local shards: $shard_count files"

  aws s3 sync "$OUT_DIR/data/employers/" "s3://$BUCKET/data/employers/" \
    --region "$REGION" \
    --size-only \
    2>&1 | grep -c "upload:" | xargs -I{} echo "  {} shards uploaded/updated"
  log "Employer shards deployed ✓"
}

# ── CloudFront invalidation ───────────────────────────────────────────────

invalidate_cf() {
  log "Creating CloudFront invalidation..."
  local inv_id
  inv_id=$(aws cloudfront create-invalidation \
    --distribution-id "$CF_DIST" \
    --paths "/*" \
    --region "$REGION" \
    --query 'Invalidation.Id' \
    --output text 2>&1)
  log "CloudFront invalidation created: $inv_id"
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

  # 4. Verify data manifest
  if aws s3api head-object --bucket "$BUCKET" --key "data/_manifest.json" --region "$REGION" &>/dev/null; then
    log "  ✓ data/_manifest.json exists in S3"
    (( PASS++ ))
  else
    error "  ✗ data/_manifest.json NOT found in S3"
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
    log "Verification: $PASS/$PASS checks passed ✓"
  fi
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
  else
    if ! $SKIP_BUILD; then
      do_build
    fi
    preflight
    deploy_main
    deploy_shards
    invalidate_cf
    verify_deployment
  fi

  echo ""
  log "Deploy complete! 🚀"
}

main "$@"
