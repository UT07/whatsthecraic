# WhatsTheCraic - Quick Deployment Guide

## Automated Deployment (GitHub Actions)

### Trigger Deployment
```bash
# Merge to master branch
git checkout master
git merge your-feature-branch
git push origin master

# Or manually trigger via GitHub UI
# Go to: Actions → Deploy to Production → Run workflow
```

### Monitor Deployment
1. Go to: https://github.com/[org]/whatsthecraic/actions
2. Click on the latest "Deploy to Production" workflow
3. Watch the logs for:
   - ✅ Build and push Docker images (~5-8 min)
   - ✅ Deploy to k3s via SSM (~6-10 min)
   - ✅ Health checks (~3-5 min)
   - ✅ Deploy frontend (~3-5 min)

**Total Time**: ~15-25 minutes

### What Gets Deployed
- All 6 backend services with commit SHA tag
- React frontend to S3/CloudFront
- Zero-downtime rolling updates
- Automatic health verification

## Manual Deployment (EC2 Direct)

### SSH to EC2
```bash
ssh ec2-user@<ec2-ip>
# Instance ID: i-077f139e329506bf5
```

### Quick Commands

#### Deploy Specific Service
```bash
# Refresh ECR credentials
/usr/local/bin/ecr-refresh.sh

# Update specific service with latest image
kubectl set image deployment/events-service \
  events-service=385017713886.dkr.ecr.eu-west-1.amazonaws.com/whatsthecraic/events-service:latest \
  -n whatsthecraic

# Watch rollout
kubectl rollout status deployment/events-service -n whatsthecraic
```

#### Deploy All Services
```bash
/usr/local/bin/ecr-refresh.sh
sleep 5

# Restart all deployments with latest images
kubectl rollout restart deployment -n whatsthecraic

# Wait for completion
kubectl rollout status deployment -n whatsthecraic --timeout=300s
```

#### Check Status
```bash
# Pod status
kubectl get pods -n whatsthecraic -o wide

# Deployment status
kubectl get deployments -n whatsthecraic

# Service endpoints
kubectl get svc -n whatsthecraic

# Ingress routes
kubectl get ingress -n whatsthecraic
```

#### View Logs
```bash
# Specific service
kubectl logs -f deployment/events-service -n whatsthecraic

# All services
kubectl logs -n whatsthecraic -l app.kubernetes.io/part-of=whatsthecraic --tail=20
```

#### Health Checks
```bash
# Test all services
for svc in aggregator:4000 auth-service:3001 events-service:4003 dj-service:4002 venue-service:4001 ml-service:4004; do
  name=${svc%:*}
  port=${svc#*:}
  echo "Testing $name..."
  kubectl exec deploy/$name -n whatsthecraic -- wget -qO- http://localhost:$port/health && echo "✅ $name OK" || echo "❌ $name FAIL"
done
```

## Rollback

### Quick Rollback (All Services)
```bash
for deploy in auth-service events-service dj-service venue-service aggregator ml-service; do
  kubectl rollout undo deployment/$deploy -n whatsthecraic
done
```

### Rollback Specific Service
```bash
# View history
kubectl rollout history deployment/events-service -n whatsthecraic

# Undo last change
kubectl rollout undo deployment/events-service -n whatsthecraic

# Undo to specific revision
kubectl rollout undo deployment/events-service --to-revision=3 -n whatsthecraic
```

## Troubleshooting

### Pod Won't Start
```bash
# Describe pod
kubectl describe pod <pod-name> -n whatsthecraic

# Check logs
kubectl logs <pod-name> -n whatsthecraic

# Check previous logs (if crashed)
kubectl logs <pod-name> -n whatsthecraic --previous
```

### Image Pull Errors
```bash
# Refresh ECR credentials
/usr/local/bin/ecr-refresh.sh

# Verify secret
kubectl get secret -n whatsthecraic

# Check image exists in ECR
aws ecr describe-images --repository-name whatsthecraic/events-service --region eu-west-1
```

### Service Not Responding
```bash
# Check pod is running
kubectl get pods -n whatsthecraic | grep events-service

# Check readiness probe
kubectl describe pod <pod-name> -n whatsthecraic | grep -A5 Readiness

# Test health endpoint directly
kubectl exec <pod-name> -n whatsthecraic -- wget -qO- http://localhost:4003/health

# Check service endpoints
kubectl describe svc events-service -n whatsthecraic
```

