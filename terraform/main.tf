terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment below to use S3 backend for state (recommended for team)
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "compass/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "NorthStar-Compass"
      Environment = var.environment
      ManagedBy   = "Terraform"
      CreatedAt   = timestamp()
    }
  }
}

# ============================================================================
# S3 Bucket for Static Site
# ============================================================================

resource "aws_s3_bucket" "compass_site" {
  bucket              = var.s3_bucket_name
  force_destroy       = var.environment == "dev" ? true : false

  tags = {
    Name        = "Compass Static Site"
    Description = "Immigration Insights App static export"
  }
}

# Block all public access initially (CloudFront will access via OAC)
resource "aws_s3_bucket_public_access_block" "compass_site" {
  bucket = aws_s3_bucket.compass_site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for rollback capability
resource "aws_s3_bucket_versioning" "compass_site" {
  bucket = aws_s3_bucket.compass_site.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "compass_site" {
  bucket = aws_s3_bucket.compass_site.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ============================================================================
# CloudFront Origin Access Control (OAC)
# ============================================================================

resource "aws_cloudfront_origin_access_control" "compass_oac" {
  name                              = "compass-oac"
  description                       = "OAC for Compass S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Update S3 bucket policy to allow CloudFront access via OAC
resource "aws_s3_bucket_policy" "compass_site" {
  bucket = aws_s3_bucket.compass_site.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOACAccess"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.compass_site.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.compass.arn
          }
        }
      }
    ]
  })
}

# ============================================================================
# ACM Certificate (for HTTPS)
# ============================================================================

resource "aws_acm_certificate" "compass" {
  count             = var.create_certificate ? 1 : 0
  domain_name       = var.domain_name != "" ? var.domain_name : var.s3_bucket_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "Compass SSL Certificate"
  }
}

# Certificate validation via DNS (if using Route 53)
resource "aws_route53_record" "compass_cert_validation" {
  count   = var.create_certificate && var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id

  for_each = {
    for dvo in aws_acm_certificate.compass[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
}

resource "aws_acm_certificate_validation" "compass" {
  count           = var.create_certificate && var.route53_zone_id != "" ? 1 : 0
  certificate_arn = aws_acm_certificate.compass[0].arn

  timeouts {
    create = "5m"
  }

  depends_on = [aws_route53_record.compass_cert_validation]
}

# ============================================================================
# CloudFront Distribution
# ============================================================================

resource "aws_cloudfront_distribution" "compass" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  # Origin: S3 bucket
  origin {
    domain_name              = aws_s3_bucket.compass_site.bucket_regional_domain_name
    origin_id                = "S3Origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.compass_oac.id
  }

  # Default cache behavior: SPA routing + aggressive caching
  default_cache_behavior {
    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD"]

    target_origin_id = "S3Origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # Long cache for production
    min_ttl     = 0
    default_ttl = var.cache_default_ttl
    max_ttl     = var.cache_max_ttl

    # Custom headers for security
    default_cache_behavior {
      response_headers_policy_id = aws_cloudfront_response_headers_policy.compass_security.id
    }
  }

  # Cache behavior for /data/* (immutable, cache 30 days)
  cache_behavior {
    path_pattern     = "/data/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3Origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    min_ttl     = 2592000  # 30 days (immutable artifacts)
    default_ttl = 2592000
    max_ttl     = 2592000
  }

  # Cache behavior for static assets (CSS, JS, fonts)
  cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3Origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    min_ttl     = 86400   # 1 day
    default_ttl = 86400
    max_ttl     = 604800  # 7 days
  }

  # Custom error response: SPA routing fallback
  # When user visits /dashboard/something, CloudFront will serve index.html
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 300
  }

  # SSL/TLS Certificate
  viewer_certificate {
    cloudfront_default_certificate = !var.create_certificate
    acm_certificate_arn            = var.create_certificate ? aws_acm_certificate.compass[0].arn : null
    ssl_support_method             = var.create_certificate ? "sni-only" : null
    minimum_protocol_version       = var.create_certificate ? "TLSv1.2_2021" : "TLSv1"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name = "Compass CloudFront Distribution"
  }
}

# ============================================================================
# Security Headers Policy
# ============================================================================

resource "aws_cloudfront_response_headers_policy" "compass_security" {
  name    = "compass-security-headers"
  comment = "Security headers for Compass"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 63072000  # 2 years
      include_subdomains         = true
      preload                    = true
      override                   = false
    }

    content_type_options {
      override = false
    }

    frame_options {
      frame_option = "DENY"
      override     = false
    }

    xss_protection {
      mode_block = true
      protection = true
      override   = false
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = false
    }

    permissions_policy {
      managed_statements = [
        {
          name = "SharedStorage"
          principals = ["*"]
          resources = ["*"]
          actions = []
        }
      ]
    }
  }
}

# ============================================================================
# Route 53 (Optional: Custom Domain)
# ============================================================================

resource "aws_route53_record" "compass" {
  count   = var.route53_zone_id != "" && var.domain_name != "" ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.compass.domain_name
    zone_id                = aws_cloudfront_distribution.compass.hosted_zone_id
    evaluate_target_health = false
  }
}

# ============================================================================
# CloudWatch Log Group (Optional: monitoring)
# ============================================================================

resource "aws_cloudwatch_log_group" "compass_cdn" {
  count             = var.enable_logging ? 1 : 0
  name              = "/aws/cloudfront/compass"
  retention_in_days = 7

  tags = {
    Name = "Compass CloudFront Logs"
  }
}
