#!/bin/bash
# Dark Sun Assistant System Test Script

echo "======================================"
echo "Dark Sun Assistant System Test"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((FAILED++))
    fi
}

echo "1. Testing Server Health..."
HEALTH=$(curl -s http://localhost:3000/api/health)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    test_result 0 "Server health endpoint responds with OK"
else
    test_result 1 "Server health endpoint"
fi
echo ""

echo "2. Testing MCP Server Status..."
MCP_STATUS=$(echo "$HEALTH" | grep -o '"status":"[^"]*"' | wc -l)
if [ "$MCP_STATUS" -ge 3 ]; then
    test_result 0 "MCP servers configured (3 servers found)"
else
    test_result 1 "MCP server configuration"
fi
echo ""

echo "3. Testing Conversations API..."
CONVS=$(curl -s http://localhost:3000/api/conversations)
if [ $? -eq 0 ]; then
    test_result 0 "Conversations endpoint accessible"
else
    test_result 1 "Conversations endpoint"
fi

# Create a test conversation
NEW_CONV=$(curl -s -X POST http://localhost:3000/api/conversations \
    -H "Content-Type: application/json" \
    -d '{"title":"Test Conversation"}')
if echo "$NEW_CONV" | grep -q '"id"'; then
    test_result 0 "Create conversation endpoint works"
    CONV_ID=$(echo "$NEW_CONV" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
else
    test_result 1 "Create conversation endpoint"
fi
echo ""

echo "4. Testing Frontend..."
FRONTEND=$(curl -s http://localhost:3000/ | head -1)
if echo "$FRONTEND" | grep -q "<!DOCTYPE html>"; then
    test_result 0 "Frontend HTML loads"
else
    test_result 1 "Frontend HTML"
fi

# Check if JavaScript is built
if [ -f "public/js/app.js" ]; then
    test_result 0 "Frontend JavaScript compiled"
else
    test_result 1 "Frontend JavaScript"
fi
echo ""

echo "5. Testing Foundry VTT Connection..."
FOUNDRY_RESPONSE=$(curl -s --connect-timeout 5 http://foundry.azthir-terra.com:30000 2>&1)
if echo "$FOUNDRY_RESPONSE" | grep -q "Redirecting"; then
    test_result 0 "Foundry VTT server is accessible on port 30000"
else
    test_result 1 "Foundry VTT server accessibility"
fi

# Test MCP Bridge port
MCP_BRIDGE=$(curl -s --connect-timeout 5 http://foundry.azthir-terra.com:31415 2>&1)
if echo "$MCP_BRIDGE" | grep -q -E "WebSocket|MCP|Bridge"; then
    test_result 0 "Foundry MCP Bridge is running on port 31415"
else
    echo -e "${YELLOW}⚠ WARNING${NC}: Foundry MCP Bridge not detected on port 31415"
    echo "  This is expected if the MCP Bridge module is not yet installed"
    test_result 1 "Foundry MCP Bridge (expected if not installed yet)"
fi
echo ""

echo "6. Testing SSH Connectivity..."
SSH_TEST=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no \
    -o PasswordAuthentication=no \
    foundry@foundry.azthir-terra.com "echo success" 2>&1)
if echo "$SSH_TEST" | grep -q "success"; then
    test_result 0 "SSH key authentication to Foundry server"
else
    echo -e "${YELLOW}⚠ WARNING${NC}: SSH key authentication not configured"
    echo "  MCP server connections via SSH will not work without keys"
    test_result 1 "SSH key authentication (needs configuration)"
fi
echo ""

echo "7. Testing Build Artifacts..."
if [ -d "dist" ] && [ -f "dist/server.js" ]; then
    test_result 0 "Backend TypeScript compiled to dist/"
else
    test_result 1 "Backend compilation"
fi

if [ -f "public/js/app.js" ]; then
    test_result 0 "Frontend TypeScript compiled to public/js/"
else
    test_result 1 "Frontend compilation"
fi
echo ""

echo "8. Testing Environment Configuration..."
if [ -f ".env" ]; then
    test_result 0 ".env file exists"
else
    test_result 1 ".env file"
fi

if grep -q "ANTHROPIC_API_KEY=your-api-key-here" .env; then
    echo -e "${YELLOW}⚠ WARNING${NC}: Anthropic API key not configured"
    echo "  Chat functionality will not work without a valid API key"
    test_result 1 "Anthropic API key (needs configuration)"
else
    test_result 0 "Anthropic API key configured"
fi
echo ""

echo "======================================"
echo "Test Summary"
echo "======================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${YELLOW}Some tests failed or require configuration${NC}"
    exit 1
fi
