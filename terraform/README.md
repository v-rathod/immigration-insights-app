# Compass · AWS Infrastructure as Code (Terraform)

Deploy Compass (P3 Immigration Insights App) to AWS using infrastructure-as-code.

## What Gets Deployed

```
┌─────────────────────────────────────────────────────────────┐
│                  Compass on AWS                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  CloudFront CDN (Global)                             │  │
│  │  ├─ Origin Access Control (OAC) for S3              │  │
│  │  ├─ Security Headers Policy (CSP, HSTS)             │  │
│  │  ├─ Custom caching: /data/* (30d), /static/* (1d)   │  │
│  │  ├─ SPA routing: 404 → index.html                   │  │
│  │  └─ HTTPS + TLS 1.2+                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  S3 Bucket (Static Site)                             │  │
│  │  ├─ Versioning enabled (rollback capability)         │  │
│  │  ├─ Server-side encryption (AES256)                  │  │
│  │  ├─ Public access blocked (via OAC only)             │  │
│  │  └─ ~141 MB of pre-built JSON + HTML/CSS/JS         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ACM Certificate (HTTPS)                             │  │
│  │  ├─ Free SSL/TLS certificate                         │  │
│  │  ├─ Auto-renewal (handled by AWS)                    │  │
│  │  └─ Optional: custom domain validation via DNS       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Route 53 (Optional: Custom Domain)                        │
│  └─ Alias record: yourdomain.com → CloudFront             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **AWS Account** with valid credentials configured
   ```bash
   aws sts get-caller-identity  # Verify you're logged in
   ```

2. **Terraform 1.0+** installed
   ```bash
   terraform --version
   ```

3. **Built static site** in `../out/` directory
   ```bash
   cd ..
   npm run build
   ```

## Deployment Steps

### Step 1: Set Up Variables

Copy the example configuration and customize it:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and set:

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `s3_bucket_name` | ✅ Yes | `my-compass-prod` | Must be globally unique |
| `aws_region` | ❌ No | `us-east-1` | Default is fine |
| `environment` | ❌ No | `prod` | Use `prod`, `staging`, or `dev` |
| `domain_name` | ❌ No | `compass.example.com` | Leave empty to use CloudFront domain |
| `route53_zone_id` | ❌ No | `Z123ABC...` | Only if using custom domain + Route 53 |
| `create_certificate` | ❌ No | `true` | Set to `false` if not using HTTPS |

### Step 2: Initialize Terraform

```bash
terraform init
```

This downloads the AWS provider and prepares the working directory.

### Step 3: Plan Deployment

Preview what will be created:

```bash
terraform plan -out=tfplan
```

Review the output. Look for:
- ✅ 1 S3 bucket
- ✅ 1 CloudFront distribution
- ✅ 1 ACM certificate (if enabled)
- ✅ 1 CloudWatch log group (if logging enabled)
- ✅ Route 53 records (if custom domain)

### Step 4: Apply Infrastructure

Create the AWS resources:

```bash
terraform apply tfplan
```

**Wait ~5-10 minutes** for CloudFront to fully deploy.

When complete, you'll see outputs:
```
Outputs:

cloudfront_domain_name = "d123abc.cloudfront.net"
cloudfront_distribution_id = "E123ABCDEF"
deployment_url = "https://d123abc.cloudfront.net"
s3_bucket_name = "my-compass-prod"
```

### Step 5: Deploy Static Files

Upload your built Next.js static export to S3:

```bash
cd ..
aws s3 sync ./out s3://my-compass-prod --delete --region us-east-1
```

Or use the command from Terraform outputs:
```bash
aws s3 sync ./out s3://$(terraform output -raw s3_bucket_name) --delete
```

### Step 6: Invalidate CloudFront Cache

Clear CloudFront's cache so new files are served immediately:

```bash
aws cloudfront create-invalidation \
  --distribution-id $(terraform output -raw cloudfront_distribution_id) \
  --paths '/*' \
  --region us-east-1
