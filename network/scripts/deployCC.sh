#!/bin/bash
# Copyright IBM Corp. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# Deploy Chaincode Script
# Implements the Fabric chaincode lifecycle: package, install, approve, commit

# Source helper functions
. scripts/envVar.sh

CHANNEL_NAME="asset-channel"
CC_NAME="assetcc"
CC_SRC_PATH="${PWD}/../chaincode/asset-approval"
CC_VERSION="1.0"
CC_SEQUENCE=1
CC_INIT_FCN=""
CC_END_POLICY=""
CC_COLL_CONFIG="${PWD}/../chaincode/asset-approval/collections_config.json"
DELAY=3
MAX_RETRY=5
VERBOSE=false

# Package chaincode
function packageChaincode() {
  infoln "Packaging chaincode..."
  
  set -x
  peer lifecycle chaincode package ${CC_NAME}.tar.gz --path ${CC_SRC_PATH} --lang node --label ${CC_NAME}_${CC_VERSION}
  res=$?
  { set +x; } 2>/dev/null
  verifyResult $res "Chaincode packaging failed" || exit 1
  successln "Chaincode packaged successfully"
}

# Install chaincode on peer
function installChaincode() {
  local ORG=$1
  setGlobals $ORG
  
  infoln "Installing chaincode on peer0.org${ORG}..."
  
  # Check if already installed
  set +e
  peer lifecycle chaincode queryinstalled --output json 2>/dev/null | grep -q "${CC_NAME}_${CC_VERSION}"
  if [ $? -eq 0 ]; then
    warnln "Chaincode already installed on peer0.org${ORG}, skipping..."
    return 0
  fi
  set -e
  
  set -x
  peer lifecycle chaincode install ${CC_NAME}.tar.gz
  res=$?
  { set +x; } 2>/dev/null
  verifyResult $res "Chaincode installation on peer0.org${ORG} failed" || exit 1
  successln "Chaincode installed on peer0.org${ORG}"
}

# Query installed chaincode
function queryInstalled() {
  local ORG=$1
  setGlobals $ORG
  
  set -x
  peer lifecycle chaincode queryinstalled --output json | jq -r 'try (.installed_chaincodes[].package_id)' | grep ^${CC_NAME}_${CC_VERSION}
  res=$?
  { set +x; } 2>/dev/null
  
  if [ $res -ne 0 ]; then
    errorln "Query installed on peer0.org${ORG} failed"
    exit 1
  fi
}

# Get package ID
function getPackageId() {
  set -x
  PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json | jq -r '.installed_chaincodes[] | select(.label=="'${CC_NAME}_${CC_VERSION}'") | .package_id')
  { set +x; } 2>/dev/null
  
  if [ -z "$PACKAGE_ID" ]; then
    errorln "Failed to get package ID"
    exit 1
  fi
  
  infoln "Package ID: ${PACKAGE_ID}"
}

# Approve chaincode for organization (idempotent - skips if already approved)
function approveForMyOrg() {
  local ORG=$1
  setGlobals $ORG
  
  # Check if already approved
  set +e
  local APPROVED=$(peer lifecycle chaincode checkcommitreadiness \
    --channelID $CHANNEL_NAME \
    --name ${CC_NAME} \
    --version ${CC_VERSION} \
    --sequence ${CC_SEQUENCE} \
    --signature-policy "OR('Org1MSP.peer','Org2MSP.peer','Org3MSP.peer')" \
    --collections-config ${CC_COLL_CONFIG} \
    --output json 2>/dev/null | jq -r ".approvals.Org${ORG}MSP")
  set -e
  
  if [ "$APPROVED" == "true" ]; then
    warnln "Chaincode already approved by org${ORG}, skipping..."
    return 0
  fi
  
  infoln "Approving chaincode definition for org${ORG}..."
  
  set -x
  peer lifecycle chaincode approveformyorg \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer0.orderer.example.com \
    --tls \
    --cafile "$ORDERER_CA" \
    --channelID $CHANNEL_NAME \
    --name ${CC_NAME} \
    --version ${CC_VERSION} \
    --package-id ${PACKAGE_ID} \
    --sequence ${CC_SEQUENCE} \
    --signature-policy "OR('Org1MSP.peer','Org2MSP.peer','Org3MSP.peer')" \
    --collections-config ${CC_COLL_CONFIG}
  res=$?
  { set +x; } 2>/dev/null
  verifyResult $res "Chaincode definition approval failed for org${ORG}" || exit 1
  successln "Chaincode definition approved for org${ORG}"
}

# Check commit readiness
function checkCommitReadiness() {
  local ORG=$1
  setGlobals $ORG
  
  infoln "Checking commit readiness..."
  
  local rc=1
  local COUNTER=1
  
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    sleep $DELAY
    set -x
    peer lifecycle chaincode checkcommitreadiness \
      --channelID $CHANNEL_NAME \
      --name ${CC_NAME} \
      --version ${CC_VERSION} \
      --sequence ${CC_SEQUENCE} \
      --signature-policy "OR('Org1MSP.peer','Org2MSP.peer','Org3MSP.peer')" \
      --collections-config ${CC_COLL_CONFIG} \
      --output json
    res=$?
    { set +x; } 2>/dev/null
    rc=0
    COUNTER=$(expr $COUNTER + 1)
  done
}

# Commit chaincode (idempotent - skips if already committed)
function commitChaincodeDefinition() {
  setGlobals 1
  
  # Check if already committed
  set +e
  peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME --name ${CC_NAME} &>/dev/null
  if [ $? -eq 0 ]; then
    warnln "Chaincode already committed, skipping..."
    return 0
  fi
  set -e
  
  infoln "Committing chaincode definition..."
  
  # Set peer connection parameters for all orgs
  parsePeerConnectionParameters 1 2 3
  
  set -x
  peer lifecycle chaincode commit \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer0.orderer.example.com \
    --tls \
    --cafile "$ORDERER_CA" \
    --channelID $CHANNEL_NAME \
    --name ${CC_NAME} \
    --version ${CC_VERSION} \
    --sequence ${CC_SEQUENCE} \
    --signature-policy "OR('Org1MSP.peer','Org2MSP.peer','Org3MSP.peer')" \
    --collections-config ${CC_COLL_CONFIG} \
    "${PEER_CONN_PARMS[@]}"
  res=$?
  { set +x; } 2>/dev/null
  verifyResult $res "Chaincode definition commit failed" || exit 1
  successln "Chaincode definition committed"
}

# Query committed chaincode
function queryCommitted() {
  local ORG=$1
  setGlobals $ORG
  
  infoln "Querying committed chaincode on peer0.org${ORG}..."
  
  local rc=1
  local COUNTER=1
  
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    sleep $DELAY
    set -x
    peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME --name ${CC_NAME}
    res=$?
    { set +x; } 2>/dev/null
    let rc=$res
    COUNTER=$(expr $COUNTER + 1)
  done
  verifyResult $res "Query committed failed" || exit 1
}

# Main function
function main() {
  # Package chaincode
  packageChaincode

  # Install on all peers
  installChaincode 1
  installChaincode 2
  installChaincode 3

  # Get package ID
  setGlobals 1
  getPackageId

  # Approve for all orgs
  approveForMyOrg 1
  approveForMyOrg 2
  approveForMyOrg 3

  # Check commit readiness
  checkCommitReadiness 1

  # Commit chaincode
  commitChaincodeDefinition

  # Query committed
  queryCommitted 1

  successln "Chaincode '${CC_NAME}' deployed successfully!"
}

main
