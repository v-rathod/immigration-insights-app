output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.site.id
}

output "s3_logs_bucket_name" {
  description = "S3 logs bucket name"
  value       = aws_s3_bucket.logs.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation)"
  value       = aws_cloudfront_distribution.site.id
}

output "deployment_url" {
  description = "Full URL to access the app"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "s3_deploy_command" {
  description = "Command to deploy static files to S3"
  value       = "aws s3 sync ./out s3://${aws_s3_bucket.site.id} --delete --region ${var.aws_region}"
}

output "cloudfront_invalidate_command" {
  description = "Command to invalidate CloudFront cache"
  value       = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.site.id} --paths '/*'"
}

output "cloudwatch_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=Compass-Operations"
}

output "estimated_monthly_cost" {
  description = "Rough estimated monthly cost"
  value       = "~$1-3/month (S3 $0.02 + CloudFront free tier + CloudWatch free tier)"
}
