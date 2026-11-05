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

variable "alb_arn" {
  type        = string
  description = "ARN of the Application Load Balancer to attach WAF to"
}

variable "waf_mode_count" {
  type        = bool
  default     = true
  description = "When true, managed WAF rules run in COUNT mode for testing. Set to false to BLOCK."
}

variable "groq_api_key" {
  type        = string
  sensitive   = true
  description = "Groq API key stored securely in Secrets Manager"
}

variable "jwt_secret" {
  type        = string
  sensitive   = true
  description = "JWT Secret for user authentication tokens"
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

variable "db_name" {
  type        = string
  default     = "terraviz"
  description = "RDS database name"
}

variable "enable_guardduty" {
  type        = bool
  default     = false
  description = "Enable GuardDuty detector (requires active AWS subscription)"
}

variable "enable_securityhub" {
  type        = bool
  default     = false
  description = "Enable Security Hub (requires active AWS subscription)"
}
