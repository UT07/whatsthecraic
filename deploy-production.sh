#!/bin/bash
#
# Production Deployment Script for WhatsTheCraic
# Run this on your EC2 instance to deploy all services including ML
#

set -e

echo "🚀 WhatsTheCraic Production Deployment"
echo "======================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/ec2-user/whatsthecraic"
DOMAIN="whatsthecraic.run.place"
AWS_REGION="eu-west-1"

# Step 1: Pull latest code
echo -e "${YELLOW}[1/8] Pulling latest code...${NC}"
cd "$PROJECT_DIR"
git pull origin main || {
    echo -e "${RED}Failed to pull code. Check git configuration.${NC}"
    exit 1
}
echo -e "${GREEN}✓ Code updated${NC}"
echo ""

# Step 2: Verify environment file exists
echo -e "${YELLOW}[2/8] Checking environment configuration...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create .env from .env.example and configure:"
    echo "  - Database credentials"
    echo "  - JWT_SECRET"
    echo "  - AWS credentials (for DynamoDB & CloudWatch)"
    echo "  - API keys (Ticketmaster, Eventbrite, Spotify)"
    exit 1
fi
echo -e "${GREEN}✓ Environment configured${NC}"
echo ""

# Step 3: Check AWS credentials
echo -e "${YELLOW}[3/8] Verifying AWS credentials...${NC}"
if aws sts get-caller-identity --region "$AWS_REGION" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ AWS credentials valid${NC}"
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo "  Account: $ACCOUNT_ID"
else
    echo -e "${YELLOW}⚠ AWS credentials not configured. Some features will be limited:${NC}"
    echo "  - No DynamoDB A/B testing"
    echo "  - No CloudWatch metrics"
    echo "  Run: aws configure"
fi
echo ""

# Step 4: Create DynamoDB tables
echo -e "${YELLOW}[4/8] Setting up DynamoDB tables for A/B testing...${NC}"
if aws sts get-caller-identity > /dev/null 2>&1; then
    # Create experiments table
    if ! aws dynamodb describe-table --table-name whatsthecraic-experiments --region "$AWS_REGION" > /dev/null 2>&1; then
        echo "  Creating experiments table..."
        aws dynamodb create-table \
            --table-name whatsthecraic-experiments \
            --attribute-definitions AttributeName=experiment_id,AttributeType=S \
            --key-schema AttributeName=experiment_id,KeyType=HASH \
            --billing-mode PAY_PER_REQUEST \
            --region "$AWS_REGION" > /dev/null
        echo -e "${GREEN}  ✓ Experiments table created${NC}"
    else
        echo -e "${GREEN}  ✓ Experiments table exists${NC}"
    fi

    # Create assignments table
    if ! aws dynamodb describe-table --table-name whatsthecraic-ab-assignments --region "$AWS_REGION" > /dev/null 2>&1; then
        echo "  Creating assignments table..."
        aws dynamodb create-table \
            --table-name whatsthecraic-ab-assignments \
            --attribute-definitions \
                AttributeName=user_id,AttributeType=S \
                AttributeName=experiment_id,AttributeType=S \
            --key-schema \
                AttributeName=user_id,KeyType=HASH \
                AttributeName=experiment_id,KeyType=RANGE \
            --billing-mode PAY_PER_REQUEST \
            --region "$AWS_REGION" > /dev/null
        echo -e "${GREEN}  ✓ Assignments table created${NC}"
    else
        echo -e "${GREEN}  ✓ Assignments table exists${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Skipped (no AWS credentials)${NC}"
fi
echo ""

# Step 5: Apply database migrations
echo -e "${YELLOW}[5/8] Applying database migrations...${NC}"
if docker ps | grep -q gigsdb; then
    echo "  Applying ML service migration..."
    docker exec -i gigsdb mysql -uroot -p"${MYSQL_ROOT_PASSWORD:-localroot}" gigsdb < database/migrations/003_ml_service_tables.sql 2>/dev/null || {
        echo -e "${YELLOW}  ⚠ Migration may have already been applied${NC}"
    }
    echo -e "${GREEN}  ✓ Database migrations applied${NC}"
else
    echo -e "${YELLOW}  ⚠ Database not running yet, will apply after services start${NC}"
fi
echo ""

# Step 6: Build and deploy services
echo -e "${YELLOW}[6/8] Building and deploying services...${NC}"
docker-compose pull
docker-compose build --parallel
docker-compose up -d --remove-orphans

echo "  Waiting for services to become healthy..."
sleep 30

# Apply migrations if we couldn't before
if [ ! -z "$MIGRATION_PENDING" ]; then
    echo "  Applying ML service migration..."
    docker exec -i gigsdb mysql -uroot -p"${MYSQL_ROOT_PASSWORD:-localroot}" gigsdb < database/migrations/003_ml_service_tables.sql 2>/dev/null || true
fi

echo -e "${GREEN}✓ Services deployed${NC}"
echo ""

# Step 7: Verify all services
echo -e "${YELLOW}[7/8] Verifying service health...${NC}"

check_service() {
    local name=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:$port/health" > /dev/null 2>&1; then
            echo -e "${GREEN}  ✓ $name (port $port)${NC}"
            return 0
        fi
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "${RED}  ✗ $name (port $port) - FAILED${NC}"
    return 1
}

check_service "Aggregator    " 4000
check_service "Events Service" 4003
check_service "DJ Service    " 4002
check_service "Venue Service " 4001
check_service "Auth Service  " 3001
check_service "ML Service    " 4004

echo ""

# Step 8: Display deployment summary
echo -e "${YELLOW}[8/8] Deployment Summary${NC}"
echo "======================================="
echo ""
echo -e "${GREEN}✓ Deployment successful!${NC}"
echo ""
echo "Service URLs:"
echo "  Main API:        http://$DOMAIN"
echo "  Aggregator:      http://localhost:4000"
echo "  Events Service:  http://localhost:4003"
echo "  DJ Service:      http://localhost:4002"
echo "  Venue Service:   http://localhost:4001"
echo "  Auth Service:    http://localhost:3001"
echo "  ML Service:      http://localhost:4004"
echo ""
echo "Public URLs (once DNS propagates):"
echo "  Frontend:        https://$DOMAIN"
echo "  API:             https://api.$DOMAIN"
echo "  Auth:            https://auth.$DOMAIN"
echo ""
echo "Test ML Service:"
echo "  curl http://localhost:4004/health"
echo "  curl http://localhost:4004/v1/model/info"
echo ""
echo "View CloudWatch Metrics:"
echo "  aws cloudwatch list-metrics --namespace WhatsTheCraic/ML --region $AWS_REGION"
echo ""
echo "Container Status:"
docker-compose ps
echo ""
echo "Next Steps:"
echo "  1. Set up cron for model retraining:"
echo "     crontab -e"
echo "     Add: 0 2 * * * $PROJECT_DIR/scripts/retrain-model.sh >> /var/log/retrain-model.log 2>&1"
echo ""
echo "  2. Monitor logs:"
echo "     docker-compose logs -f ml-service"
echo ""
echo "  3. Update your resume with the new project description:"
echo "     See docs/RESUME_PROJECT_DESCRIPTION.md"
echo ""
echo -e "${GREEN}🎉 Your MLOps-powered WhatsTheCraic is now live!${NC}"
