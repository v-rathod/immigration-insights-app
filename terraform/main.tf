# =============================================================================
# Compass · AWS Infrastructure (Terraform)
# =============================================================================
# Deploys: S3 (static site) + CloudFront (CDN) + Logging + Monitoring
# Estimated cost: ~$1–3/month
# =============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment for remote state (recommended for teams):
  # backend "s3" {
  #   bucket         = "compass-terraform-state"
  #   key            = "compass/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "NorthStar"
      Application = "Compass"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# =============================================================================
# S3 Bucket — Static Site Content
# =============================================================================

resource "aws_s3_bucket" "site" {
  bucket        = var.s3_bucket_name
  force_destroy = var.environment != "prod"

  tags = {
    Name = "Compass Static Site"
  }
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# =============================================================================
# S3 Bucket — Access Logs
# =============================================================================

resource "aws_s3_bucket" "logs" {
  bucket        = "${var.s3_bucket_name}-logs"
  force_destroy = true

  tags = {
    Name = "Compass Access Logs"
  }
}

resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = false
  block_public_policy     = true
  ignore_public_acls      = false
  restrict_public_buckets = true
}

# Auto-delete old logs after 90 days
resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# CloudFront standard logging requires bucket owner controls + ACL
resource "aws_s3_bucket_ownership_controls" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "logs" {
  depends_on = [aws_s3_bucket_ownership_controls.logs]
  bucket     = aws_s3_bucket.logs.id
  acl        = "log-delivery-write"
}

# S3 access logging on the site bucket itself
resource "aws_s3_bucket_logging" "site" {
  bucket        = aws_s3_bucket.site.id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3-access-logs/"
}

# =============================================================================
# CloudFront Origin Access Control (OAC)
# =============================================================================

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.s3_bucket_name}-oac"
  description                       = "OAC for Compass S3 origin"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 bucket policy: only CloudFront can read
resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.site.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
          }
        }
      }
    ]
  })
}

# =============================================================================
# CloudFront Security Headers Policy
# =============================================================================

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${var.s3_bucket_name}-security-headers"
  comment = "Security headers for Compass"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    content_security_policy {
      content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com https://api.groq.com https://formspree.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://formspree.io"
      override                = true
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "camera=(), microphone=(), geolocation=(), payment=()"
      override = true
    }
    items {
      header   = "X-Permitted-Cross-Domain-Policies"
      value    = "none"
      override = true
    }
  }
}

# =============================================================================
# CloudFront Function — SPA URL Rewriter
# Rewrites /about → /about/index.html so Next.js static export routes work
# =============================================================================

resource "aws_cloudfront_function" "url_rewriter" {
  name    = "${var.s3_bucket_name}-url-rewriter"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite clean URLs to index.html for Next.js static export"
  publish = true

  code = <<-EOF
    async function handler(event) {
      const request = event.request;
      let uri = request.uri;

      // Already has a file extension — let it pass through unchanged
      if (/\.[a-zA-Z0-9]+$/.test(uri)) {
        return request;
      }

      // Ends with / → append index.html
      if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
        return request;
      }

      // No extension, no trailing slash → append /index.html
      request.uri = uri + '/index.html';
      return request;
    }
  EOF
}

# =============================================================================
# CloudFront Cache Policies
# =============================================================================

# /data/* — immutable pre-computed JSON (30-day cache)
resource "aws_cloudfront_cache_policy" "immutable_data" {
  name        = "${var.s3_bucket_name}-immutable-data"
  comment     = "30-day cache for /data/* pre-computed JSON"
  default_ttl = 2592000
  max_ttl     = 2592000
  min_ttl     = 2592000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# /_next/* — hashed static assets (1-day cache)
resource "aws_cloudfront_cache_policy" "static_assets" {
  name        = "${var.s3_bucket_name}-static-assets"
  comment     = "1-day cache for hashed _next/ assets"
  default_ttl = 86400
  max_ttl     = 604800
  min_ttl     = 3600

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Default — HTML pages (short TTL for quick updates)
resource "aws_cloudfront_cache_policy" "html_pages" {
  name        = "${var.s3_bucket_name}-html-pages"
  comment     = "1-hour cache for HTML pages"
  default_ttl = 3600
  max_ttl     = 86400
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# =============================================================================
# CloudFront Distribution
# =============================================================================

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  http_version        = "http2and3"
  price_class         = "PriceClass_100"
  comment             = "Compass Immigration Insights App"

  # Origin: S3 via OAC
  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "S3Origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  # Default behavior: HTML pages
  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "S3Origin"
    cache_policy_id            = aws_cloudfront_cache_policy.html_pages.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.url_rewriter.arn
    }
  }

  # /data/* — immutable JSON (30-day cache)
  ordered_cache_behavior {
    path_pattern               = "/data/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "S3Origin"
    cache_policy_id            = aws_cloudfront_cache_policy.immutable_data.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
  }

  # /_next/* — hashed static assets (1-day cache)
  ordered_cache_behavior {
    path_pattern               = "/_next/*"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "S3Origin"
    cache_policy_id            = aws_cloudfront_cache_policy.static_assets.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
  }

  # SPA routing: serve index.html for 404/403
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 60
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 60
  }

  # HTTPS: CloudFront default cert (no custom domain needed)
  viewer_certificate {
    cloudfront_default_certificate = var.domain_name == ""
    acm_certificate_arn            = var.domain_name != "" && var.create_certificate ? aws_acm_certificate.cert[0].arn : null
    ssl_support_method             = var.domain_name != "" ? "sni-only" : null
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # CloudFront access logging to S3
  logging_config {
    include_cookies = false
    bucket          = aws_s3_bucket.logs.bucket_regional_domain_name
    prefix          = "cloudfront-logs/"
  }

  depends_on = [aws_s3_bucket_acl.logs]

  tags = {
    Name = "Compass CDN"
  }
}

