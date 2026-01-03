#!/bin/bash
# ============================================================================
# Hyperledger Fabric Asset Approval System - Security & Fault Tolerance Tests
# ============================================================================
# This script tests:
# 1. Access Control (OBAC) - Unauthorized operations should fail
# 2. State Machine - Finalized assets cannot be modified
# 3. Private Data - Only authorized orgs can access
# 4. Fault Tolerance - Network survives orderer failure (optional)
#
# Usage: ./run-tests.sh
# ============================================================================

# Enable strict error handling
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

# Suppress config warnings for clean test output
export SUPPRESS_CONFIG_WARNINGS=true

cd "$CLIENT_DIR" || {
    echo -e "${RED}ERROR: Cannot access client directory: $CLIENT_DIR${NC}"
    exit 1
}

# Test counters - use explicit assignment to avoid set -e issues
declare -i TESTS_PASSED=0
declare -i TESTS_FAILED=0
declare -i TESTS_TOTAL=0

# Increment function that handles set -e properly
increment_passed() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

increment_failed() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

# Test functions
function test_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    increment_passed
}

function test_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo -e "${RED}  Expected: $2${NC}"
    echo -e "${RED}  Got: $3${NC}"
    increment_failed
}

function test_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Execute test command and capture output
# Returns: 0 if command succeeded, 1 if failed
# Sets: TEST_OUTPUT variable with command output
run_test_command() {
    local cmd="$1"
    set +e  # Temporarily disable exit on error
    TEST_OUTPUT=$(eval "$cmd" 2>&1)
    local exit_code=$?
    set -e
    return $exit_code
}

# Generate unique test IDs
TIMESTAMP=$(date +%s)
ASSET_ACCESS="TEST_ACCESS_${TIMESTAMP}"
ASSET_STATE="TEST_STATE_${TIMESTAMP}"
ASSET_PDC="TEST_PDC_${TIMESTAMP}"

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║     HYPERLEDGER FABRIC - SECURITY & FAULT TOLERANCE TESTS              ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================================================
# TEST SUITE 1: ORGANIZATION-BASED ACCESS CONTROL (OBAC)
# ============================================================================
test_section "TEST SUITE 1: Access Control (OBAC)"

# Test 1.1: Org1 CAN create assets
echo -e "${YELLOW}Test 1.1: Org1 should be ALLOWED to create assets...${NC}"
if run_test_command "node src/app.js create ${ASSET_ACCESS} 'Access Control Test' org1 admin"; then
    if echo "$TEST_OUTPUT" | grep -q "Asset created successfully"; then
        test_pass "Org1 create asset - ALLOWED (expected)"
    else
        test_fail "Org1 create asset - command succeeded but no success message" "Asset created successfully" "$TEST_OUTPUT"
    fi
else
    test_fail "Org1 create asset - should be ALLOWED" "Exit code 0 and success message" "Exit code $?, Output: $TEST_OUTPUT"
fi

# Test 1.2: Org2 CANNOT create assets
echo -e "${YELLOW}Test 1.2: Org2 should be DENIED creating assets...${NC}"
if run_test_command "node src/app.js create '${ASSET_ACCESS}_ORG2' 'Unauthorized' org2 admin"; then
    # Command succeeded - this is unexpected
    test_fail "Org2 create asset - should be DENIED" "Error/Access Denied" "Command succeeded unexpectedly: $TEST_OUTPUT"
else
    # Command failed - expected
    if echo "$TEST_OUTPUT" | grep -qi "error\|denied\|org1"; then
        test_pass "Org2 create asset - DENIED (expected)"
    else
        test_fail "Org2 create asset - failed but no clear error message" "Error containing 'denied' or 'Org1'" "$TEST_OUTPUT"
    fi
fi

# Test 1.3: Org3 CANNOT create assets
echo -e "${YELLOW}Test 1.3: Org3 should be DENIED creating assets...${NC}"
if run_test_command "node src/app.js create '${ASSET_ACCESS}_ORG3' 'Unauthorized' org3 admin"; then
    test_fail "Org3 create asset - should be DENIED" "Error/Access Denied" "Command succeeded unexpectedly: $TEST_OUTPUT"
else
    if echo "$TEST_OUTPUT" | grep -qi "error\|denied\|org1"; then
        test_pass "Org3 create asset - DENIED (expected)"
    else
        test_fail "Org3 create asset - failed but no clear error message" "Error containing 'denied' or 'Org1'" "$TEST_OUTPUT"
    fi
