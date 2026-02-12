# WhatsTheCraic Deployment Guide

Quick deployment guide for getting WhatsTheCraic live with MLOps features.

## Prerequisites

- AWS Account with credentials configured
- EC2 instance (t4g.micro or better) running Amazon Linux 2023
- Domain name (whatsthecraic.run.place)
- Git, Docker, Docker Compose installed on EC2

## Step-by-Step Deployment

### 1. Prepare EC2 Instance

```bash
# SSH to your EC2 instance
ssh ec2-user@your-instance-ip

# Install Docker
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo yum install -y git

# Log out and back in for docker group to take effect
exit
ssh ec2-user@your-instance-ip
```

### 2. Clone Repository

```bash
# Clone your repository
cd /home/ec2-user
git clone https://github.com/yourusername/whatsthecraic.git
cd whatsthecraic
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env
```

**Required environment variables**:
```bash
# Database
DB_HOST=db
DB_PORT=3306
DB_USER=app
DB_PASSWORD=your-secure-password
DB_NAME=gigsdb

# Auth
JWT_SECRET=your-random-secret-key-change-this

# AWS (for DynamoDB & CloudWatch)
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# ML Service
ENABLE_CLOUDWATCH=true
ENVIRONMENT=production

# Event ingestion (optional)
TICKETMASTER_API_KEY=your-ticketmaster-key
EVENTBRITE_API_TOKEN=your-eventbrite-token
INGESTION_ENABLED=true
INGESTION_DEFAULT_CITY=Dublin

# Spotify OAuth (optional)
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=https://auth.whatsthecraic.run.place/auth/spotify/callback
```

### 4. Set Up AWS Resources

**Configure AWS CLI**:
```bash
aws configure
# Enter your Access Key ID, Secret Access Key, Region (eu-west-1)
```

**Create DynamoDB Tables** (for A/B testing):
```bash
# Experiments table
aws dynamodb create-table \
  --table-name whatsthecraic-experiments \
  --attribute-definitions AttributeName=experiment_id,AttributeType=S \
  --key-schema AttributeName=experiment_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-1

# Assignments table
aws dynamodb create-table \
  --table-name whatsthecraic-ab-assignments \
  --attribute-definitions \
    AttributeName=user_id,AttributeType=S \
    AttributeName=experiment_id,AttributeType=S \
  --key-schema \
    AttributeName=user_id,KeyType=HASH \
    AttributeName=experiment_id,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-1
```

### 5. Deploy Services

```bash
# Build and start all services
docker-compose up -d --build

# Check logs
docker-compose logs -f

# Verify all services are healthy
docker-compose ps
```

Expected output:
```
NAME                STATUS              PORTS
aggregator_service  Up (healthy)        0.0.0.0:4000->4000/tcp
auth_service        Up (healthy)        0.0.0.0:3001->3001/tcp
dj_service          Up (healthy)        0.0.0.0:4002->4002/tcp
events_service      Up (healthy)        0.0.0.0:4003->4003/tcp
venue_service       Up (healthy)        0.0.0.0:4001->4001/tcp
ml_service          Up (healthy)        0.0.0.0:4004->4004/tcp
gigsdb              Up (healthy)        0.0.0.0:3306->3306/tcp
caddy               Up                  0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

### 6. Apply Database Migrations

```bash
# Apply ML service migrations
docker exec -i gigsdb mysql -uroot -plocalroot gigsdb < database/migrations/003_ml_service_tables.sql

# Verify tables created
docker exec gigsdb mysql -uroot -plocalroot -e "SHOW TABLES;" gigsdb
```

### 7. Configure Domain & DNS

**In AWS Route53** (or your DNS provider):
```
Type: A Record
Name: whatsthecraic.run.place
Value: your-ec2-public-ip
TTL: 300

Type: A Record
Name: api.whatsthecraic.run.place
Value: your-ec2-public-ip
TTL: 300

Type: A Record
Name: auth.whatsthecraic.run.place
Value: your-ec2-public-ip
TTL: 300
```

**Caddy will automatically provision Let's Encrypt SSL certificates** once DNS propagates.

### 8. Verify Deployment

```bash
# Health checks
curl -f http://localhost:4000/health  # Aggregator
curl -f http://localhost:4001/health  # Venue service
curl -f http://localhost:4002/health  # DJ service
curl -f http://localhost:4003/health  # Events service
curl -f http://localhost:3001/health  # Auth service
curl -f http://localhost:4004/health  # ML service

# Test ML recommendations
curl -X POST http://localhost:4004/v1/recommendations \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","city":"Dublin","limit":10}'

