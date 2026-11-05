output "vpc_id" {
  value       = aws_vpc.main.id
  description = "The ID of the VPC"
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "List of public subnet IDs"
}

output "private_app_subnet_ids" {
  value       = aws_subnet.private_app[*].id
  description = "List of private application subnet IDs"
}

output "private_data_subnet_ids" {
  value       = aws_subnet.private_data[*].id
  description = "List of private data subnet IDs"
}

output "alb_security_group_id" {
  value       = aws_security_group.alb.id
  description = "Security Group ID of the ALB"
}

output "ecs_security_group_id" {
  value       = aws_security_group.ecs.id
  description = "Security Group ID of the ECS Fargate tasks"
}

output "rds_security_group_id" {
  value       = aws_security_group.rds.id
  description = "Security Group ID of the RDS PostgreSQL instance"
}

output "elasticache_security_group_id" {
  value       = aws_security_group.elasticache.id
  description = "Security Group ID of the ElastiCache Redis cluster"
}

output "nat_gateway_id" {
  value       = aws_nat_gateway.main.id
  description = "ID of the single NAT Gateway"
}
