# Compass: Stage Environment
# Usage: terraform workspace select default && terraform apply -var-file=stage.tfvars
#
# Stage deploys to stage.immigrationcompass.fyi with its own CloudFront + S3.
# Route 53 zone is SHARED with prod (owned by prod workspace).

s3_bucket_name     = "compass-stage-883107059193"
aws_region         = "us-east-1"
environment        = "stage"

# Subdomain for stage (points to stage CloudFront via A/AAAA records)
domain_name        = "stage.immigrationcompass.fyi"
route53_zone_id    = "Z08038301M0XIKARMVXCB"  # Shared zone (owned by prod workspace)
create_certificate = true
