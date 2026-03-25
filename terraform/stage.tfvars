# Compass: Stage Environment
# Usage: terraform workspace select default && terraform apply -var-file=stage.tfvars -var-file=stage.secrets.tfvars
#
# stage.secrets.tfvars contains basic auth credentials (gitignored).
# If the secrets file is missing, stage deploys without auth protection.
#
# Stage uses BOTH CloudFront URL (d10immmzyp7xgr.cloudfront.net) and custom domain
# (stage.immigrationcompass.fyi). Both resolve to the same CloudFront distribution.

s3_bucket_name     = "compass-stage-883107059193"
aws_region         = "us-east-1"
environment        = "stage"

# Custom domain for stage — subdomain under the prod-owned Route 53 zone
domain_name        = "stage.immigrationcompass.fyi"
route53_zone_id    = "Z08038301M0XIKARMVXCB"
create_certificate = true
