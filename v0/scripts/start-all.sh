#!/bin/bash
# ============================================================================
# Hyperledger Fabric Asset Approval System - Complete Startup Script
# ============================================================================
# This script brings up the entire network from scratch, including:
# 1. Starting CAs and enrolling identities
# 2. Starting peers and orderers
# 3. Creating channel and joining all peers
# 4. Deploying chaincode
# 5. Setting up the client
# 6. Running a warm-up to avoid cold-start issues
#
# Usage: ./start-all.sh
# ============================================================================

set -e
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}"
echo "============================================================================"
echo "   Hyperledger Fabric Asset Approval System - Complete Startup"
echo "============================================================================"
echo -e "${NC}"

# Step 1: Bring down any existing network
echo -e "${YELLOW}[1/6] Cleaning up any existing network...${NC}"
cd "$PROJECT_ROOT/network"
./scripts/network.sh down 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup complete${NC}"

# Step 2: Start the network
echo -e "${YELLOW}[2/6] Starting the network (CAs, Orderers, Peers)...${NC}"
./scripts/network.sh up
echo -e "${GREEN}✓ Network started${NC}"

# Step 3: Create channel and join peers
echo -e "${YELLOW}[3/6] Creating channel and joining peers...${NC}"
./scripts/network.sh createChannel
echo -e "${GREEN}✓ Channel created${NC}"

# Step 4: Deploy chaincode
echo -e "${YELLOW}[4/6] Deploying chaincode...${NC}"
./scripts/network.sh deployCC

# Wait for chaincode containers to be ready
sleep 5

echo -e "${GREEN}✓ Chaincode deployed${NC}"

# Step 5: Setup client
echo -e "${YELLOW}[5/6] Setting up client application...${NC}"
cd "$PROJECT_ROOT/client"

# Install npm dependencies if needed
if [ ! -d "node_modules" ]; then
    npm install
fi

# Remove old wallet and re-enroll
rm -rf wallet

# Enroll admins (credentials from environment or defaults for POC)
node src/enrollAdmin.js org1
node src/enrollAdmin.js org2
node src/enrollAdmin.js org3
echo -e "${GREEN}✓ Client setup complete${NC}"

# Step 6: Warm up chaincode (to avoid cold-start issues)
echo -e "${YELLOW}[6/6] Warming up chaincode...${NC}"
# Create a test asset to trigger chaincode container startup
set +e  # Allow warmup to fail without exiting
node src/app.js create WARMUP001 "Warmup Asset" org1 admin 2>/dev/null
sleep 3
# Second attempt should succeed
node src/app.js create WARMUP002 "Warmup Asset 2" org1 admin 2>/dev/null
set -e
echo -e "${GREEN}✓ Chaincode warmed up${NC}"

echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}   SUCCESS! Network is ready for demo${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "Run the demo with: ${BLUE}./demo.sh${NC}"
echo ""
echo "Or manually test:"
echo "  cd $PROJECT_ROOT/client"
echo "  node src/app.js create ASSET001 \"My Asset\" org1 admin"
echo "  node src/app.js query ASSET001 org1 admin"
echo "  node src/app.js approve ASSET001 org2 admin"
echo "  node src/app.js approve ASSET001 org3 admin"
echo "  node src/app.js query ASSET001 org1 admin"
echo ""
