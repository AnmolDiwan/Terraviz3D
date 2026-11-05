variable "project" {
  type    = string
  default = "TerraViz3D"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "private_data_subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for RDS and ElastiCache in the private data tier"
}

variable "rds_security_group_id" {
  type        = string
  description = "Security Group ID for RDS PostgreSQL"
}

variable "elasticache_security_group_id" {
  type        = string
  description = "Security Group ID for ElastiCache Redis"
}

variable "kms_data_key_arn" {
  type        = string
  description = "KMS CMK ARN for RDS and Secrets encryption"
}

variable "db_name" {
  type        = string
  default     = "terraviz"
  description = "Name of the default PostgreSQL database"
}

variable "db_username" {
  type        = string
  sensitive   = true
  default     = "terraviz_admin"
  description = "RDS master username"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "RDS master password"
}

variable "enable_elasticache" {
  type        = bool
  default     = false
  description = "Whether to provision an ElastiCache Redis cluster (set to false to keep within $80 budget)"
}
