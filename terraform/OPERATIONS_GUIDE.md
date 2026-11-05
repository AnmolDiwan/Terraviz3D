# TerraViz 3D — Cloud Infrastructure & Operations Guide

## Architecture Overview

TerraViz 3D is deployed across 2 Availability Zones (`us-east-1a` and `us-east-1b`) in AWS account `530540751051`:

```
                       [ Internet Users ]
                               │
            ┌──────────────────┴──────────────────┐
            │ Port 80 (Redirect/Forward)          │
            ▼                                     ▼
 ┌──────────────────────┐              ┌────────────────────────┐
 │   Public ALB         │              │ AWS WAFv2 WebACL       │
 │  (Dual AZs)          │◄─────────────┤ Common, BadInputs, SQLi│
 └──────────┬───────────┘              │ + IP & /api/ai limits  │
            │ Target Group (Port 4000) └────────────────────────┘
            ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ Private App Tier: ECS Fargate Cluster (terraviz3d-cluster)   │
 │ - 2 Tasks minimum (1 On-Demand base + 1 Spot provider)       │
 │ - Auto Scaling: Target Tracking at 70% CPU                   │
 │ - Egress via Single NAT Gateway in Public Subnet A           │
 │ - Internal S3 Gateway VPC Endpoint (Free, zero NAT cost)     │
 └──────────────────────────────┬───────────────────────────────┘
                                │ Chained SG (Port 5432)
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ Private Data Tier: RDS PostgreSQL 15 (db.t4g.micro)          │
 │ - KMS Customer Managed Key Encryption (alias/terraviz3d-data)│
 │ - Deletion Protection ON                                     │
 │ - Forced TLS 1.2+ (rds.force_ssl = 1 parameter group)        │
 │ - Automated daily backups (1-day Free-Tier retention)        │
 └──────────────────────────────────────────────────────────────┘
```

---

## IAM Role Verification Matrix

### BackendDeveloperRole (`arn:aws:iam::530540751051:role/BackendDeveloperRole`)
Assumed by user `Shivansh` with MFA required (`aws:MultiFactorAuthPresent`). Max session duration: 4 hours. Attached to `DeveloperPermissionBoundary`.

| Action | Expected Result | Verification Command |
| :--- | :---: | :--- |
| `ecs:DescribeServices` on Backend Service | **SUCCEED** | `aws ecs describe-services --cluster terraviz3d-cluster-production --services terraviz3d-backend-svc` |
| `ecr:GetAuthorizationToken` & push/pull backend repo | **SUCCEED** | `aws ecr get-login-password --region us-east-1` |
| `secretsmanager:GetSecretValue` on `/app/backend/*` | **SUCCEED** | `aws secretsmanager get-secret-value --secret-id /app/backend/app_secrets` |
| `iam:CreateUser` or `iam:AttachRolePolicy` | **FAIL (403)** | `aws iam create-user --user-name evil-user` (Blocked by boundary & explicit deny) |
| `s3:DeleteObject` on Frontend Bucket | **FAIL (403)** | `aws s3 rm s3://terraviz3d-frontend-530540751051/index.html` (Explicit deny on S3) |
| `rds:DeleteDBInstance` or `rds:ModifyDBInstance` | **FAIL (403)** | `aws rds delete-db-instance --db-instance-identifier terraviz3d-production-postgres` |

---

### FrontendDeveloperRole (`arn:aws:iam::530540751051:role/FrontendDeveloperRole`)
Assumed by user `Aditya` with MFA required. Max session duration: 4 hours. Attached to `DeveloperPermissionBoundary`.

| Action | Expected Result | Verification Command |
| :--- | :---: | :--- |
| `s3:PutObject` on Frontend Bucket | **SUCCEED** | `aws s3 cp dist/index.html s3://terraviz3d-frontend-530540751051/` |
| `s3:ListBucket` on Frontend Bucket | **SUCCEED** | `aws s3 ls s3://terraviz3d-frontend-530540751051/` |
| `cloudwatch:GetMetricData` on Frontend/ALB metrics | **SUCCEED** | `aws cloudwatch list-metrics --namespace AWS/ApplicationELB` |
| `ecs:UpdateService` on Backend Service | **FAIL (403)** | `aws ecs update-service --cluster terraviz3d-cluster-production --service terraviz3d-backend-svc --desired-count 0` |
| `secretsmanager:GetSecretValue` on `/app/backend/*` | **FAIL (403)** | `aws secretsmanager get-secret-value --secret-id /app/backend/db_credentials` |
| `rds:DescribeDBInstances` or DB connection | **FAIL (403)** | `aws rds describe-db-instances` (Explicit deny on RDS) |

---

## Deploying & Updating Components

### 1. Backend Updates (Shivansh)
1. Build container image locally:
   ```bash
   docker build -t 530540751051.dkr.ecr.us-east-1.amazonaws.com/terraviz-backend:v1.0.1 -f backend/Dockerfile backend/
   ```
2. Authenticate to ECR:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 530540751051.dkr.ecr.us-east-1.amazonaws.com
   ```
3. Push image and force new ECS deployment:
   ```bash
   docker push 530540751051.dkr.ecr.us-east-1.amazonaws.com/terraviz-backend:v1.0.1
   aws ecs update-service --cluster terraviz3d-cluster-production --service terraviz3d-backend-svc --force-new-deployment --region us-east-1
   ```

### 2. Frontend Updates (Aditya)
1. Build static production bundle:
   ```bash
   cd frontend
   npm run build
   ```
2. Sync build directory to S3:
   ```bash
   aws s3 sync dist/ s3://terraviz3d-frontend-530540751051/ --delete --region us-east-1
   ```

---

## Teardown Instructions (Destruction Order & Protections)

To cleanly tear down the entire project without orphaned resources or errors:

### Step 1: Disable RDS Deletion Protection
The RDS database has `deletion_protection = true` to protect against accidental loss. Before running Terraform destroy:
```bash
aws rds modify-db-instance \
  --db-instance-identifier terraviz3d-production-postgres \
  --no-deletion-protection \
  --apply-immediately \
  --region us-east-1
```

### Step 2: Empty S3 Buckets
S3 buckets containing objects (Frontend build, CloudTrail logs, AWS Config records, and remote state) cannot be deleted by AWS S3 API until empty:
```bash
aws s3 rm s3://terraviz3d-frontend-530540751051/ --recursive --region us-east-1
aws s3 rm s3://terraviz3d-cloudtrail-530540751051/ --recursive --region us-east-1
aws s3 rm s3://terraviz3d-config-530540751051/ --recursive --region us-east-1
```

### Step 3: Run Terraform Destroy
Run the destroy command using the dedicated deployer credentials:
```bash
cd terraform/environments/prod
terraform destroy -auto-approve \
  -var="db_password=TerraVizSecure2026!" \
  -var="jwt_secret=dummy_secret_for_destroy" \
  -var="groq_api_key=dummy_key_for_destroy"
```

### Step 4: Destroy Bootstrap Resources (State & Lock Table)
Once the main environment is destroyed:
```bash
cd terraform/bootstrap
terraform destroy -auto-approve
```
