# Compass: Production Environment (custom domain, future)
# Usage: terraform workspace select prod && terraform apply -var-file=prod.tfvars
#
# INSTRUCTIONS: When you purchase a domain:
# 1. Update s3_bucket_name to a unique prod bucket name
# 2. Set domain_name to your domain
# 3. Set route53_zone_id to your Route 53 hosted zone ID
# 4. Set create_certificate = true
# 5. Run: terraform workspace new prod
#         terraform apply -var-file=prod.tfvars

s3_bucket_name     = "compass-prod-883107059193"
aws_region         = "us-east-1"
environment        = "prod"

# Custom domain (fill when domain is purchased)
domain_name        = ""
route53_zone_id    = ""
create_certificate = false
