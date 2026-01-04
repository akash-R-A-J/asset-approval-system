#!/bin/bash
# Stop Network Script for Asset Approval System v2

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NETWORK_DIR="$PROJECT_ROOT/network"
DOCKER_DIR="$NETWORK_DIR/docker"

echo "Stopping Asset Approval System v2..."

cd "$DOCKER_DIR"

# Stop containers
docker-compose down --volumes --remove-orphans

# Clean up
rm -rf "$NETWORK_DIR/organizations"
rm -rf "$NETWORK_DIR/channel-artifacts"
rm -f "$PROJECT_ROOT"/*.tar.gz

echo "Network stopped and cleaned up"
