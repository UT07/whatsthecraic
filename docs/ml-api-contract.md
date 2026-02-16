# ML Service API Contract

**Version:** 1.0.0
**Service:** ml-service
**Port:** 4004
**Base URL (Internal):** http://ml-service:4004
**Base URL (External):** https://api.whatsthecraic.run.place/v1/ml (via aggregator)

---

## Overview

The ML Service provides personalized event recommendations using collaborative filtering, A/B testing capabilities, and model performance monitoring. Built with FastAPI and scikit-learn, it's designed for cost-effective deployment on EC2.

---

## Authentication

All endpoints accept an optional `Authorization` header:
```
Authorization: Bearer <jwt-token>
```

---

## Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Description:** Service health check with model status

**Request:** No parameters

**Response:**
```json
{
  "status": "healthy",
  "service": "ml-service",
  "model_version": "v1.0.0",
  "model_loaded": true,
  "timestamp": "2026-02-16T12:34:56.789Z"
}
```

**Status Codes:**
- `200 OK` - Service is healthy

---

### 2. Get Recommendations

**Endpoint:** `POST /v1/recommendations`

**Description:** Get personalized event recommendations for a user. Includes automatic A/B test assignment for different recommendation algorithms.

**Request Body:**
```json
{
  "user_id": "string (required)",
  "city": "string (optional)",
  "limit": "integer (optional, default: 20)",
  "context": {
    "user_preferences": {},
    "current_time": "string",
    "device_type": "string"
  }
}
```

**Response:**
```json
{
  "user_id": "user_123",
  "recommendations": [
    {
      "event_id": "evt_789",
      "score": 0.92,
      "confidence": 0.85,
      "reason": "Based on your music preferences",
      "metadata": {
        "event_name": "Techno Night",
        "venue": "The Button Factory",
        "date": "2026-03-15",
        "genre": "Electronic"
      }
    }
  ],
  "model_version": "v1.0.0",
  "ab_experiment": "rec_algorithm_v1",
  "latency_ms": 45.23
}
```

**Status Codes:**
- `200 OK` - Recommendations generated successfully
- `400 Bad Request` - Invalid request parameters
- `500 Internal Server Error` - Model prediction failed

---

### 3. Record Feedback

**Endpoint:** `POST /v1/feedback`

**Description:** Record user feedback for model improvement and A/B test tracking. Used for online learning and model retraining.

**Request Body:**
```json
{
  "user_id": "string (required)",
  "event_id": "string (required)",
  "action": "string (required: 'save' | 'hide' | 'click' | 'skip')",
  "context": {
    "recommendation_id": "string",
    "position": "integer",
    "timestamp": "string"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Feedback recorded"
}
```

**Status Codes:**
- `200 OK` - Feedback recorded successfully
- `400 Bad Request` - Invalid action type or missing required fields
- `500 Internal Server Error` - Failed to store feedback

**Actions:**
- `save` - User saved/bookmarked the event (positive signal)
- `hide` - User hid/dismissed the event (negative signal)
- `click` - User clicked on the event (engagement signal)
- `skip` - User scrolled past without interaction (neutral/negative signal)

---

### 4. Get Model Info

**Endpoint:** `GET /v1/model/info`

**Description:** Get current model metrics and performance statistics

**Request:** No parameters

**Response:**
```json
{
  "model_version": "v1.0.0",
  "last_trained": "2026-02-15T08:00:00Z",
  "training_samples": 15432,
  "validation_metrics": {
    "precision_at_10": 0.78,
    "recall_at_10": 0.65,
    "ndcg_at_10": 0.82,
    "map": 0.71
  },
  "prediction_count": 245678,
  "avg_latency_ms": 42.5
}
```

**Status Codes:**
- `200 OK` - Model info retrieved successfully
- `500 Internal Server Error` - Failed to retrieve model metrics

---

### 5. List A/B Experiments

**Endpoint:** `GET /v1/experiments`

**Description:** List all active A/B experiments and their configurations

**Request:** No parameters

**Response:**
```json
{
  "experiments": [
    {
      "experiment_id": "rec_algorithm_v1",
      "name": "Recommendation Algorithm Test",
      "status": "active",
      "variants": [
        {
          "variant_id": "control",
          "name": "Baseline",
          "traffic_percentage": 40
        },
        {
          "variant_id": "collaborative_filtering",
          "name": "Collaborative Filtering",
          "traffic_percentage": 30
        },
        {
          "variant_id": "content_based",
          "name": "Content-Based",
          "traffic_percentage": 30
        }
      ],
      "created_at": "2026-02-01T00:00:00Z",
      "metrics_tracked": ["click_through_rate", "save_rate", "engagement_time"]
    }
  ],
  "count": 1
}
```

