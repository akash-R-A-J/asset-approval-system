#!/bin/bash
# ============================================================================
# Prerequisites Check Script
# Verifies all required tools are installed before running the system
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MISSING=0

println() {
    echo -e "$1"
}

check_command() {
    local cmd=$1
    local name=$2
    local min_version=$3
    
    if command -v "$cmd" &> /dev/null; then
        local version=$($cmd --version 2>/dev/null | head -n1 || echo "unknown")
        println "  ${GREEN}✓${NC} $name: $version"
        return 0
    else
        println "  ${RED}✗${NC} $name: NOT FOUND"
        MISSING=$((MISSING + 1))
        return 1
    fi
}

check_docker_compose() {
    if docker compose version &> /dev/null; then
        local version=$(docker compose version --short 2>/dev/null)
        println "  ${GREEN}✓${NC} Docker Compose: v$version"
        return 0
    elif command -v docker-compose &> /dev/null; then
        local version=$(docker-compose --version 2>/dev/null | head -n1)
        println "  ${GREEN}✓${NC} docker-compose: $version"
        return 0
    else
        println "  ${RED}✗${NC} Docker Compose: NOT FOUND"
        MISSING=$((MISSING + 1))
        return 1
    fi
}

check_fabric_binaries() {
    local fabric_bins=("peer" "configtxgen" "cryptogen" "osnadmin")
    local all_found=true
    
    for bin in "${fabric_bins[@]}"; do
        if command -v "$bin" &> /dev/null; then
            println "  ${GREEN}✓${NC} $bin: found"
        else
            println "  ${RED}✗${NC} $bin: NOT FOUND"
            MISSING=$((MISSING + 1))
            all_found=false
        fi
    done
    
    if [ "$all_found" = false ]; then
        println ""
        println "  ${YELLOW}TIP:${NC} Download Fabric binaries:"
        println "  curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh | bash -s -- binary"
        println "  Then add to PATH: export PATH=\$PATH:\$(pwd)/bin"
    fi
}

# ============================================================================
# Main
# ============================================================================

println ""
println "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
println "${BLUE}║       Asset Approval System - Prerequisites Check              ║${NC}"
println "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
println ""

# Docker
println "${YELLOW}Docker:${NC}"
check_command "docker" "Docker"
check_docker_compose
println ""

# Node.js
println "${YELLOW}Node.js:${NC}"
check_command "node" "Node.js"
check_command "npm" "npm"
println ""

# Fabric Binaries
println "${YELLOW}Hyperledger Fabric Binaries:${NC}"
check_fabric_binaries
println ""

# Optional
println "${YELLOW}Optional (for development):${NC}"
check_command "go" "Go" || true
MISSING=$((MISSING - 1)) # Go is optional, don't count as missing
println ""

# Summary
println "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $MISSING -eq 0 ]; then
    println "${GREEN}✓ All required prerequisites are installed!${NC}"
    println ""
    println "You can now run: ${BLUE}./start-all.sh${NC}"
    exit 0
else
    println "${RED}✗ Missing $MISSING required tool(s)${NC}"
    println ""
    println "Please install the missing tools and run this script again."
    println ""
    println "Quick install guides:"
    println "  Docker:  https://docs.docker.com/get-docker/"
    println "  Node.js: https://nodejs.org/ (v18+ recommended)"
    println "  Fabric:  curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh | bash -s -- binary"
    exit 1
fi
