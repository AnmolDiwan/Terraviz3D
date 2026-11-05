data "aws_caller_identity" "current" {}

# Permissions boundary ensuring neither role can ever escalate privileges
resource "aws_iam_policy" "developer_boundary" {
  name        = "DeveloperPermissionBoundary"
  description = "Maximum permissions boundary for developer roles"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowedDeveloperServices"
        Effect = "Allow"
        Action = [
          "ecs:*",
          "ecr:*",
          "s3:*",
          "cloudfront:*",
          "logs:*",
          "cloudwatch:*",
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "rds:Describe*",
          "elasticache:Describe*"
        ]
        Resource = "*"
      },
      {
        Sid    = "DenyPrivilegeEscalation"
        Effect = "Deny"
        Action = [
          "iam:*",
          "organizations:*",
          "account:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "DenySecurityDisruption"
        Effect = "Deny"
        Action = [
          "kms:Delete*",
          "kms:ScheduleKeyDeletion",
          "cloudtrail:StopLogging",
          "cloudtrail:DeleteTrail",
          "guardduty:DeleteDetector",
          "guardduty:DisassociateFromMasterAccount",
          "config:StopConfigurationRecorder",
          "config:DeleteConfigurationRecorder",
          "wafv2:DeleteWebACL",
          "wafv2:UpdateWebACL"
        ]
        Resource = "*"
      }
    ]
  })
}
