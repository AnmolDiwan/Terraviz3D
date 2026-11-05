variable "project" {
  type    = string
  default = "TerraViz3D"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "ecs_cluster_arn" {
  type        = string
  description = "ARN of the ECS Cluster"
}

variable "backend_service_arn" {
  type        = string
  description = "ARN of the Backend ECS Service"
}

variable "ecr_backend_arn" {
  type        = string
  description = "ARN of the Backend ECR repository"
}

variable "backend_log_group_arn" {
  type        = string
  description = "ARN of the backend CloudWatch log group"
}

variable "frontend_s3_bucket_arn" {
  type        = string
  description = "ARN of the Frontend S3 bucket"
}

variable "cloudfront_distribution_arn" {
  type        = string
  description = "ARN of the CloudFront distribution"
}
