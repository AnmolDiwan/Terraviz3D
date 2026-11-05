# 1. Network Module (VPC, Subnets across 2 AZs, NAT GW, Chained SGs, S3 Gateway Endpoint)
module "network" {
  source      = "../../modules/network"
  project     = var.project
  environment = var.environment
}

# 2. Compute Module (ALB, ECS Fargate, ECR, Frontend S3 + CloudFront with OAC)
module "compute" {
  source                    = "../../modules/compute"
  project                   = var.project
  environment               = var.environment
  aws_region                = var.aws_region
  vpc_id                    = module.network.vpc_id
  public_subnet_ids         = module.network.public_subnet_ids
  private_app_subnet_ids    = module.network.private_app_subnet_ids
  alb_security_group_id     = module.network.alb_security_group_id
  ecs_security_group_id     = module.network.ecs_security_group_id
  kms_logs_key_arn          = module.security.kms_logs_key_arn
  db_credentials_secret_arn = module.security.db_credentials_secret_arn
  app_secrets_arn           = module.security.app_secrets_arn
  db_endpoint               = module.data.db_instance_endpoint
  db_name                   = var.db_name
}

# 3. Data Module (RDS PostgreSQL db.t4g.micro, KMS encrypted, 7-day backup, forced TLS)
module "data" {
  source                        = "../../modules/data"
  project                       = var.project
  environment                   = var.environment
  private_data_subnet_ids       = module.network.private_data_subnet_ids
  rds_security_group_id         = module.network.rds_security_group_id
  elasticache_security_group_id = module.network.elasticache_security_group_id
  kms_data_key_arn              = module.security.kms_data_key_arn
  db_name                       = var.db_name
  db_username                   = var.db_username
  db_password                   = var.db_password
  enable_elasticache            = var.enable_elasticache
}

# 4. Security Module (KMS, Secrets Manager, WAF on ALB, CloudTrail, GuardDuty, Config, Security Hub, BPA)
module "security" {
  source         = "../../modules/security"
  project        = var.project
  environment    = var.environment
  aws_region     = var.aws_region
  alb_arn        = module.compute.alb_arn
  waf_mode_count = var.waf_mode_count
  groq_api_key   = var.groq_api_key
  jwt_secret     = var.jwt_secret
  db_username    = var.db_username
  db_password    = var.db_password
  db_name        = var.db_name
}

# 5. Monitoring Module (CloudWatch Alarms, SNS Topic, Email sub, Dashboard, AWS Budgets $80)
module "monitoring" {
  source                      = "../../modules/monitoring"
  project                     = var.project
  environment                 = var.environment
  aws_region                  = var.aws_region
  alert_email                 = var.alert_email
  ecs_cluster_name            = module.compute.ecs_cluster_name
  ecs_service_name            = module.compute.ecs_service_name
  alb_arn_suffix              = split("loadbalancer/", module.compute.alb_arn)[1]
  alb_target_group_arn_suffix = split("targetgroup/", module.compute.alb_target_group_arn)[1]
  rds_instance_id             = module.data.db_instance_id
  waf_web_acl_name            = "${var.project}-${var.environment}-web-acl"
}

# 6. IAM Module (Anmol, Shivansh, Aditya least-privilege roles, MFA, Boundaries)
module "iam" {
  source                      = "../../modules/iam"
  project                     = var.project
  aws_region                  = var.aws_region
  ecs_cluster_arn             = "arn:aws:ecs:${var.aws_region}:*:cluster/${module.compute.ecs_cluster_name}"
  backend_service_arn         = "arn:aws:ecs:${var.aws_region}:*:service/${module.compute.ecs_cluster_name}/${module.compute.ecs_service_name}"
  ecr_backend_arn             = "arn:aws:ecr:${var.aws_region}:*:repository/terraviz-backend"
  backend_log_group_arn       = "arn:aws:logs:${var.aws_region}:*:log-group:/ecs/${lower(var.project)}-backend-${var.environment}"
  frontend_s3_bucket_arn      = "arn:aws:s3:::${module.compute.frontend_s3_bucket}"
  cloudfront_distribution_arn = module.compute.cloudfront_distribution_id != "disabled" ? "arn:aws:cloudfront::*:distribution/${module.compute.cloudfront_distribution_id}" : "arn:aws:cloudfront::*:distribution/*"
}
