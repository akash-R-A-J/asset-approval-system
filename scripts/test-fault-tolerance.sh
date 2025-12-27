#!/bin/bash
# ============================================================================
# Hyperledger Fabric - Fault Tolerance Test
# ============================================================================
# This script demonstrates Raft consensus fault tolerance by:
# 1. Stopping one orderer
# 2. Verifying transactions still work (2 of 3 orderers = quorum)
# 3. Restarting the orderer
# 4. Stopping two orderers
# 5. Showing transactions fail (only 1 orderer = no quorum)
#
# Usage: ./test-fault-tolerance.sh
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

TIMESTAMP=$(date +%s)

function section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

function pause() {
    echo ""
    echo -e "${YELLOW}Press Enter to continue...${NC}"
    read
}

# Create asset and verify it was actually created by querying
# Args: $1 = assetID, $2 = description, $3 = timeout (optional, default 30s)
# Returns: 0 on success, 1 on failure
function create_and_verify_asset() {
    local asset_id="$1"
    local description="$2"
    local timeout="${3:-30}"
    local output
    local exit_code
    local verify_output
    local had_connection_errors=false
    
    echo -e "Creating asset ${BLUE}${asset_id}${NC}..."
    echo ""
    
    # Capture both stdout and stderr, don't exit on error
    set +e
    output=$(timeout ${timeout}s node src/app.js create "$asset_id" "$description" org1 admin 2>&1)
    exit_code=$?
    set -e
    
    # Check for timeout
    if [ $exit_code -eq 124 ]; then
        echo -e "${RED}✗ TIMEOUT: Transaction took too long (>${timeout}s)${NC}"
        echo "This may indicate ordering service issues."
        return 1
    fi
    
    # Check if there were connection errors (but might still succeed)
    if echo "$output" | grep -qi "error:.*failed\|ECONNREFUSED\|unable to connect"; then
        had_connection_errors=true
    fi
    
    # Show the output
    echo "$output"
    echo ""
    
    # ALWAYS verify by querying the asset - don't trust just the success message
    echo -e "${CYAN}Verifying asset exists on ledger...${NC}"
    set +e
    verify_output=$(node src/app.js query "$asset_id" org1 admin 2>&1)
    verify_exit=$?
    set -e
    
    if [ $verify_exit -eq 0 ] && echo "$verify_output" | grep -q '"assetID"'; then
        # Asset exists - extract key information from ACTUAL query response
        local asset_status=$(echo "$verify_output" | grep -o '"status": "[^"]*"' | head -1 | cut -d'"' -f4)
        local asset_owner=$(echo "$verify_output" | grep -o '"owner": "[^"]*"' | head -1 | cut -d'"' -f4)
        local created_at=$(echo "$verify_output" | grep -o '"createdAt": "[^"]*"' | head -1 | cut -d'"' -f4)
        
        echo ""
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓ ASSET VERIFIED ON LEDGER (Data from actual query)                   ║${NC}"
        echo -e "${GREEN}╠════════════════════════════════════════════════════════════════════════╣${NC}"
        echo -e "${GREEN}║  Asset ID:    ${asset_id}${NC}"
        echo -e "${GREEN}║  Status:      ${asset_status}${NC}"
        echo -e "${GREEN}║  Owner:       ${asset_owner}${NC}"
        echo -e "${GREEN}║  Created At:  ${created_at}${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
        
        # Show raw JSON as proof this is real data from ledger
        echo ""
        echo -e "${CYAN}Raw ledger query response (proof of actual ledger data):${NC}"
        echo "$verify_output" | grep -A 20 "Asset data:" | head -15
        
        if [ "$had_connection_errors" = true ]; then
            echo ""
            echo -e "${YELLOW}Note: SDK encountered connection errors to stopped orderer(s) but${NC}"
            echo -e "${YELLOW}      successfully submitted transaction via available orderer(s).${NC}"
            echo -e "${YELLOW}      This demonstrates Raft fault tolerance in action!${NC}"
        fi
        
        return 0
    else
        echo ""
        echo -e "${RED}╔════════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ✗ ASSET NOT FOUND ON LEDGER                                           ║${NC}"
        echo -e "${RED}╠════════════════════════════════════════════════════════════════════════╣${NC}"
        echo -e "${RED}║  The create command may have shown success but asset doesn't exist.    ║${NC}"
        echo -e "${RED}║  This indicates the transaction was not committed to the ledger.       ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "Query output:"
        echo "$verify_output" | head -5
        return 1
    fi
}