### Database Connection Issues
```bash
# Check secrets are set
kubectl get secret whatsthecraic-secrets -n whatsthecraic -o yaml | grep "DB_"

# Test database connectivity from pod
kubectl exec -it <pod-name> -n whatsthecraic -- /bin/sh
# Inside pod:
wget -qO- "http://localhost:4003/health"
# Check logs for DB errors
```

### High CPU/Memory
```bash
# Check resource usage
kubectl top pods -n whatsthecraic

# Check HPA status
kubectl get hpa -n whatsthecraic

# Scale manually if needed
kubectl scale deployment/events-service --replicas=2 -n whatsthecraic
```

## Environment Variables

### Update ConfigMap
```bash
# Edit configmap
kubectl edit configmap whatsthecraic-config -n whatsthecraic

# Restart services to pick up changes
kubectl rollout restart deployment -n whatsthecraic
```

### Update Secrets
```bash
# Create/update secret
kubectl create secret generic whatsthecraic-secrets \
  --from-literal=DB_PASSWORD=<new-password> \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart services
kubectl rollout restart deployment -n whatsthecraic
```

## Testing Production

### API Endpoints
```bash
# Health check
curl https://api.whatsthecraic.run.place/health

# Auth check
curl https://auth.whatsthecraic.run.place/health

# Test event search
curl "https://api.whatsthecraic.run.place/events?city=Dublin&limit=5"

# Test DJ search
curl "https://api.whatsthecraic.run.place/djs?search=test&limit=5"
```

### Frontend
```bash
# Open in browser
open https://whatsthecraic.run.place

# Check CloudFront distribution
aws cloudfront get-distribution --id E2HRBT0I8G9WPY
```

## Monitoring

### GitHub Actions
- URL: https://github.com/[org]/whatsthecraic/actions
- Check workflow status
- View deployment logs

### AWS CloudWatch
- Namespace: `WhatsTheCraic/Deployments`
- Metrics: DeploymentSuccess, DeploymentFailure

### Kubernetes Events
```bash
# Recent events
kubectl get events -n whatsthecraic --sort-by='.lastTimestamp' | tail -20

# Watch events live
kubectl get events -n whatsthecraic --watch
```

## Common Issues

### "ImagePullBackOff"
**Solution**: Refresh ECR credentials
```bash
/usr/local/bin/ecr-refresh.sh
kubectl rollout restart deployment/<service-name> -n whatsthecraic
```

### "CrashLoopBackOff"
**Solution**: Check logs and environment variables
```bash
kubectl logs <pod-name> -n whatsthecraic
kubectl describe pod <pod-name> -n whatsthecraic
```

### "Pending" Pods
**Solution**: Check resources and node capacity
```bash
kubectl describe pod <pod-name> -n whatsthecraic
kubectl top nodes
```

### Health Check Failures
**Solution**: Increase initialDelaySeconds or check health endpoint
```bash
kubectl exec <pod-name> -n whatsthecraic -- wget -qO- http://localhost:4003/health
kubectl edit deployment/<service-name> -n whatsthecraic
# Adjust livenessProbe/readinessProbe settings
```

## Emergency Contacts

### Critical Issues
1. Check GitHub Actions logs
2. SSH to EC2 and check pod status
3. Review CloudWatch logs
4. Check AWS SSM command history

### Rollback Decision
If new deployment causes:
- 500 errors on API
- Pod crashes (CrashLoopBackOff)
- Database connection failures
- Performance degradation

→ **Immediately rollback** using quick rollback commands above

## Service URLs

- **Frontend**: https://whatsthecraic.run.place
- **API**: https://api.whatsthecraic.run.place
- **Auth**: https://auth.whatsthecraic.run.place
- **CloudFront**: E2HRBT0I8G9WPY
- **S3 Bucket**: wtc-ui-385017713886-eu-west-1
- **ECR Registry**: 385017713886.dkr.ecr.eu-west-1.amazonaws.com

---

**Instance ID**: i-077f139e329506bf5
**Region**: eu-west-1
**Namespace**: whatsthecraic
**Cluster**: k3s on EC2
