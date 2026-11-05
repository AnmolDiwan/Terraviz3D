output "admin_role_arn" {
  value       = aws_iam_role.admin_role.arn
  description = "ARN of the break-glass Admin role"
}

output "backend_dev_role_arn" {
  value       = aws_iam_role.backend_dev_role.arn
  description = "ARN of the BackendDeveloper role"
}

output "frontend_dev_role_arn" {
  value       = aws_iam_role.frontend_dev_role.arn
  description = "ARN of the FrontendDeveloper role"
}

output "developer_boundary_arn" {
  value       = aws_iam_policy.developer_boundary.arn
  description = "ARN of the developer permissions boundary"
}