# =============================================================================
# ACM Certificate (optional — only when custom domain is set)
# =============================================================================

resource "aws_acm_certificate" "cert" {
  count             = var.domain_name != "" && var.create_certificate ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "Compass SSL Certificate"
  }
}

# =============================================================================
# Route 53 (optional — only when zone ID + domain provided)
# =============================================================================

resource "aws_route53_record" "site" {
  count   = var.domain_name != "" && var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# =============================================================================
# CloudWatch Dashboard — Operational Visibility
# =============================================================================

resource "aws_cloudwatch_dashboard" "compass" {
  dashboard_name = "Compass-Operations"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "CloudFront Requests"
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", aws_cloudfront_distribution.site.id, "Region", "Global", { stat = "Sum", period = 300 }]
          ]
          view   = "timeSeries"
          region = "us-east-1"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Error Rate (4xx / 5xx)"
          metrics = [
            ["AWS/CloudFront", "4xxErrorRate", "DistributionId", aws_cloudfront_distribution.site.id, "Region", "Global", { stat = "Average", period = 300, label = "4xx" }],
            ["AWS/CloudFront", "5xxErrorRate", "DistributionId", aws_cloudfront_distribution.site.id, "Region", "Global", { stat = "Average", period = 300, label = "5xx" }]
          ]
          view   = "timeSeries"
          region = "us-east-1"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "Bytes Downloaded"
          metrics = [
            ["AWS/CloudFront", "BytesDownloaded", "DistributionId", aws_cloudfront_distribution.site.id, "Region", "Global", { stat = "Sum", period = 300 }]
          ]
          view   = "timeSeries"
          region = "us-east-1"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "Cache Hit Rate"
          metrics = [
            ["AWS/CloudFront", "CacheHitRate", "DistributionId", aws_cloudfront_distribution.site.id, "Region", "Global", { stat = "Average", period = 300 }]
          ]
          view   = "timeSeries"
          region = "us-east-1"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          title   = "S3 Bucket Size"
          metrics = [
            ["AWS/S3", "BucketSizeBytes", "StorageType", "StandardStorage", "BucketName", var.s3_bucket_name, { stat = "Average", period = 86400 }]
          ]
          view   = "singleValue"
          region = var.aws_region
          period = 86400
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          title   = "S3 Object Count"
          metrics = [
            ["AWS/S3", "NumberOfObjects", "StorageType", "AllStorageTypes", "BucketName", var.s3_bucket_name, { stat = "Average", period = 86400 }]
          ]
          view   = "singleValue"
          region = var.aws_region
          period = 86400
        }
      }
    ]
  })
}

# =============================================================================
# CloudWatch Alarms — Error Alerts
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "high_4xx_rate" {
  alarm_name          = "compass-high-4xx-error-rate"
  alarm_description   = "4xx error rate > 10% for 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  dimensions = {
    DistributionId = aws_cloudfront_distribution.site.id
    Region         = "Global"
  }

  tags = {
    Name = "Compass 4xx Alert"
  }
}

resource "aws_cloudwatch_metric_alarm" "high_5xx_rate" {
  alarm_name          = "compass-high-5xx-error-rate"
  alarm_description   = "5xx error rate > 1% for 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    DistributionId = aws_cloudfront_distribution.site.id
    Region         = "Global"
  }

  tags = {
    Name = "Compass 5xx Alert"
  }
}
