#!/bin/bash
#
# End-to-End Testing Script for WhatsTheCraic
# Tests all services including ML recommendations
#

set -e

echo "🧪 WhatsTheCraic End-to-End Testing"
echo "===================================="
echo ""

# Configuration
BASE_URL="${BASE_URL:-http://localhost:4000}"
ML_URL="${ML_URL:-http://localhost:4004}"
AUTH_URL="${AUTH_URL:-http://localhost:3001}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run tests
run_test() {
    local test_name=$1
    local command=$2

    echo -n "  Testing $test_name... "

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 1: Health Checks
echo -e "${YELLOW}[1/6] Health Checks${NC}"
run_test "Aggregator health    " "curl -f -s $BASE_URL/health"
run_test "Events service health" "curl -f -s http://localhost:4003/health"
run_test "DJ service health    " "curl -f -s http://localhost:4002/health"
run_test "Venue service health " "curl -f -s http://localhost:4001/health"
run_test "Auth service health  " "curl -f -s $AUTH_URL/health"
run_test "ML service health    " "curl -f -s $ML_URL/health"
echo ""

# Test 2: Authentication
echo -e "${YELLOW}[2/6] Authentication${NC}"

# Create test user
echo -n "  Creating test user... "
SIGNUP_RESPONSE=$(curl -s -X POST "$AUTH_URL/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test-$(date +%s)@test.com\",\"password\":\"TestPassword123\"}" 2>/dev/null)

if echo "$SIGNUP_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    TOKEN=$(echo "$SIGNUP_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
else
    echo -e "${YELLOW}⚠ (user may already exist)${NC}"
    # Try login instead
    LOGIN_RESPONSE=$(curl -s -X POST "$AUTH_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"TestPassword123"}' 2>/dev/null)
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

echo "  Token: ${TOKEN:0:20}..."
echo ""

# Test 3: ML Service
echo -e "${YELLOW}[3/6] ML Service${NC}"

run_test "Model info           " "curl -f -s $ML_URL/v1/model/info"
run_test "Metrics endpoint     " "curl -f -s $ML_URL/metrics | grep -q 'ml_requests_total'"

echo -n "  Getting recommendations... "
REC_RESPONSE=$(curl -s -X POST "$ML_URL/v1/recommendations" \
    -H "Content-Type: application/json" \
    -d '{"user_id":"test-user","city":"Dublin","limit":10}' 2>/dev/null)

if echo "$REC_RESPONSE" | grep -q "recommendations"; then
    echo -e "${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    NUM_RECS=$(echo "$REC_RESPONSE" | grep -o '"recommendations":\[' | wc -l)
    echo "    Received recommendations"
else
    echo -e "${RED}✗${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo "    Response: $REC_RESPONSE"
fi

echo -n "  Recording feedback... "
FEEDBACK_RESPONSE=$(curl -s -X POST "$ML_URL/v1/feedback" \
    -H "Content-Type: application/json" \
    -d '{"user_id":"test-user","event_id":"event-123","action":"save"}' 2>/dev/null)

if echo "$FEEDBACK_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

run_test "List experiments     " "curl -f -s $ML_URL/v1/experiments | grep -q 'experiments'"

echo ""

# Test 4: Event Search
echo -e "${YELLOW}[4/6] Event Services${NC}"

run_test "Event search         " "curl -f -s '$BASE_URL/v1/events/search?city=Dublin'"
run_test "Performers search    " "curl -f -s '$BASE_URL/v1/performers?city=Dublin'"

echo ""

# Test 5: Directory Services
echo -e "${YELLOW}[5/6] Directory Services${NC}"

run_test "DJ search            " "curl -f -s 'http://localhost:4002/v1/djs/search?city=Dublin'"
run_test "Venue search         " "curl -f -s 'http://localhost:4001/v1/venues/search?city=Dublin'"

echo ""

# Test 6: CloudWatch Metrics (if AWS configured)
echo -e "${YELLOW}[6/6] CloudWatch Integration${NC}"

if aws sts get-caller-identity > /dev/null 2>&1; then
    run_test "CloudWatch metrics   " "aws cloudwatch list-metrics --namespace WhatsTheCraic/ML --region eu-west-1 --query 'Metrics[0]'"
else
    echo -e "${YELLOW}  ⚠ Skipped (no AWS credentials)${NC}"
fi

echo ""

# Summary
echo "===================================="
echo "Test Results:"
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Your WhatsTheCraic platform is working correctly!"
    echo ""
    echo "Try these URLs:"
    echo "  Frontend: https://whatsthecraic.run.place"
    echo "  API:      https://api.whatsthecraic.run.place"
    echo "  ML API:   https://api.whatsthecraic.run.place/ml"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Check logs:${NC}"
    echo "  docker-compose logs ml-service"
    echo "  docker-compose logs aggregator"
    echo ""
    exit 1
fi
