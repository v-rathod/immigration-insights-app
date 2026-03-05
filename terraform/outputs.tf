output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.compass_site.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.compass.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation)"
  value       = aws_cloudfront_distribution.compass.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.compass.arn
}

output "custom_domain" {
  description = "Custom domain name (if configured)"
  value       = var.domain_name != "" ? var.domain_name : "Not configured"
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN"
  value       = var.create_certificate ? aws_acm_certificate.compass[0].arn : "Not created"
}

output "deployment_url" {
  description = "Full URL to access the app"
  value = var.domain_name != "" ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.compass.domain_name}"
}

output "s3_deploy_command" {
  description = "Command to deploy static files to S3"
  value       = "aws s3 sync ./out s3://${aws_s3_bucket.compass_site.id} --delete --region ${var.aws_region}"
}

output "cloudfront_invalidate_command" {
  description = "Command to invalidate CloudFront cache (run after deploy)"
  value       = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.compass.id} --paths '/*' --region ${var.aws_region}"
}

output "estimated_monthly_cost" {
  description = "Rough estimated monthly cost (actual may vary)"
  value       = "~$1-3/month (S3 + CloudFront + Route53)"
}
