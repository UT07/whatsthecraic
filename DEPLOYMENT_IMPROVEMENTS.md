# WhatsTheCraic CI/CD Pipeline Improvements

## Summary

Fixed and optimized the Kubernetes CI/CD pipeline for WhatsTheCraic platform. All 6 services (auth, events, dj, venue, aggregator, ml) now have proper health checks, rolling update strategies, and improved deployment verification.

## Changes Made

### 1. GitHub Actions Workflow (.github/workflows/deploy.yml)

#### Docker Build Improvements
- Added metadata labels to all Docker images:
  - `git.commit`: Tracks exact commit SHA
  - `git.branch`: Tracks branch name
  - `build.date`: ISO 8601 timestamp
- Better logging during build process

#### Deployment Strategy Enhanced
**BEFORE:**
- Used `kubectl rollout restart` (restarts with same image)
- Single timeout for all deployments
- Limited error visibility

**AFTER:**
- Uses `kubectl set image` with specific commit SHA tags
- Individual rollout status checks for each service
- Extended timeout to 600 seconds (10 minutes)
- Proper error output capture
- Sequential rollout verification per service
- Comprehensive deployment logging

**Key Changes:**
```yaml
# Now explicitly sets image tags using commit SHA
kubectl set image deployment/events-service \
  events-service=385017713886.dkr.ecr.eu-west-1.amazonaws.com/whatsthecraic/events-service:$IMAGE_TAG \
  -n whatsthecraic

# Waits for each deployment individually
kubectl rollout status deployment/events-service -n whatsthecraic --timeout=180s
```

#### Health Checks Expansion
**BEFORE:**
- Only checked aggregator and auth-service
- 5 attempts with 45s intervals
- Basic pass/fail

**AFTER:**
- Checks ALL 6 services:
  - aggregator (4000/health)
  - auth-service (3001/health)
  - events-service (4003/health) ✨ NEW
  - dj-service (4002/health) ✨ NEW
  - venue-service (4001/health) ✨ NEW
  - ml-service (4004/health) ✨ NEW
- 6 attempts with 55s intervals (total ~5.5 minutes)
- Detailed pod status with `-o wide`
- Critical services validation (aggregator, auth, events must be healthy)
- Better error reporting with labeled sections

### 2. Kubernetes Manifests

#### Rolling Update Strategies (dj-service, venue-service, ml-service)
Added explicit rolling update configuration:
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # Allow 1 extra pod during update
    maxUnavailable: 0  # Ensure zero downtime
```

**Impact:**
- Zero-downtime deployments for all services
- Consistent update behavior across all services
- Matches best practice from auth-service and events-service

#### ConfigMap Documentation (k8s/configmap.yaml)
Added comment explaining Spotify caching:
```yaml
# Spotify (rate limiting is now handled by in-memory cache in spotify-client.js)
# No external Redis required - uses built-in caching with 24h TTL
```

## Spotify Rate Limiting Improvements

The events-service now includes an advanced Spotify client with:

### Features
- **In-memory caching**: 24-hour TTL, automatic cleanup
- **Rate limiting**: 200ms minimum delay between requests (5 req/sec max)
- **Exponential backoff**: Handles 429 errors with retry delays: 1s, 2s, 5s, 10s
- **Request queuing**: Serializes all Spotify API calls
- **Token caching**: Reuses access tokens until expiry

### Environment Variables
No new environment variables needed! The caching is automatic and uses existing:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

### Monitoring
New endpoint available: `/spotify/cache-stats` (internal monitoring)
Returns:
```json
{
  "size": 150,
  "validEntries": 140,
  "expiredEntries": 10,
  "queueLength": 0,
  "isProcessing": false
}
```

## Deployment Configuration Status

### All Services Now Have:
✅ Proper health checks (liveness + readiness)
✅ Rolling update strategies with maxSurge=1, maxUnavailable=0
✅ Resource requests and limits
✅ Environment variables from ConfigMap + Secrets
✅ Service Account with RBAC
✅ Proper port configuration
✅ Traefik ingress routing (API + Auth)

### Service Details

| Service | Port | Health | Resources | HPA |
|---------|------|--------|-----------|-----|
| aggregator | 4000 | ✅ | 100m/96Mi → 300m/256Mi | ✅ (1-2) |
| auth-service | 3001 | ✅ | 50m/64Mi → 200m/192Mi | ❌ |
| events-service | 4003 | ✅ | 100m/128Mi → 300m/384Mi | ✅ (1-2) |
| dj-service | 4002 | ✅ | 50m/64Mi → 200m/192Mi | ❌ |
| venue-service | 4001 | ✅ | 50m/64Mi → 200m/192Mi | ❌ |
| ml-service | 4004 | ✅ | 100m/128Mi → 500m/512Mi | ❌ |

### Ingress Routes
- `api.whatsthecraic.run.place` → aggregator:4000
- `auth.whatsthecraic.run.place` → auth-service:3001
- `whatsthecraic.run.place` → aggregator:4000
- `www.whatsthecraic.run.place` → aggregator:4000

## Testing Checklist

### Pre-Deployment Validation
- [x] YAML syntax validated (all files)
- [x] Rolling update strategies consistent
- [x] Health check endpoints documented
- [x] Resource limits appropriate
- [x] Image tags use commit SHA
- [x] ECR registry configured (385017713886.dkr.ecr.eu-west-1.amazonaws.com)

### Post-Deployment Verification
Run these commands on EC2 instance after deployment:

```bash
# Check all pods are running
kubectl get pods -n whatsthecraic -o wide

