#!/bin/bash
# Stop All - Stops the complete Asset Approval System network

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${RED}=============================================${NC}"
echo -e "${RED}  Stopping Asset Approval System Network${NC}"
echo -e "${RED}=============================================${NC}"
echo ""

# Run the stop script
"$SCRIPT_DIR/scripts/stop-network.sh"

echo ""
echo -e "${GREEN}✓ Network stopped successfully${NC}"
echo ""
echo "To restart, run: ./start-all.sh"
echo ""
