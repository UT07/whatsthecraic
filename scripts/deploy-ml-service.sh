#!/bin/bash
set -euo pipefail

# Deploy ML Service to k3s
# Usage: ./scripts/deploy-ml-service.sh [IMAGE_TAG]

IMAGE_TAG="${1:-latest}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
ECR_REGISTRY="${ECR_REGISTRY:-385017713886.dkr.ecr.eu-west-1.amazonaws.com}"
SERVICE_NAME="ml-service"
IMAGE_NAME="whatsthecraic/${SERVICE_NAME}"
NAMESPACE="whatsthecraic"

echo "============================================"
echo "ML Service Deployment"
echo "============================================"
echo "Image Tag: ${IMAGE_TAG}"
echo "ECR Registry: ${ECR_REGISTRY}"
echo "Namespace: ${NAMESPACE}"
echo ""

# Step 1: Build Docker image
echo "[1/4] Building Docker image..."
cd "$(dirname "$0")/../${SERVICE_NAME}"
docker build -t "${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}" .

# Step 2: Tag as latest
echo "[2/4] Tagging as latest..."
docker tag "${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}" "${ECR_REGISTRY}/${IMAGE_NAME}:latest"

# Step 3: Push to ECR
echo "[3/4] Pushing to ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"
docker push "${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
docker push "${ECR_REGISTRY}/${IMAGE_NAME}:latest"

# Step 4: Update Kubernetes deployment
echo "[4/4] Updating Kubernetes deployment..."
kubectl set image "deployment/${SERVICE_NAME}" \
  "${SERVICE_NAME}=${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}" \
  -n "${NAMESPACE}"

echo ""
echo "Waiting for rollout to complete..."
kubectl rollout status "deployment/${SERVICE_NAME}" -n "${NAMESPACE}" --timeout=180s

echo ""
echo "Checking pod status..."
kubectl get pods -n "${NAMESPACE}" -l "app=${SERVICE_NAME}"

echo ""
echo "============================================"
echo "ML Service deployment complete!"
echo "============================================"
