# Compass: Stage Environment
# Usage: terraform workspace select default && terraform apply -var-file=stage.tfvars
#
# Stage uses BOTH CloudFront URL (d10immmzyp7xgr.cloudfront.net) and custom domain
# (stage.immigrationcompass.fyi). Both resolve to the same CloudFront distribution.
# Once Zscaler approves the subdomain, the CloudFront URL can be retired.

s3_bucket_name     = "compass-stage-883107059193"
aws_region         = "us-east-1"
environment        = "stage"

# Custom domain for stage — subdomain under the prod-owned Route 53 zone
domain_name        = "stage.immigrationcompass.fyi"
route53_zone_id    = "Z08038301M0XIKARMVXCB"
create_certificate = true
