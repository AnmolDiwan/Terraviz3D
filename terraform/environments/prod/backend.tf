terraform {
  backend "s3" {
    bucket         = "terraviz3d-tfstate-530540751051"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraviz3d-tflock"
    encrypt        = true
  }
}
