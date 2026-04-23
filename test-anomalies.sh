#!/bin/bash

# Anomaly Detection Testing Script
# Usage: bash test-anomalies.sh

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="http://localhost:5050/api"
FRONTEND_URL="http://localhost:5173"

# Please replace with your actual JWT token
TOKEN="YOUR_JWT_TOKEN_HERE"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Anomaly Detection Feature Test Suite${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test 1: Check API Status
echo -e "${YELLOW}Test 1: Checking AI System Status${NC}"
curl -s -X GET "${API_BASE_URL}/ai/status" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq . || echo -e "${RED}Failed to connect to backend${NC}"

echo -e "\n${YELLOW}Test 2: Fetching Active Anomalies${NC}"
curl -s -X GET "${API_BASE_URL}/ai/anomalies/active" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq .

echo -e "\n${YELLOW}Test 3: Detecting Cost Anomalies${NC}"
curl -s -X POST "${API_BASE_URL}/ai/anomalies/detect/cost" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"provider": "aws"}' | jq .

echo -e "\n${YELLOW}Test 4: Detecting Utilization Anomalies${NC}"
curl -s -X POST "${API_BASE_URL}/ai/anomalies/detect/utilization" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"provider": "aws"}' | jq .

echo -e "\n${YELLOW}Test 5: Fetching All Anomalies with Filters${NC}"
curl -s -X GET "${API_BASE_URL}/ai/anomalies?severity=high" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq .

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}Testing Complete!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Manual Testing Steps:${NC}"
echo -e "1. Start backend: ${BLUE}cd backend && npm start${NC}"
echo -e "2. Start frontend: ${BLUE}cd frontend && npm run dev${NC}"
echo -e "3. Open browser: ${BLUE}${FRONTEND_URL}${NC}"
echo -e "4. Login and navigate to Dashboard"
echo -e "5. Look for AnomalyAlertWidget below the metrics"
echo -e "6. Click on anomalies to expand details"
echo -e "7. Test ACK and dismiss buttons\n"
