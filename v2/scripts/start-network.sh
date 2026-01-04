#!/bin/bash
# Start Network Script for Asset Approval System v2
# Uses Fabric CA for certificate generation (NOT cryptogen)
# This enables True ABAC with role attributes in X.509 certificates

set -e

# Source environment and helper functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
. "$SCRIPT_DIR/envVar.sh"

NETWORK_DIR="$PROJECT_ROOT/network"
DOCKER_DIR="$NETWORK_DIR/docker"

export FABRIC_CFG_PATH="$NETWORK_DIR"

# ===========================================================================
# Start CA Containers First
# ===========================================================================

startCAContainers() {
    println "Starting ALL Certificate Authority containers..."
    
    cd "$DOCKER_DIR"
    
    # Copy env.example to .env if not exists
    if [ ! -f ".env" ]; then
        cp env.example .env
    fi
    
    # Start ALL CA containers including orderer CA (100% Fabric CA based)
    docker-compose up -d ca.org1.example.com ca.org2.example.com ca.org3.example.com ca.orderer.example.com
    
    infoln "Waiting for CAs to start..."
    sleep 5
    
    # Verify CAs are running
    for CA in ca.org1.example.com ca.org2.example.com ca.org3.example.com ca.orderer.example.com; do
        if ! docker ps | grep -q $CA; then
            errorln "$CA failed to start"
        fi
    done
    
    successln "All CA containers started successfully"
}

# ===========================================================================
# Initialize Fabric CA Directories
# ===========================================================================

initializeCADirectories() {
    println "Initializing Fabric CA directories..."
    
    cd "$NETWORK_DIR"
    
    # Create CA config directories if they don't exist
    mkdir -p organizations/fabric-ca/org1
    mkdir -p organizations/fabric-ca/org2
    mkdir -p organizations/fabric-ca/org3
    mkdir -p organizations/fabric-ca/ordererOrg
    
    # Wait for CAs to generate their certs
    sleep 3
    
    # Copy CA certs from peer org containers
    for ORG_NUM in 1 2 3; do
        docker cp ca.org${ORG_NUM}.example.com:/etc/hyperledger/fabric-ca-server/ca-cert.pem \
            organizations/fabric-ca/org${ORG_NUM}/ca-cert.pem 2>/dev/null || true
    done
    
    # Copy CA cert from orderer CA container
    docker cp ca.orderer.example.com:/etc/hyperledger/fabric-ca-server/ca-cert.pem \
        organizations/fabric-ca/ordererOrg/ca-cert.pem 2>/dev/null || true
    
    successln "CA directories initialized"
}

# ===========================================================================
# Enroll Orderer Identities via Fabric CA (100% CA-based, no cryptogen!)
# ===========================================================================

enrollOrdererIdentities() {
    println "Enrolling orderer identities via Fabric CA..."
    
    cd "$NETWORK_DIR"
    
    # Source the registerEnroll script functions and call createOrderer
    . "$SCRIPT_DIR/registerEnroll.sh"
    createOrderer
    
    successln "Orderer identities enrolled via Fabric CA"
}

# ===========================================================================
# Register and Enroll Identities with Role Attributes
# ===========================================================================

registerAndEnrollIdentities() {
    println "Registering and enrolling identities with role attributes..."
    
    cd "$NETWORK_DIR"
    
    # Source the registerEnroll script functions
    . "$SCRIPT_DIR/registerEnroll.sh"
    
    # Create identities for each org
    createOrg1
    createOrg2
    createOrg3
    
    successln "All identities enrolled with role attributes"
}

# ===========================================================================
# Generate Channel Artifacts
# ===========================================================================

generateChannelArtifacts() {
    println "Generating channel artifacts..."
    
    cd "$NETWORK_DIR"
    
    rm -rf channel-artifacts 2>/dev/null || true
    [ ! -d "channel-artifacts" ] && mkdir channel-artifacts || true
    
    configtxgen -profile AssetChannel -outputBlock ./channel-artifacts/${CHANNEL_NAME}.block -channelID $CHANNEL_NAME
    
    if [ $? -ne 0 ]; then
        errorln "Failed to generate channel genesis block"
    fi
    
    successln "Channel artifacts generated successfully"
}

