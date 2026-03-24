# Compass: Multi-Environment Deployment Guide

## Environment Overview

| Environment | URL | Purpose | PostHog Tag | Terraform | Status |
|-------------|-----|---------|-------------|-----------|--------|
| **dev** | `http://localhost:3000` | Local development | `dev` | N/A | Active |
| **stage** | `https://stage.immigrationcompass.fyi` | Pre-production testing | `stage` | default workspace + `stage.tfvars` | Active |
| **prod** | `https://immigrationcompass.fyi` | Public-facing production | `prod` | prod workspace + `prod.tfvars` | Active |

## Architecture: Full Environment Isolation

Stage and prod are **completely isolated** in AWS. They share nothing except:
- The same AWS account (883107059193)
- The same Route 53 hosted zone (immigrationcompass.fyi, owned by prod workspace)

| Resource | Stage | Prod |
|----------|-------|------|
| S3 bucket (site) | `compass-stage-883107059193` | `compass-prod-883107059193` |
| S3 bucket (logs) | `compass-stage-883107059193-logs` | `compass-prod-883107059193-logs` |
| CloudFront dist | Separate distribution | Separate distribution |
| ACM certificate | `stage.immigrationcompass.fyi` | `immigrationcompass.fyi` |
| CloudFront function | `compass-stage-*-url-rewriter` | `compass-prod-*-url-rewriter` |
| CloudWatch dashboard | `Compass-Stage-Operations` | `Compass-Prod-Operations` |
| CloudWatch alarms | `compass-stage-high-4xx-*` | `compass-prod-high-4xx-*` |
| Terraform state | `terraform.tfstate` (default workspace) | `terraform.tfstate.d/prod/` |
| Billing tag | `Environment=stage` | `Environment=prod` |

### Blast Radius

| Failure Scenario | Impact |
|-----------------|--------|
| Stage S3 bucket deleted | Only stage affected. Prod untouched. |
| Stage deploy broken | Only stage affected. Redeploy from `out/`. |
| Prod CloudFront misconfigured | Only prod affected. Stage provides rollback reference. |
| Terraform apply on wrong workspace | Resources are isolated by bucket name and workspace state. |

### Promotion Flow

```
Local dev (localhost:3000)
    ↓ npm test + npm run build
Stage (stage.immigrationcompass.fyi)
    ↓ bash scripts/deploy.sh --env stage
    ↓ Smoke tests + manual verification
Prod (immigrationcompass.fyi)
    ↓ bash scripts/deploy.sh --env prod
    ↓ Post-deploy smoke tests
```

## How It Works

### Environment Identifier: `NEXT_PUBLIC_APP_ENV`

Every build is tagged with an environment name via the `NEXT_PUBLIC_APP_ENV` environment variable. This variable controls:

1. **PostHog event tagging** - All analytics events include `environment: "dev"|"stage"|"prod"` so you can filter dashboards by environment.
2. **Future env-aware behavior** - Feature flags, API endpoints, or UI banners can check this value.

### Where `NEXT_PUBLIC_APP_ENV` is set

| Scenario | How it is set |
|----------|--------------|
| `npm run dev` (local) | From `.env.local` (`NEXT_PUBLIC_APP_ENV=dev`) |
| `deploy.sh --env stage` | Exported by the deploy script before `next build` |
| `deploy.sh --env prod` | Exported by the deploy script before `next build` |
| GitHub Actions deploy | Set in the "Build static site" step from workflow input |

## Local Development

```bash
# 1. Copy the example env file
cp .env.local.example .env.local

# 2. Fill in your keys (PostHog, Groq, Formspree)
# 3. Run the dev server
npm run dev
```

All PostHog events from `npm run dev` are tagged `environment: "dev"`.

## Deploying to Stage

Stage uses its own isolated AWS infrastructure at `stage.immigrationcompass.fyi`.

```bash
# Full deploy (build + sync + invalidate + verify + smoke tests)
bash scripts/deploy.sh --env stage

# Skip build (deploy existing out/):
bash scripts/deploy.sh --env stage --skip-build
```

