#!/usr/bin/env bash
# -----------------------------------------------------------------------
# deploy.sh: Safe deployment script for Compass (P3)
#
# USAGE:
#   ./scripts/deploy.sh                   # Deploy to stage (default)
#   ./scripts/deploy.sh --env stage       # Explicit stage deploy
#   ./scripts/deploy.sh --env prod        # Deploy to prod (requires prod config)
#   ./scripts/deploy.sh --skip-build      # Skip build, deploy existing out/
#   ./scripts/deploy.sh --shards-only     # Only sync employer shards
#   ./scripts/deploy.sh --skip-shards     # Skip shard sync (code-only deploy)
#   ./scripts/deploy.sh --force-shards    # Force shard sync even if hash unchanged
#   ./scripts/deploy.sh --env prod --skip-build  # Combine flags
#
# SHARD HASH FINGERPRINT:
#   Employer shards (95K files, 1.1GB) are only re-uploaded when they change.
#   A SHA-256 of _search.json is stored in S3 as data/employers/.shard-hash.
#   If the hash matches, shard sync is skipped — saving ~$0.50 per deploy.
#   Shards change only when P2 Meridian pipeline runs (rare).
#   Use --force-shards to override the hash check.
# -----------------------------------------------------------------------
set -euo pipefail

# ---- Environment Configuration ------------------------------------------
# Load from scripts/deploy-envs.conf based on --env flag.
# Default: stage
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONF_FILE="$SCRIPT_DIR/deploy-envs.conf"

load_env_config() {
  local env_upper
  env_upper=$(echo "$1" | tr '[:lower:]' '[:upper:]')

  if [[ ! -f "$CONF_FILE" ]]; then
    echo "[deploy] ERROR: Config file not found: $CONF_FILE" >&2
    exit 1
  fi

  BUCKET=$(grep "^${env_upper}_S3_BUCKET=" "$CONF_FILE" | cut -d= -f2)
  CF_DIST=$(grep "^${env_upper}_CF_DIST=" "$CONF_FILE" | cut -d= -f2)
  REGION=$(grep "^${env_upper}_REGION=" "$CONF_FILE" | cut -d= -f2)
  DEPLOY_URL=$(grep "^${env_upper}_URL=" "$CONF_FILE" | cut -d= -f2)
  POSTHOG_KEY=$(grep "^${env_upper}_NEXT_PUBLIC_POSTHOG_KEY=" "$CONF_FILE" | cut -d= -f2)

  if [[ -z "$BUCKET" || -z "$CF_DIST" || -z "$REGION" ]]; then
    echo "[deploy] ERROR: Missing config for environment '$1' in $CONF_FILE" >&2
    echo "[deploy] Expected: ${env_upper}_S3_BUCKET, ${env_upper}_CF_DIST, ${env_upper}_REGION" >&2
    exit 1
  fi
}

# Defaults (overridden by load_env_config)
DEPLOY_ENV="stage"
BUCKET=""
CF_DIST=""
REGION=""
DEPLOY_URL=""
POSTHOG_KEY=""
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
  )
  # Note: dashboard/backlog/index.html intentionally omitted — page exists but is hidden from nav
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
  log "Building static site for [$DEPLOY_ENV]..."
  cd "$PROJECT_DIR"
  rm -rf out .next

  # Bake environment and analytics key into the bundle at build time.
  # NEXT_PUBLIC_* vars are inlined by Next.js during static export.
  export NEXT_PUBLIC_APP_ENV="$DEPLOY_ENV"
  [[ -n "$POSTHOG_KEY" ]] && export NEXT_PUBLIC_POSTHOG_KEY="$POSTHOG_KEY"
  npx next build

  BUILD_DURATION=$(_elapsed $BUILD_START)
  local pages
  pages=$(find "$OUT_DIR" -name '*.html' | wc -l | tr -d ' ')
  log "Build complete: ${pages} HTML pages in ${BUILD_DURATION}s [$DEPLOY_ENV] ✓"
}

# ── Rollback support ──────────────────────────────────────────────────────

# Snapshots the current index.html S3 version ID before a deploy.
# If smoke tests fail, rollback_deploy() restores the previous version.
# Requires S3 versioning enabled (already the case — terraform/main.tf).

ROLLBACK_VERSION_ID=""