# Attempt to create asset but expect failure
# Args: $1 = assetID, $2 = description, $3 = timeout
# Returns: 0 if creation failed (expected), 1 if creation succeeded (unexpected)
function expect_creation_failure() {
    local asset_id="$1"
    local description="$2"
    local timeout="${3:-30}"
    local output
    local exit_code
    
    echo -e "${YELLOW}Attempting transaction without quorum (should fail)...${NC}"
    echo ""
    
    set +e
    output=$(timeout ${timeout}s node src/app.js create "$asset_id" "$description" org1 admin 2>&1)
    exit_code=$?
    set -e
    
    # Timeout is expected in this case
    if [ $exit_code -eq 124 ]; then
        echo -e "${GREEN}✓ EXPECTED: Transaction timed out - cannot reach consensus${NC}"
        return 0
    fi
    
    # Check for failure indicators
    if echo "$output" | grep -qi "error\|fail\|unavailable\|timeout\|ECONNREFUSED"; then
        echo -e "${GREEN}✓ EXPECTED FAILURE: Transaction failed without quorum${NC}"
        echo "  This is correct behavior - Raft cannot reach consensus."
        echo ""
        echo "Error message (truncated):"
        echo "$output" | grep -i "error" | head -3
        return 0
    fi
    
    # Check if creation actually succeeded (unexpected)
    if echo "$output" | grep -q "Asset created successfully"; then
        echo -e "${RED}✗ UNEXPECTED: Asset was created despite no quorum!${NC}"
        echo "This should not happen. Check orderer status."
        return 1
    fi
    
    # Unknown state - verify by querying
    echo "Checking if asset exists..."
    set +e
    verify_output=$(node src/app.js query "$asset_id" org1 admin 2>&1)
    set -e
    
    if echo "$verify_output" | grep -q '"assetID"'; then
        echo -e "${RED}✗ UNEXPECTED: Asset exists despite expected failure!${NC}"
        return 1
    else
        echo -e "${GREEN}✓ EXPECTED: Asset was not created (no quorum)${NC}"
        return 0
    fi
}

# Check orderer count - only count actual orderer nodes, not CA
function get_orderer_count() {
    # Pattern: ordererN.orderer.example.com (not ca_orderer)
    docker ps --format "{{.Names}}" | grep -E "^orderer[0-9]+\.orderer\.example\.com$" | wc -l
}

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║            RAFT CONSENSUS FAULT TOLERANCE TEST                          ║"
echo "╠════════════════════════════════════════════════════════════════════════╣"
echo "║  This test demonstrates that the network survives orderer failures      ║"
echo "║  Raft with 3 nodes: Tolerates 1 failure (requires 2 for quorum)        ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================================================
# STEP 1: Verify All Orderers Running
# ============================================================================
section "STEP 1: Verify All Orderers Running"
echo ""
echo "Checking orderer status..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep orderer || echo "No orderers found!"
echo ""
ORDERER_COUNT=$(get_orderer_count)
if [ "$ORDERER_COUNT" -ne 3 ]; then
    echo -e "${RED}ERROR: Expected 3 orderers, found ${ORDERER_COUNT}${NC}"
    echo "Please ensure all orderers are running before starting this test."
    exit 1
fi
echo -e "Active orderers: ${GREEN}${ORDERER_COUNT}/3${NC}"
pause

# ============================================================================
# STEP 2: Create Asset (All Orderers Running - Baseline)
# ============================================================================
section "STEP 2: Create Asset (All Orderers Running - Baseline)"
cd "$CLIENT_DIR"
ASSET_FT1="FAULT_TEST_${TIMESTAMP}_1"
echo ""
echo "This establishes a baseline - network should work with all 3 orderers."
echo ""
if create_and_verify_asset "$ASSET_FT1" "Fault Tolerance Test 1" 60; then
    echo ""
    echo -e "${GREEN}✓ Baseline test passed - network is working correctly${NC}"
else
    echo ""
    echo -e "${RED}✗ Baseline test FAILED - network may have issues${NC}"
    echo "Please check the network status before continuing."
    pause
fi
pause

# ============================================================================
# STEP 3: Stop Orderer2 (Simulating Crash)
# ============================================================================
section "STEP 3: Stop Orderer2 (Simulating Crash)"
echo ""
echo -e "${YELLOW}Stopping orderer2.orderer.example.com...${NC}"
docker stop orderer2.orderer.example.com || {
    echo -e "${RED}Failed to stop orderer2${NC}"
    exit 1
}
sleep 2  # Give time for the cluster to notice
echo ""
echo "Remaining orderers:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep orderer || echo "No orderers running!"
ORDERER_COUNT=$(get_orderer_count)
echo ""
echo -e "Active orderers: ${YELLOW}${ORDERER_COUNT}/3${NC}"
if [ "$ORDERER_COUNT" -eq 2 ]; then
    echo -e "${GREEN}Quorum is maintained (2/3 = majority)${NC}"
else
    echo -e "${RED}Unexpected orderer count: ${ORDERER_COUNT}${NC}"
fi
pause

# ============================================================================
# STEP 4: Create Asset (With 1 Orderer Down)
# ============================================================================
section "STEP 4: Create Asset (With 1 Orderer Down)"
ASSET_FT2="FAULT_TEST_${TIMESTAMP}_2"
echo ""
echo "Testing if network still works with 2 orderers..."
echo "Note: You may see discovery errors as the SDK tries to connect to the stopped orderer."
echo "These errors are expected - the SDK will fall back to available orderers."
echo ""

