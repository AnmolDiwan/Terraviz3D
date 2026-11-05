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

variable "alert_email" {
  type        = string
  description = "Email address to receive SNS alert notifications and AWS Budgets alerts"
}

variable "ecs_cluster_name" {
  type        = string
  description = "ECS Cluster Name"
}

variable "ecs_service_name" {
  type        = string
  description = "ECS Service Name"
}

variable "alb_arn_suffix" {
  type        = string
  description = "ALB ARN Suffix for CloudWatch metrics"
}

variable "alb_target_group_arn_suffix" {
  type        = string
  description = "Target Group ARN Suffix for CloudWatch metrics"
}

variable "rds_instance_id" {
  type        = string
  description = "RDS Instance Identifier"
}

variable "waf_web_acl_name" {
  type        = string
  description = "WAF WebACL Name"
}

variable "enable_cost_anomaly" {
  type        = bool
  default     = false
  description = "Whether to create a Cost Anomaly Monitor (AWS limits 1 dimensional monitor per account)"
}
