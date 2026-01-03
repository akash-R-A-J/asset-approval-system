#!/bin/bash
# Copyright IBM Corp. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# Main Network Control Script
# Scripts are wrappers around Fabric binaries to reduce operator error
# and ensure consistent execution across environments.

# Source helper scripts
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

. scripts/envVar.sh

# Print help
function printHelp() {
  println "Usage: "
  println "  network.sh <Mode> [Flags]"
  println "    Modes:"
  println "      up           - Start the network with CAs, orderers, and peers"
  println "      down         - Stop and remove the network"
  println "      restart      - Restart the network"
  println "      createChannel - Create and join channel"
  println "      deployCC     - Deploy chaincode"
  println "      all          - Run up, createChannel, and deployCC"
  println ""
  println "    Flags:"
  println "      -v           - Verbose mode"
  println ""
  println "    Examples:"
  println "      network.sh up"
  println "      network.sh createChannel"
  println "      network.sh deployCC"
  println "      network.sh down"
}

# Check prerequisites
function checkPrereqs() {
  # Check for docker
  if ! command -v docker &> /dev/null; then
    errorln "Docker is not installed. Please install Docker first."
    exit 1
  fi

  # Check for docker-compose
  if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    errorln "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
  fi

  # Check docker is running
  if ! docker info &> /dev/null; then
    errorln "Docker daemon is not running. Please start Docker first."
    exit 1
  fi
}

# Create required directories
function createDirs() {
  mkdir -p organizations/peerOrganizations
  mkdir -p organizations/ordererOrganizations
  mkdir -p channel-artifacts
}

# Start Certificate Authorities
function startCAs() {
  infoln "Starting Certificate Authorities..."
  
  docker-compose -f docker/docker-compose-ca.yaml up -d 2>&1
  
  if [ $? -ne 0 ]; then
    errorln "Failed to start CAs"
    exit 1
  fi

  # Wait for CAs to start
  infoln "Waiting for CAs to start..."
  sleep 5

  # Check if CAs are running
  for ca in ca_org1 ca_org2 ca_org3 ca_orderer; do
    if ! docker ps | grep -q $ca; then
      errorln "CA $ca is not running"
      exit 1
    fi
  done

  successln "Certificate Authorities started"
}

# Enroll identities using Fabric CA
function enrollIdentities() {
  infoln "Enrolling identities..."
  
  # Source enrollment script
  . scripts/registerEnroll.sh

  # Create organizations
  createOrg1
  createOrg2
  createOrg3
  createOrderer

  successln "All identities enrolled"
}

# Start the network (peers, orderers, CouchDB)
function startNetwork() {
  infoln "Starting network containers..."
  
  docker-compose -f docker/docker-compose.yaml up -d 2>&1
  
  if [ $? -ne 0 ]; then
    errorln "Failed to start network"
    exit 1
  fi

  # Wait for containers to start
  infoln "Waiting for containers to start..."
  sleep 10

  # Check if all containers are running
  for container in orderer0.orderer.example.com orderer1.orderer.example.com orderer2.orderer.example.com \
                   peer0.org1.example.com peer0.org2.example.com peer0.org3.example.com \
                   couchdb0 couchdb1 couchdb2; do
    if ! docker ps | grep -q $container; then
      errorln "Container $container is not running"
      docker logs $container
      exit 1
    fi
  done

  successln "Network containers started"
}

# Bring up the network
function networkUp() {
  checkPrereqs
  createDirs

  # Start CAs first
  startCAs

  # Enroll identities
  enrollIdentities

  # Start network containers
  startNetwork

  successln "=============================================="
  successln "Network started successfully!"
  successln "=============================================="
}

# Create channel
function createChannel() {
  infoln "Creating channel..."
  . scripts/createChannel.sh
}

# Deploy chaincode
function deployChaincode() {
  infoln "Deploying chaincode..."
  . scripts/deployCC.sh
}

