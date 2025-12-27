#!/bin/bash
# Copyright IBM Corp. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# Create Channel Script
# This script creates the asset-channel and joins all peers

# Source helper functions
. scripts/envVar.sh

CHANNEL_NAME="asset-channel"
DELAY=3
MAX_RETRY=5
VERBOSE=false

# Create channel genesis block
function createChannelGenesisBlock() {
  setGlobals 1
  which configtxgen
  if [ "$?" -ne 0 ]; then
    errorln "configtxgen tool not found."
    exit 1
  fi

  infoln "Generating channel genesis block '${CHANNEL_NAME}.block'"

  set -x
  configtxgen -profile ThreeOrgsChannel -outputBlock ./channel-artifacts/${CHANNEL_NAME}.block -channelID $CHANNEL_NAME -configPath ./configtx/
  res=$?
  { set +x; } 2>/dev/null
  verifyResult $res "Failed to generate channel configuration transaction" || exit 1
  successln "Channel genesis block generated"
}

# Create channel using osnadmin - must join ALL orderers for Raft quorum
function createChannel() {
  setOrdererGlobals
  
  infoln "Creating channel ${CHANNEL_NAME}"
  
  # Join orderer0
  infoln "Joining orderer0 to channel..."
  local rc=1
  local COUNTER=1
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    sleep $DELAY
    set -x
    osnadmin channel join --channelID $CHANNEL_NAME --config-block ./channel-artifacts/${CHANNEL_NAME}.block -o localhost:7053 --ca-file "$ORDERER_CA" --client-cert "${PWD}/organizations/ordererOrganizations/orderer.example.com/orderers/orderer0.orderer.example.com/tls/server.crt" --client-key "${PWD}/organizations/ordererOrganizations/orderer.example.com/orderers/orderer0.orderer.example.com/tls/server.key"
    res=$?
    { set +x; } 2>/dev/null
    rc=$res
    COUNTER=$(expr $COUNTER + 1)
  done
  
  # Join orderer1
  infoln "Joining orderer1 to channel..."
  rc=1
  COUNTER=1
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    sleep $DELAY
    set -x
    osnadmin channel join --channelID $CHANNEL_NAME --config-block ./channel-artifacts/${CHANNEL_NAME}.block -o localhost:8053 --ca-file "$ORDERER_CA" --client-cert "${PWD}/organizations/ordererOrganizations/orderer.example.com/orderers/orderer1.orderer.example.com/tls/server.crt" --client-key "${PWD}/organizations/ordererOrganizations/orderer.example.com/orderers/orderer1.orderer.example.com/tls/server.key"
    res=$?
    { set +x; } 2>/dev/null
    rc=$res
    COUNTER=$(expr $COUNTER + 1)
  done
  
  # Join orderer2
  infoln "Joining orderer2 to channel..."
  rc=1
  COUNTER=1
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    sleep $DELAY
    set -x
    osnadmin channel join --channelID $CHANNEL_NAME --config-block ./channel-artifacts/${CHANNEL_NAME}.block -o localhost:9053 --ca-file "$ORDERER_CA" --client-cert "${PWD}/organizations/ordererOrganizations/orderer.example.com/orderers/orderer2.orderer.example.com/tls/server.crt" --client-key "${PWD}/organizations/ordererOrganizations/orderer.example.com/orderers/orderer2.orderer.example.com/tls/server.key"
    res=$?
    { set +x; } 2>/dev/null
    rc=$res
    COUNTER=$(expr $COUNTER + 1)
  done
  
  verifyResult $res "Channel creation failed" || exit 1
  successln "All orderers joined channel '$CHANNEL_NAME'"
}

