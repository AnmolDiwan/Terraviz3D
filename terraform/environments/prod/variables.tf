variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS deployment region"
}

variable "project" {
  type        = string
  default     = "TerraViz3D"
  description = "Project name"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Environment name"
}

variable "alert_email" {
  type        = string
  default     = "anmol.diwan12@gmail.com"
  description = "Email address for CloudWatch alarms, SNS notifications, and Budgets alerts"
}

variable "db_username" {
  type        = string
  sensitive   = true
  default     = "terraviz_admin"
  description = "RDS PostgreSQL master username"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "RDS PostgreSQL master password"
}

variable "db_name" {
  type        = string
  default     = "terraviz"
  description = "RDS database name"
}

variable "jwt_secret" {
  type        = string
  sensitive   = true
  description = "JWT Secret for authentication"
}

variable "groq_api_key" {
  type        = string
  sensitive   = true
  description = "Groq API key for AI assistant LLM inference"
}

variable "waf_mode_count" {
  type        = bool
  default     = true
  description = "Set to true for initial COUNT mode, false to BLOCK"
}

variable "enable_elasticache" {
  type        = bool
  default     = false
  description = "Set to true to provision ElastiCache Redis (false keeps within $80 budget)"
}
