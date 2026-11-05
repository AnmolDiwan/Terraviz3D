# 1. Human IAM Users
resource "aws_iam_user" "anmol" {
  name = "Anmol"
  tags = {
    Role = "BreakGlassAdmin"
  }
}

resource "aws_iam_user" "shivansh" {
  name = "Shivansh"
  tags = {
    Role = "BackendDeveloper"
  }
}

resource "aws_iam_user" "aditya" {
  name = "Aditya"
  tags = {
    Role = "FrontendDeveloper"
  }
}

# 2. Break-Glass Admin Role (Anmol) with MFA Enforced
resource "aws_iam_role" "admin_role" {
  name                 = "TerraVizAdminRole"
  max_session_duration = 14400 # 4 hours

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_user.anmol.arn
        }
        Action = "sts:AssumeRole"
        Condition = {
          Bool = {
            "aws:MultiFactorAuthPresent" = "true"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "admin_attach" {
  role       = aws_iam_role.admin_role.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

# 3. BackendDeveloper Role (Shivansh)
resource "aws_iam_role" "backend_dev_role" {
  name                 = "BackendDeveloperRole"
  max_session_duration = 14400 # 4 hours
  permissions_boundary = aws_iam_policy.developer_boundary.arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_user.shivansh.arn
        }
        Action = "sts:AssumeRole"
        Condition = {
          Bool = {
            "aws:MultiFactorAuthPresent" = "true"
          }
        }
      }
    ]
  })
}

resource "aws_iam_policy" "backend_dev_policy" {
  name        = "BackendDeveloperLeastPrivilegePolicy"
  description = "Scoped backend developer permissions with explicit denies"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ECS permissions (describe/list/update-service/run-task on backend only)
      {
        Sid    = "AllowECSBackendManagement"
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:UpdateService",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:RunTask",
          "ecs:StopTask",
          "ecs:DescribeTaskDefinition"
        ]
        Resource = [
          var.ecs_cluster_arn,
          var.backend_service_arn,
          "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task/*"
        ]
      },
      {
        Sid    = "AllowECSDiscovery"
        Effect = "Allow"
        Action = [
          "ecs:ListClusters",
          "ecs:ListServices"
        ]
        Resource = "*"
      },
      # ECR push/pull on backend repo only
      {
        Sid    = "AllowECRBackend"
        Effect = "Allow"
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeRepositories",
          "ecr:ListImages"
        ]
        Resource = var.ecr_backend_arn
      },
      {
        Sid    = "AllowECRAuthToken"
        Effect = "Allow"
        Action = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      # CloudWatch Logs & Metrics
      {
        Sid    = "AllowBackendLogsAndMetrics"
        Effect = "Allow"
        Action = [
          "logs:DescribeLogStreams",
          "logs:GetLogEvents",
          "logs:FilterLogEvents",
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics"
        ]
        Resource = [
          "${var.backend_log_group_arn}:*",
          "*"
        ]
      },
      # Secrets Manager: read backend path only
      {
        Sid    = "AllowBackendSecretsRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:/app/backend/*"
      },
      # RDS and ElastiCache describe-only
      {
        Sid    = "AllowDataDescribeOnly"
        Effect = "Allow"
        Action = [
          "rds:Describe*",
          "elasticache:Describe*"
        ]
        Resource = "*"
      },
      # Read-only on WAF
      {
        Sid    = "AllowWAFReadOnly"
        Effect = "Allow"
        Action = [
          "wafv2:Get*",
          "wafv2:List*"
        ]
        Resource = "*"
      },
      # Explicit Deny on Restricted Services & Frontend
      {
        Sid    = "ExplicitDenyRestrictedOperations"
        Effect = "Deny"
        Action = [
          "iam:*",
          "organizations:*",
          "s3:*",
          "cloudfront:*",
          "ec2:*SecurityGroup*",
          "kms:Delete*",
          "kms:ScheduleKeyDeletion",
          "cloudtrail:StopLogging",
          "cloudtrail:DeleteTrail",
          "guardduty:DeleteDetector",
          "config:StopConfigurationRecorder",
          "config:DeleteConfigurationRecorder",
          "wafv2:DeleteWebACL",
          "wafv2:UpdateWebACL",
          "rds:ModifyDBInstance",
          "rds:DeleteDBInstance",
          "elasticache:Modify*",
          "elasticache:Delete*"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "backend_dev_attach" {
  role       = aws_iam_role.backend_dev_role.name
  policy_arn = aws_iam_policy.backend_dev_policy.arn
}

# 4. FrontendDeveloper Role (Aditya)
resource "aws_iam_role" "frontend_dev_role" {
  name                 = "FrontendDeveloperRole"
  max_session_duration = 14400 # 4 hours
  permissions_boundary = aws_iam_policy.developer_boundary.arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_user.aditya.arn
        }
        Action = "sts:AssumeRole"
        Condition = {
          Bool = {
            "aws:MultiFactorAuthPresent" = "true"
          }
        }
      }
    ]
  })
}

resource "aws_iam_policy" "frontend_dev_policy" {
  name        = "FrontendDeveloperLeastPrivilegePolicy"
  description = "Scoped frontend developer permissions with explicit denies"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # S3: read/write/delete on frontend bucket only
      {
        Sid    = "AllowFrontendS3Management"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          var.frontend_s3_bucket_arn,
          "${var.frontend_s3_bucket_arn}/*"
        ]
      },
      # CloudFront: Invalidation and Get/List on frontend distribution only
      {
        Sid    = "AllowCloudFrontInvalidationAndRead"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetInvalidation",
          "cloudfront:ListInvalidations",
          "cloudfront:GetDistribution",
          "cloudfront:GetDistributionConfig",
          "cloudfront:ListDistributions"
        ]
        Resource = var.cloudfront_distribution_arn
      },
      # CloudWatch Logs/Metrics read on frontend
      {
        Sid    = "AllowFrontendMetricsRead"
        Effect = "Allow"
        Action = [
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
      },
      # Explicit Deny on IAM, Backend, RDS, ElastiCache, Secrets Manager
      {
        Sid    = "ExplicitDenyBackendAndSecurity"
        Effect = "Deny"
        Action = [
          "iam:*",
          "organizations:*",
          "ecs:*",
          "ecr:*",
          "rds:*",
          "elasticache:*",
          "secretsmanager:*",
          "ec2:*SecurityGroup*",
          "kms:Delete*",
          "kms:ScheduleKeyDeletion",
          "cloudtrail:StopLogging",
          "cloudtrail:DeleteTrail",
          "guardduty:DeleteDetector",
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

resource "aws_iam_role_policy_attachment" "frontend_dev_attach" {
  role       = aws_iam_role.frontend_dev_role.name
  policy_arn = aws_iam_policy.frontend_dev_policy.arn
}

# 5. Allow users to assume their respective roles
resource "aws_iam_user_policy" "anmol_assume_admin" {
  name = "AnmolAssumeAdmin"
  user = aws_iam_user.anmol.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "sts:AssumeRole"
        Resource = aws_iam_role.admin_role.arn
      }
    ]
  })
}

resource "aws_iam_user_policy" "shivansh_assume_backend" {
  name = "ShivanshAssumeBackend"
  user = aws_iam_user.shivansh.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "sts:AssumeRole"
        Resource = aws_iam_role.backend_dev_role.arn
      }
    ]
  })
}

resource "aws_iam_user_policy" "aditya_assume_frontend" {
  name = "AdityaAssumeFrontend"
  user = aws_iam_user.aditya.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "sts:AssumeRole"
        Resource = aws_iam_role.frontend_dev_role.arn
      }
    ]
  })
}
