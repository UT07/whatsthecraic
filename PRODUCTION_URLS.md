# WhatsTheCraic Production URLs

## 🌐 Your Live Platform URLs

### Frontend (React App)
- **Main Website**: https://whatsthecraic.run.place
- **WWW**: https://www.whatsthecraic.run.place

### API Endpoints

#### Main Aggregator API
- **Base URL**: https://api.whatsthecraic.run.place
- **Health**: https://api.whatsthecraic.run.place/health
- **Metrics**: https://api.whatsthecraic.run.place/metrics

#### Event Search
```bash
# Search events in Dublin
curl "https://api.whatsthecraic.run.place/v1/events/search?city=Dublin"

# Search with personalized ranking
curl "https://api.whatsthecraic.run.place/v1/events/search?city=Dublin&rank=personalized" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get event details
curl "https://api.whatsthecraic.run.place/v1/events/{event_id}"
```

#### ML Recommendation Service
- **Base URL**: https://api.whatsthecraic.run.place/ml (routed through Caddy)
- **Health**: https://api.whatsthecraic.run.place/ml/health
- **Model Info**: https://api.whatsthecraic.run.place/ml/v1/model/info

```bash
# Get personalized recommendations
curl -X POST "https://api.whatsthecraic.run.place/ml/v1/recommendations" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-user-id",
    "city": "Dublin",
    "limit": 20
  }'

# Record user feedback
curl -X POST "https://api.whatsthecraic.run.place/ml/v1/feedback" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-user-id",
    "event_id": "event-123",
    "action": "save"
  }'

# View A/B experiments
curl "https://api.whatsthecraic.run.place/ml/v1/experiments"

# Get experiment results
curl "https://api.whatsthecraic.run.place/ml/v1/experiments/rec_algorithm_v1/results"
```

#### Authentication
- **Base URL**: https://auth.whatsthecraic.run.place

```bash
# Sign up
curl -X POST "https://auth.whatsthecraic.run.place/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'

# Login
curl -X POST "https://auth.whatsthecraic.run.place/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'

# Get/Update preferences
curl "https://auth.whatsthecraic.run.place/auth/preferences" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### DJ & Venue Directory
```bash
# Search DJs
curl "https://api.whatsthecraic.run.place/v1/djs/search?city=Dublin"

# Search Venues
curl "https://api.whatsthecraic.run.place/v1/venues/search?city=Dublin"
```

## 🔗 Internal Service URLs (EC2 only)

These are accessible only from within your EC2 instance:

- **Aggregator**: http://localhost:4000
- **Events Service**: http://localhost:4003
- **DJ Service**: http://localhost:4002
- **Venue Service**: http://localhost:4001
- **Auth Service**: http://localhost:3001
- **ML Service**: http://localhost:4004
- **MySQL Database**: localhost:3306

## 📊 Monitoring & Observability

### CloudWatch Dashboards
1. Go to: https://console.aws.amazon.com/cloudwatch/
2. Select region: **eu-west-1**
3. View metrics namespace: **WhatsTheCraic/ML**

### Metrics Available
- `PredictionCount`: Number of recommendations served
- `PredictionLatency`: Inference latency (ms)
- `RequestCount`: Total API requests
- `ErrorCount`: Error rate
- `UserFeedback`: User actions (save, hide, click)

### Prometheus Metrics
```bash
# View all metrics
curl "https://api.whatsthecraic.run.place/ml/metrics"
```

## 🧪 Testing Your Deployment

### Quick Health Check
```bash
# Test all services
curl https://api.whatsthecraic.run.place/health
curl https://api.whatsthecraic.run.place/ml/health
curl https://auth.whatsthecraic.run.place/health
```

### End-to-End Test
```bash
# On your EC2 instance
cd /home/ec2-user/whatsthecraic
./test-deployment.sh
```

### Manual Testing Flow

1. **Create Account**:
```bash
curl -X POST "https://auth.whatsthecraic.run.place/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

2. **Get Recommendations**:
```bash
curl -X POST "https://api.whatsthecraic.run.place/ml/v1/recommendations" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","city":"Dublin","limit":10}'
```

3. **Search Events**:
```bash
curl "https://api.whatsthecraic.run.place/v1/events/search?city=Dublin&limit=10"
```

4. **Record Interaction**:
```bash
curl -X POST "https://api.whatsthecraic.run.place/ml/v1/feedback" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","event_id":"event-123","action":"save"}'
```

## 🔐 Security Notes

- All public URLs use HTTPS (TLS 1.2+)
- Caddy auto-provisions Let's Encrypt certificates
- Internal services are firewalled (EC2 security group)
- API keys stored in environment variables
- JWT tokens for authentication

## 💰 Cost Monitoring

### Check Current AWS Costs
```bash
# View month-to-date costs
aws ce get-cost-and-usage \
  --time-period Start=2024-02-01,End=2024-02-28 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --region us-east-1

# View DynamoDB costs
aws ce get-cost-and-usage \
  --time-period Start=2024-02-01,End=2024-02-28 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://dynamodb-filter.json \
  --region us-east-1
```

### Expected Monthly Costs
- EC2 t4g.micro: $7-8/month (or $0 with free tier)
- DynamoDB: ~$2/month (on-demand, low traffic)
- CloudWatch: $0 (within free tier)
- Data transfer: $2-3/month
- CloudFront: $3/month
- Route53: $0.50/month
- **Total: ~$15/month**

## 🎯 Resume Links

When updating your resume or LinkedIn, use these links:

**Live Demo**: https://whatsthecraic.run.place
**API Docs**: https://api.whatsthecraic.run.place/health
**GitHub**: https://github.com/yourusername/whatsthecraic

## 📱 Frontend Features

Once deployed via Amplify, your frontend will have:
- Event search and discovery
- User authentication
- Personalized event feed
- Saved events
- Artist/venue exploration
- Organizer marketplace
- Spotify OAuth integration

## 🚨 Troubleshooting

### If URLs don't work:

1. **Check DNS propagation**:
```bash
dig whatsthecraic.run.place
nslookup api.whatsthecraic.run.place
```

2. **Verify services are running**:
```bash
ssh ec2-user@your-ec2-ip
docker-compose ps
```

3. **Check Caddy logs**:
```bash
docker-compose logs caddy
```

4. **Test internal endpoints**:
```bash
curl http://localhost:4000/health
curl http://localhost:4004/health
```

### If ML service fails:

1. **Check logs**:
```bash
docker-compose logs ml-service
```

2. **Verify model exists**:
```bash
docker exec ml_service ls -la /app/models/
```

3. **Force retrain**:
```bash
curl -X POST http://localhost:4004/v1/model/retrain
```

## 📞 Support

For issues, check:
- `docs/mlops-guide.md` - MLOps documentation
- `docs/DEPLOYMENT_GUIDE.md` - Deployment guide
- `docs/ops-runbook.md` - Operations runbook

---

**Last Updated**: 2026-02-12
**Status**: Ready for Production ✅