**Status Codes:**
- `200 OK` - Experiments listed successfully
- `500 Internal Server Error` - Failed to retrieve experiments

---

### 6. Get Experiment Results

**Endpoint:** `GET /v1/experiments/{experiment_id}/results`

**Description:** Get statistical results for a specific A/B experiment

**Path Parameters:**
- `experiment_id` (string, required) - The experiment ID

**Request:** No parameters

**Response:**
```json
{
  "experiment_id": "rec_algorithm_v1",
  "status": "active",
  "start_date": "2026-02-01T00:00:00Z",
  "participants": 12543,
  "variants": [
    {
      "variant_id": "control",
      "participants": 5017,
      "metrics": {
        "click_through_rate": 0.12,
        "save_rate": 0.08,
        "avg_engagement_time_seconds": 45.2
      }
    },
    {
      "variant_id": "collaborative_filtering",
      "participants": 3763,
      "metrics": {
        "click_through_rate": 0.15,
        "save_rate": 0.11,
        "avg_engagement_time_seconds": 52.1
      },
      "statistical_significance": {
        "vs_control": {
          "p_value": 0.023,
          "is_significant": true,
          "confidence_level": 0.95
        }
      }
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Results retrieved successfully
- `404 Not Found` - Experiment not found
- `500 Internal Server Error` - Failed to calculate results

---

### 7. Trigger Model Retraining

**Endpoint:** `POST /v1/model/retrain`

**Description:** Manually trigger model retraining (typically called by scheduled cron job)

**Request:** No body required

**Response:**
```json
{
  "status": "success",
  "model_version": "v1.0.1",
  "metrics": {
    "training_samples": 16234,
    "training_duration_seconds": 342,
    "validation_metrics": {
      "precision_at_10": 0.81,
      "recall_at_10": 0.68,
      "ndcg_at_10": 0.84
    }
  }
}
```

**Status Codes:**
- `200 OK` - Retraining completed successfully
- `500 Internal Server Error` - Retraining failed

---

### 8. Prometheus Metrics

**Endpoint:** `GET /metrics`

**Description:** Prometheus-compatible metrics endpoint for monitoring

**Request:** No parameters

**Response:** Prometheus text format
```
# HELP ml_service_requests_total Total number of requests
# TYPE ml_service_requests_total counter
ml_service_requests_total{endpoint="/v1/recommendations",status="200"} 12543

# HELP ml_service_latency_seconds Request latency in seconds
# TYPE ml_service_latency_seconds histogram
ml_service_latency_seconds_bucket{le="0.05"} 8234
ml_service_latency_seconds_bucket{le="0.1"} 11234
ml_service_latency_seconds_bucket{le="0.5"} 12432
...
```

**Status Codes:**
- `200 OK` - Metrics retrieved successfully

---

## Aggregator Integration Status

**WARNING:** The aggregator service currently has **incomplete ML endpoint proxying**.

### Current Aggregator Endpoints (INCOMPLETE):
- `GET /v1/ml/health` → `GET /health`
- `GET /v1/ml/recommendations/:userId` → (incorrect pattern)

### Missing Aggregator Proxies:
- `POST /v1/recommendations` ❌ NOT PROXIED
- `POST /v1/feedback` ❌ NOT PROXIED
- `GET /v1/model/info` ❌ NOT PROXIED
- `GET /v1/experiments` ❌ NOT PROXIED
- `GET /v1/experiments/:id/results` ❌ NOT PROXIED

### Required Aggregator Updates:

The following routes need to be added to `/tmp/wtc-worktrees/worktree-backend-api/aggregator-service/src/index.js`:

```javascript
// ML service proxy - NEEDS TO BE ADDED
app.post('/v1/recommendations', (req, res) =>
  proxyRequest(req, res, {
    url: `${ML_SERVICE_URL}/v1/recommendations`,
    method: 'post'
  })
);

app.post('/v1/feedback', (req, res) =>
  proxyRequest(req, res, {
    url: `${ML_SERVICE_URL}/v1/feedback`,
    method: 'post'
  })
);

app.get('/v1/model/info', (req, res) =>
  proxyRequest(req, res, {
    url: `${ML_SERVICE_URL}/v1/model/info`
  })
);

app.get('/v1/experiments', (req, res) =>
  proxyRequest(req, res, {
    url: `${ML_SERVICE_URL}/v1/experiments`
  })
);

app.get('/v1/experiments/:experimentId/results', (req, res) =>
  proxyRequest(req, res, {
    url: `${ML_SERVICE_URL}/v1/experiments/${req.params.experimentId}/results`
  })
);
```

---

## Error Handling

All endpoints follow a consistent error format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

Common error scenarios:
- Invalid JSON in request body → `400 Bad Request`
- Missing required fields → `400 Bad Request`
- Model not loaded → `500 Internal Server Error`
- Database connection failed → `500 Internal Server Error`

---

## Rate Limiting

Rate limiting is handled at the aggregator level:
- Default: 60 requests per minute per IP
- Can be configured via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` environment variables

