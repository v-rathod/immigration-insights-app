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
  description = "Environment name (dev, stage, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "stage", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, stage, staging, or prod"
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
  description = "Custom domain name (e.g., compass.example.com). Leave empty to use CloudFront default domain."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID. Leave empty if not using Route 53."
  type        = string
  default     = ""
}

variable "create_certificate" {
  description = "Create ACM certificate for custom domain (requires domain_name)"
  type        = bool
  default     = false
}

variable "basic_auth_credentials" {
  description = "Basic auth credentials as 'username:password'. When non-empty, CloudFront requires authentication. Use ONLY for non-prod environments. Leave empty for prod."
  type        = string
  default     = ""
  sensitive   = true

  validation {
    condition     = var.basic_auth_credentials == "" || can(regex("^[^:]+:.+$", var.basic_auth_credentials))
    error_message = "basic_auth_credentials must be empty or in 'username:password' format"
  }
}
