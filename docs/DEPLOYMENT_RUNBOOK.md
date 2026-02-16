# WhatsTheCraic Deployment Runbook

**Last Updated:** 2026-02-16
**Owner:** DevOps Team
**Environment:** Production (AWS eu-west-1)

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Backend Services Deployment](#backend-services-deployment)
3. [Frontend Deployment](#frontend-deployment)
4. [ML Service Deployment](#ml-service-deployment)
5. [Verification Steps](#verification-steps)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Required Access & Credentials

- [ ] AWS credentials configured (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- [ ] AWS CLI installed and configured for `eu-west-1` region
- [ ] kubectl configured with k3s cluster access
- [ ] Docker installed and running
- [ ] GitHub Actions secrets configured:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `EC2_INSTANCE_ID` = `i-077f139e329506bf5` (**CRITICAL: Update this value**)

### Environment Variables

```bash
export AWS_REGION=eu-west-1
export ECR_REGISTRY=385017713886.dkr.ecr.eu-west-1.amazonaws.com
export S3_BUCKET=wtc-ui-385017713886-eu-west-1
export CF_DISTRIBUTION=E2HRBT0I8G9WPY
export EC2_INSTANCE_ID=i-077f139e329506bf5
```

### Pre-Deployment Tests

- [ ] Run unit tests: `./scripts/run-unit-tests.sh`
- [ ] Run linting: `./scripts/run-lint.sh`
- [ ] Run smoke tests: `./scripts/ci-smoke.sh`
- [ ] Review git status: `git status`
- [ ] Ensure all changes committed: `git log -1`

---

## Backend Services Deployment

### Automated Deployment (Recommended)

Push to `master` branch triggers GitHub Actions workflow:

```bash
git push origin master
```

Monitor deployment:
```bash
gh run watch
```

### Manual Deployment

If automated deployment fails or manual intervention needed:

#### Step 1: Login to ECR

```bash
aws ecr get-login-password --region eu-west-1 | \
  docker login --username AWS --password-stdin 385017713886.dkr.ecr.eu-west-1.amazonaws.com
```

#### Step 2: Build and Push Images

```bash
SERVICES=("auth-service" "events-service" "dj-service" "venue-service" "aggregator-service" "ml-service")
IMAGE_TAG=$(git rev-parse --short HEAD)

for SVC in "${SERVICES[@]}"; do
  echo "Building ${SVC}..."
  docker build -t ${ECR_REGISTRY}/whatsthecraic/${SVC}:${IMAGE_TAG} ./${SVC}
  docker tag ${ECR_REGISTRY}/whatsthecraic/${SVC}:${IMAGE_TAG} ${ECR_REGISTRY}/whatsthecraic/${SVC}:latest

  echo "Pushing ${SVC}..."
  docker push ${ECR_REGISTRY}/whatsthecraic/${SVC}:${IMAGE_TAG}
  docker push ${ECR_REGISTRY}/whatsthecraic/${SVC}:latest
done
```

#### Step 3: Deploy to k3s

SSH into EC2 instance or use SSM:

```bash
# Via SSM
aws ssm start-session --target ${EC2_INSTANCE_ID}

# On EC2 instance
/usr/local/bin/ecr-refresh.sh
kubectl rollout restart deployment -n whatsthecraic
kubectl rollout status deployment -n whatsthecraic --timeout=120s
kubectl get pods -n whatsthecraic
```

---

## Frontend Deployment

### Automated Deployment (Recommended)

Frontend deploys automatically on push to `master` via GitHub Actions.

### Manual Deployment

Use the deployment script:

```bash
./scripts/deploy-frontend.sh
```

Or manual steps:

```bash
cd gigfinder-app

# Install dependencies
npm ci --legacy-peer-deps

# Build production bundle
NODE_OPTIONS="--openssl-legacy-provider" CI=false npm run build

# Sync to S3
aws s3 sync build/ s3://${S3_BUCKET}/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id ${CF_DISTRIBUTION} \
  --paths "/*"
```

**Note:** CloudFront invalidation takes 5-15 minutes to complete.

---

## ML Service Deployment

### Deploy ML Service Only

Use the dedicated script:

```bash
./scripts/deploy-ml-service.sh $(git rev-parse --short HEAD)
```

### Retrain Model

Trigger manual retrain:

```bash
kubectl exec -n whatsthecraic deploy/ml-service -- \
  curl -X POST http://localhost:4004/v1/model/retrain
```

Or use the admin dashboard:
- Navigate to `/admin/ml`
- Click "Retrain Model Now"

### Schedule Automatic Retraining

Apply the cron job manifest:

```bash
kubectl apply -f k8s/ml-retrain-cronjob.yaml
```

Verify cron job:

```bash
kubectl get cronjobs -n whatsthecraic
kubectl get jobs -n whatsthecraic
```

---

## Verification Steps

### 1. Backend Health Checks

```bash
# Via kubectl exec
kubectl exec -n whatsthecraic deploy/aggregator -- wget -qO- http://localhost:4000/health
kubectl exec -n whatsthecraic deploy/auth-service -- wget -qO- http://localhost:3001/health
kubectl exec -n whatsthecraic deploy/ml-service -- wget -qO- http://localhost:4004/health

# Via public API
curl https://api.whatsthecraic.run.place/health
```

Expected response: `{"status": "ok"}` or similar

### 2. Pod Status

```bash
kubectl get pods -n whatsthecraic
```

All pods should be `Running` with `1/1` READY.

### 3. Frontend Verification

```bash
curl -I https://whatsthecraic.run.place
```

Expected: HTTP 200 response with CloudFront headers

### 4. ML Service Verification

```bash
# Get model info
curl https://api.whatsthecraic.run.place/v1/model/info

# Check Prometheus metrics
curl https://api.whatsthecraic.run.place/metrics | grep ml_
```

### 5. End-to-End Smoke Test

```bash
./scripts/ci-smoke.sh
```

### 6. Database Connectivity

```bash
kubectl exec -n whatsthecraic deploy/auth-service -- \
  nc -zv gigs-postgres.cpqc8gcglf26.eu-west-1.rds.amazonaws.com 5432
```

---

## Rollback Procedures

### Backend Rollback

#### Option 1: Rollback Kubernetes Deployment

```bash
kubectl rollout undo deployment/<service-name> -n whatsthecraic

# Example
kubectl rollout undo deployment/ml-service -n whatsthecraic
kubectl rollout status deployment/ml-service -n whatsthecraic
```

#### Option 2: Redeploy Previous Image Tag

```bash
IMAGE_TAG="<previous-commit-sha>"
kubectl set image deployment/ml-service \
  ml-service=${ECR_REGISTRY}/whatsthecraic/ml-service:${IMAGE_TAG} \
  -n whatsthecraic
```

### Frontend Rollback

#### Option 1: Restore from S3 Versioning

```bash
# List versions
aws s3api list-object-versions --bucket ${S3_BUCKET} --prefix index.html

# Restore specific version
aws s3api copy-object \
  --copy-source ${S3_BUCKET}/index.html?versionId=<VERSION_ID> \
  --bucket ${S3_BUCKET} \
  --key index.html

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id ${CF_DISTRIBUTION} \
  --paths "/*"
```

#### Option 2: Redeploy Previous Git Commit

```bash
git checkout <previous-commit>
./scripts/deploy-frontend.sh
git checkout master
```

### Database Rollback

**CRITICAL:** Database rollbacks require careful planning.

1. Check migration history:
   ```bash
   kubectl exec -n whatsthecraic deploy/auth-service -- \
     psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 10;"
   ```

2. Restore from RDS snapshot (production only):
   ```bash
   # List snapshots
   aws rds describe-db-snapshots --db-instance-identifier gigs-postgres

   # Restore requires creating new instance and updating DNS
   # Contact DBA before proceeding
   ```

---

## Troubleshooting

### Issue: Pods in CrashLoopBackOff

```bash
# Check logs
kubectl logs -n whatsthecraic deploy/<service-name> --tail=100

# Check events
kubectl describe pod -n whatsthecraic <pod-name>

# Common fixes
kubectl delete pod -n whatsthecraic <pod-name>  # Force restart
kubectl rollout restart deployment/<service-name> -n whatsthecraic
```

### Issue: ImagePullBackOff

```bash
# Verify ECR image exists
aws ecr describe-images --repository-name whatsthecraic/<service-name>

# Refresh ECR credentials on k3s node
ssh ec2-user@<ec2-ip> /usr/local/bin/ecr-refresh.sh
```

### Issue: Service Unavailable (502/503)

```bash
# Check pod health
kubectl get pods -n whatsthecraic

# Check service endpoints
kubectl get endpoints -n whatsthecraic

# Check ingress
kubectl describe ingress -n whatsthecraic wtc-ingress

# Restart traefik (k3s ingress controller)
kubectl rollout restart deployment traefik -n kube-system
```

### Issue: Database Connection Failed

```bash
# Test connectivity
kubectl exec -n whatsthecraic deploy/auth-service -- \
  nc -zv gigs-postgres.cpqc8gcglf26.eu-west-1.rds.amazonaws.com 5432

# Check security groups
aws ec2 describe-security-groups --group-ids <sg-id>

# Verify credentials in secrets
kubectl get secret -n whatsthecraic postgres-credentials -o yaml
```

### Issue: ML Service Not Responding

```bash
# Check if model file exists
kubectl exec -n whatsthecraic deploy/ml-service -- ls -lh /app/models/

# Check memory/CPU
kubectl top pod -n whatsthecraic -l app=ml-service

# Manually retrain
kubectl exec -n whatsthecraic deploy/ml-service -- \
  curl -X POST http://localhost:4004/v1/model/retrain
```

### Issue: CloudFront Serving Stale Content

```bash
# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id ${CF_DISTRIBUTION} \
  --paths "/*"

# Check invalidation status
aws cloudfront list-invalidations --distribution-id ${CF_DISTRIBUTION}

# Wait for completion
aws cloudfront wait invalidation-completed \
  --distribution-id ${CF_DISTRIBUTION} \
  --id <INVALIDATION_ID>
```

### Issue: GitHub Actions Deployment Failed

1. Check workflow run: `gh run list --limit 5`
2. View logs: `gh run view <run-id> --log`
3. Common issues:
   - EC2_INSTANCE_ID not updated
   - AWS credentials expired
   - SSM timeout (increase timeout in workflow)
   - Docker build failures (check Dockerfile syntax)

---

## Emergency Contacts

- **DevOps Lead:** [Contact info]
- **AWS Support:** [Support case link]
- **On-Call Engineer:** [PagerDuty link]

## Monitoring & Alerts

- **CloudWatch Dashboard:** https://console.aws.amazon.com/cloudwatch/
- **k3s Cluster:** `kubectl get all -n whatsthecraic`
- **Application Logs:** `kubectl logs -n whatsthecraic -l app=<service> --tail=100 -f`

---

## Appendix

### Quick Reference Commands

```bash
# View all deployments
kubectl get deployments -n whatsthecraic

# Scale deployment
kubectl scale deployment/<service-name> --replicas=3 -n whatsthecraic

# Edit deployment
kubectl edit deployment/<service-name> -n whatsthecraic

# View resource usage
kubectl top nodes
kubectl top pods -n whatsthecraic

# Access pod shell
kubectl exec -it -n whatsthecraic deploy/<service-name> -- /bin/sh

# Port forward for local testing
kubectl port-forward -n whatsthecraic deploy/ml-service 4004:4004
```

### AWS Resource IDs

| Resource | ID/Value |
|----------|----------|
| EC2 Instance | `i-077f139e329506bf5` |
| S3 Bucket | `wtc-ui-385017713886-eu-west-1` |
| CloudFront Distribution | `E2HRBT0I8G9WPY` |
| ECR Registry | `385017713886.dkr.ecr.eu-west-1.amazonaws.com` |
| RDS Instance | `gigs-postgres.cpqc8gcglf26.eu-west-1.rds.amazonaws.com` |
| Region | `eu-west-1` |

---

**Document Revision History:**

- 2026-02-16: Initial creation with ML service deployment procedures