# Join peer to channel
function joinChannel() {
  local ORG=$1
  setGlobals $ORG
  
  local rc=1
  local COUNTER=1
  
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    sleep $DELAY
    set -x
    peer channel join -b ./channel-artifacts/${CHANNEL_NAME}.block
    res=$?
    { set +x; } 2>/dev/null
    rc=$res
    COUNTER=$(expr $COUNTER + 1)
  done
  
  verifyResult $res "Peer org${ORG} failed to join channel" || exit 1
  successln "Peer org${ORG} joined channel '${CHANNEL_NAME}'"
}

# Set anchor peer for organization
function setAnchorPeer() {
  local ORG=$1
  setGlobals $ORG
  
  infoln "Fetching channel config for org${ORG}"
  
  # Fetch current config
  peer channel fetch config config_block.pb -o localhost:7050 --ordererTLSHostnameOverride orderer0.orderer.example.com -c $CHANNEL_NAME --tls --cafile "$ORDERER_CA"
  
  # Decode config block
  configtxlator proto_decode --input config_block.pb --type common.Block --output config_block.json
  jq '.data.data[0].payload.data.config' config_block.json > config.json
  
  # Modify config with anchor peer
  if [ $ORG -eq 1 ]; then
    HOST="peer0.org1.example.com"
    PORT=7051
  elif [ $ORG -eq 2 ]; then
    HOST="peer0.org2.example.com"
    PORT=9051
  elif [ $ORG -eq 3 ]; then
    HOST="peer0.org3.example.com"
    PORT=11051
  fi
  
  jq '.channel_group.groups.Application.groups.'Org${ORG}MSP'.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "'$HOST'","port": '$PORT'}]},"version": "0"}}' config.json > modified_config.json
  
  # Calculate config update
  configtxlator proto_encode --input config.json --type common.Config --output config.pb
  configtxlator proto_encode --input modified_config.json --type common.Config --output modified_config.pb
  
  # Check if there's a difference between original and updated config
  set +e
  configtxlator compute_update --channel_id $CHANNEL_NAME --original config.pb --updated modified_config.pb --output config_update.pb 2>/dev/null
  if [ ! -s config_update.pb ]; then
    infoln "Anchor peer for org${ORG} already set, skipping..."
    rm -f config_block.pb config_block.json config.json modified_config.json config.pb modified_config.pb config_update.pb
    set -e
    return 0
  fi
  set -e
  
  # Wrap update in envelope
  configtxlator proto_decode --input config_update.pb --type common.ConfigUpdate --output config_update.json
  echo '{"payload":{"header":{"channel_header":{"channel_id":"'$CHANNEL_NAME'", "type":2}},"data":{"config_update":'$(cat config_update.json)'}}}' | jq . > config_update_in_envelope.json
  configtxlator proto_encode --input config_update_in_envelope.json --type common.Envelope --output config_update_in_envelope.pb
  
  # Submit config update
  peer channel update -f config_update_in_envelope.pb -c $CHANNEL_NAME -o localhost:7050 --ordererTLSHostnameOverride orderer0.orderer.example.com --tls --cafile "$ORDERER_CA"
  
  # Cleanup
  rm -f config_block.pb config_block.json config.json modified_config.json config.pb modified_config.pb config_update.pb config_update.json config_update_in_envelope.json config_update_in_envelope.pb
  
  successln "Anchor peer set for org${ORG}"
}

# Main function
function main() {
  # Create channel artifacts directory
  mkdir -p channel-artifacts

  # Create channel genesis block
  createChannelGenesisBlock

  # Create channel
  createChannel

  # Join all peers
  infoln "Joining org1 peer to channel..."
  joinChannel 1

  infoln "Joining org2 peer to channel..."
  joinChannel 2

  infoln "Joining org3 peer to channel..."
  joinChannel 3

  # Set anchor peers
  infoln "Setting anchor peer for org1..."
  setAnchorPeer 1

  infoln "Setting anchor peer for org2..."
  setAnchorPeer 2

  infoln "Setting anchor peer for org3..."
  setAnchorPeer 3

  successln "Channel '${CHANNEL_NAME}' created and all peers joined successfully!"
}

main
