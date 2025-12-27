#!/bin/bash
# Copyright IBM Corp. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# Environment variables script for switching organization context
# Scripts are wrappers around Fabric binaries to reduce operator error

# Color codes for output
C_RESET='\033[0m'
C_RED='\033[0;31m'
C_GREEN='\033[0;32m'
C_BLUE='\033[0;34m'
C_YELLOW='\033[1;33m'

# Print functions
function println() {
  echo -e "$1"
}

function errorln() {
  println "${C_RED}${1}${C_RESET}"
}

function successln() {
  println "${C_GREEN}${1}${C_RESET}"
}

function infoln() {
  println "${C_BLUE}${1}${C_RESET}"
}

function warnln() {
  println "${C_YELLOW}${1}${C_RESET}"
}

# Versions
export FABRIC_VERSION=2.5
export CA_VERSION=1.5

# Network configuration
export CHANNEL_NAME="asset-channel"
export CHAINCODE_NAME="assetcc"
export CHAINCODE_VERSION="1.0"
export CHAINCODE_SEQUENCE=1

# Paths - scripts are executed from network/ directory
export FABRIC_CFG_PATH=${PWD}/peercfg
export ORDERER_CA=${PWD}/organizations/ordererOrganizations/orderer.example.com/tlsca/tlsca.orderer.example.com-cert.pem

# Set global variables for peer CLI based on organization number
# Usage: setGlobals <ORG_NUMBER>
function setGlobals() {
  local USING_ORG=$1
  infoln "Using organization ${USING_ORG}"
  
  if [ $USING_ORG -eq 1 ]; then
    export CORE_PEER_LOCALMSPID="Org1MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
    export CORE_PEER_ADDRESS=localhost:7051
  elif [ $USING_ORG -eq 2 ]; then
    export CORE_PEER_LOCALMSPID="Org2MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
    export CORE_PEER_ADDRESS=localhost:9051
  elif [ $USING_ORG -eq 3 ]; then
    export CORE_PEER_LOCALMSPID="Org3MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp
    export CORE_PEER_ADDRESS=localhost:11051
  else
    errorln "ORG Unknown"
    exit 1
  fi

  # Enable TLS
  export CORE_PEER_TLS_ENABLED=true

  if [ "$VERBOSE" == "true" ]; then
    env | grep CORE
  fi
}

# Set global variables for orderer operations
function setOrdererGlobals() {
  export ORDERER_CA=${PWD}/organizations/ordererOrganizations/orderer.example.com/tlsca/tlsca.orderer.example.com-cert.pem
  export ORDERER_ADMIN_TLS_SIGN_CERT=${PWD}/organizations/ordererOrganizations/orderer.example.com/orderers/orderer0.orderer.example.com/tls/server.crt
  export ORDERER_ADMIN_TLS_PRIVATE_KEY=${PWD}/organizations/ordererOrganizations/orderer.example.com/orderers/orderer0.orderer.example.com/tls/server.key
}

# Get peer connection parameters for all organizations
# Used for chaincode operations that need multiple peer endorsements
function parsePeerConnectionParameters() {
  PEER_CONN_PARMS=()
  PEERS=""
  
  while [ "$#" -gt 0 ]; do
    setGlobals $1
    PEER="peer0.org$1"
    PEERS="$PEERS $PEER"
    PEER_CONN_PARMS+=("--peerAddresses" "$CORE_PEER_ADDRESS")
    PEER_CONN_PARMS+=("--tlsRootCertFiles" "$CORE_PEER_TLS_ROOTCERT_FILE")
    shift
  done
}

# Verify that a command succeeded
# Returns 1 on failure (caller should handle)
function verifyResult() {
  if [ $1 -ne 0 ]; then
    errorln "!!!!!!!!!!!!!!! $2 !!!!!!!!!!!!!!!!"
    return 1
  fi
  return 0
}

# Fatal error - prints message and exits
# Use this only when you MUST stop execution
function fatalln() {
  errorln "FATAL: $1"
  exit 1
}

export -f setGlobals
export -f setOrdererGlobals
export -f parsePeerConnectionParameters
export -f verifyResult
export -f fatalln
export -f println
export -f errorln
export -f successln
export -f infoln
export -f warnln

