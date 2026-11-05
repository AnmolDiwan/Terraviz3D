# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${lower(var.project)}-${var.environment}-redis-subnet-group"
  subnet_ids  = var.private_data_subnet_ids
  description = "Private Subnet Group for ElastiCache Redis"
}

# Optional ElastiCache Redis Cluster (can be enabled if budget allows)
resource "aws_elasticache_cluster" "redis" {
  count                = var.enable_elasticache ? 1 : 0
  cluster_id           = "${lower(var.project)}-redis"
  engine               = "redis"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [var.elasticache_security_group_id]

  tags = {
    Component = "cache"
  }
}