# Verify deployments
kubectl get deployments -n whatsthecraic

# Check rollout status
kubectl rollout status deployment/events-service -n whatsthecraic

# Test health endpoints
kubectl exec deploy/events-service -n whatsthecraic -- wget -qO- http://localhost:4003/health

# Check ingress
kubectl get ingress -n whatsthecraic

# View recent logs
kubectl logs -n whatsthecraic -l app=events-service --tail=50

# Test Spotify caching (if applicable)
curl -H "Authorization: Bearer $JWT" https://api.whatsthecraic.run.place/events/spotify/search?q=test
```

## Manual Steps Required

### 1. GitHub Secrets
Ensure these secrets are set in GitHub repository settings:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `EC2_INSTANCE_ID` = `i-077f139e329506bf5`

### 2. Kubernetes Secrets
The `k8s/secrets.yaml` is a template. Real secrets must be created manually:

```bash
kubectl create secret generic whatsthecraic-secrets \
  --from-literal=DB_HOST=<rds-endpoint> \
  --from-literal=DB_USER=admin \
  --from-literal=DB_PASSWORD=<password> \
  --from-literal=JWT_SECRET=<jwt-secret> \
  --from-literal=TICKETMASTER_API_KEY=<key> \
  --from-literal=BANDSINTOWN_APP_ID=<id> \
  --from-literal=SPOTIFY_CLIENT_ID=<id> \
  --from-literal=SPOTIFY_CLIENT_SECRET=<secret> \
  --from-literal=EVENTBRITE_API_TOKEN=<token> \
  --from-literal=APIFY_TOKEN=<token> \
  -n whatsthecraic
```

### 3. ECR Refresh Script
Verify `/usr/local/bin/ecr-refresh.sh` exists on EC2 instance and is executable:

```bash
#!/bin/bash
# This script refreshes ECR credentials for k3s
aws ecr get-login-password --region eu-west-1 | \
  sudo k3s crictl login --username AWS --password-stdin \
  385017713886.dkr.ecr.eu-west-1.amazonaws.com
```

### 4. First Deployment
If deploying for the first time, apply manifests manually:

```bash
# SSH to EC2 instance
ssh ec2-user@<ec2-ip>

# Apply configurations
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
# Create secrets manually (see above)
kubectl apply -f k8s/auth-service.yaml
kubectl apply -f k8s/events-service.yaml
kubectl apply -f k8s/dj-service.yaml
kubectl apply -f k8s/venue-service.yaml
kubectl apply -f k8s/aggregator.yaml
kubectl apply -f k8s/ml-service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Or use kustomize
kubectl apply -k k8s/
```

## Rollback Procedure

If deployment fails, rollback to previous version:

```bash
# Find previous revision
kubectl rollout history deployment/events-service -n whatsthecraic

# Rollback specific service
kubectl rollout undo deployment/events-service -n whatsthecraic

# Rollback to specific revision
kubectl rollout undo deployment/events-service --to-revision=2 -n whatsthecraic

# Rollback all services
for deploy in auth-service events-service dj-service venue-service aggregator ml-service; do
  kubectl rollout undo deployment/$deploy -n whatsthecraic
done
```

## Monitoring & Debugging

### View Logs
```bash
# Tail logs for specific service
kubectl logs -f deployment/events-service -n whatsthecraic

