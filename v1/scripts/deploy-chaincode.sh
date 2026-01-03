#!/bin/bash
# Deploy Chaincode Script for Asset Approval System
# Packages, installs, approves, and commits chaincode

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
CHANNEL_NAME="asset-channel"
CC_NAME="asset-approval"
CC_VERSION="1.0"
CC_SEQUENCE="1"
CC_INIT_FCN=""
CC_END_POLICY="AND('Org1MSP.peer',OR('Org2MSP.peer','Org3MSP.peer'))"

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NETWORK_DIR="$PROJECT_ROOT/network"
CHAINCODE_DIR="$PROJECT_ROOT/chaincode/asset-approval"
CC_COLL_CONFIG="$PROJECT_ROOT/chaincode/asset-approval/collections_config.json"

export FABRIC_CFG_PATH="$NETWORK_DIR"

# ===========================================================================
# Helper Functions
# ===========================================================================

println() {
    echo -e "$1"
}

successln() {
    println "${GREEN}$1${NC}"
}

errorln() {
    println "${RED}$1${NC}"
}

warnln() {
    println "${YELLOW}$1${NC}"
}

setOrgEnv() {
    local ORG=$1
    local PEER_PORT=$2
    
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="Org${ORG}MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/org${ORG}.example.com/peers/peer0.org${ORG}.example.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/org${ORG}.example.com/users/Admin@org${ORG}.example.com/msp"
    export CORE_PEER_ADDRESS=localhost:$PEER_PORT
}

# ===========================================================================
# Package Chaincode
# ===========================================================================

packageChaincode() {
    println "Packaging chaincode (TypeScript)..."
    
    cd "$CHAINCODE_DIR"
    
    # Install npm dependencies and build TypeScript
    npm install
    npm run build
    
    cd "$PROJECT_ROOT"
    
    # Package chaincode as node
    peer lifecycle chaincode package ${CC_NAME}.tar.gz \
        --path ./chaincode/asset-approval \
        --lang node \
        --label ${CC_NAME}_${CC_VERSION}
    
    if [ $? -ne 0 ]; then
        errorln "Failed to package chaincode"
        exit 1
    fi
    
    successln "Chaincode packaged successfully"
}

# ===========================================================================
# Install Chaincode on Endorsing and Query Peers
# ===========================================================================

installChaincode() {
    println "Installing chaincode on endorsing and query peers..."
    
    cd "$PROJECT_ROOT"
    
    export ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
    
    # Install on Org1 peers (peer0 - endorser, peer1 - query)
    for PEER_PORT in 7051 7151; do
        setOrgEnv 1 $PEER_PORT
        peer lifecycle chaincode install ${CC_NAME}.tar.gz
        println "Installed on Org1 peer port $PEER_PORT"
    done
    
    # Install on Org2 peers
    for PEER_PORT in 8051 8151; do
        setOrgEnv 2 $PEER_PORT
        peer lifecycle chaincode install ${CC_NAME}.tar.gz
        println "Installed on Org2 peer port $PEER_PORT"
    done
    
    # Install on Org3 peers
    for PEER_PORT in 9051 9151; do
        setOrgEnv 3 $PEER_PORT
        peer lifecycle chaincode install ${CC_NAME}.tar.gz
        println "Installed on Org3 peer port $PEER_PORT"
    done
    
    successln "Chaincode installed on all endorsing and query peers"
}

# ===========================================================================
# Get Package ID
# ===========================================================================

getPackageId() {
    setOrgEnv 1 7051
    
    peer lifecycle chaincode queryinstalled >&log.txt
    PACKAGE_ID=$(sed -n "/${CC_NAME}_${CC_VERSION}/{s/^Package ID: //; s/, Label:.*$//; p;}" log.txt)
    rm log.txt
    
    if [ -z "$PACKAGE_ID" ]; then
        errorln "Failed to get package ID"
        exit 1
    fi
    
    println "Package ID: $PACKAGE_ID"
}

# ===========================================================================
# Approve Chaincode for Orgs
# ===========================================================================