```

Or use the command from Terraform outputs.

### Step 7: Test the App

Visit your deployment URL:
- **CloudFront domain**: https://d123abc.cloudfront.net
- **Custom domain** (if set): https://compass.example.com

## Managing Infrastructure

### View Current State

```bash
terraform show
terraform output
```

### Update Configuration

Edit `terraform.tfvars` and run:

```bash
terraform plan
terraform apply
```

### Destroy Resources (if needed)

⚠️ **Warning**: This deletes all AWS resources created by Terraform.

```bash
terraform destroy
```

You'll need to confirm by typing `yes`.

## Advanced: Terraform Backend (Team Collaboration)

By default, Terraform stores state in `terraform.tfstate` (local file). For teams, use S3 backend:

### Create S3 Backend (one-time setup)

```bash
# Create bucket for Terraform state
aws s3api create-bucket \
  --bucket my-terraform-state-2026 \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket my-terraform-state-2026 \
  --versioning-configuration Status=Enabled

# Block public access
aws s3api put-public-access-block \
  --bucket my-terraform-state-2026 \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket my-terraform-state-2026 \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "aws:kms"}
    }]
  }'
```

### Enable Backend in main.tf

Uncomment the `backend` block in `main.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state-2026"
    key            = "compass/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

Then run:

```bash
terraform init
```

Terraform will migrate state from local file to S3.

## Cost Estimation

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| S3 | 141 MB stored | ~$0.03 |
| CloudFront | 1-10 GB egress | ~$0.08–0.80 |
| Route 53 | 1 hosted zone | ~$0.50 |
| ACM | 1 certificate | FREE |
| **Total** | **Typical** | **~$0.61–1.33/month** |

At scale (100+ GB/month traffic), CloudFront is still cheaper than most alternatives.

## Troubleshooting

### CloudFront returns 403 Forbidden

- Check S3 bucket policy: `terraform show | grep -A 10 "PolicyStatus"`
- Verify OAC is correct: `terraform show aws_cloudfront_origin_access_control`
- Cache might be stale: Invalidate with `aws cloudfront create-invalidation`

### HTTPS cert not validating

- Ensure Route 53 hosted zone exists
- Check DNS validation records created: `terraform show aws_route53_record`
- Wait 5-10 minutes for DNS propagation

### SPA routing not working (404 on refresh)

- Verify custom error response is set: `terraform show aws_cloudfront_distribution | grep -A 2 "custom_error"`
- Invalidate cache: `aws cloudfront create-invalidation --distribution-id E123... --paths "/*"`

### Terraform state is locked

```bash
# View locks
terraform state list

# Unlock (careful!)
terraform force-unlock <lock-id>
```

## CI/CD Integration (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'public/**'
      - 'package.json'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 20

      - run: npm install
      - run: npm run build

      - uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.6.0

      - name: Deploy to S3
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws s3 sync ./out s3://my-compass-prod --delete

      - name: Invalidate CloudFront
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws cloudfront create-invalidation --distribution-id E123... --paths "/*"
```

## File Structure

```
terraform/
├── main.tf                   # Main infrastructure (S3, CloudFront, ACM)
├── variables.tf              # Input variables with validation
├── outputs.tf                # Output values for reference
├── terraform.tfvars.example  # Example configuration
├── .gitignore                # Exclude sensitive files from git
└── README.md                 # This file
```

## Next Steps

1. ✅ Configure `terraform.tfvars`
2. ✅ Run `terraform apply`
3. ✅ Deploy static files: `aws s3 sync ./out s3://...`
4. ✅ Invalidate cache: `aws cloudfront create-invalidation ...`
5. ✅ Test at deployment URL
6. (Optional) Set up GitHub Actions CI/CD for auto-deploy

---

**Questions?** Check [AWS Terraform docs](https://registry.terraform.io/providers/hashicorp/aws/latest) or [Terraform docs](https://developer.hashicorp.com/terraform/docs).
