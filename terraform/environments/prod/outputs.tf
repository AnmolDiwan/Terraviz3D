output "cloudfront_https_url" {
  value       = module.compute.cloudfront_domain_name != "disabled" ? "https://${module.compute.cloudfront_domain_name}" : "pending-account-verification (use ALB: http://${module.compute.alb_dns_name})"
  description = "Frontend Free Production HTTPS URL"
}

output "alb_dns_name" {
  value       = module.compute.alb_dns_name
  description = "Application Load Balancer DNS name"
}

output "rds_postgres_endpoint" {
  value       = module.data.db_instance_endpoint
  description = "RDS PostgreSQL private endpoint"
}

output "ecr_repository_url" {
  value       = module.compute.ecr_repository_url
  description = "ECR Docker repository URL"
}

output "frontend_s3_bucket" {
  value       = module.compute.frontend_s3_bucket
  description = "Frontend S3 deployment bucket"
}

output "cloudwatch_dashboard_name" {
  value       = module.monitoring.dashboard_name
  description = "CloudWatch Dashboard Name"
}

output "admin_role_arn" {
  value       = module.iam.admin_role_arn
  description = "Anmol Break-Glass Admin Role ARN"
}

output "backend_developer_role_arn" {
  value       = module.iam.backend_dev_role_arn
  description = "Shivansh BackendDeveloper Role ARN"
}

output "frontend_developer_role_arn" {
  value       = module.iam.frontend_dev_role_arn
  description = "Aditya FrontendDeveloper Role ARN"
}