# Check CloudWatch metrics
aws cloudwatch list-metrics --namespace WhatsTheCraic/ML --region eu-west-1
```

### 9. Set Up Model Retraining Cron

```bash
# Make script executable
chmod +x scripts/retrain-model.sh

# Test manual run
./scripts/retrain-model.sh

# Add to crontab (runs daily at 2 AM)
crontab -e
```

Add this line:
```
0 2 * * * /home/ec2-user/whatsthecraic/scripts/retrain-model.sh >> /var/log/retrain-model.log 2>&1
```

### 10. Deploy Frontend to CloudFront

**Option A: AWS Amplify (Recommended)**
1. Go to AWS Amplify Console
2. Connect your GitHub repository
3. Select `gigfinder-app` as the build directory
4. Build settings:
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd gigfinder-app
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: gigfinder-app/build
    files:
      - '**/*'
  cache:
    paths:
      - gigfinder-app/node_modules/**/*
```
5. Set environment variables in Amplify:
   - `REACT_APP_API_URL=https://api.whatsthecraic.run.place`
6. Deploy

**Option B: Manual CloudFront/S3**
```bash
# Build React app
cd gigfinder-app
npm install
npm run build

# Upload to S3
aws s3 sync build/ s3://whatsthecraic-frontend/
```

### 11. Set Up GitHub Actions CI/CD

**GitHub Secrets** (Settings → Secrets and variables → Actions):
```
AWS_ACCESS_KEY_ID: your-access-key
AWS_SECRET_ACCESS_KEY: your-secret-key
EC2_INSTANCE_ID: i-xxxxxxxxxxxxx
```

**Push to main branch** to trigger deployment:
```bash
git add .
git commit -m "Add MLOps features"
git push origin main
```

## Monitoring & Maintenance

### CloudWatch Dashboards

Create custom dashboard:
```bash
aws cloudwatch put-dashboard \
  --dashboard-name WhatsTheCraic \
  --dashboard-body file://docs/cloudwatch-dashboard.json \
  --region eu-west-1
```

### View Logs

```bash
# Service logs
docker-compose logs -f ml-service
docker-compose logs -f events-service

# Retraining logs
tail -f /var/log/retrain-model.log
```

### Backup Database

```bash
# Create backup
docker exec gigsdb mysqldump -uroot -plocalroot gigsdb > backup-$(date +%Y%m%d).sql

# Restore from backup
docker exec -i gigsdb mysql -uroot -plocalroot gigsdb < backup-20240212.sql
```

### Update Services

```bash
cd /home/ec2-user/whatsthecraic
git pull origin main
docker-compose pull
docker-compose up -d --remove-orphans
docker system prune -f
```

## Cost Breakdown

Monthly costs (approximate):

- **EC2 t4g.micro**: $7/month (or free tier: 750 hours/month)
- **DynamoDB**: $2/month (on-demand, low traffic)
- **CloudWatch**: $0 (within free tier)
- **Data transfer**: $3/month
- **CloudFront**: $3/month (Amplify hosting)
- **Route53**: $0.50/month

**Total: $10-15/month** (or ~$5/month with free tier EC2)

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs

# Check disk space
df -h

# Check memory
free -m
```

### Database connection errors
```bash
# Verify DB is running
docker-compose ps db

# Check DB logs
docker-compose logs db

# Test connection
docker exec gigsdb mysql -uroot -plocalroot -e "SELECT 1"
```

### ML service errors
```bash
# Check ML service logs
docker-compose logs ml-service

# Verify model file
docker exec ml_service ls -la /app/models/

# Force model retrain
curl -X POST http://localhost:4004/v1/model/retrain
```

### High memory usage
```bash
# Check container stats
docker stats

# Restart services
docker-compose restart

# Consider upgrading to t4g.small if needed
```

## Security Checklist

- [ ] Change default passwords in `.env`
- [ ] Rotate `JWT_SECRET`
- [ ] Enable SSL/TLS (Caddy handles this automatically)
- [ ] Restrict EC2 security group to only necessary ports
- [ ] Set up AWS CloudWatch alarms for anomalies
- [ ] Enable AWS CloudTrail for audit logging
- [ ] Regularly update Docker images
- [ ] Implement rate limiting (already configured)
- [ ] Review IAM permissions (principle of least privilege)

## Next Steps

1. **Load Testing**: Use `hey` or `k6` to test performance
2. **Monitoring Alerts**: Set up CloudWatch alarms for critical metrics
3. **Backup Automation**: Schedule daily database backups
4. **CDN Optimization**: Configure CloudFront caching rules
5. **Security Hardening**: Enable WAF, implement API authentication

## Support

For issues, check:
- `docs/ops-runbook.md` for operational procedures
- `docs/mlops-guide.md` for ML-specific documentation
- GitHub Issues for community support