# ===========================================================================
# Start Remaining Containers
# ===========================================================================

startRemainingContainers() {
    println "Starting orderers, peers, and CouchDB..."
    
    cd "$DOCKER_DIR"
    
    docker-compose up -d
    
    println "Waiting for containers to start..."
    sleep 10
    
    docker-compose ps
    
    successln "All containers started"
}

# ===========================================================================
# Create Channel
# ===========================================================================

createChannel() {
    println "Creating channel: $CHANNEL_NAME..."
    
    CHANNEL_BLOCK="$NETWORK_DIR/channel-artifacts/${CHANNEL_NAME}.block"
    
    # With Fabric CA, TLS certs are in tls/ directory, not msp/tlscacerts/
    ORDERER_CA="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"
    
    # Join orderers to channel
    for ORDERER_PORT in 7053 8053 9053; do
        ORDERER_NUM=$((($ORDERER_PORT - 7053) / 1000 + 1))
        if [ $ORDERER_NUM -eq 1 ]; then 
            ORDERER_NAME="orderer"
        else
            ORDERER_NAME="orderer${ORDERER_NUM}"
        fi
        
        TLS_CERT="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/${ORDERER_NAME}.example.com/tls/server.crt"
        TLS_KEY="$NETWORK_DIR/organizations/ordererOrganizations/example.com/orderers/${ORDERER_NAME}.example.com/tls/server.key"
        
        osnadmin channel join --channelID $CHANNEL_NAME \
            --config-block "$CHANNEL_BLOCK" \
            -o localhost:$ORDERER_PORT \
            --ca-file "$ORDERER_CA" \
            --client-cert "$TLS_CERT" \
            --client-key "$TLS_KEY" || true
            
        println "Joined ${ORDERER_NAME} to channel"
    done
    
    successln "Channel created"
}

# ===========================================================================
# Join Peers to Channel
# ===========================================================================

joinChannel() {
    println "Joining peers to channel..."
    
    CHANNEL_BLOCK="$NETWORK_DIR/channel-artifacts/${CHANNEL_NAME}.block"
    
    # Join Org1 peer
    export CORE_PEER_LOCALMSPID="Org1MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
    export CORE_PEER_ADDRESS=localhost:7051
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
    export CORE_PEER_TLS_ENABLED=true
    
    peer channel join -b $CHANNEL_BLOCK
    println "Org1 peer0 joined channel"
    
    # Join Org2 peer
    export CORE_PEER_LOCALMSPID="Org2MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp"
    export CORE_PEER_ADDRESS=localhost:8051
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"
    
    peer channel join -b $CHANNEL_BLOCK
    println "Org2 peer0 joined channel"
    
    # Join Org3 peer
    export CORE_PEER_LOCALMSPID="Org3MSP"
    export CORE_PEER_MSPCONFIGPATH="$NETWORK_DIR/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp"
    export CORE_PEER_ADDRESS=localhost:9051
    export CORE_PEER_TLS_ROOTCERT_FILE="$NETWORK_DIR/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt"
    
    peer channel join -b $CHANNEL_BLOCK
    println "Org3 peer0 joined channel"
    
    successln "All peers joined channel"
}

# ===========================================================================
# Main
# ===========================================================================

main() {
    println "=============================================="
    println "  Asset Approval System v2 - Network Startup"
    println "  100% Fabric CA Based (No cryptogen!)"
    println "=============================================="
    
    startCAContainers
    initializeCADirectories
    enrollOrdererIdentities
    registerAndEnrollIdentities
    generateChannelArtifacts
    startRemainingContainers
    
    println "Waiting for orderer to be ready..."
    sleep 5
    
    createChannel
    joinChannel
    
    println ""
    successln "=============================================="
    successln "  Network Started Successfully!"
    successln "=============================================="
    println ""
    println "Channel: $CHANNEL_NAME"
    println "100% Fabric CA Based - All identities enrolled via CA"
    println "Role Attributes in Certificates:"
    println "  - Org1: role=owner"
    println "  - Org2: role=auditor"
    println "  - Org3: role=regulator"
    println ""
    println "Next: Run deploy-chaincode.sh to deploy the chaincode"
}

main "$@"
