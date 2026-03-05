variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^(us|eu|ap|sa|ca)-", var.aws_region))
    error_message = "AWS region must be valid (e.g., us-east-1, eu-west-1)"
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "s3_bucket_name" {
  description = "S3 bucket name for static site (must be globally unique)"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.s3_bucket_name))
    error_message = "S3 bucket name must be 3-63 characters, lowercase letters, numbers, and hyphens"
  }
}

variable "domain_name" {
  description = "Custom domain name for the app (e.g., compass.example.com). Leave empty to use CloudFront default domain."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for custom domain. Leave empty if not using Route 53."
  type        = string
  default     = ""
}

variable "create_certificate" {
  description = "Create ACM certificate for custom domain"
  type        = bool
  default     = true
}

variable "cache_default_ttl" {
  description = "Default cache TTL in seconds for HTML/JS/CSS"
  type        = number
  default     = 3600  # 1 hour

  validation {
    condition     = var.cache_default_ttl > 0
    error_message = "Cache TTL must be greater than 0"
  }
}

variable "cache_max_ttl" {
  description = "Maximum cache TTL in seconds"
  type        = number
  default     = 86400  # 1 day

  validation {
    condition     = var.cache_max_ttl >= var.cache_default_ttl
    error_message = "Max TTL must be >= default TTL"
  }
}

variable "enable_logging" {
  description = "Enable CloudWatch logging for CloudFront"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default = {
    Project = "NorthStar"
    App     = "Compass"
  }
}
