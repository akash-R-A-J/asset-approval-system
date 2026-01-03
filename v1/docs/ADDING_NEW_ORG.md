# Adding a New Organization

This guide explains how to add a new organization to the Asset Approval System without disrupting existing operations.

## Overview

Adding a new organization requires:
1. Generate crypto materials for the new org
2. Update channel configuration
3. Have existing orgs sign the update
4. Submit the configuration update
5. New org starts containers and syncs

**No network restart or chaincode upgrade required.**

## Step-by-Step Process

### Step 1: Generate Crypto Materials

```bash
# Create crypto-config for new org
cat > crypto-config-org4.yaml << EOF
PeerOrgs:
  - Name: Org4
    Domain: org4.example.com
    EnableNodeOUs: true
    Template:
      Count: 3
    Users:
      Count: 2
EOF

cryptogen generate --config=crypto-config-org4.yaml --output=organizations
```

### Step 2: Create Org Definition

```bash
export FABRIC_CFG_PATH=$PWD

# Generate org definition JSON
configtxgen -printOrg Org4MSP > org4.json
```

### Step 3: Fetch Current Channel Config

```bash
# Set environment for existing org (e.g., Org1)
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_MSPCONFIGPATH=./organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp

# Fetch current config
peer channel fetch config config_block.pb -o localhost:7050 -c asset-channel --tls --cafile $ORDERER_CA

# Decode to JSON
configtxlator proto_decode --input config_block.pb --type common.Block | jq .data.data[0].payload.data.config > config.json
```

### Step 4: Add New Org to Config

```bash
# Add Org4 to the application groups
jq -s '.[0] * {"channel_group":{"groups":{"Application":{"groups": {"Org4MSP":.[1]}}}}}' config.json org4.json > modified_config.json
```

### Step 5: Compute Config Update

```bash
# Encode original config
configtxlator proto_encode --input config.json --type common.Config --output config.pb

# Encode modified config
configtxlator proto_encode --input modified_config.json --type common.Config --output modified_config.pb

# Compute the delta
configtxlator compute_update --channel_id asset-channel --original config.pb --updated modified_config.pb --output org4_update.pb

# Decode for signing
configtxlator proto_decode --input org4_update.pb --type common.ConfigUpdate | jq . > org4_update.json

# Wrap in envelope
echo '{"payload":{"header":{"channel_header":{"channel_id":"asset-channel","type":2}},"data":{"config_update":'$(cat org4_update.json)'}}}' | jq . > org4_update_envelope.json

# Encode final envelope
configtxlator proto_encode --input org4_update_envelope.json --type common.Envelope --output org4_update_envelope.pb
```

### Step 6: Collect Signatures

```bash
# Sign by Org1
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_MSPCONFIGPATH=./organizations/.../Admin@org1.../msp
peer channel signconfigtx -f org4_update_envelope.pb

# Sign by Org2
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_MSPCONFIGPATH=./organizations/.../Admin@org2.../msp
peer channel signconfigtx -f org4_update_envelope.pb
```

### Step 7: Submit Update

```bash
# Submit the update (any org can do this)
peer channel update -f org4_update_envelope.pb -c asset-channel -o localhost:7050 --tls --cafile $ORDERER_CA
```

### Step 8: Start Org4 Containers

Add Org4 containers to docker-compose and start:

```bash
docker-compose up -d peer0.org4.example.com peer1.org4.example.com peer2.org4.example.com couchdb0.org4
```

### Step 9: Join Channel

```bash
export CORE_PEER_LOCALMSPID="Org4MSP"
export CORE_PEER_ADDRESS=localhost:10051

peer channel fetch 0 asset-channel.block -o localhost:7050 -c asset-channel --tls --cafile $ORDERER_CA
peer channel join -b asset-channel.block
```

### Step 10: Install Chaincode (if needed)

If Org4 will endorse transactions:

```bash
peer lifecycle chaincode install asset-approval.tar.gz
peer lifecycle chaincode approveformyorg --channelID asset-channel --name asset-approval ...
```

## ABAC Integration

The new organization's users need the appropriate role attribute:

```javascript
// When enrolling Org4 users
await caClient.register({
    enrollmentID: 'newUser',
    attrs: [{ name: 'role', value: 'auditor', ecert: true }]  // or 'regulator'
}, adminUser);
```

**No chaincode changes required** - ABAC checks the role attribute, not the MSP ID.

## Updating Endorsement Policy (if needed)

If the new org should be part of endorsement:

```bash
# Update policy to include Org4
CC_END_POLICY="AND('Org1MSP.peer', OR('Org2MSP.peer', 'Org3MSP.peer', 'Org4MSP.peer'))"

# Approve chaincode upgrade with new policy
peer lifecycle chaincode approveformyorg ... --signature-policy "$CC_END_POLICY"
```

## Checklist

- [ ] Crypto materials generated
- [ ] Channel config updated
- [ ] Required signatures collected
- [ ] Config update submitted
- [ ] Containers started
- [ ] Peers joined channel
- [ ] Chaincode installed (if endorsing)
- [ ] Users enrolled with correct roles
- [ ] Endorsement policy updated (if needed)

## Zero Downtime

Throughout this process:
- Existing orgs continue operating
- No network restart
- No chaincode redeployment (unless policy changes)
- Ledger data preserved
