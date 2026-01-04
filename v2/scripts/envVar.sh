#!/bin/bash
# Copyright IBM Corp. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# Environment variables for v2 scripts

# Colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export NC='\033[0m'

# Helper functions
println() {
    echo -e "$1"
}

infoln() {
    echo -e "${YELLOW}$1${NC}"
}

successln() {
    echo -e "${GREEN}$1${NC}"
}

errorln() {
    echo -e "${RED}$1${NC}"
    exit 1
}

warnln() {
    echo -e "${YELLOW}$1${NC}"
}

# Configuration
export CHANNEL_NAME="asset-channel"
export CC_NAME="asset-approval"
export CC_VERSION="2.0"

# Paths
export SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
export NETWORK_DIR="$PROJECT_ROOT/network"
export FABRIC_CFG_PATH="$NETWORK_DIR"
