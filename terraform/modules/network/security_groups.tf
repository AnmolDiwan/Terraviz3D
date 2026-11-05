# 1. ALB Security Group: Ingress 80/443 from internet only
resource "aws_security_group" "alb" {
  name        = "${var.project}-${var.environment}-alb-sg"
  description = "Controls HTTP/HTTPS access to ALB from CloudFront / internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    description      = "HTTP from anywhere (redirected to HTTPS)"
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  ingress {
    description      = "HTTPS from anywhere"
    from_port        = 443
    to_port          = 443
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Name = "${var.project}-${var.environment}-alb-sg"
  }
}

# 2. ECS Fargate Backend Security Group
resource "aws_security_group" "ecs" {
  name        = "${var.project}-${var.environment}-ecs-sg"
  description = "Allows ingress only from ALB on port 4000; chained security group"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project}-${var.environment}-ecs-sg"
  }
}

# ALB -> ECS egress rule (chained)
resource "aws_security_group_rule" "alb_to_ecs" {
  type                     = "egress"
  from_port                = 4000
  to_port                  = 4000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.alb.id
  source_security_group_id = aws_security_group.ecs.id
  description              = "Forward traffic from ALB to ECS backend on port 4000"
}

# ECS ingress from ALB (chained)
resource "aws_security_group_rule" "ecs_ingress_from_alb" {
  type                     = "ingress"
  from_port                = 4000
  to_port                  = 4000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.alb.id
  description              = "Allow traffic into backend strictly from ALB"
}

# ECS outbound to internet via NAT (for Groq AI inference, USGS Earthquakes, REST Countries, ECR pull)
resource "aws_security_group_rule" "ecs_egress_internet" {
  type              = "egress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  security_group_id = aws_security_group.ecs.id
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "HTTPS outbound for external APIs (Groq, USGS, Countries) via NAT"
}

# 3. RDS PostgreSQL Security Group
resource "aws_security_group" "rds" {
  name        = "${var.project}-${var.environment}-rds-sg"
  description = "Allows Postgres ingress strictly from ECS Fargate tasks; no external access"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project}-${var.environment}-rds-sg"
  }
}

# Chained ingress: ECS -> RDS
resource "aws_security_group_rule" "rds_ingress_from_ecs" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.ecs.id
  description              = "PostgreSQL access strictly from ECS backend"
}

# Chained egress: ECS -> RDS
resource "aws_security_group_rule" "ecs_egress_to_rds" {
  type                     = "egress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.rds.id
  description              = "ECS egress to PostgreSQL"
}

# 4. ElastiCache Redis Security Group
resource "aws_security_group" "elasticache" {
  name        = "${var.project}-${var.environment}-elasticache-sg"
  description = "Allows Redis ingress strictly from ECS Fargate tasks; no external access"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project}-${var.environment}-elasticache-sg"
  }
}

# Chained ingress: ECS -> Redis
resource "aws_security_group_rule" "redis_ingress_from_ecs" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.elasticache.id
  source_security_group_id = aws_security_group.ecs.id
  description              = "Redis access strictly from ECS backend"
}

# Chained egress: ECS -> Redis
resource "aws_security_group_rule" "ecs_egress_to_redis" {
  type                     = "egress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.elasticache.id
  description              = "ECS egress to Redis"
}
