#!/bin/bash
# Master startup script for Asset Approval System v2

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=============================================="
echo "  Asset Approval System v2 - Full Startup"
echo "  (True ABAC, Org-Agnostic Design)"
echo "=============================================="
echo ""

# Start network
echo "Starting network..."
$SCRIPT_DIR/scripts/start-network.sh

# Deploy chaincode
echo ""
echo "Deploying chaincode..."
$SCRIPT_DIR/scripts/deploy-chaincode.sh

# Install client dependencies
echo ""
echo "Installing client dependencies..."
cd "$SCRIPT_DIR/client"
npm install

echo ""
echo "=============================================="
echo "  v2 System Ready!"
echo "=============================================="
echo ""
echo "Run demo: cd client && npm run demo"
echo ""