# Stop and remove the network
function networkDown() {
  infoln "Stopping network..."

  # Stop network containers
  docker-compose -f docker/docker-compose.yaml down --volumes --remove-orphans 2>&1
  
  # Stop CA containers
  docker-compose -f docker/docker-compose-ca.yaml down --volumes --remove-orphans 2>&1

  # Remove chaincode containers
  docker rm -f $(docker ps -aq --filter "name=dev-peer*") 2>/dev/null
  
  # Remove chaincode images
  docker rmi -f $(docker images -aq --filter "reference=dev-peer*") 2>/dev/null

  # Clean up generated files (suppress permission errors from CA-generated files)
  rm -rf organizations/peerOrganizations 2>/dev/null
  rm -rf organizations/ordererOrganizations 2>/dev/null
  
  # CA files - created by Docker as root, suppress errors
  rm -rf organizations/fabric-ca/org1/msp 2>/dev/null
  rm -rf organizations/fabric-ca/org1/tls-cert.pem 2>/dev/null
  rm -rf organizations/fabric-ca/org1/ca-cert.pem 2>/dev/null
  rm -rf organizations/fabric-ca/org1/IssuerPublicKey 2>/dev/null
  rm -rf organizations/fabric-ca/org1/IssuerRevocationPublicKey 2>/dev/null
  rm -rf organizations/fabric-ca/org1/fabric-ca-server.db 2>/dev/null
  rm -rf organizations/fabric-ca/org2/msp 2>/dev/null
  rm -rf organizations/fabric-ca/org2/tls-cert.pem 2>/dev/null
  rm -rf organizations/fabric-ca/org2/ca-cert.pem 2>/dev/null
  rm -rf organizations/fabric-ca/org2/IssuerPublicKey 2>/dev/null
  rm -rf organizations/fabric-ca/org2/IssuerRevocationPublicKey 2>/dev/null
  rm -rf organizations/fabric-ca/org2/fabric-ca-server.db 2>/dev/null
  rm -rf organizations/fabric-ca/org3/msp 2>/dev/null
  rm -rf organizations/fabric-ca/org3/tls-cert.pem 2>/dev/null
  rm -rf organizations/fabric-ca/org3/ca-cert.pem 2>/dev/null
  rm -rf organizations/fabric-ca/org3/IssuerPublicKey 2>/dev/null
  rm -rf organizations/fabric-ca/org3/IssuerRevocationPublicKey 2>/dev/null
  rm -rf organizations/fabric-ca/org3/fabric-ca-server.db 2>/dev/null
  rm -rf organizations/fabric-ca/ordererOrg/msp 2>/dev/null
  rm -rf organizations/fabric-ca/ordererOrg/tls-cert.pem 2>/dev/null
  rm -rf organizations/fabric-ca/ordererOrg/ca-cert.pem 2>/dev/null
  rm -rf organizations/fabric-ca/ordererOrg/IssuerPublicKey 2>/dev/null
  rm -rf organizations/fabric-ca/ordererOrg/IssuerRevocationPublicKey 2>/dev/null
  rm -rf organizations/fabric-ca/ordererOrg/fabric-ca-server.db 2>/dev/null
  rm -rf channel-artifacts 2>/dev/null
  rm -f ${CC_NAME}.tar.gz 2>/dev/null

  successln "Network stopped and cleaned"
}

# Parse command line arguments
MODE=$1
shift

# Parse flags
while [[ $# -ge 1 ]]; do
  key="$1"
  case $key in
    -v)
      VERBOSE=true
      ;;
    *)
      errorln "Unknown flag: $key"
      printHelp
      exit 1
      ;;
  esac
  shift
done

# Execute based on mode
case "$MODE" in
  up)
    networkUp
    ;;
  down)
    networkDown
    ;;
  restart)
    networkDown
    networkUp
    ;;
  createChannel)
    createChannel
    ;;
  deployCC)
    deployChaincode
    ;;
  all)
    networkUp
    sleep 5
    createChannel
    sleep 5
    deployChaincode
    ;;
  *)
    printHelp
    exit 1
    ;;
esac
