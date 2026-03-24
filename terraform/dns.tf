# =============================================================================
# Route 53 — DNS Hosting
# =============================================================================
# Shared Route 53 zone for immigrationcompass.fyi.
#
# Architecture:
#   - PROD workspace: Owns the zone (route53_zone_id is empty → zone created here)
#   - STAGE workspace: References the zone by ID (route53_zone_id is set → no zone created)
#
# Both workspaces create their own A/AAAA records pointing to their own
# CloudFront distributions, ensuring full resource isolation.
# =============================================================================

# Route 53 Hosted Zone — created ONLY when route53_zone_id is not provided
# (i.e., only in the prod workspace that owns the parent domain)
resource "aws_route53_zone" "main" {
  count = var.domain_name != "" && var.route53_zone_id == "" ? 1 : 0
  name  = var.domain_name

  tags = {
    Name = "Compass DNS Zone"
  }
}

# Resolve the zone ID: either from the created zone or from the variable
locals {
  resolved_zone_id = (
    var.route53_zone_id != "" ? var.route53_zone_id :
    (var.domain_name != "" && length(aws_route53_zone.main) > 0
      ? aws_route53_zone.main[0].zone_id
      : "")
  )
}

# Route 53 A Record — Points domain/subdomain to this environment's CloudFront
resource "aws_route53_record" "cloudfront_a_record" {
  count   = var.domain_name != "" && local.resolved_zone_id != "" ? 1 : 0
  zone_id = local.resolved_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# Route 53 AAAA Record (IPv6)
resource "aws_route53_record" "cloudfront_aaaa_record" {
  count   = var.domain_name != "" && local.resolved_zone_id != "" ? 1 : 0
  zone_id = local.resolved_zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# Output: Nameservers (only meaningful when zone is created here = prod)
output "route53_nameservers" {
  description = "Route 53 nameservers (only output when zone is created in this workspace)"
  value       = length(aws_route53_zone.main) > 0 ? aws_route53_zone.main[0].name_servers : []
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID (created or referenced)"
  value       = local.resolved_zone_id
}

# =============================================================================
# ACM Certificate DNS Validation Records
# =============================================================================
# Adds CNAME records to Route 53 so ACM can validate domain ownership.

resource "aws_route53_record" "acm_validation" {
  for_each = toset(var.domain_name != "" && var.create_certificate && local.resolved_zone_id != "" ? [var.domain_name] : [])

  allow_overwrite = true
  name            = tolist(aws_acm_certificate.cert[0].domain_validation_options)[0].resource_record_name
  records         = [tolist(aws_acm_certificate.cert[0].domain_validation_options)[0].resource_record_value]
  ttl             = 60
  type            = tolist(aws_acm_certificate.cert[0].domain_validation_options)[0].resource_record_type
  zone_id         = local.resolved_zone_id
}

# Wait for ACM certificate to be fully validated before CloudFront uses it
resource "aws_acm_certificate_validation" "cert" {
  count                   = var.domain_name != "" && var.create_certificate ? 1 : 0
  certificate_arn         = aws_acm_certificate.cert[0].arn
  validation_record_fqdns = [for record in aws_route53_record.acm_validation : record.fqdn]
}

# =============================================================================
# Google Search Console Verification
# =============================================================================
resource "aws_route53_record" "google_site_verification" {
  count           = var.domain_name != "" && local.resolved_zone_id != "" && var.route53_zone_id == "" ? 1 : 0
  zone_id         = local.resolved_zone_id
  name            = var.domain_name
  type            = "TXT"
  ttl             = 300
  allow_overwrite = true
  records         = ["google-site-verification=ydZR6_X372zf-EFzEzTYG7CdY8HJTru-STIwg49Q_eQ"]
}