fi

# Test 1.4: Org1 CANNOT approve assets
echo -e "${YELLOW}Test 1.4: Org1 should be DENIED approving assets...${NC}"
if run_test_command "node src/app.js approve ${ASSET_ACCESS} org1 admin"; then
    test_fail "Org1 approve asset - should be DENIED" "Error/Access Denied" "Command succeeded unexpectedly: $TEST_OUTPUT"
else
    if echo "$TEST_OUTPUT" | grep -qi "error\|denied\|org2\|org3"; then
        test_pass "Org1 approve asset - DENIED (expected)"
    else
        test_fail "Org1 approve asset - failed but no clear error message" "Error containing 'denied'" "$TEST_OUTPUT"
    fi
fi

# Test 1.5: Org2 CAN approve assets
echo -e "${YELLOW}Test 1.5: Org2 should be ALLOWED to approve assets...${NC}"
if run_test_command "node src/app.js approve ${ASSET_ACCESS} org2 admin"; then
    if echo "$TEST_OUTPUT" | grep -q "Asset approved successfully"; then
        test_pass "Org2 approve asset - ALLOWED (expected)"
    else
        test_fail "Org2 approve asset - command succeeded but no success message" "Asset approved successfully" "$TEST_OUTPUT"
    fi
else
    test_fail "Org2 approve asset - should be ALLOWED" "Exit code 0 and success message" "Exit code $?, Output: $TEST_OUTPUT"
fi

# Test 1.6: Org3 CAN approve assets
echo -e "${YELLOW}Test 1.6: Org3 should be ALLOWED to approve assets...${NC}"
if run_test_command "node src/app.js approve ${ASSET_ACCESS} org3 admin"; then
    if echo "$TEST_OUTPUT" | grep -q "Asset approved successfully"; then
        test_pass "Org3 approve asset - ALLOWED (expected)"
    else
        test_fail "Org3 approve asset - command succeeded but no success message" "Asset approved successfully" "$TEST_OUTPUT"
    fi
else
    test_fail "Org3 approve asset - should be ALLOWED" "Exit code 0 and success message" "Exit code $?, Output: $TEST_OUTPUT"
fi

# ============================================================================
# TEST SUITE 2: STATE MACHINE ENFORCEMENT
# ============================================================================
test_section "TEST SUITE 2: State Machine Enforcement"

# Create and approve an asset to get it to APPROVED state
echo -e "${YELLOW}Setting up: Creating and approving asset for state machine tests...${NC}"
run_test_command "node src/app.js create ${ASSET_STATE} 'State Machine Test' org1 admin" || true
run_test_command "node src/app.js approve ${ASSET_STATE} org2 admin" || true
run_test_command "node src/app.js approve ${ASSET_STATE} org3 admin" || true

# Test 2.1: Verify asset is APPROVED
echo -e "${YELLOW}Test 2.1: Asset should have APPROVED status...${NC}"
if run_test_command "node src/app.js query ${ASSET_STATE} org1 admin"; then
    if echo "$TEST_OUTPUT" | grep -q '"status": "APPROVED"'; then
        test_pass "Asset status is APPROVED (expected)"
    else
        test_fail "Asset status check" "status: APPROVED" "$TEST_OUTPUT"
    fi
else
    test_fail "Asset query failed" "Successful query" "Exit code $?, Output: $TEST_OUTPUT"
fi

# Test 2.2: Cannot approve already approved asset
echo -e "${YELLOW}Test 2.2: Re-approving an APPROVED asset should be DENIED...${NC}"
if run_test_command "node src/app.js approve ${ASSET_STATE} org2 admin"; then
    test_fail "Re-approve APPROVED asset - should be DENIED" "Error/Already approved" "Command succeeded unexpectedly: $TEST_OUTPUT"
else
    if echo "$TEST_OUTPUT" | grep -qi "error\|already\|approved"; then
        test_pass "Re-approve APPROVED asset - DENIED (expected)"
    else
        test_fail "Re-approve APPROVED asset - failed but no clear message" "Error about already approved" "$TEST_OUTPUT"
    fi
fi

