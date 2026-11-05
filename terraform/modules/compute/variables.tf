variable "project" {
  type    = string
  default = "TerraViz3D"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public Subnet IDs for ALB"
}

variable "private_app_subnet_ids" {
  type        = list(string)
  description = "Private Subnet IDs for ECS Fargate"
}

variable "alb_security_group_id" {
  type        = string
  description = "ALB Security Group ID"
}

variable "ecs_security_group_id" {
  type        = string
  description = "ECS Fargate Security Group ID"
}

variable "kms_logs_key_arn" {
  type        = string
  description = "KMS Key ARN for CloudWatch Logs and S3"
}

variable "db_credentials_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for DB credentials"
}

variable "app_secrets_arn" {
  type        = string
  description = "Secrets Manager ARN for App secrets"
}

variable "db_endpoint" {
  type        = string
  description = "PostgreSQL DB endpoint (host:port)"
}

variable "db_name" {
  type        = string
  description = "Database name"
  default     = "terraviz"
}

variable "enable_cloudfront" {
  type        = bool
  default     = false
  description = "Enable CloudFront distribution. Requires AWS account verification for new accounts."
}
