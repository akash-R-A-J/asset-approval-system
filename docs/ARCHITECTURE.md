# Asset Approval System - Architecture Documentation

This document provides a detailed technical explanation of the Hyperledger Fabric Asset Approval System architecture, design decisions, and security model.

## 1. Network Topology

### 1.1 Organizations

| Organization | Role | MSP ID | Description |
|--------------|------|--------|-------------|
| Org1 | Asset Owner | Org1MSP | Creates and manages assets |
| Org2 | Auditor | Org2MSP | Reviews and approves assets, sees private data |
| Org3 | Regulator | Org3MSP | Provides regulatory approval, sees only public data |
| OrdererOrg | Ordering Service | OrdererMSP | Maintains transaction ordering |

> **Important**: Each organization, including the orderer organization, runs its own Fabric CA to maintain independent trust domains. This ensures no single organization controls identity issuance for others.

### 1.2 Certificate Authorities

```
┌─────────────────────────────────────────────────────────────────┐
│                    FABRIC CA INFRASTRUCTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ CA Org1  │  │ CA Org2  │  │ CA Org3  │  │ CA OrdererOrg│    │
│  │ :7054    │  │ :8054    │  │ :9054    │  │ :10054       │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘    │
│       │             │             │               │             │
│       ▼             ▼             ▼               ▼             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────────┐     │
│  │ Peer0   │  │ Peer0   │  │ Peer0   │  │ 3 Orderers     │     │
│  │ Admin   │  │ Admin   │  │ Admin   │  │ Admin          │     │
│  │ User1   │  │ User1   │  │ User1   │  └────────────────┘     │
│  └─────────┘  └─────────┘  └─────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Ordering Service (Raft)

- **Type**: Raft (crash fault-tolerant)
- **Nodes**: 3 orderers
- **Fault Tolerance**: Survives 1 node failure (2f+1 where f=1)

```
Ordering Service Consensus:
    orderer0 ◄──────► orderer1 ◄──────► orderer2
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                   RAFT LEADER
            (elected automatically)
```

> **Note**: Orderers belong to a separate OrdererOrg with its own MSP. This separation is critical for governance - peer organizations cannot unilaterally modify ordering service configuration.

## 2. Channel Architecture

### 2.1 Channel Configuration

- **Channel Name**: `asset-channel`
- **Members**: Org1, Org2, Org3
- **Anchor Peers**: One per organization

### 2.2 Data Partitioning

```
┌─────────────────────────────────────────────────────────────────┐
│                        ASSET-CHANNEL                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PUBLIC WORLD STATE                 PRIVATE DATA COLLECTIONS    │
│  ┌─────────────────────────┐        ┌─────────────────────────┐ │
│  │  Asset {                │        │  Org1Org2Private {      │ │
│  │    assetID: "ASSET001"  │        │    assetID: "ASSET001"  │ │
│  │    status: "PENDING"    │        │    description: "..."   │ │
│  │    owner: "Org1MSP"     │◄──────►│    internalNotes: "..." │ │
│  │    approvals: {...}     │        │    valuationAmount: ... │ │
│  │    createdAt: "..."     │        │  }                      │ │
│  │  }                      │        │                         │ │
│  │                         │        │  VISIBLE TO:            │ │
│  │  VISIBLE TO: ALL ORGS   │        │  - Org1 (Owner)         │ │
│  └─────────────────────────┘        │  - Org2 (Auditor)       │ │
│                                     │  NOT Org3 (Regulator)   │ │
│                                     └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Chaincode Design

### 3.1 Organization-Based Access Control (OBAC)

Access control is enforced via MSP ID checks in chaincode. This can be extended to attribute-based access control (ABAC) using Fabric CA certificate attributes.

```javascript
// ORGANIZATION-BASED ACCESS CONTROL (OBAC) - via MSP ID
async CreateAsset(ctx, assetID) {
    const clientMSP = ctx.clientIdentity.getMSPID();
    if (clientMSP !== 'Org1MSP') {
        throw new Error('Only Asset Owner (Org1) can create assets');
    }
    // ... create asset
}
```

> **Critical Distinction**: Endorsement policies ensure transaction validity at the network level (who must sign). Organization-based access control logic in chaincode enforces business authorization (who is allowed to invoke).

### 3.2 Endorsement Policy

```
Endorsement Policy: OR('Org1MSP.peer','Org2MSP.peer','Org3MSP.peer')
```

**Design Rationale**: For this POC, endorsement ensures multi-org validation while access control logic enforces business rules. This avoids over-constraining the network while preserving security.

Using a strict `AND(Org1, OR(Org2, Org3))` policy would:
- Increase latency (multiple endorsements required)
- Complicate client routing
- Break early asset creation if approvers aren't online

### 3.3 Asset Lifecycle (State Machine)

The asset follows a strict state machine. Once an asset reaches a final state (APPROVED or REJECTED), it cannot be modified.

