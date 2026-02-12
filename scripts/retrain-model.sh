#!/bin/bash
#
# Model Retraining Script
# Schedule with cron: 0 2 * * * /path/to/retrain-model.sh
# Runs daily at 2 AM to retrain ML recommendation model
#

set -e

echo "[$(date)] Starting model retraining..."

# Configuration
ML_SERVICE_URL="${ML_SERVICE_URL:-http://localhost:4004}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"  # Optional: Slack notifications
MIN_FEEDBACK_COUNT=50  # Minimum feedback needed before retraining

# Function to send Slack notification
send_slack_notification() {
    local message=$1
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK" || true
    fi
}

# Check if ML service is healthy
echo "Checking ML service health..."
if ! curl -f -s "${ML_SERVICE_URL}/health" > /dev/null; then
    echo "ERROR: ML service is not healthy"
    send_slack_notification "⚠️ Model retraining failed: ML service not healthy"
    exit 1
fi

# Get current model info
echo "Fetching current model info..."
MODEL_INFO=$(curl -s "${ML_SERVICE_URL}/v1/model/info")
echo "Current model: $MODEL_INFO"

# Check if we have enough new feedback
# This would require a custom endpoint to check feedback count
# For now, we'll proceed with retraining

# Trigger retraining
echo "Triggering model retraining..."
RETRAIN_RESPONSE=$(curl -s -X POST "${ML_SERVICE_URL}/v1/model/retrain")

# Check if retraining was successful
if echo "$RETRAIN_RESPONSE" | grep -q '"status":"success"'; then
    NEW_VERSION=$(echo "$RETRAIN_RESPONSE" | grep -o '"model_version":"[^"]*"' | cut -d'"' -f4)
    METRICS=$(echo "$RETRAIN_RESPONSE" | grep -o '"metrics":{[^}]*}')

    echo "[$(date)] Model retraining completed successfully"
    echo "New model version: $NEW_VERSION"
    echo "Metrics: $METRICS"

    send_slack_notification "✅ Model retraining successful: $NEW_VERSION"
else
    echo "[$(date)] ERROR: Model retraining failed"
    echo "Response: $RETRAIN_RESPONSE"

    send_slack_notification "❌ Model retraining failed: $(echo "$RETRAIN_RESPONSE" | grep -o '"detail":"[^"]*"')"
    exit 1
fi

# Optional: Archive old models
# This would depend on your model storage strategy

echo "[$(date)] Model retraining process completed"