# View logs from all pods with label
kubectl logs -n whatsthecraic -l app=events-service --tail=100

# Check events
kubectl get events -n whatsthecraic --sort-by='.lastTimestamp'
```

### Check Resource Usage
```bash
# Pod resource usage
kubectl top pods -n whatsthecraic

# Node resource usage
kubectl top nodes

# HPA status
kubectl get hpa -n whatsthecraic
```

### Debug Pod Issues
```bash
# Describe pod
kubectl describe pod <pod-name> -n whatsthecraic

# Get pod logs (previous container if crashed)
kubectl logs <pod-name> -n whatsthecraic --previous

# Execute commands in pod
kubectl exec -it <pod-name> -n whatsthecraic -- /bin/sh

# Check environment variables
kubectl exec <pod-name> -n whatsthecraic -- env | sort
```

## Performance Improvements

### Deployment Time
- **Before**: ~3-4 minutes (restart-based, sequential with timeouts)
- **After**: ~5-7 minutes (proper rolling updates with health verification)
- Trade-off: Slightly longer but much safer and more reliable

### Zero Downtime
- All services now have `maxUnavailable: 0`
- New pods must be ready before old pods terminate
- Health checks ensure service availability

### Error Recovery
- Individual service rollout tracking
- Detailed error output on failure
- Longer timeout prevents false failures during slow starts (ml-service)

## Future Improvements

### Recommended Next Steps

1. **Add HPA to remaining services**
   - dj-service, venue-service, auth-service
   - Monitor CPU/memory usage first

2. **Implement Blue/Green Deployments**
   - Use Argo Rollouts or Flagger
   - Gradual traffic shifting
   - Automated rollback on errors

3. **Add Prometheus Metrics**
   - Service-level metrics
   - Custom business metrics (events ingested, API calls, etc.)
   - Grafana dashboards

4. **Implement Rate Limiting at Ingress**
   - Traefik middleware for rate limiting
   - Protect against DDoS
   - Per-endpoint limits

5. **Add Database Migration Job**
   - Run migrations as Kubernetes Job before deployment
   - Ensure schema compatibility

6. **Implement Secrets Rotation**
   - Use AWS Secrets Manager
   - Automatic rotation for RDS, API keys
   - K8s External Secrets Operator

7. **Add Staging Environment**
   - Deploy to staging namespace first
   - Run integration tests
   - Promote to production

8. **Container Scanning**
   - Add Trivy or Snyk to CI pipeline
   - Scan for vulnerabilities before push
   - Block critical CVEs

## Known Issues & Limitations

### Current Limitations
1. **Single replica for most services**: Scaling limited by HPA (only aggregator and events-service)
2. **No persistent storage**: ml-service uses emptyDir for models (lost on pod restart)
3. **Manual secret management**: Secrets must be created manually
4. **No SSL cert automation**: Traefik/Let's Encrypt configured but not automated in workflow
5. **SSM command limits**: 600-second timeout may be insufficient for very slow deployments

### Workarounds
- **Model persistence**: Consider using PersistentVolume or S3 for ml-service models
- **Secret management**: Migrate to External Secrets Operator or Sealed Secrets
- **Deployment speed**: Optimize Docker image size and layer caching

## Contact & Support

For issues with deployment:
1. Check GitHub Actions logs: https://github.com/[org]/whatsthecraic/actions
2. Check pod status: `kubectl get pods -n whatsthecraic`
3. Check SSM command output in AWS Console
4. Review CloudWatch logs for services with ENABLE_CLOUDWATCH=true

## Files Modified

- `.github/workflows/deploy.yml`: Enhanced deployment workflow
- `k8s/dj-service.yaml`: Added rolling update strategy
- `k8s/venue-service.yaml`: Added rolling update strategy
- `k8s/ml-service.yaml`: Added rolling update strategy
- `k8s/configmap.yaml`: Added Spotify caching documentation

## Files Already Configured (No Changes)
- `k8s/auth-service.yaml`: Already had proper rolling updates
- `k8s/events-service.yaml`: Already had proper rolling updates
- `k8s/aggregator.yaml`: Already had proper rolling updates
- `k8s/ingress.yaml`: Traefik configuration correct
- `k8s/hpa.yaml`: Autoscaling configured for aggregator and events-service
- `k8s/namespace.yaml`: RBAC and ServiceAccount configured

---

**Last Updated**: 2026-02-16
**Version**: 1.0.0
**Status**: Ready for deployment ✅
