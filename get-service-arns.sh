#!/bin/bash

# Step 1: Get the Namespace ID
NAMESPACE_ID=$(aws servicediscovery list-namespaces --query "Namespaces[?Name=='whatsthecraic.local'].Id" --output text --region eu-west-1)
echo "Namespace ID: $NAMESPACE_ID"

# Step 2: Get the Service ARNs
VENUE_SERVICE_ARN=$(aws servicediscovery list-services --query "Services[?Name=='venue-service'].Arn" --output text --region eu-west-1)
DJ_SERVICE_ARN=$(aws servicediscovery list-services --query "Services[?Name=='dj-service'].Arn" --output text --region eu-west-1)
EVENTS_SERVICE_ARN=$(aws servicediscovery list-services --query "Services[?Name=='events-service'].Arn" --output text --region eu-west-1)
AGGREGATOR_SERVICE_ARN=$(aws servicediscovery list-services --query "Services[?Name=='aggregator-service'].Arn" --output text --region eu-west-1)

# Echo the retrieved ARNs for verification
echo "Venue Service ARN: $VENUE_SERVICE_ARN"
echo "DJ Service ARN: $DJ_SERVICE_ARN"
echo "Events Service ARN: $EVENTS_SERVICE_ARN"
echo "Aggregator Service ARN: $AGGREGATOR_SERVICE_ARN"

