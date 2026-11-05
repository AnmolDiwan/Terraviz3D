output "kms_data_key_arn" {
  value       = aws_kms_key.data_key.arn
  description = "ARN of KMS CMK for data and secrets"
}

output "kms_logs_key_arn" {
  value       = aws_kms_key.logs_key.arn
  description = "ARN of KMS CMK for logs and S3"
}

output "db_credentials_secret_arn" {
  value       = aws_secretsmanager_secret.db_credentials.arn
  description = "ARN of Secrets Manager DB credentials"
}

output "app_secrets_arn" {
  value       = aws_secretsmanager_secret.app_secrets.arn
  description = "ARN of Secrets Manager Application secrets"
}

output "waf_web_acl_arn" {
  value       = aws_wafv2_web_acl.alb_waf.arn
  description = "ARN of the WAFv2 WebACL"
}

output "cloudtrail_bucket_arn" {
  value       = aws_s3_bucket.cloudtrail_bucket.arn
  description = "ARN of CloudTrail S3 bucket"
}
