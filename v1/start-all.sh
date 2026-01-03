#!/bin/bash
# Start All - One Command Full Startup
# Starts network, deploys chaincode, and runs demo

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

println() {
    echo -e "$1"
}

header() {
    println ""
    println "${BLUE}=============================================${NC}"
    println "${BLUE}  $1${NC}"
    println "${BLUE}=============================================${NC}"
    println ""
}

successln() {
    println "${GREEN}✓ $1${NC}"
}

errorln() {
    println "${RED}✗ $1${NC}"
}

# ===========================================================================
# Main
# ===========================================================================

header "Asset Approval System - Full Startup"

println "Architecture:"
println "  • 3 Organizations (Asset Owner, Auditor, Regulator)"
println "  • 9 Peers (3 per org: endorser, query, committer)"
println "  • 3 Orderers (Raft cluster)"
println "  • 3 Fabric CAs"
println "  • 9 CouchDB instances"
println "  • Endorsement: AND(Org1, OR(Org2, Org3))"
println ""

# Step 0: Check prerequisites (quick check, not full script)
header "Step 0: Checking Prerequisites"
PREREQ_OK=true

# Check critical commands
for cmd in docker node npm peer configtxgen cryptogen osnadmin; do
    if ! command -v "$cmd" &> /dev/null; then
        errorln "Missing: $cmd"
        PREREQ_OK=false
    fi
done

# Check docker compose
if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    errorln "Missing: docker compose"
    PREREQ_OK=false
fi

if [ "$PREREQ_OK" = false ]; then
    println ""
    errorln "Prerequisites check failed!"
    println "Run ${YELLOW}./scripts/check-prerequisites.sh${NC} for detailed information."
    exit 1
fi
successln "All prerequisites found"

# Step 1: Stop any existing network
header "Step 1: Stopping Existing Network (if any)"
cd "$SCRIPT_DIR"
./scripts/stop-network.sh 2>/dev/null || true
successln "Cleanup complete"

# Step 2: Start Network
header "Step 2: Starting Network"
cd "$SCRIPT_DIR"
./scripts/start-network.sh
successln "Network started"

# Step 3: Deploy Chaincode
header "Step 3: Deploying Chaincode"
./scripts/deploy-chaincode.sh
successln "Chaincode deployed"

# Step 4: Install Client Dependencies
header "Step 4: Installing Client Dependencies"
cd "$SCRIPT_DIR/client"
npm install
successln "Dependencies installed"

# Step 5: Run Demo
header "Step 5: Running Demo"
npm run demo
successln "Demo completed"

# Summary
header "Startup Complete!"

println "Network Status:"
println "  • Channel: asset-channel"
println "  • Chaincode: asset-approval v1.0"
println "  • All 9 peers operational"
println "  • Raft ordering active"
println ""

println "Available Commands:"
println "  • npm run demo        - Run the demo again"
println "  • npm run test        - Run tests"
println "  • ./scripts/stop-network.sh - Stop network"
println ""

println "Port Reference:"
println "  • Org1 peers: 7051, 7151, 7251"
println "  • Org2 peers: 8051, 8151, 8251"
println "  • Org3 peers: 9051, 9151, 9251"
println "  • Orderers:   7050, 8050, 9050"
println "  • CAs:        7054, 8054, 9054"