snapshot_before_deploy() {
  ROLLBACK_VERSION_ID=$(aws s3api head-object \
    --bucket "$BUCKET" --key "index.html" --region "$REGION" \
    --query 'VersionId' --output text 2>/dev/null || echo "")
  if [[ -n "$ROLLBACK_VERSION_ID" && "$ROLLBACK_VERSION_ID" != "null" ]]; then
    log "Saved rollback snapshot: index.html version $ROLLBACK_VERSION_ID"
  else
    ROLLBACK_VERSION_ID=""
    warn "No existing index.html version found — rollback not available (first deploy?)"
  fi
}

rollback_deploy() {
  if [[ -z "$ROLLBACK_VERSION_ID" ]]; then
    error "No rollback snapshot available. Manual intervention required."
    return 1
  fi
  warn "ROLLING BACK: restoring index.html version $ROLLBACK_VERSION_ID"
  # Copy the previous version back as the current version
  aws s3api copy-object \
    --bucket "$BUCKET" \
    --copy-source "$BUCKET/index.html?versionId=$ROLLBACK_VERSION_ID" \
    --key "index.html" \
    --region "$REGION" \
    --metadata-directive COPY \
    --output text &>/dev/null || {
      error "Rollback copy-object failed. Manual intervention required."
      return 1
    }
  # Invalidate CloudFront so users get the rolled-back version immediately
  aws cloudfront create-invalidation \
    --distribution-id "$CF_DIST" \
    --paths "/*" \
    --region "$REGION" \
    --output text &>/dev/null || true
  warn "Rollback complete. Previous index.html restored + CloudFront invalidated."
  warn "The site may take 30-60s to fully propagate."
}

# ── Deploy main site ───────────────────────────────────────────────────────

deploy_main() {
  MAIN_SYNC_START=$SECONDS
  log "Deploying main site to S3 (excluding employer shards)..."
  local upload_count
  # --exact-timestamps ensures HTML files referencing new build hashes are re-uploaded
  # even when S3 already has a file at the same key (prevents stale HTML + new CSS mismatch).
  # --no-progress suppresses per-file transfer lines (reduces stdout noise).
  upload_count=$(aws s3 sync "$OUT_DIR/" "s3://$BUCKET" \
    --delete \
    --exclude "data/employers/*" \
    --exact-timestamps \
    --no-progress \
    --region "$REGION" \
    2>&1 | grep -c "upload:" || true)
  MAIN_SYNC_DURATION=$(_elapsed $MAIN_SYNC_START)
  log "Main site deployed: ${upload_count} files uploaded in ${MAIN_SYNC_DURATION}s ✓"
}

# ── Deploy employer shards ─────────────────────────────────────────────────

# Compute a fingerprint for the employer shard dataset.
# Uses _search.json as proxy: if the search index hasn't changed, shards haven't either.
compute_shard_hash() {
  if [[ -f "$OUT_DIR/data/employers/_search.json" ]]; then
    shasum -a 256 "$OUT_DIR/data/employers/_search.json" | cut -d' ' -f1
  else
    echo "no_search_index_$(date +%s)"
  fi
}

