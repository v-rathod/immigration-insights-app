# Compass: Stage Environment (current CloudFront deployment)
# Usage: terraform workspace select stage && terraform apply -var-file=stage.tfvars

s3_bucket_name     = "compass-immigration-insights-883107059193"
aws_region         = "us-east-1"
environment        = "staging"

# No custom domain for stage (uses CloudFront default domain)
domain_name        = ""
route53_zone_id    = ""
create_certificate = false
