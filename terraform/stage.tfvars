# Compass: Stage Environment
# Usage: terraform workspace select default && terraform apply -var-file=stage.tfvars
#
# Stage uses CloudFront URL directly (no custom domain).
# This avoids corporate proxy (Zscaler) blocking of custom domains
# while maintaining full resource isolation from prod.

s3_bucket_name     = "compass-stage-883107059193"
aws_region         = "us-east-1"
environment        = "stage"

# No custom domain for stage — access via CloudFront URL: d10immmzyp7xgr.cloudfront.net
domain_name        = ""
route53_zone_id    = ""
create_certificate = false