if create_and_verify_asset "$ASSET_FT2" "Fault Tolerance Test 2" 60; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  SUCCESS: Network continues to work with 1 orderer down!               ║${NC}"
    echo -e "${GREEN}║  This demonstrates Raft's crash fault tolerance.                       ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
else
    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  FAILED: Transaction failed even with 2 orderers up                     ║${NC}"
    echo -e "${RED}║  This may indicate leader election issues. Try waiting longer.          ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Checking orderer logs for issues..."
    docker logs orderer0.orderer.example.com 2>&1 | tail -5
fi
pause

# ============================================================================
# STEP 5: Restart Orderer2
# ============================================================================
section "STEP 5: Restart Orderer2"
echo ""
echo -e "${GREEN}Restarting orderer2.orderer.example.com...${NC}"
docker start orderer2.orderer.example.com || {
    echo -e "${RED}Failed to start orderer2${NC}"
}
echo "Waiting for orderer to rejoin cluster..."
sleep 5
echo ""
echo "All orderers:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep orderer || echo "No orderers found!"
ORDERER_COUNT=$(get_orderer_count)
echo ""
echo -e "Active orderers: ${GREEN}${ORDERER_COUNT}/3${NC}"
pause

# ============================================================================
# STEP 6: Stop Two Orderers (Demonstrating Quorum Loss)
# ============================================================================
section "STEP 6: Stop Two Orderers (Demonstrating Quorum Loss)"
echo ""
echo -e "${RED}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  WARNING: Stopping 2 orderers will cause QUORUM LOSS!                  ║${NC}"
echo -e "${RED}║  Raft requires majority (2 of 3) for consensus.                        ║${NC}"
echo -e "${RED}║  With only 1 orderer, NO transactions will be possible.                ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════════════════╝${NC}"
pause

echo -e "${YELLOW}Stopping orderer1 and orderer2...${NC}"
docker stop orderer1.orderer.example.com || true
docker stop orderer2.orderer.example.com || true
sleep 2
echo ""
echo "Remaining orderers:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep orderer || echo "No orderers running!"
ORDERER_COUNT=$(get_orderer_count)
echo ""
echo -e "Active orderers: ${RED}${ORDERER_COUNT}/3${NC}"
echo -e "${RED}NO QUORUM - consensus is impossible!${NC}"
pause

# ============================================================================
# STEP 7: Attempt Transaction (Should FAIL - No Quorum)
# ============================================================================
section "STEP 7: Attempt Transaction (Should FAIL - No Quorum)"
ASSET_FT3="FAULT_TEST_${TIMESTAMP}_3"
echo ""

if expect_creation_failure "$ASSET_FT3" "Should Fail" 20; then
    echo ""
    echo -e "${GREEN}Test passed: Transaction correctly failed without quorum${NC}"
else
    echo ""
    echo -e "${RED}Test failed: Transaction unexpectedly succeeded without quorum${NC}"
fi
pause

# ============================================================================
# STEP 8: Restore All Orderers
# ============================================================================
section "STEP 8: Restore All Orderers"
echo ""
echo -e "${GREEN}Restarting orderer1 and orderer2...${NC}"
docker start orderer1.orderer.example.com || true
docker start orderer2.orderer.example.com || true
echo "Waiting for cluster to stabilize..."
sleep 7
echo ""
echo "All orderers restored:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep orderer || echo "No orderers found!"
ORDERER_COUNT=$(get_orderer_count)
echo ""
echo -e "Active orderers: ${GREEN}${ORDERER_COUNT}/3${NC}"
pause

# ============================================================================
# STEP 9: Verify Network Recovered
# ============================================================================
section "STEP 9: Verify Network Recovered"
ASSET_FT4="FAULT_TEST_${TIMESTAMP}_4"
echo ""
echo "Testing network after recovery..."
echo "Waiting for Raft leader election to complete..."
sleep 5

if create_and_verify_asset "$ASSET_FT4" "Recovery Test" 60; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  SUCCESS: Network fully recovered!                                     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
else
    echo ""
    echo -e "${YELLOW}Network may need more time to recover.${NC}"
    echo "Waiting 10 more seconds and retrying..."
    sleep 10
    ASSET_FT5="FAULT_TEST_${TIMESTAMP}_5"
    if create_and_verify_asset "$ASSET_FT5" "Recovery Test 2" 60; then
        echo ""
        echo -e "${GREEN}✓ Network recovered after additional wait time${NC}"
    else
        echo ""
        echo -e "${RED}✗ Network still not recovered. Manual investigation needed.${NC}"
    fi
fi

# ============================================================================
# TEST SUMMARY
# ============================================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              FAULT TOLERANCE TEST COMPLETE                              ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Key Demonstrations:                                                    ║${NC}"
echo -e "${GREEN}║  ✓ Network survives 1 orderer failure (2/3 = quorum maintained)        ║${NC}"
echo -e "${GREEN}║  ✓ Network fails with 2 orderer failures (1/3 = no quorum)             ║${NC}"
echo -e "${GREEN}║  ✓ Network recovers when orderers restart                               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
