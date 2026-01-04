#!/bin/bash
# Deploy Chaincode Script for Asset Approval System v2

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
CHANNEL_NAME="asset-channel"
CC_NAME="asset-approval"
CC_VERSION="2.0"
CC_SEQUENCE="1"

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NETWORK_DIR="$PROJECT_ROOT/network"
CC_DIR="$PROJECT_ROOT/chaincode/asset-approval"

export FABRIC_CFG_PATH="$NETWORK_DIR"

println() { echo -e "$1"; }
successln() { println "${GREEN}$1${NC}"; }
errorln() { println "${RED}$1${NC}"; }

# ===========================================================================
# Set Peer Environment
# ===========================================================================

setOrg1Peer() {
    export CORE_PEER_LOCALMSPID="Org1MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
    export CORE_PEER_ADDRESS=localhost:7051
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
    export CORE_PEER_TLS_ENABLED=true
}

setOrg2Peer() {
    export CORE_PEER_LOCALMSPID="Org2MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp"
    export CORE_PEER_ADDRESS=localhost:8051
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"
    export CORE_PEER_TLS_ENABLED=true
}

setOrg3Peer() {
    export CORE_PEER_LOCALMSPID="Org3MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp"
    export CORE_PEER_ADDRESS=localhost:9051
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt"
    export CORE_PEER_TLS_ENABLED=true
}

# ===========================================================================
# Build Chaincode
# ===========================================================================

buildChaincode() {
    println "Building chaincode..."
    
    cd "$CC_DIR"
    npm install
    npm run build
    
    successln "Chaincode built successfully"
}

# ===========================================================================
# Package Chaincode
# ===========================================================================

packageChaincode() {
    println "Packaging chaincode..."
    
    cd "$PROJECT_ROOT"
    
    # Remove old package
    rm -f ${CC_NAME}.tar.gz
    
    setOrg1Peer
    
    peer lifecycle chaincode package ${CC_NAME}.tar.gz \
        --path "$CC_DIR" \
        --lang node \
        --label ${CC_NAME}_${CC_VERSION}
    
    successln "Chaincode packaged successfully"
}

# ===========================================================================
# Install Chaincode on All Peers
# ===========================================================================

installChaincode() {
    println "Installing chaincode on all peers..."
    
    cd "$PROJECT_ROOT"
    
    # Install on Org1
    setOrg1Peer
    peer lifecycle chaincode install ${CC_NAME}.tar.gz
    println "Installed on Org1 peer0"
    
    # Install on Org2
    setOrg2Peer
    peer lifecycle chaincode install ${CC_NAME}.tar.gz
    println "Installed on Org2 peer0"
    
    # Install on Org3
    setOrg3Peer
    peer lifecycle chaincode install ${CC_NAME}.tar.gz
    println "Installed on Org3 peer0"
    
    successln "Chaincode installed on all peers"
}

# ===========================================================================
# Get Package ID
# ===========================================================================

getPackageID() {
    setOrg1Peer
    
    # Query installed chaincode and extract the full package ID
    # Format is: Package ID: asset-approval_2.0:84d74f7bba073...
    CC_PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json | jq -r ".installed_chaincodes[] | select(.label==\"${CC_NAME}_${CC_VERSION}\") | .package_id")
    
    if [ -z "$CC_PACKAGE_ID" ]; then
        errorln "Failed to get package ID"
        exit 1
    fi
    
    println "Package ID: $CC_PACKAGE_ID"
}

# ===========================================================================
# Approve Chaincode for Each Org
# ===========================================================================

approveChaincode() {
    println "Approving chaincode for all orgs..."
    
    # With Fabric CA, TLS certs are in tls/ directory, not msp/tlscacerts/
    ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"
    COLLECTIONS_CONFIG="$CC_DIR/collections_config.json"
    
    # Approve for Org1
    setOrg1Peer
    peer lifecycle chaincode approveformyorg \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls --cafile "$ORDERER_CA" \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --version $CC_VERSION \
        --package-id $CC_PACKAGE_ID \
        --sequence $CC_SEQUENCE \
        --collections-config "$COLLECTIONS_CONFIG"
    println "Org1 approved"
    
    # Approve for Org2
    setOrg2Peer
    peer lifecycle chaincode approveformyorg \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls --cafile "$ORDERER_CA" \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --version $CC_VERSION \
        --package-id $CC_PACKAGE_ID \
        --sequence $CC_SEQUENCE \
        --collections-config "$COLLECTIONS_CONFIG"
    println "Org2 approved"
    
    # Approve for Org3
    setOrg3Peer
    peer lifecycle chaincode approveformyorg \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls --cafile "$ORDERER_CA" \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --version $CC_VERSION \
        --package-id $CC_PACKAGE_ID \
        --sequence $CC_SEQUENCE \
        --collections-config "$COLLECTIONS_CONFIG"
    println "Org3 approved"
    
    successln "Chaincode approved by all orgs"
}

# ===========================================================================
# Commit Chaincode
# ===========================================================================

commitChaincode() {
    println "Committing chaincode..."
    
    # With Fabric CA, TLS certs are in tls/ directory, not msp/tlscacerts/
    ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"
    COLLECTIONS_CONFIG="$CC_DIR/collections_config.json"
    
    ORG1_TLS="$NETWORK_DIR/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
    ORG2_TLS="$NETWORK_DIR/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"
    ORG3_TLS="$NETWORK_DIR/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt"
    
    setOrg1Peer
    
    peer lifecycle chaincode commit \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --tls --cafile "$ORDERER_CA" \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --version $CC_VERSION \
        --sequence $CC_SEQUENCE \
        --collections-config "$COLLECTIONS_CONFIG" \
        --peerAddresses localhost:7051 --tlsRootCertFiles "$ORG1_TLS" \
        --peerAddresses localhost:8051 --tlsRootCertFiles "$ORG2_TLS" \
        --peerAddresses localhost:9051 --tlsRootCertFiles "$ORG3_TLS"
    
    successln "Chaincode committed successfully"
}

# ===========================================================================
# Verify Deployment
# ===========================================================================

verifyDeployment() {
    println "Verifying deployment..."
    
    setOrg1Peer
    
    peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME --name $CC_NAME
    
    successln "Chaincode verified"
}

# ===========================================================================
# Main
# ===========================================================================

main() {
    println "=============================================="
    println "  Asset Approval System v2 - Deploy Chaincode"
    println "  (True ABAC, Org-Agnostic Design)"
    println "=============================================="
    
    buildChaincode
    packageChaincode
    installChaincode
    getPackageID
    approveChaincode
    commitChaincode
    verifyDeployment
    
    println ""
    successln "=============================================="
    successln "  Chaincode Deployed Successfully!"
    successln "=============================================="
    println ""
    println "Chaincode: $CC_NAME"
    println "Version: $CC_VERSION"
    println "Channel: $CHANNEL_NAME"
    println ""
    println "Next: Run 'npm run demo' from client directory"
}

main "$@"
