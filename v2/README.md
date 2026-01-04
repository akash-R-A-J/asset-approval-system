<h1 align="center">🏢 Asset Approval System v2</h1>

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![Fabric](https://img.shields.io/badge/Fabric-2.5-blue)
![Containers](https://img.shields.io/badge/Containers-14-orange)
![100% Fabric CA](https://img.shields.io/badge/Identity-100%25%20Fabric%20CA-green)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success)

**Enterprise-grade asset lifecycle management with True ABAC on Hyperledger Fabric.**

</div>

---

## ✨ Why v2?

| Best For | Key Innovation |
|----------|----------------|
| ✅ True ABAC (role in certificates) | No chaincode changes to add orgs |
| ✅ 100% Fabric CA | Production-like identity management |
| ✅ Organization-agnostic chaincode | Scalable multi-party governance |
| ✅ Private data collections | Confidential information handling |
| ✅ Complete audit trails | Immutable transaction history |

**👉 This is the production-ready version. See [v0](../v0/) for learning or [v1](../v1/) for comparison.**

---

## 📋 Prerequisites

> ⚠️ **Requires Linux or WSL2** — Cannot run on native Windows

| Software | Version | Check Command | Install Guide |
|----------|---------|---------------|---------------|
| Docker | 20+ | `docker --version` | [Install Docker](https://docs.docker.com/get-docker/) |
| Docker Compose | v2+ | `docker compose version` | Included with Docker Desktop |
| Node.js | 18+ | `node --version` | [Install Node.js](https://nodejs.org/) |
| Fabric Binaries | 2.5.x | `peer version` | See below |
| Fabric CA Client | 1.5.x | `fabric-ca-client version` | See below |
| jq | Any | `jq --version` | `sudo apt install jq` |

### Install Fabric Binaries

```bash
# Download Fabric binaries to ~/bin
mkdir -p ~/bin
cd ~/bin

curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.4 1.5.7 -d -s

# Add to PATH (add to ~/.bashrc for persistence)
export PATH=$PATH:~/bin/bin
```

### Verify Installation

```bash
# All commands should work
peer version
orderer version
fabric-ca-client version
configtxgen --version
```

---

## ⚡ Quick Start (5 Minutes)

### Step 1: Clone and Navigate

```bash
git clone https://github.com/your-org/asset-approval-system.git
cd asset-approval-system/v2
```

### Step 2: Make Scripts Executable

```bash
chmod +x *.sh scripts/*.sh
```

### Step 3: Start Everything

```bash
./start-all.sh
```

**What happens (3-5 minutes):**
```
✓ 4 Certificate Authorities started
✓ Orderer identities enrolled via Fabric CA
✓ Peer identities enrolled with role attributes
✓ Channel artifacts generated
✓ 3 Orderers + 3 Peers + 3 CouchDB started
✓ Channel created (asset-channel)
✓ All peers joined channel
✓ Chaincode compiled (TypeScript)
✓ Chaincode installed on all peers
✓ Chaincode approved by all orgs
✓ Chaincode committed

SUCCESS! Network is ready
```

### Step 4: Run Interactive Demo

```bash
cd client
npm install
npm run demo
```

**Demo walks you through:**
1. Creating an asset (as Owner)
2. Querying the asset
3. Approving the asset (as Auditor)
4. Approving the asset (as Regulator)
5. Activating the approved asset
6. Viewing audit history

### Step 5: Run Tests

```bash
# Run all tests (30+ tests)
npm test

# Run specific test suites
npm run test:abac       # ABAC access control tests
npm run test:state      # State machine tests
npm run test:approval   # Approval workflow tests
npm run test:rejection  # Rejection workflow tests
npm run test:query      # Query tests
npm run test:security   # Security tests

# List available suites
npm run test:list
```

### Step 6: Stop When Done

```bash
cd ..
./stop-all.sh
```

---

## 🏗️ Architecture

### Network Topology (14 Containers)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    100% FABRIC CA NETWORK                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   CA-Org1   │  │   CA-Org2   │  │   CA-Org3   │  │ CA-Orderer  │ │
│  │    :7054    │  │    :8054    │  │    :9054    │  │   :10054    │ │
│  │ role=owner  │  │role=auditor │  │role=regulator  │             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                       ORDERING SERVICE (Raft)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   orderer   │  │  orderer2   │  │  orderer3   │                  │
│  │    :7050    │  │    :8050    │  │    :9050    │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│                    Tolerates 1 failure                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ORG1 (Owner)         ORG2 (Auditor)        ORG3 (Regulator)        │
│  ┌─────────────┐     ┌─────────────┐       ┌─────────────┐         │
│  │ Peer  :7051 │     │ Peer  :8051 │       │ Peer  :9051 │         │
│  │ CouchDB     │     │ CouchDB     │       │ CouchDB     │         │
│  │    :5984    │     │    :6984    │       │    :7984    │         │
│  └─────────────┘     └─────────────┘       └─────────────┘         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   CHANNEL: asset-channel                        │ │
│  │  ┌──────────────────┐    ┌──────────────────────────────────┐  │ │
│  │  │   PUBLIC LEDGER  │    │ PRIVATE DATA (Org1 + Org2 only)  │  │ │
│  │  │  • assetID       │    │ • confidentialNotes              │  │ │
│  │  │  • status        │    │ • internalValue                  │  │ │
│  │  │  • approvals     │    │                                  │  │ │
│  │  │  • timestamps    │    │                                  │  │ │
│  │  └──────────────────┘    └──────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Asset Lifecycle (State Machine)

```
                                ┌───────────────┐
                                │    CREATED    │ ← Owner creates asset
                                └───────┬───────┘
                                        │ submitForApproval()
                                        ▼
                                ┌───────────────┐
              ┌─────────────────│    PENDING    │─────────────────┐
              │  rejectAsset()  │   APPROVAL    │  approveAsset() │
              ▼                 └───────────────┘                 ▼
      ┌───────────────┐                               ┌───────────────┐
      │   REJECTED    │                               │   APPROVED    │
      └───────┬───────┘                               └───────┬───────┘
              │ resubmit()                                    │ activateAsset()
              │                                               ▼
              │                                       ┌───────────────┐
              └──────────────► PENDING ◄──────────────│    ACTIVE     │
                              APPROVAL                └───────┬───────┘
                                                              │ deleteAsset()
                                                              ▼
                                                      ┌───────────────┐
                                                      │    DELETED    │
                                                      └───────────────┘
```

---

## 🔐 True ABAC Implementation

**What makes v2 special:** Roles are embedded in X.509 certificates, NOT checked against organization MSP ID.

```typescript
// How chaincode reads the role
const role = ctx.clientIdentity.getAttributeValue('role');
//                                                  ↑
//                                    Reads from certificate!

// Authorization is role-based, not org-based
if (!['owner'].includes(role)) {
    throw new Error(`Access denied: role ${role} cannot create assets`);
}
```

### Role Permissions Matrix

| Operation | `owner` | `auditor` | `regulator` |
|-----------|:-------:|:---------:|:-----------:|
| CreateAsset | ✅ | ❌ | ❌ |
| UpdateAsset | ✅ | ❌ | ❌ |
| SubmitForApproval | ✅ | ❌ | ❌ |
| ApproveAsset | ❌ | ✅ | ✅ |
| RejectAsset | ❌ | ✅ | ✅ |
| ActivateAsset | ✅ | ❌ | ❌ |
| DeleteAsset | ✅ | ❌ | ❌ |
| Read Private Data | ✅ | ✅ | ❌ |

### Adding a New Organization

**Zero chaincode changes required!**

1. Start new org's Fabric CA
2. Register users with appropriate role attribute
3. Update channel configuration
4. Join peer to channel
5. **Done!**

---

## 🖥️ CLI Commands

```bash
cd client

# ═══════════════════════════════════════════════════
# AS OWNER (Org1)
# ═══════════════════════════════════════════════════

# Create an asset
node src/app.js invoke CreateAsset ASSET001 "Manufacturing Equipment" org1 user1

# Submit for approval
node src/app.js invoke SubmitForApproval ASSET001 org1 user1

# Activate approved asset
node src/app.js invoke ActivateAsset ASSET001 org1 user1

# Delete asset
node src/app.js invoke DeleteAsset ASSET001 org1 user1

# ═══════════════════════════════════════════════════
# AS AUDITOR (Org2)
# ═══════════════════════════════════════════════════

# Approve asset
node src/app.js invoke ApproveAsset ASSET001 org2 user1

# Reject with reason
node src/app.js invoke RejectAsset ASSET001 "Missing compliance docs" org2 user1

# ═══════════════════════════════════════════════════
# AS REGULATOR (Org3)
# ═══════════════════════════════════════════════════

# Approve asset
node src/app.js invoke ApproveAsset ASSET001 org3 user1

# ═══════════════════════════════════════════════════
# QUERIES (Any Org)
# ═══════════════════════════════════════════════════

# Get single asset
node src/app.js query QueryAsset ASSET001 org1 user1

# List all assets
node src/app.js query QueryAllAssets org1 user1

# View audit history
node src/app.js query GetAssetHistory ASSET001 org1 user1

# Check caller identity (debug)
node src/app.js query GetCallerInfo org1 user1
```

---

## 📁 Project Structure

```
v2/
├── 📜 start-all.sh              # One-command startup
├── 📜 stop-all.sh               # Clean shutdown
│
├── 📂 scripts/
│   ├── start-network.sh         # Network bootstrapping
│   ├── deploy-chaincode.sh      # Chaincode lifecycle
│   ├── registerEnroll.sh        # Fabric CA enrollment (all identities)
│   └── envVar.sh                # Environment variables
│
├── 📂 chaincode/asset-approval/
│   ├── src/
│   │   └── assetApproval.ts     # Smart contract (True ABAC)
│   ├── collections_config.json  # Private data collections
│   └── package.json
│
├── 📂 network/
│   ├── configtx.yaml            # Channel & endorsement policies
│   ├── core.yaml                # Peer CLI configuration
│   └── docker/
│       ├── docker-compose.yaml  # 14 containers
│       └── env.example          # Environment template
│
└── 📂 client/
    ├── src/
    │   ├── fabricClient.js      # Gateway SDK wrapper
    │   ├── demo.js              # Interactive demo
    │   └── app.js               # CLI application
    └── package.json
```

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| `/bin/bash^M: bad interpreter` | `dos2unix *.sh scripts/*.sh` |
| `fabric-ca-client: not found` | Add `~/bin/bin` to PATH |
| `Port already in use` | `docker stop $(docker ps -aq)` |
| `Permission denied` | `chmod +x *.sh scripts/*.sh` |
| `ENDORSEMENT_POLICY_FAILURE` | Wait 10s and retry (cold start) |
| `Cannot find module` | `cd client && npm install` |
| `TLS handshake error` | Ensure orderer CA cert exists |

### Full Reset

```bash
./stop-all.sh
docker volume prune -f
docker network prune -f
./start-all.sh
```

---

## 🆚 v0 vs v1 vs v2 Comparison

| Aspect | v0 | v1 | **v2** |
|--------|----|----|--------|
| **Purpose** | Learning | Multi-peer | **Production** |
| **Access Control** | OBAC | OBAC | **True ABAC** |
| **Add New Org** | Chaincode change | Chaincode change | **Config only** |
| **Identity Management** | Fabric CA | cryptogen | **100% Fabric CA** |
| **Language** | JavaScript | TypeScript | **TypeScript** |
| **Containers** | 12 | 24 | **14** |
| **Peers per Org** | 1 | 3 | **1** |
| **Resubmit Rejected** | ❌ | ✅ | **✅** |
| **Private Data** | ✅ | ✅ | **✅** |

---

## 🔒 Production Considerations

This is **production-grade architecture** with dev defaults for convenience:

| Area | v2 Status | Production Need |
|------|-----------|-----------------|
| TLS | Self-signed | Real CA (Let's Encrypt, etc.) |
| Passwords | Hardcoded | HashiCorp Vault, K8s Secrets |
| Network | localhost | Kubernetes, Docker Swarm |
| Private Keys | On disk | HSM (Hardware Security Module) |
| Monitoring | None | Prometheus + Grafana |
| Logging | Docker logs | ELK Stack, Splunk |
| Backups | None | Automated ledger snapshots |

---

## 📄 License

Apache-2.0

---

<div align="center">

**Production-Ready Asset Approval System**

*True ABAC · 100% Fabric CA · TypeScript · Scalable*

[⬅️ Back to Main README](../README.md) · [📚 v0 for Learning](../v0/README.md) · [🔄 Compare with v1](../v1/README.md)

</div>