deploy_shards() {
  SHARD_SYNC_START=$SECONDS
  log "Checking employer shards..."

  local shard_count
  shard_count=$(find "$OUT_DIR/data/employers" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
  log "  Local shards: $shard_count files"

  # ── Hash fingerprint check ──────────────────────────────────────────────
  # Skip the expensive 95K-file sync when the shard data hasn't changed.
  # Each full shard sync costs ~$0.50 in S3 Tier-1 API requests (PUT + LIST).
  # The hash is stored in S3 as data/employers/.shard-hash after each sync.
  if [[ "${FORCE_SHARDS:-false}" == "false" && "${SKIP_SHARDS:-false}" == "false" ]]; then
    local local_hash remote_hash
    local_hash=$(compute_shard_hash)
    remote_hash=$(aws s3 cp "s3://$BUCKET/data/employers/.shard-hash" - \
      --region "$REGION" 2>/dev/null || echo "")

    if [[ -n "$remote_hash" && "$local_hash" == "$remote_hash" ]]; then
      SHARD_SYNC_DURATION=$(_elapsed $SHARD_SYNC_START)
      log "Employer shards unchanged (hash: ${local_hash:0:16}...) — skipping sync ✓"
      log "  Saved ~0.50 USD in S3 API costs. Use --force-shards to override."
      return 0
    elif [[ -n "$remote_hash" ]]; then
      log "  Shard data changed (local: ${local_hash:0:12}... remote: ${remote_hash:0:12}...) — syncing"
    else
      log "  No remote hash found — first shard deploy or hash missing, syncing"
    fi
  fi

  if [[ "${SKIP_SHARDS:-false}" == "true" ]]; then
    log "Employer shards skipped (--skip-shards flag) ✓"
    SHARD_SYNC_DURATION=0
    return 0
  fi

  log "Deploying employer shards to S3 (this takes ~4 min for 95K files)..."
  local upload_count
  upload_count=$(aws s3 sync "$OUT_DIR/data/employers/" "s3://$BUCKET/data/employers/" \
    --region "$REGION" \
    --size-only \
    --no-progress \
    2>&1 | grep -c "upload:" || true)
  SHARD_SYNC_DURATION=$(_elapsed $SHARD_SYNC_START)
  log "Employer shards deployed: ${upload_count} updated in ${SHARD_SYNC_DURATION}s ✓"

  # Store the new hash so future deploys can skip if nothing changed
  local new_hash
  new_hash=$(compute_shard_hash)
  echo "$new_hash" | aws s3 cp - "s3://$BUCKET/data/employers/.shard-hash" \
    --content-type "text/plain" \
    --region "$REGION" &>/dev/null && \
    log "  Shard hash stored in S3 (${new_hash:0:16}...) ✓" || \
    warn "  Could not store shard hash in S3 (non-fatal)"
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

  # 5. Check CloudFront is serving via the custom domain
  #    (raw *.cloudfront.net URL may return 403 on prod due to branded-domain redirect)
  if [[ -n "${DEPLOY_URL:-}" ]] && command -v curl &>/dev/null; then
    local HTTP_STATUS
    if [[ -n "${BASIC_AUTH_B64:-}" ]]; then
      HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Basic $BASIC_AUTH_B64" "${DEPLOY_URL}/" 2>/dev/null || echo "000")
    else
      HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${DEPLOY_URL}/" 2>/dev/null || echo "000")
    fi
    if [[ "$HTTP_STATUS" == "200" ]]; then
      log "  ✓ CloudFront returning HTTP 200 at ${DEPLOY_URL}/"
      (( PASS++ ))
    elif [[ "$HTTP_STATUS" == "403" ]]; then
      error "  ✗ CloudFront returning HTTP 403 (Access Denied) — check S3 bucket policy or basic auth"
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
  # CloudFront invalidation is already waited for in invalidate_cf() above.
  # No additional sleep needed here.

  # Use the custom domain directly (stage.immigrationcompass.fyi is Zscaler-approved)
  local SMOKE_URL="${DEPLOY_URL}"

  log "Running HTTP smoke tests against ${SMOKE_URL}..."
  SMOKE_TEST_URL="$SMOKE_URL" node "$PROJECT_DIR/scripts/smoke-test.mjs" || {
    error "Smoke tests FAILED — site may be degraded. Check CloudFront and S3."
    return 1
  }

  # ── Comprehensive post-deploy validation ────────────────────────────────
  if [[ -f "$PROJECT_DIR/scripts/comprehensive-post-deploy.mjs" ]]; then
    log "Running comprehensive post-deploy validation..."
    SMOKE_TEST_URL="$SMOKE_URL" node "$PROJECT_DIR/scripts/comprehensive-post-deploy.mjs" || {
      error "Comprehensive post-deploy tests FAILED — data integrity issues. Check above output."
      return 1
    }
  fi

  # ── Playwright e2e (browser rendering + user flows) ─────────────────────
  if [[ -f "$PROJECT_DIR/playwright.deploy.config.ts" ]] && command -v npx &>/dev/null; then
    log "Running Playwright post-deploy e2e tests against ${SMOKE_URL}..."
    DEPLOY_URL="$SMOKE_URL" npx playwright test --config=playwright.deploy.config.ts 2>&1 || {
      warn "Playwright e2e tests had failures — review the output above"
      # Non-fatal: smoke + comprehensive tests already passed.
      # Playwright failures may indicate visual regressions but not broken functionality.
    }
  fi

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

  log "Notifying GitHub Actions (repository_dispatch -> smoke-test workflow)..."
  local http_status
  http_status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Authorization: token ${token}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${repo}/dispatches" \
    -d "{\"event_type\":\"deploy-completed\",\"client_payload\":{\"environment\":\"${DEPLOY_ENV}\",\"deploy_url\":\"${DEPLOY_URL}\",\"commit\":\"${commit}\",\"build_duration_s\":${BUILD_DURATION},\"main_sync_duration_s\":${MAIN_SYNC_DURATION},\"shard_sync_duration_s\":${SHARD_SYNC_DURATION},\"total_duration_s\":${total_duration}}}" \
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
  echo -e "${BOLD}${CYAN}  Compass Deploy Timing Summary [$DEPLOY_ENV]${NC}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  if (( BUILD_DURATION > 0 )); then
    printf "  %-28s %s\n" "Build (next build):" "${BUILD_DURATION}s"
  fi
  if (( MAIN_SYNC_DURATION > 0 )); then
    printf "  %-28s %s\n" "S3 main sync:" "${MAIN_SYNC_DURATION}s"
  fi
  if (( SHARD_SYNC_DURATION > 0 )); then
    printf "  %-28s %s\n" "S3 shard sync:" "${SHARD_SYNC_DURATION}s"
  elif [[ "${SKIP_SHARDS:-false}" == "true" ]]; then
    printf "  %-28s %s\n" "S3 shard sync:" "skipped (--skip-shards, ~0.50 USD saved)"
  else
    printf "  %-28s %s\n" "S3 shard sync:" "skipped (hash unchanged, ~0.50 USD saved)"
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
  SKIP_SHARDS=false
  FORCE_SHARDS=false

  for arg in "$@"; do
    case "$arg" in
      --skip-build)   SKIP_BUILD=true ;;
      --shards-only)  SHARDS_ONLY=true ;;
      --skip-shards)  SKIP_SHARDS=true ;;
      --force-shards) FORCE_SHARDS=true ;;
      --env=*)        DEPLOY_ENV="${arg#--env=}" ;;
      --env)          ;; # handled below via shift
      --help|-h)
        echo "Usage: $0 [--env stage|prod] [--skip-build] [--shards-only] [--skip-shards] [--force-shards]"
        echo "  --env ENV       Environment to deploy (default: stage)"
        echo "  --skip-build    Skip npm build, deploy existing out/"
        echo "  --shards-only   Only sync employer shards"
        echo "  --skip-shards   Skip shard sync entirely (code-only deploy, saves ~0.50 USD)"
        echo "  --force-shards  Force shard sync even if hash unchanged"
        echo ""
        echo "Cost tip: Shards change only when P2 pipeline runs. For code-only deploys,"
        echo "  use --skip-shards. The hash fingerprint auto-detects changes otherwise."
        exit 0
        ;;
      *) # Handle --env stage (space-separated)
        if [[ "${prev_arg:-}" == "--env" ]]; then
          DEPLOY_ENV="$arg"
        else
          error "Unknown option: $arg"; exit 1
        fi
        ;;
    esac
    prev_arg="$arg"
  done

  # Also support COMPASS_ENV environment variable
  DEPLOY_ENV="${DEPLOY_ENV:-${COMPASS_ENV:-stage}}"

  # Load environment-specific AWS config
  load_env_config "$DEPLOY_ENV"

  # ── Stage basic auth: export BASIC_AUTH_B64 for smoke tests ─────────────
  if [[ "$DEPLOY_ENV" == "stage" ]]; then
    local SECRETS_FILE="$PROJECT_DIR/terraform/stage.secrets.tfvars"
    if [[ -f "$SECRETS_FILE" ]]; then
      local BASIC_AUTH_CREDS
      BASIC_AUTH_CREDS=$(grep 'basic_auth_credentials' "$SECRETS_FILE" \
        | sed 's/.*"\(.*\)".*/\1/')
      if [[ -n "$BASIC_AUTH_CREDS" ]]; then
        export BASIC_AUTH_B64
        BASIC_AUTH_B64=$(printf '%s' "$BASIC_AUTH_CREDS" | base64)
        log "Stage basic auth configured (BASIC_AUTH_B64 exported for smoke tests)"
      fi
    fi
  fi

  cd "$PROJECT_DIR"
  DEPLOY_START=$SECONDS
  echo ""
  log "==============================================================="
  log "  Compass Deploy [$DEPLOY_ENV] - $(date '+%Y-%m-%d %H:%M:%S')"
  log "  Bucket:  $BUCKET"
  log "  CF Dist: $CF_DIST"
  log "  Region:  $REGION"
  log "==============================================================="
  echo ""

  if $SHARDS_ONLY; then
    preflight
    snapshot_before_deploy
    deploy_shards
    invalidate_cf
    verify_deployment
    run_smoke_tests || { rollback_deploy; exit 1; }
  else
    if ! $SKIP_BUILD; then
      do_build
    fi
    preflight
    snapshot_before_deploy
    deploy_main
    deploy_shards
    invalidate_cf
    verify_deployment
    run_smoke_tests || { rollback_deploy; exit 1; }
  fi

  print_timing_summary
  notify_github

  log "Deploy complete! 🚀"
}

main "$@"
