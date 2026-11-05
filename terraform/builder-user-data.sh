#!/bin/bash
exec > /var/log/user-data.log 2>&1
set -ex

cleanup() {
  EXIT_CODE=$?
  echo "===> Exit code: $EXIT_CODE"
  echo "===> Uploading user-data log to S3..."
  aws s3 cp /var/log/user-data.log s3://terraviz3d-tfstate-530540751051/build/builder-log.txt || true

  echo "===> Terminating builder instance in 10s..."
  sleep 10
  TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
  INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)
  aws ec2 terminate-instances --instance-ids "$INSTANCE_ID" --region us-east-1 || true
}
trap cleanup EXIT

echo "===> [0/6] Setting up swap space..."
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

echo "===> [1/6] Installing dependencies..."
dnf install -y docker unzip
systemctl enable --now docker

echo "===> [2/6] Downloading source bundle from S3..."
mkdir -p /tmp/build
aws s3 cp s3://terraviz3d-tfstate-530540751051/build/source.zip /tmp/build/source.zip
cd /tmp/build
unzip -q source.zip

echo "===> [3/6] Authenticating Docker with Amazon ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 530540751051.dkr.ecr.us-east-1.amazonaws.com

echo "===> [4/6] Building Docker container image..."
docker build -t 530540751051.dkr.ecr.us-east-1.amazonaws.com/terraviz-backend:latest -f backend/Dockerfile backend

echo "===> [5/6] Pushing image to ECR..."
docker push 530540751051.dkr.ecr.us-east-1.amazonaws.com/terraviz-backend:latest

echo "===> [6/6] Triggering ECS service deployment..."
aws ecs update-service --cluster terraviz3d-cluster-production --service terraviz3d-backend-svc --force-new-deployment --region us-east-1

echo "===> BUILD AND DEPLOYMENT FINISHED WITH FULL SUCCESS!"
