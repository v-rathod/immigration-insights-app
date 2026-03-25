#!/usr/bin/env bash
# scripts/promote-to-prod.sh
#
# Stage → Production Promotion
# ─────────────────────────────────────────────────────────────────────────────
# THE CORE PRINCIPLE: Prod gets exactly the same artifact as stage.
#
#   Step 1  Verify stage smoke tests pass (gate before touching prod).
#   Step 2  Promote employer shards: stage S3 → prod S3 (server-side copy,
#           no local download, ~30 s regardless of shard count).
#   Step 3  Rebuild the main site with NEXT_PUBLIC_APP_ENV=prod (~2 min).
#           Same git commit + same public/data/ = functionally identical bundle.
#           Hostname-based env detection means the same bundle would work either
#           way, but we rebuild so Sentry release tags show "prod" correctly.
#   Step 4  Deploy main site to prod via deploy.sh --skip-build.
#           deploy.sh runs CloudFront invalidation + verification + smoke tests.
#
# Usage:
#   bash scripts/promote-to-prod.sh
#
# Requirements:
#   - AWS credentials configured (aws sts get-caller-identity succeeds)
#   - Node.js available
#   - Must run from within the immigration-insights-app repo
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
PROD_CF_DIST="$PROD_CF_DIST"
STAGE_CF_DOMAIN=
REGION="${PROD_REGION:-us-east-1}"
STAGE_SMOKE_URL="$STAGE_URL"
PROD_POSTHOG="$PROD_NEXT_PUBLIC_POSTHOG_KEY"

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
echo -e "${BOLD}${CYAN}  Compass Stage → Prod Promotion${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Source (stage) : ${CYAN}s3://$STAGE_BUCKET/${NC}"
echo -e "  Dest   (prod)  : ${CYAN}s3://$PROD_BUCKET/${NC}"
echo -e "  Region         : ${CYAN}$REGION${NC}"
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

# Verify stage has an index.html before promoting
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

# Use the direct CloudFront domain to avoid any proxy issues
STAGE_CF_DOMAIN=$(aws cloudfront get-distribution --id "$STAGE_CF_DIST" \
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

# ── 3. Promote employer shards: stage S3 → prod S3 ───────────────────────────
#
# This is a server-side S3-to-S3 copy — no local download required.
# ~95 K shards, but --size-only means only changed ones transfer.
# Typical time: 30 s if nothing changed, 3-4 min on first promote.

SHARD_START=$SECONDS
log "Promoting employer shards: s3://$STAGE_BUCKET/data/employers/ → s3://$PROD_BUCKET/data/employers/"
SHARD_COUNT=$(aws s3 sync \
  "s3://$STAGE_BUCKET/data/employers/" \
  "s3://$PROD_BUCKET/data/employers/" \
  --size-only \
  --no-progress \
  --region "$REGION" \
  2>&1 | grep -c "upload:" || true)
SHARD_DURATION=$(_elapsed "$SHARD_START")
log "  ✓ Employer shards promoted: $SHARD_COUNT updated in ${SHARD_DURATION}s"

# ── 4. Rebuild main site with prod env vars ───────────────────────────────────
#
# We rebuild (not copy) so that SENTRY_DSN release tags and any server-side
# metadata reflect the prod environment. The bundle is functionally identical
# to stage thanks to hostname-based env detection (src/lib/env.ts), but Sentry
# traces benefit from the explicit NEXT_PUBLIC_APP_ENV=prod tag.
#
# This uses npx next build directly (same as deploy.sh), bypassing the
# sync_p2_data.py prebuild hook — the JSON data files in public/data/ are
# already current from the most recent P2 sync.

BUILD_START=$SECONDS
log "Building main site with NEXT_PUBLIC_APP_ENV=prod..."
cd "$PROJECT_DIR"
rm -rf out .next
export NEXT_PUBLIC_APP_ENV="prod"
[[ -n "$PROD_POSTHOG" ]] && export NEXT_PUBLIC_POSTHOG_KEY="$PROD_POSTHOG"
npx next build
BUILD_DURATION=$(_elapsed "$BUILD_START")
HTML_COUNT=$(find out -name "*.html" | wc -l | tr -d ' ')
log "  ✓ Build complete: ${HTML_COUNT} HTML pages in ${BUILD_DURATION}s"

# ── 5. Deploy to prod via deploy.sh --skip-build ──────────────────────────────
#
# deploy.sh handles: S3 sync + CloudFront invalidation + verification + smoke.
# --skip-build skips npx next build (we just did it above with prod env vars).
# The employer shards in out/data/employers/ will already be on prod S3 from
# Step 3, so deploy_shards() will upload 0 files (--size-only finds no diffs).

log "Deploying to prod (S3 sync + CloudFront invalidation + smoke tests)..."
bash "$SCRIPT_DIR/deploy.sh" --env prod --skip-build

# ── 6. Print summary ──────────────────────────────────────────────────────────

TOTAL=$(( SECONDS - PROMOTE_START ))
echo ""
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${CYAN}  Promotion Complete${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
printf "  %-30s %s\n" "Shard promotion (S3→S3):"  "${SHARD_DURATION}s"
printf "  %-30s %s\n" "Main site rebuild (prod):"  "${BUILD_DURATION}s"
printf "  %-30s %s\n" "deploy.sh --skip-build:"    "(see above)"
echo -e "${BOLD}${CYAN}  ─────────────────────────────────────────────────────────${NC}"
printf "  ${BOLD}%-30s %s${NC}\n" "Total:" "${TOTAL}s ($(( TOTAL / 60 ))m $(( TOTAL % 60 ))s)"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
log "Prod is live at $PROD_URL 🚀"
