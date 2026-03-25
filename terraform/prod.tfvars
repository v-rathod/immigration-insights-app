# Compass: Production Environment
# Usage: terraform workspace select prod && terraform apply -var-file=prod.tfvars
#
# Prod deploys to immigrationcompass.fyi with its own CloudFront + S3.
# Route 53 zone is OWNED by this workspace (zone_id left empty so dns.tf creates it).

s3_bucket_name     = "compass-prod-883107059193"
aws_region         = "us-east-1"
environment        = "prod"

# Root domain for production
domain_name        = "immigrationcompass.fyi"
route53_zone_id    = ""  # Empty = zone created in this workspace (prod owns the zone)
create_certificate = true

# SECURITY: basic_auth MUST be empty for prod — no authentication prompt on public site
basic_auth_credentials = ""
