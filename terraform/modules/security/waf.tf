# CloudWatch Log Group for WAF (Name must start with aws-waf-logs-)
resource "aws_cloudwatch_log_group" "waf_logs" {
  name              = "aws-waf-logs-terraviz-${var.environment}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.logs_key.arn

  tags = {
    Name = "${var.project}-${var.environment}-waf-logs"
  }
}

# AWS WAFv2 Web ACL for Regional ALB
resource "aws_wafv2_web_acl" "alb_waf" {
  name        = "${var.project}-${var.environment}-web-acl"
  description = "WAFv2 WebACL protecting ALB with Managed Rules and AI path rate-limits"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rule 1: Common Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      dynamic "count" {
        for_each = var.waf_mode_count ? [1] : []
        content {}
      }
      dynamic "none" {
        for_each = var.waf_mode_count ? [] : [1]
        content {}
      }
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 2: Known Bad Inputs Rule Set
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 20

    override_action {
      dynamic "count" {
        for_each = var.waf_mode_count ? [1] : []
        content {}
      }
      dynamic "none" {
        for_each = var.waf_mode_count ? [] : [1]
        content {}
      }
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 3: SQLi Rule Set
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 30

    override_action {
      dynamic "count" {
        for_each = var.waf_mode_count ? [1] : []
        content {}
      }
      dynamic "none" {
        for_each = var.waf_mode_count ? [] : [1]
        content {}
      }
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLiRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 4: Global IP Rate-Based Limit (2000 req / 5 min)
  rule {
    name     = "GlobalRateLimitPerIP"
    priority = 40

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GlobalRateLimitMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 5: Scoped AI Endpoint Protection (300 req / 5 min on /api/ai/*)
  rule {
    name     = "AIEndpointRateLimitPerIP"
    priority = 50

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 300
        aggregate_key_type = "IP"
        scope_down_statement {
          byte_match_statement {
            search_string         = "/api/ai"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "STARTS_WITH"
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AIEndpointRateLimitMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "TerraVizWebACLMetric"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "${var.project}-${var.environment}-waf-acl"
  }
}

# Associate WAF with Regional ALB
resource "aws_wafv2_web_acl_association" "alb_assoc" {
  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.alb_waf.arn
}

# WAF Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "alb_waf_logging" {
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs.arn]
  resource_arn            = aws_wafv2_web_acl.alb_waf.arn
}