# Test 2.3: Cannot reject approved asset
echo -e "${YELLOW}Test 2.3: Rejecting an APPROVED asset should be DENIED...${NC}"
if run_test_command "node src/app.js reject ${ASSET_STATE} 'Test rejection' org2 admin"; then
    test_fail "Reject APPROVED asset - should be DENIED" "Error/Cannot reject" "Command succeeded unexpectedly: $TEST_OUTPUT"
else
    if echo "$TEST_OUTPUT" | grep -qi "error\|approved\|cannot"; then
        test_pass "Reject APPROVED asset - DENIED (expected)"
    else
        test_fail "Reject APPROVED asset - failed but no clear message" "Error about cannot reject approved" "$TEST_OUTPUT"
    fi
fi

# ============================================================================
# TEST SUITE 3: REJECTION STATE MACHINE
# ============================================================================
test_section "TEST SUITE 3: Rejection State Machine"

ASSET_REJECT="TEST_REJECT_${TIMESTAMP}"

# Create asset for rejection test
echo -e "${YELLOW}Setting up: Creating asset for rejection tests...${NC}"
run_test_command "node src/app.js create ${ASSET_REJECT} 'Rejection Test' org1 admin" || true

# Test 3.1: Org2 can reject assets
echo -e "${YELLOW}Test 3.1: Org2 should be ALLOWED to reject pending assets...${NC}"
if run_test_command "node src/app.js reject ${ASSET_REJECT} 'Failed audit check' org2 admin"; then
    if echo "$TEST_OUTPUT" | grep -q "Asset rejected"; then
        test_pass "Org2 reject asset - ALLOWED (expected)"
    else
        test_fail "Org2 reject asset - command succeeded but no success message" "Asset rejected" "$TEST_OUTPUT"
    fi
else
    test_fail "Org2 reject asset - should be ALLOWED" "Exit code 0 and success message" "Exit code $?, Output: $TEST_OUTPUT"
fi

# Test 3.2: Verify asset is REJECTED
echo -e "${YELLOW}Test 3.2: Asset should have REJECTED status...${NC}"
if run_test_command "node src/app.js query ${ASSET_REJECT} org1 admin"; then
    if echo "$TEST_OUTPUT" | grep -q '"status": "REJECTED"'; then
        test_pass "Asset status is REJECTED (expected)"
    else
        test_fail "Asset status check" "status: REJECTED" "$TEST_OUTPUT"
    fi
else
    test_fail "Asset query failed" "Successful query" "Exit code $?, Output: $TEST_OUTPUT"
fi

# Test 3.3: Cannot approve rejected asset
echo -e "${YELLOW}Test 3.3: Approving a REJECTED asset should be DENIED...${NC}"
if run_test_command "node src/app.js approve ${ASSET_REJECT} org3 admin"; then
    test_fail "Approve REJECTED asset - should be DENIED" "Error/Cannot approve rejected" "Command succeeded unexpectedly: $TEST_OUTPUT"
else
    if echo "$TEST_OUTPUT" | grep -qi "error\|rejected\|cannot"; then
        test_pass "Approve REJECTED asset - DENIED (expected)"
    else
        test_fail "Approve REJECTED asset - failed but no clear message" "Error about cannot approve rejected" "$TEST_OUTPUT"
    fi
fi

# ============================================================================
# TEST SUITE 4: QUERY PERMISSIONS
# ============================================================================
test_section "TEST SUITE 4: Query Permissions (All Orgs Can Read)"

# Test 4.1: Org1 can query
echo -e "${YELLOW}Test 4.1: Org1 should be ALLOWED to query assets...${NC}"
if run_test_command "node src/app.js query ${ASSET_ACCESS} org1 admin"; then
    if echo "$TEST_OUTPUT" | grep -q '"assetID"'; then
        test_pass "Org1 query asset - ALLOWED (expected)"
    else
        test_fail "Org1 query asset - no asset data returned" "Asset data with assetID" "$TEST_OUTPUT"
    fi
else
    test_fail "Org1 query asset - command failed" "Exit code 0" "Exit code $?, Output: $TEST_OUTPUT"
fi

# Test 4.2: Org2 can query
echo -e "${YELLOW}Test 4.2: Org2 should be ALLOWED to query assets...${NC}"
if run_test_command "node src/app.js query ${ASSET_ACCESS} org2 admin"; then
    if echo "$TEST_OUTPUT" | grep -q '"assetID"'; then
        test_pass "Org2 query asset - ALLOWED (expected)"
    else
        test_fail "Org2 query asset - no asset data returned" "Asset data with assetID" "$TEST_OUTPUT"
    fi
