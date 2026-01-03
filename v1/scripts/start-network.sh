#!/bin/bash
# Start Network Script for Asset Approval System
# Generates crypto materials, starts containers, creates channel, joins peers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CHANNEL_NAME="asset-channel"
DELAY=3
MAX_RETRY=5
VERBOSE=false

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NETWORK_DIR="$PROJECT_ROOT/network"
DOCKER_DIR="$NETWORK_DIR/docker"

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

# ===========================================================================
# Generate Crypto Materials
# ===========================================================================

generateCryptoMaterials() {
    println "Generating crypto materials..."
    
    cd "$NETWORK_DIR"
    
    # Generate using cryptogen
    if [ -d "organizations" ]; then
        rm -rf organizations
    fi
    
    cryptogen generate --config=crypto-config.yaml --output=organizations
    
    if [ $? -ne 0 ]; then
        errorln "Failed to generate crypto materials"
        exit 1
    fi
    
    successln "Crypto materials generated successfully"
}

# ===========================================================================
# Generate Genesis Block and Channel TX
# ===========================================================================

generateChannelArtifacts() {
    println "Generating channel artifacts..."
    
    cd "$NETWORK_DIR"
    
    # Clean up and recreate channel-artifacts directory
    rm -rf channel-artifacts 2>/dev/null || true
    # Only mkdir if it doesn't exist (workaround for WSL1 bug)
    [ ! -d "channel-artifacts" ] && mkdir channel-artifacts || true
    
    # For Fabric 2.5+ with channel participation mode, we create channel genesis block directly
    # (No system channel needed)
    configtxgen -profile AssetChannel -outputBlock ./channel-artifacts/${CHANNEL_NAME}.block -channelID $CHANNEL_NAME
    
    if [ $? -ne 0 ]; then
        errorln "Failed to generate channel genesis block"
        exit 1
    fi
    
    # Generate anchor peer updates
    configtxgen -profile AssetChannel -outputAnchorPeersUpdate ./channel-artifacts/Org1MSPanchors.tx -channelID $CHANNEL_NAME -asOrg Org1MSP
    configtxgen -profile AssetChannel -outputAnchorPeersUpdate ./channel-artifacts/Org2MSPanchors.tx -channelID $CHANNEL_NAME -asOrg Org2MSP
    configtxgen -profile AssetChannel -outputAnchorPeersUpdate ./channel-artifacts/Org3MSPanchors.tx -channelID $CHANNEL_NAME -asOrg Org3MSP
    
    successln "Channel artifacts generated successfully"
}

# ===========================================================================
# Create Fabric CA directories
# ===========================================================================

createCADirectories() {
    println "Creating Fabric CA directories..."
    
    mkdir -p "$NETWORK_DIR/organizations/fabric-ca/org1"
    mkdir -p "$NETWORK_DIR/organizations/fabric-ca/org2"
    mkdir -p "$NETWORK_DIR/organizations/fabric-ca/org3"
    
    # Copy TLS certs for CAs
    for ORG in 1 2 3; do
        cp "$NETWORK_DIR/organizations/peerOrganizations/org${ORG}.example.com/ca/"* \
           "$NETWORK_DIR/organizations/fabric-ca/org${ORG}/" 2>/dev/null || true
    done
    
    successln "CA directories created"
}

# ===========================================================================
# Start Docker Containers
# ===========================================================================

startContainers() {
    println "Starting Docker containers..."
    
    cd "$DOCKER_DIR"
    
    docker-compose up -d
    
    if [ $? -ne 0 ]; then
        errorln "Failed to start containers"
        exit 1
    fi
    
    # Wait for containers to be ready
    println "Waiting for containers to start..."
    sleep 10
    
    # Check container status
    docker-compose ps
    
    successln "Containers started successfully"
}

# ===========================================================================
# Create Channel
# ===========================================================================

