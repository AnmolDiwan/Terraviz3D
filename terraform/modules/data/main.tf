# DB Subnet Group across private data subnets
resource "aws_db_subnet_group" "rds" {
  name        = "${lower(var.project)}-${var.environment}-db-subnet-group"
  subnet_ids  = var.private_data_subnet_ids
  description = "Private DB Subnet Group for TerraViz RDS PostgreSQL"

  tags = {
    Name = "${var.project}-${var.environment}-db-subnet-group"
  }
}

# DB Parameter Group enforcing TLS 1.2+ encryption in transit
resource "aws_db_parameter_group" "pg15" {
  name        = "${lower(var.project)}-${var.environment}-pg15-param-group"
  family      = "postgres15"
  description = "Custom parameter group enforcing SSL/TLS encryption for PostgreSQL"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = {
    Name = "${var.project}-${var.environment}-pg15-params"
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "postgres" {
  identifier                  = "${lower(var.project)}-${var.environment}-postgres"
  engine                      = "postgres"
  engine_version              = "15.7"
  instance_class              = "db.t4g.micro"
  allocated_storage           = 20
  max_allocated_storage       = 50
  storage_type                = "gp3"
  storage_encrypted           = true
  kms_key_id                  = var.kms_data_key_arn

  db_name                     = var.db_name
  username                    = var.db_username
  password                    = var.db_password

  db_subnet_group_name        = aws_db_subnet_group.rds.name
  vpc_security_group_ids      = [var.rds_security_group_id]
  parameter_group_name        = aws_db_parameter_group.pg15.name
  publicly_accessible         = false

  multi_az                    = false # Documented budget risk; single-AZ keeps cost under $80
  backup_retention_period     = 1     # Free-Tier account restriction: max 1 day automated retention
  backup_window               = "03:00-04:00"
  maintenance_window          = "Mon:04:30-Mon:05:30"
  auto_minor_version_upgrade  = true
  deletion_protection         = true

  skip_final_snapshot         = false
  final_snapshot_identifier   = "${lower(var.project)}-${var.environment}-postgres-final"

  tags = {
    Component = "database"
  }
}