```
                    ┌─────────────────┐
                    │   CreateAsset   │
                    │    (Org1)       │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    PENDING      │◄──── UpdateStatus (Org1, only in PENDING)
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
     ┌────────────────┐            ┌────────────────┐
     │ ApproveAsset   │            │ RejectAsset    │
     │ (Org2, Org3)   │            │ (Org2, Org3)   │
     └───────┬────────┘            └───────┬────────┘
             │                             │
             ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │    APPROVED     │ ═══════╗  │    REJECTED     │ ═══════╗
    │  (both orgs)    │  FINAL ║  │  (any org)      │  FINAL ║
    └─────────────────┘ ═══════╝  └─────────────────┘ ═══════╝
```

> **State Machine Enforcement**: Finalized assets cannot be modified. An owner cannot override a regulator's rejection, and rejected assets cannot later be approved.

**DeleteAsset**: This is an administrative cleanup operation available only to Org1 and is not part of the normal approval workflow.

## 4. Security Model

### 4.1 Identity Management

**Enrollment Flow**:
```
1. Admin bootstraps CA
2. Admin enrolls to get admin cert
3. Admin registers new identity
4. New identity enrolls with secret
5. All crypto generated CLIENT-SIDE
```

> **Security Note**: All cryptographic material is generated on the client side during enrollment; private keys never leave the enrolling entity. The CA only issues signed certificates.

### 4.2 TLS Configuration

- All peer-to-peer communication uses TLS
- All client-to-peer communication uses TLS
- Orderer cluster communication uses mutual TLS

### 4.3 Private Data Protection

| Data | Where Stored | Who Can Read | Who Can Write |
|------|--------------|--------------|---------------|
| Public Asset | All peers | All orgs | Org1 |
| Private Details | Org1, Org2 peers only | Org1, Org2 | Org1 |
| Approval Records | All peers | All orgs | Org2, Org3 |

### 4.4 Transaction Validation

During the validation phase, peers verify endorsement policies and MVCC (Multi-Version Concurrency Control) versioning before committing blocks. This ensures that:
- The required endorsements are present
- No conflicting writes occurred during endorsement
- State integrity is maintained

## 5. Client Architecture

### 5.1 Gateway Pattern

```
┌──────────────┐     ┌────────────────┐     ┌─────────────────┐
│  CLI/API     │────►│  Node.js       │────►│  Fabric Peer    │
│  User        │     │  Gateway       │     │                 │
└──────────────┘     └────────────────┘     └─────────────────┘
                            │
                            ▼
                     ┌────────────────┐
                     │  Identity      │
                     │  Wallet        │
                     └────────────────┘
```

> **Gateway Pattern**: The Node.js backend acts as a trusted gateway to the Fabric network, not an authority over business rules. The gateway manages connections and submits transactions on behalf of enrolled users. Business logic enforcement happens in chaincode, not in the client.

### 5.2 Connection Profiles

Each organization has a dedicated connection profile containing:
- Peer endpoints and TLS certificates
- CA endpoints
- Orderer endpoints (for transaction submission)

## 6. Operational Considerations

### 6.1 Script Design

> **Operational Design**: Scripts are wrappers around Fabric binaries (`peer`, `configtxgen`, `fabric-ca-client`) to reduce operator error and ensure consistent execution across environments.

### 6.2 Monitoring

- Orderer and peer expose Prometheus metrics
- CouchDB web interface available for debugging
- Docker logs for all containers

### 6.3 Backup Strategy

1. **Ledger**: CouchDB data in Docker volumes
2. **Crypto Material**: `organizations/` directory
3. **Channel Config**: Stored in orderer blocks

## 7. Adding a New Organization

### 7.1 Process Overview

```
1. Generate Org4 identities via Fabric CA
2. Create MSP definition: configtxgen -printOrg Org4MSP > org4.json
3. Fetch current channel config
4. Compute config update with Org4
5. Collect signatures from existing admins
6. Submit config update transaction
7. Org4 peer joins channel
8. Update chaincode if needed
```

### 7.2 Zero Downtime

This process requires **zero downtime**:
- Existing transactions continue processing
- No restart of existing peers/orderers
- Gradual rollout possible

### 7.3 Governance Requirements

- Majority of existing org admins must sign the config update
- New org cannot unilaterally join
- Existing orgs retain control

## 8. Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Block Size | 10 transactions | Configurable |
| Block Timeout | 2 seconds | Configurable |
| Endorsement | 1 peer | OR policy |
| State DB | CouchDB | Supports rich queries |

## 9. configtx.yaml Explained

`configtx.yaml` defines **channel-level policies** and consortium configuration:

- Organization MSP definitions
- Orderer configuration
- Channel capabilities
- Consortium membership

> **Important**: Chaincode endorsement policies are defined separately during **chaincode lifecycle approval** (commit step), not in configtx.yaml.

## 10. Future Enhancements

1. **Add more peers per org** for redundancy
2. **Implement chaincode as a service** for easier upgrades
3. **Add Prometheus/Grafana** monitoring stack
4. **Implement event listeners** for real-time notifications
5. **Add REST API layer** on top of CLI

---

*This architecture is designed for a POC demonstration. Production deployments would require additional hardening, monitoring, and operational procedures.*
