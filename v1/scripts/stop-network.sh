#!/bin/bash
# Stop Network Script for Asset Approval System
# Note: Not using set -e since cleanup commands may fail if nothing exists

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

println() {
    echo -e "$1"
}

successln() {
    println "${GREEN}$1${NC}"
}

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NETWORK_DIR="$PROJECT_ROOT/network"
DOCKER_DIR="$NETWORK_DIR/docker"

println "=============================================="
println "  Asset Approval System - Stop Network"
println "=============================================="

# Stop containers (may fail if network not running)
cd "$DOCKER_DIR"
docker-compose down --volumes --remove-orphans 2>/dev/null || true

# Remove chaincode containers
docker rm -f $(docker ps -a -q --filter "name=dev-peer*") 2>/dev/null || true

# Remove chaincode images
docker rmi -f $(docker images -q --filter "reference=dev-peer*") 2>/dev/null || true

# Clean up crypto materials
cd "$NETWORK_DIR"
rm -rf organizations/peerOrganizations 2>/dev/null || true
rm -rf organizations/ordererOrganizations 2>/dev/null || true
rm -rf organizations/fabric-ca/org1/* 2>/dev/null || true
rm -rf organizations/fabric-ca/org2/* 2>/dev/null || true
rm -rf organizations/fabric-ca/org3/* 2>/dev/null || true
rm -rf channel-artifacts 2>/dev/null || true

# Clean up chaincode package
cd "$PROJECT_ROOT"
rm -f *.tar.gz 2>/dev/null || true

successln "=============================================="
successln "  Network Stopped and Cleaned Successfully!"
successln "=============================================="