else
    test_fail "Org2 query asset - command failed" "Exit code 0" "Exit code $?, Output: $TEST_OUTPUT"
fi

# Test 4.3: Org3 can query
echo -e "${YELLOW}Test 4.3: Org3 should be ALLOWED to query assets...${NC}"
if run_test_command "node src/app.js query ${ASSET_ACCESS} org3 admin"; then
    if echo "$TEST_OUTPUT" | grep -q '"assetID"'; then
        test_pass "Org3 query asset - ALLOWED (expected)"
    else
        test_fail "Org3 query asset - no asset data returned" "Asset data with assetID" "$TEST_OUTPUT"
    fi
else
    test_fail "Org3 query asset - command failed" "Exit code 0" "Exit code $?, Output: $TEST_OUTPUT"
fi

# ============================================================================
# TEST SUITE 5: PRIVATE DATA ACCESS CONTROL
# ============================================================================
test_section "TEST SUITE 5: Private Data Access Control"

# Create a new asset for private data testing
ASSET_PDC="TEST_PDC_${TIMESTAMP}"
echo -e "${YELLOW}Setting up: Creating asset for private data tests...${NC}"
run_test_command "node src/app.js create ${ASSET_PDC} 'Private Data Test Asset' org1 admin" || true

# Test 5.1: Org1 CAN query private data
echo -e "${YELLOW}Test 5.1: Org1 (Owner) should be ALLOWED to query private data...${NC}"
if run_test_command "node src/app.js queryPrivate ${ASSET_PDC} org1 admin"; then
    if echo "$TEST_OUTPUT" | grep -q '"assetID"\|"description"'; then
        test_pass "Org1 query private data - ALLOWED (expected)"
    else
        test_fail "Org1 query private data - no private data returned" "Private data with description" "$TEST_OUTPUT"
    fi
else
    test_fail "Org1 query private data - should be ALLOWED" "Exit code 0" "Exit code $?, Output: $TEST_OUTPUT"
fi

# Test 5.2: Org2 CAN query private data
echo -e "${YELLOW}Test 5.2: Org2 (Auditor) should be ALLOWED to query private data...${NC}"
if run_test_command "node src/app.js queryPrivate ${ASSET_PDC} org2 admin"; then
    if echo "$TEST_OUTPUT" | grep -q '"assetID"\|"description"'; then
        test_pass "Org2 query private data - ALLOWED (expected)"
    else
        test_fail "Org2 query private data - no private data returned" "Private data with description" "$TEST_OUTPUT"
    fi
else
    test_fail "Org2 query private data - should be ALLOWED" "Exit code 0" "Exit code $?, Output: $TEST_OUTPUT"
fi

# Test 5.3: Org3 CANNOT query private data
echo -e "${YELLOW}Test 5.3: Org3 (Regulator) should be DENIED querying private data...${NC}"
if run_test_command "node src/app.js queryPrivate ${ASSET_PDC} org3 admin"; then
    # Command succeeded - this is unexpected, Org3 should not have access
    test_fail "Org3 query private data - should be DENIED" "Error/Access Denied" "Command succeeded unexpectedly: $TEST_OUTPUT"
else
    # Command failed - expected
    if echo "$TEST_OUTPUT" | grep -qi "error\|denied\|access\|org1\|org2"; then
        test_pass "Org3 query private data - DENIED (expected)"
    else
        test_fail "Org3 query private data - failed but no clear error message" "Error containing 'denied' or 'access'" "$TEST_OUTPUT"
    fi
fi

# ============================================================================
# TEST RESULTS SUMMARY
# ============================================================================
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                        TEST RESULTS SUMMARY                             ${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Total Tests:  ${TESTS_TOTAL}"
echo -e "${GREEN}Passed:       ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed:       ${TESTS_FAILED}${NC}"
echo ""

if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    ALL TESTS PASSED! ✓                                  ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Security features verified:"
    echo "  ✓ Organization-Based Access Control (OBAC) enforced"
    echo "  ✓ State machine prevents modification of finalized assets"
    echo "  ✓ Query permissions work for all organizations"
    echo "  ✓ Private data access restricted to authorized organizations"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                    SOME TESTS FAILED! ✗                                 ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi

