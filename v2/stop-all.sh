#!/bin/bash
# Stop all v2 components

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
$SCRIPT_DIR/scripts/stop-network.sh

echo "v2 system stopped"
