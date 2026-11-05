output "db_instance_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "Connection endpoint for PostgreSQL (host:port)"
}

output "db_instance_address" {
  value       = aws_db_instance.postgres.address
  description = "Host address for PostgreSQL"
}

output "db_instance_id" {
  value       = aws_db_instance.postgres.id
  description = "RDS instance ID"
}

output "db_name" {
  value       = aws_db_instance.postgres.db_name
  description = "PostgreSQL Database Name"
}

output "redis_endpoint" {
  value       = var.enable_elasticache ? aws_elasticache_cluster.redis[0].cache_nodes[0].address : "disabled"
  description = "Primary endpoint for ElastiCache Redis"
}
