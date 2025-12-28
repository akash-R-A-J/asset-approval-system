#!/bin/bash
# ============================================================================
# Hyperledger Fabric Asset Approval System - Interactive Demo Script
# ============================================================================
# This script demonstrates the asset approval workflow with clear explanations.
# Perfect for interview demonstrations.
#
# Usage: ./demo.sh
# ============================================================================

set -e
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLIENT_DIR="$PROJECT_ROOT/client"

# Suppress config warnings for clean demo output
export SUPPRESS_CONFIG_WARNINGS=true

cd "$CLIENT_DIR" || {
    echo -e "${RED}Error: Cannot access client directory${NC}"
    exit 1
}

function pause() {
    echo ""
    echo -e "${CYAN}Press Enter to continue...${NC}"
    read
}

function step() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Run a command and handle errors gracefully
function run_step() {
    local cmd="$@"
    set +e  # Temporarily disable exit on error
    output=$("$@" 2>&1)
    local exit_code=$?
    set -e
    
    echo "$output"
    
    if [ $exit_code -ne 0 ]; then
        echo ""
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}  DEMO FAILED! The above command encountered an error.${NC}"
        echo -e "${RED}  Please check the network status and try again.${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        exit 1
    fi
}

clear
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║       HYPERLEDGER FABRIC - ASSET APPROVAL SYSTEM DEMO                   ║"
echo "╠════════════════════════════════════════════════════════════════════════╣"
echo "║  Network: 3 Organizations, 3 Orderers (Raft), CouchDB State DB          ║"
echo "║  Org1: Asset Owner | Org2: Auditor | Org3: Regulator                   ║"
echo "║  All identities managed by Fabric CA (no cryptogen)                     ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
pause

# Generate unique asset ID
ASSET_ID="ASSET$(date +%s)"

step "STEP 1: Create Asset (Org1 - Asset Owner)"
echo ""
echo -e "Command: ${GREEN}node src/app.js create $ASSET_ID \"Medical Equipment\" org1 admin${NC}"
echo ""
echo "This operation:"
echo "  • Submits transaction to chaincode as Org1"
echo "  • Chaincode enforces Organization-Based Access Control (OBAC)"
echo "  • Only Org1MSP can create assets"
echo "  • Asset created with status: PENDING"
echo ""
pause
run_step node src/app.js create $ASSET_ID "Medical Equipment" org1 admin

step "STEP 2: Query Asset State (Org1)"
echo ""
echo -e "Command: ${GREEN}node src/app.js query $ASSET_ID org1 admin${NC}"
echo ""
echo "This is a query (evaluate), not a transaction:"
echo "  • Does not go through ordering service"
echo "  • Reads directly from peer's world state (CouchDB)"
echo "  • No block is created"
echo ""
pause
run_step node src/app.js query $ASSET_ID org1 admin

step "STEP 3: First Approval (Org2 - Auditor)"
echo ""
echo -e "Command: ${GREEN}node src/app.js approve $ASSET_ID org2 admin${NC}"
echo ""
echo "Org2 (Auditor) approves the asset:"
echo "  • Chaincode verifies caller is Org2MSP or Org3MSP"
echo "  • Approval recorded with timestamp"
echo "  • Asset still PENDING (needs 2 approvals)"
echo ""
pause
run_step node src/app.js approve $ASSET_ID org2 admin

step "STEP 4: Check Partial Approval Status"
echo ""
echo -e "Command: ${GREEN}node src/app.js query $ASSET_ID org1 admin${NC}"
echo ""
echo "After one approval:"
echo "  • Org2MSP approval is recorded"
echo "  • Status remains PENDING"
echo ""
pause
run_step node src/app.js query $ASSET_ID org1 admin

step "STEP 5: Second Approval (Org3 - Regulator)"
echo ""
echo -e "Command: ${GREEN}node src/app.js approve $ASSET_ID org3 admin${NC}"
echo ""
echo "Org3 (Regulator) approves the asset:"
echo "  • With both approvals, status changes to APPROVED"
echo "  • State machine prevents further modifications"
echo ""
pause
run_step node src/app.js approve $ASSET_ID org3 admin

step "STEP 6: Final Asset State - APPROVED"
echo ""
echo -e "Command: ${GREEN}node src/app.js query $ASSET_ID org1 admin${NC}"
echo ""
pause
run_step node src/app.js query $ASSET_ID org1 admin

step "STEP 7: View Asset History (Blockchain Provenance)"
echo ""
echo -e "Command: ${GREEN}node src/app.js history $ASSET_ID org1 admin${NC}"
echo ""
echo "Fabric maintains full history of all changes:"
echo "  • Each transaction is in a separate block"
echo "  • Immutable audit trail"
echo "  • TxId for each state change"
echo ""
pause
run_step node src/app.js history $ASSET_ID org1 admin

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                         DEMO COMPLETE!                                  ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Key Concepts Demonstrated:                                             ║${NC}"
echo -e "${GREEN}║  ✓ Organization-Based Access Control (OBAC) via MSP ID                  ║${NC}"
echo -e "${GREEN}║  ✓ Multi-organization approval workflow                                  ║${NC}"
echo -e "${GREEN}║  ✓ State machine enforcement (APPROVED assets cannot be modified)       ║${NC}"
echo -e "${GREEN}║  ✓ Fabric CA for identity management                                     ║${NC}"
echo -e "${GREEN}║  ✓ Raft consensus with 3 orderers                                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
