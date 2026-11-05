terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "TerraViz3D"
      Owner       = "Anmol"
      Environment = "Production"
      CostCenter  = "Engineering"
      ManagedBy   = "Terraform"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

data "aws_caller_identity" "current" {}

# S3 Bucket for Terraform Remote State
resource "aws_s3_bucket" "tf_state" {
  bucket        = "terraviz3d-tfstate-${data.aws_caller_identity.current.account_id}"
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket                  = aws_s3_bucket.tf_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB Table for Terraform State Locking
resource "aws_dynamodb_table" "tf_locks" {
  name         = "terraviz3d-tflock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Dedicated Terraform Deployer Role (Least Privilege - Hard Rule #1)
resource "aws_iam_role" "terraform_deployer" {
  name = "TerraformDeployerRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_policy" "terraform_deployer_policy" {
  name        = "TerraformDeployerScopedPolicy"
  description = "Scoped permissions strictly required for TerraViz3D infrastructure deployment"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "StateAccess"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.tf_state.arn,
          "${aws_s3_bucket.tf_state.arn}/*"
        ]
      },
      {
        Sid    = "StateLocking"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem"
        ]
        Resource = aws_dynamodb_table.tf_locks.arn
      },
      {
        Sid    = "TerraVizScopedInfrastructureManagement"
        Effect = "Allow"
        Action = [
          "ec2:*",
          "ecs:*",
          "ecr:*",
          "elasticloadbalancing:*",
          "rds:*",
          "elasticache:*",
          "s3:*",
          "cloudfront:*",
          "kms:*",
          "secretsmanager:*",
          "wafv2:*",
          "logs:*",
          "cloudwatch:*",
          "sns:*",
          "guardduty:*",
          "config:*",
          "securityhub:*",
          "accessanalyzer:*",
          "access-analyzer:*",
          "inspector2:*",
          "budgets:*",
          "ce:*",
          "cloudtrail:*",
          "application-autoscaling:*",
          "autoscaling:*",
          "iam:*",
          "codebuild:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "ExplicitDenyDestructiveGlobalOperations"
        Effect = "Deny"
        Action = [
          "organizations:*",
          "account:CloseAccount",
          "iam:DeleteAccountPasswordPolicy"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "deployer_attach" {
  role       = aws_iam_role.terraform_deployer.name
  policy_arn = aws_iam_policy.terraform_deployer_policy.arn
}

# Dedicated Deployer IAM User (since AWS STS restricts root from assuming roles)
resource "aws_iam_user" "terraform_deployer_user" {
  name = "terraform-deployer"
  tags = {
    Role = "Deployer"
  }
}

resource "aws_iam_user_policy_attachment" "deployer_user_attach" {
  user       = aws_iam_user.terraform_deployer_user.name
  policy_arn = aws_iam_policy.terraform_deployer_policy.arn
}

resource "aws_iam_access_key" "deployer_key" {
  user = aws_iam_user.terraform_deployer_user.name
}

output "deployer_access_key_id" {
  value = aws_iam_access_key.deployer_key.id
}

output "deployer_secret_access_key" {
  value     = aws_iam_access_key.deployer_key.secret
  sensitive = true
}

output "s3_bucket_name" {
  value = aws_s3_bucket.tf_state.bucket
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.tf_locks.name
}

output "deployer_role_arn" {
  value = aws_iam_role.terraform_deployer.arn
}