PostHog events from stage are tagged `environment: "stage"`.

## Deploying to Production

Prod uses its own isolated AWS infrastructure at `immigrationcompass.fyi`.

```bash
# Full deploy (build + sync + invalidate + verify + smoke tests)
bash scripts/deploy.sh --env prod

# Skip build (deploy existing out/):
bash scripts/deploy.sh --env prod --skip-build
```

PostHog events from prod are tagged `environment: "prod"`.

## Terraform Management

### Workspace Model

Each environment has its own Terraform workspace and `.tfvars` file. The same `.tf` files
are used for both (DRY principle), with different variable values per environment.

```bash
cd terraform

# Stage
terraform workspace select default
terraform plan -var-file=stage.tfvars
terraform apply -var-file=stage.tfvars

# Production
terraform workspace select prod
terraform plan -var-file=prod.tfvars
terraform apply -var-file=prod.tfvars
```

### Route 53 Zone Ownership

The Route 53 zone for `immigrationcompass.fyi` is **owned by the prod workspace**.
The stage workspace references it by zone ID to create its subdomain record.

- Prod: Creates the zone + A/AAAA records for `immigrationcompass.fyi`
- Stage: References the zone by ID + creates A/AAAA records for `stage.immigrationcompass.fyi`

### 2. Deploy config

`scripts/deploy-envs.conf` maps environment names to their isolated AWS resources:

```conf
# Stage
STAGE_S3_BUCKET=compass-stage-883107059193
STAGE_CF_DIST=<stage-cf-id>
STAGE_URL=https://stage.immigrationcompass.fyi

# Prod
PROD_S3_BUCKET=compass-prod-883107059193
PROD_CF_DIST=<prod-cf-id>
PROD_URL=https://immigrationcompass.fyi
```

### 3. Deploy

```bash
# Stage first, always
bash scripts/deploy.sh --env stage
# Verify stage.immigrationcompass.fyi works
bash scripts/deploy.sh --env prod
```

PostHog events from prod are tagged `environment: "prod"`.

## Configuration Files

| File | Committed? | Purpose |
|------|-----------|---------|
| `.env.local` | No (gitignored) | Local secrets: PostHog key, Groq key, Formspree ID |
| `.env.local.example` | No (gitignored) | Template for `.env.local` |
| `.env.stage` | Yes | Sets `NEXT_PUBLIC_APP_ENV=stage` |
| `.env.production` | Yes | Sets `NEXT_PUBLIC_APP_ENV=prod` |
| `scripts/deploy-envs.conf` | Yes | Maps env names to isolated AWS resources |
| `terraform/stage.tfvars` | Yes | Terraform variables for stage |
| `terraform/prod.tfvars` | Yes | Terraform variables for prod |

## Terraform Workspaces

Each environment has its own Terraform workspace and `.tfvars` file:

```bash
cd terraform

# Stage (default workspace)
terraform workspace select default
terraform apply -var-file=stage.tfvars

# Production
terraform workspace select prod
terraform apply -var-file=prod.tfvars
```

Workspaces keep state files separated so stage and prod infrastructure never interfere.

## GitHub Actions

| Workflow | Trigger | Environment |
|----------|---------|-------------|
| `ci.yml` | Push to main, PRs | N/A (tests only) |
| `deploy.yml` | Manual (workflow_dispatch) | Selectable: stage or prod |
| `smoke-test.yml` | After CI, after deploy, manual | Uses URL from deploy payload |
| `smoke.yml` | Every 6h (cron), manual | Configurable URL input |

## PostHog Filtering

In the PostHog dashboard, filter events by the `environment` property:

- **All stage events**: `environment = "stage"`
- **All prod events**: `environment = "prod"`
- **Dev only**: `environment = "dev"`

This works for both custom events (via `analytics.*`) and the super property registered on PostHog init (attached to all autocaptured events).
