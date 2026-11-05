output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "Public DNS name of the ALB"
}

output "alb_arn" {
  value       = aws_lb.main.arn
  description = "ARN of the ALB"
}

output "alb_target_group_arn" {
  value       = aws_lb_target_group.backend.arn
  description = "ARN of the backend target group"
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "Name of the ECS cluster"
}

output "ecs_service_name" {
  value       = aws_ecs_service.backend.name
  description = "Name of the ECS service"
}

output "ecr_repository_url" {
  value       = aws_ecr_repository.backend.repository_url
  description = "URL of the ECR repository"
}

output "frontend_s3_bucket" {
  value       = aws_s3_bucket.frontend.id
  description = "Name of the S3 bucket hosting frontend static assets"
}

output "cloudfront_distribution_id" {
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].id : "disabled"
  description = "CloudFront Distribution ID"
}

output "cloudfront_domain_name" {
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].domain_name : "disabled"
  description = "CloudFront Domain Name (Free HTTPS URL)"
}