---

## Configuration

### Environment Variables (ML Service):

```bash
# Service
ENVIRONMENT=production
SERVICE_PORT=4004

# Database
DB_HOST=db
DB_PORT=3306
DB_USER=app
DB_PASSWORD=<secret>
DB_NAME=gigsdb

# Model Configuration
MODEL_VERSION=v1.0.0
MIN_TRAINING_SAMPLES=10
RETRAIN_THRESHOLD_DAYS=7

# AWS (for A/B testing)
AWS_REGION=eu-west-1
USE_LOCAL_DYNAMODB=false

# CloudWatch
CLOUDWATCH_NAMESPACE=WhatsTheCraic/ML
ENABLE_CLOUDWATCH=true

# Redis (optional caching)
REDIS_HOST=<redis-host>
REDIS_PORT=6379
REDIS_ENABLED=false
CACHE_TTL_SECONDS=3600

# Recommendation Settings
DEFAULT_RECOMMENDATION_COUNT=20
MAX_RECOMMENDATION_COUNT=100
MIN_SIMILARITY_SCORE=0.1
```

---

## Client Usage Examples

### JavaScript/TypeScript (Frontend):

```javascript
// Get recommendations
const getRecommendations = async (userId, city = null, limit = 20) => {
  const response = await fetch('https://api.whatsthecraic.run.place/v1/recommendations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ user_id: userId, city, limit })
  });
  return await response.json();
};

// Record feedback
const recordFeedback = async (userId, eventId, action) => {
  await fetch('https://api.whatsthecraic.run.place/v1/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      user_id: userId,
      event_id: eventId,
      action
    })
  });
};

// Get model info (for admin dashboard)
const getModelInfo = async () => {
  const response = await fetch('https://api.whatsthecraic.run.place/v1/model/info', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  return await response.json();
};
```

### cURL Examples:

```bash
# Get recommendations
curl -X POST https://api.whatsthecraic.run.place/v1/recommendations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "user_id": "user_123",
    "city": "Dublin",
    "limit": 10
  }'

# Record feedback
curl -X POST https://api.whatsthecraic.run.place/v1/feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "user_id": "user_123",
    "event_id": "evt_456",
    "action": "save"
  }'

# Get model info
curl https://api.whatsthecraic.run.place/v1/model/info \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# List experiments
curl https://api.whatsthecraic.run.place/v1/experiments \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Performance Characteristics

- **Average Latency:** ~40-50ms per recommendation request
- **Throughput:** Handles 100+ requests/second on t3.medium EC2
- **Model Size:** ~50MB (fits in memory)
- **Training Time:** 5-10 minutes for 10K samples
- **Cold Start:** ~2-3 seconds to load model on startup

---

## Monitoring & Observability

### Key Metrics to Track:

1. **Latency:** p50, p95, p99 for `/v1/recommendations`
2. **Error Rate:** 5xx errors as percentage of total requests
3. **Model Performance:** Precision@10, Recall@10, NDCG@10
4. **A/B Test Conversions:** Save rate, click-through rate per variant
5. **Model Freshness:** Time since last training

### CloudWatch Metrics:

The service publishes metrics to CloudWatch namespace `WhatsTheCraic/ML`:
- `PredictionCount` - Number of predictions made
- `PredictionLatency` - Time to generate recommendations
- `FeedbackCount` - Number of feedback events recorded
- `ModelLoadTime` - Time to load model on startup

---

## Version History

- **v1.0.0** (2026-02-16) - Initial API contract based on source code analysis
  - POST /v1/recommendations
  - POST /v1/feedback
  - GET /v1/model/info
  - GET /v1/experiments
  - GET /v1/experiments/:id/results
  - POST /v1/model/retrain
  - GET /health
  - GET /metrics

---

## Notes for Frontend Developers

1. **Always handle loading states** - Recommendations can take 40-100ms
2. **Implement retry logic** - Model service may be temporarily unavailable during retraining
3. **Track feedback immediately** - Don't wait for user to navigate away
4. **Respect A/B test assignments** - Users should see consistent experience
5. **Cache recommendations** - Consider caching for 5-10 minutes to reduce load

---

## CRITICAL ISSUES

### Aggregator Proxy Endpoints Missing

The aggregator service is **NOT** properly proxying ML endpoints. This blocks frontend integration.

**Action Required:** Update `aggregator-service/src/index.js` to add the missing proxy routes listed in "Required Aggregator Updates" section above.

**Impact:** Without these proxies, frontend cannot access ML features through the public API.

**Priority:** HIGH - This blocks Wave 2 agents (Frontend Core, ML Intelligence)
