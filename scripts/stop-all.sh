#!/bin/bash
# ============================================================================
# Stop the Hyperledger Fabric Network
# ============================================================================
# Usage: ./stop-all.sh
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Stopping Hyperledger Fabric network..."
cd "$PROJECT_ROOT/network"
./scripts/network.sh down

echo ""
echo "Network stopped successfully!"
echo "To start again, run: ./start-all.sh"
