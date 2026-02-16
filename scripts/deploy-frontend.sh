#!/bin/bash
set -euo pipefail

# Deploy Frontend to S3 and CloudFront
# Usage: ./scripts/deploy-frontend.sh

AWS_REGION="${AWS_REGION:-eu-west-1}"
S3_BUCKET="${S3_BUCKET:-wtc-ui-385017713886-eu-west-1}"
CF_DISTRIBUTION="${CF_DISTRIBUTION:-E2HRBT0I8G9WPY}"
BUILD_DIR="gigfinder-app/build"

echo "============================================"
echo "Frontend Deployment"
echo "============================================"
echo "S3 Bucket: ${S3_BUCKET}"
echo "CloudFront Distribution: ${CF_DISTRIBUTION}"
echo ""

# Step 1: Navigate to frontend directory
cd "$(dirname "$0")/../gigfinder-app"

# Step 2: Install dependencies
echo "[1/5] Installing dependencies..."
npm ci --legacy-peer-deps

# Step 3: Build production bundle
echo "[2/5] Building production bundle..."
NODE_OPTIONS="--openssl-legacy-provider" CI=false npm run build

# Step 4: Sync to S3
echo "[3/5] Syncing to S3..."
aws s3 sync build/ "s3://${S3_BUCKET}/" --delete --region "${AWS_REGION}"

# Step 5: Invalidate CloudFront cache
echo "[4/5] Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "${CF_DISTRIBUTION}" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "CloudFront invalidation created: ${INVALIDATION_ID}"

# Step 6: Wait for invalidation to complete (optional)
echo "[5/5] Waiting for invalidation to complete..."
aws cloudfront wait invalidation-completed \
  --distribution-id "${CF_DISTRIBUTION}" \
  --id "${INVALIDATION_ID}"

echo ""
echo "============================================"
echo "Frontend deployment complete!"
echo "============================================"
echo "URL: https://whatsthecraic.run.place"
echo ""
