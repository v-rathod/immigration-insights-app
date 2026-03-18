# Compass: Multi-Environment Deployment Guide

## Environment Overview

| Environment | URL | Purpose | PostHog Tag | Status |
|-------------|-----|---------|-------------|--------|
| **dev** | `http://localhost:3000` | Local development | `dev` | Active |
| **stage** | `d10immmzyp7xgr.cloudfront.net` | Pre-production testing | `stage` | Active |
| **prod** | Custom domain (TBD) | Public-facing production | `prod` | Planned |

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

Stage uses the existing AWS infrastructure (S3 bucket + CloudFront distribution).

```bash
# Full deploy (build + sync + invalidate + verify + smoke tests)
bash scripts/deploy.sh

# Or explicitly:
bash scripts/deploy.sh --env stage

# Skip build (deploy existing out/):
bash scripts/deploy.sh --env stage --skip-build
```

PostHog events from stage are tagged `environment: "stage"`.

## Deploying to Production (Future)

When you purchase a domain:

### 1. Provision AWS infrastructure

```bash
cd terraform

# Create a new Terraform workspace for prod
terraform workspace new prod

# Edit prod.tfvars with your domain details:
#   domain_name        = "your-domain.com"
#   route53_zone_id    = "ZXXXXXXXXXX"
#   create_certificate = true

# Plan and apply
terraform plan -var-file=prod.tfvars
terraform apply -var-file=prod.tfvars
```

### 2. Update deploy config

After `terraform apply` outputs the S3 bucket name and CloudFront distribution ID, update `scripts/deploy-envs.conf`:

```conf
PROD_S3_BUCKET=compass-prod-883107059193
PROD_CF_DIST=EXXXXXXXXXX
PROD_REGION=us-east-1
PROD_URL=https://your-domain.com
```

### 3. Deploy

```bash
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
| `scripts/deploy-envs.conf` | Yes | Maps env names to AWS resources (S3 bucket, CF dist) |
| `terraform/stage.tfvars` | Yes | Terraform variables for stage |
| `terraform/prod.tfvars` | Yes | Terraform variables for prod (template) |

## Terraform Workspaces

Each environment has its own Terraform workspace and `.tfvars` file:

```bash
cd terraform

# Stage (current)
terraform workspace select default   # or: terraform workspace new stage
terraform apply -var-file=stage.tfvars

# Production (future)
terraform workspace new prod
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