createChannel() {
    println "Creating channel: $CHANNEL_NAME..."
    
    CHANNEL_BLOCK="$NETWORK_DIR/channel-artifacts/${CHANNEL_NAME}.block"
    ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
    
    # Join orderer1 to channel using osnadmin
    println "Joining orderer.example.com to channel..."
    ORDERER1_ADMIN_TLS_SIGN_CERT="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt"
    ORDERER1_ADMIN_TLS_PRIVATE_KEY="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.key"
    
    osnadmin channel join --channelID $CHANNEL_NAME \
        --config-block "$CHANNEL_BLOCK" \
        -o localhost:7053 \
        --ca-file "$ORDERER_CA" \
        --client-cert "$ORDERER1_ADMIN_TLS_SIGN_CERT" \
        --client-key "$ORDERER1_ADMIN_TLS_PRIVATE_KEY"
    
    if [ $? -ne 0 ]; then
        errorln "Failed to join orderer1 to channel"
        exit 1
    fi
    
    # Join orderer2 to channel
    println "Joining orderer2.example.com to channel..."
    ORDERER2_CA="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer2.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
    ORDERER2_ADMIN_TLS_SIGN_CERT="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer2.example.com/tls/server.crt"
    ORDERER2_ADMIN_TLS_PRIVATE_KEY="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer2.example.com/tls/server.key"
    
    osnadmin channel join --channelID $CHANNEL_NAME \
        --config-block "$CHANNEL_BLOCK" \
        -o localhost:8053 \
        --ca-file "$ORDERER2_CA" \
        --client-cert "$ORDERER2_ADMIN_TLS_SIGN_CERT" \
        --client-key "$ORDERER2_ADMIN_TLS_PRIVATE_KEY"
    
    # Join orderer3 to channel
    println "Joining orderer3.example.com to channel..."
    ORDERER3_CA="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer3.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
    ORDERER3_ADMIN_TLS_SIGN_CERT="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer3.example.com/tls/server.crt"
    ORDERER3_ADMIN_TLS_PRIVATE_KEY="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer3.example.com/tls/server.key"
    
    osnadmin channel join --channelID $CHANNEL_NAME \
        --config-block "$CHANNEL_BLOCK" \
        -o localhost:9053 \
        --ca-file "$ORDERER3_CA" \
        --client-cert "$ORDERER3_ADMIN_TLS_SIGN_CERT" \
        --client-key "$ORDERER3_ADMIN_TLS_PRIVATE_KEY"
    
    successln "Channel created successfully"
}

# ===========================================================================
# Join Peers to Channel
# ===========================================================================

joinChannel() {
    println "Joining peers to channel..."
    
    CHANNEL_BLOCK="$NETWORK_DIR/channel-artifacts/${CHANNEL_NAME}.block"
    
    # Join Org1 peers
    export CORE_PEER_LOCALMSPID="Org1MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
    
    for PEER_PORT in 7051 7151 7251; do
        export CORE_PEER_ADDRESS=localhost:$PEER_PORT
        export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
        
        peer channel join -b $CHANNEL_BLOCK
        println "Org1 peer on port $PEER_PORT joined channel"
    done
    
    # Join Org2 peers
    export CORE_PEER_LOCALMSPID="Org2MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp"
    
    for PEER_PORT in 8051 8151 8251; do
        export CORE_PEER_ADDRESS=localhost:$PEER_PORT
        export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"
        
        peer channel join -b $CHANNEL_BLOCK
        println "Org2 peer on port $PEER_PORT joined channel"
    done
    
    # Join Org3 peers
    export CORE_PEER_LOCALMSPID="Org3MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp"
    
    for PEER_PORT in 9051 9151 9251; do
        export CORE_PEER_ADDRESS=localhost:$PEER_PORT
        export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt"
        
        peer channel join -b $CHANNEL_BLOCK
        println "Org3 peer on port $PEER_PORT joined channel"
    done
    
    successln "All peers joined channel successfully"
}

# ===========================================================================
# Set Anchor Peers
# ===========================================================================

setAnchorPeers() {
    # Note: Anchor peers are optional for basic functionality
    # In channel participation mode, the traditional anchor peer update method
    # requires additional config update transactions. Skipping for now.
    println "Skipping anchor peer configuration (optional for demo)..."
    successln "Network setup complete - anchor peers can be configured later if needed"
}

# ===========================================================================
# Main
# ===========================================================================

main() {
    println "=============================================="
    println "  Asset Approval System - Network Startup"
    println "=============================================="
    
    generateCryptoMaterials
    generateChannelArtifacts
    createCADirectories
    startContainers
    
    # Wait for orderer to be ready
    println "Waiting for orderer to be ready..."
    sleep 5
    
    createChannel
    joinChannel
    setAnchorPeers
    
    println ""
    successln "=============================================="
    successln "  Network Started Successfully!"
    successln "=============================================="
    println ""
    println "Channel: $CHANNEL_NAME"
    println "Orgs: Org1 (Asset Owner), Org2 (Auditor), Org3 (Regulator)"
    println "Peers: 3 per org (9 total)"
    println "Orderers: 3 (Raft cluster)"
    println ""
    println "Next: Run deploy-chaincode.sh to deploy the chaincode"
}

main "$@"