approveChaincode() {
    println "Approving chaincode for organizations..."
    
    export ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
    
    cd "$PROJECT_ROOT"
    
    # Approve for Org1
    setOrgEnv 1 7051
    peer lifecycle chaincode approveformyorg \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --version $CC_VERSION \
        --package-id $PACKAGE_ID \
        --sequence $CC_SEQUENCE \
        --signature-policy "$CC_END_POLICY" \
        --collections-config "$CC_COLL_CONFIG" \
        --tls \
        --cafile "$ORDERER_CA"
    
    println "Org1 approved chaincode"
    
    # Approve for Org2
    setOrgEnv 2 8051
    peer lifecycle chaincode approveformyorg \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --version $CC_VERSION \
        --package-id $PACKAGE_ID \
        --sequence $CC_SEQUENCE \
        --signature-policy "$CC_END_POLICY" \
        --collections-config "$CC_COLL_CONFIG" \
        --tls \
        --cafile "$ORDERER_CA"
    
    println "Org2 approved chaincode"
    
    # Approve for Org3
    setOrgEnv 3 9051
    peer lifecycle chaincode approveformyorg \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --version $CC_VERSION \
        --package-id $PACKAGE_ID \
        --sequence $CC_SEQUENCE \
        --signature-policy "$CC_END_POLICY" \
        --collections-config "$CC_COLL_CONFIG" \
        --tls \
        --cafile "$ORDERER_CA"
    
    println "Org3 approved chaincode"
    
    successln "All organizations approved chaincode"
}

# ===========================================================================
# Check Commit Readiness
# ===========================================================================

checkCommitReadiness() {
    println "Checking commit readiness..."
    
    setOrgEnv 1 7051
    
    peer lifecycle chaincode checkcommitreadiness \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --version $CC_VERSION \
        --sequence $CC_SEQUENCE \
        --signature-policy "$CC_END_POLICY" \
        --collections-config "$CC_COLL_CONFIG" \
        --output json
    
    successln "Commit readiness check passed"
}

# ===========================================================================
# Commit Chaincode
# ===========================================================================

commitChaincode() {
    println "Committing chaincode..."
    
    export ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
    
    cd "$PROJECT_ROOT"
    
    setOrgEnv 1 7051
    
    peer lifecycle chaincode commit \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer.example.com \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME \
        --version $CC_VERSION \
        --sequence $CC_SEQUENCE \
        --signature-policy "$CC_END_POLICY" \
        --collections-config "$CC_COLL_CONFIG" \
        --tls \
        --cafile "$ORDERER_CA" \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles "$NETWORK_DIR/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
        --peerAddresses localhost:8051 \
        --tlsRootCertFiles "$NETWORK_DIR/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
        --peerAddresses localhost:9051 \
        --tlsRootCertFiles "$NETWORK_DIR/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt"
    
    if [ $? -ne 0 ]; then
        errorln "Failed to commit chaincode"
        exit 1
    fi
    
    successln "Chaincode committed successfully"
}

# ===========================================================================
# Query Committed Chaincode
# ===========================================================================

queryCommitted() {
    println "Querying committed chaincode..."
    
    setOrgEnv 1 7051
    
    peer lifecycle chaincode querycommitted \
        --channelID $CHANNEL_NAME \
        --name $CC_NAME
    
    successln "Chaincode query successful"
}

# ===========================================================================
# Main
# ===========================================================================

main() {
    println "=============================================="
    println "  Asset Approval System - Deploy Chaincode"
    println "=============================================="
    println ""
    println "Chaincode: $CC_NAME"
    println "Version: $CC_VERSION"
    println "Channel: $CHANNEL_NAME"
    println "Endorsement: $CC_END_POLICY"
    println ""
    
    packageChaincode
    installChaincode
    getPackageId
    approveChaincode
    checkCommitReadiness
    commitChaincode
    queryCommitted
    
    println ""
    successln "=============================================="
    successln "  Chaincode Deployed Successfully!"
    successln "=============================================="
    println ""
    println "Endorsement Policy: AND(Org1, OR(Org2, Org3))"
    println "PDC: assetPrivateOrg1Org2 (Org1 + Org2 only)"
    println ""
    println "Next: Run the client application or demo.sh"
}

main "$@"
