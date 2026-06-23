#!/usr/bin/env bash
set -euo pipefail

REGION="ap-south-1"
PROJECT="depsafe"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT}"

echo "=== 1. Terraform init & apply ==="
cd "$ROOT_DIR/infra"

if [ ! -f terraform.tfvars ]; then
  echo "ERROR: Create infra/terraform.tfvars with: github_token = \"ghp_...\""
  exit 1
fi

terraform init -input=false
terraform apply -auto-approve

S3_BUCKET=$(terraform output -raw s3_bucket)
CF_URL=$(terraform output -raw cloudfront_url)
API_URL=$(terraform output -raw api_url)
CF_DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[?Id=='s3']].Id" \
  --output text | head -1)

echo "=== 2. Build & push Docker image ==="
cd "$ROOT_DIR"

aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

docker build --platform linux/amd64 -t "${PROJECT}:latest" .
docker tag "${PROJECT}:latest" "${ECR_REPO}:latest"
docker push "${ECR_REPO}:latest"

echo "=== 3. Update Lambda function ==="
aws lambda update-function-code \
  --function-name "$PROJECT" \
  --image-uri "${ECR_REPO}:latest" \
  --region "$REGION" \
  --no-cli-pager

echo "Waiting for Lambda update..."
aws lambda wait function-updated --function-name "$PROJECT" --region "$REGION"

echo "=== 4. Build frontend ==="
cd "$ROOT_DIR/frontend"

export PATH="/usr/local/Cellar/node@20/20.20.2/bin:$PATH"
npm run build

echo "=== 5. Upload to S3 ==="
aws s3 sync dist/ "s3://${S3_BUCKET}/" --delete --region "$REGION"

echo "=== 6. Invalidate CloudFront ==="
if [ -n "$CF_DIST_ID" ]; then
  aws cloudfront create-invalidation \
    --distribution-id "$CF_DIST_ID" \
    --paths "/*" \
    --no-cli-pager
fi

echo ""
echo "=== Deployed! ==="
echo "Frontend: ${CF_URL}"
echo "API:      ${API_URL}"
