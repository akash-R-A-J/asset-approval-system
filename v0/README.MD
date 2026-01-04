<h1 align="center">📚 Asset Approval System v0</h1>

<div align="center">

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)
![Fabric](https://img.shields.io/badge/Fabric-2.5-blue)
![Containers](https://img.shields.io/badge/Containers-12-orange)
![Status](https://img.shields.io/badge/Status-Learning%20%2F%20POC-blue)

**Simple implementation for learning Hyperledger Fabric concepts and building POC demos.**

</div>

---

## ✨ Why v0?

| Best For | Not Ideal For |
|----------|---------------|
| ✅ Learning Fabric concepts | ❌ Production deployment |
| ✅ POC demonstrations | ❌ High availability needs |
| ✅ Resource-constrained environments | ❌ Multi-peer redundancy |
| ✅ Quick prototyping | ❌ Complex state machines |
| ✅ Understanding OBAC | ❌ Rejected asset resubmission |

**👉 Start here to learn, then graduate to [v1](../v1/) for production.**

---

## ⚡ Quick Start

### Prerequisites

| Software | Version | Check Command |
|----------|---------|---------------|
| Docker | 20+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| Node.js | 18+ | `node --version` |
| Fabric Binaries | 2.5.x | `peer version` |
| jq | Any | `jq --version` |

> ⚠️ **Requires Linux or WSL2** - Cannot run on native Windows

### Start in 3 Commands

```bash
# 1. Navigate to v0
cd asset-approval-system/v0

# 2. Make scripts executable
chmod +x scripts/*.sh network/scripts/*.sh

# 3. Start everything (3-5 minutes)
./scripts/start-all.sh
```

**What happens:**
```
✓ Network started (12 containers)
✓ Channel created
✓ Chaincode deployed
✓ Client setup complete
✓ Chaincode warmed up
SUCCESS! Network is ready
```

### Run Demo & Tests

```bash
# Interactive workflow demonstration
./scripts/demo.sh

# Security tests (18 tests)
./scripts/run-tests.sh

# Fault tolerance tests
./scripts/test-fault-tolerance.sh
```

### Stop & Cleanup

```bash
./scripts/stop-all.sh
```

---

## 🏗️ Architecture

### Network Topology (12 Containers)

```
┌────────────────────────────────────────────────────────────────────┐
│                       ORDERING SERVICE (Raft)                       │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐               │
│  │  orderer0  │    │  orderer1  │    │  orderer2  │               │
│  │   :7050    │    │   :8050    │    │   :9050    │               │
│  └────────────┘    └────────────┘    └────────────┘               │
│                      Tolerates 1 failure                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ORG1 (Asset Owner)     ORG2 (Auditor)      ORG3 (Regulator)      │
│  ┌───────────────┐     ┌───────────────┐   ┌───────────────┐      │
│  │ Peer    :7051 │     │ Peer    :9051 │   │ Peer   :11051 │      │
│  │ CA      :7054 │     │ CA      :8054 │   │ CA      :9054 │      │
│  │ CouchDB :5984 │     │ CouchDB :7984 │   │ CouchDB :8984 │      │
│  └───────────────┘     └───────────────┘   └───────────────┘      │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                   CHANNEL: asset-channel                      │ │
│  │  ┌─────────────────┐   ┌────────────────────────────────┐    │ │
│  │  │  PUBLIC LEDGER  │   │ PRIVATE DATA (Org1 + Org2)     │    │ │
│  │  │  • assetID      │   │ • description                  │    │ │
│  │  │  • status       │   │ • internal notes               │    │ │
│  │  │  • approvals    │   │ • valuation amount             │    │ │
│  │  │  • timestamps   │   │ • confidential terms           │    │ │
│  │  └─────────────────┘   └────────────────────────────────┘    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 State Machine

```
     ┌─────────────┐
     │   CREATE    │ ← Org1 creates asset
     └──────┬──────┘
            │ (starts as PENDING)
            ▼
     ┌─────────────┐     Both Org2 + Org3    ┌─────────────┐
     │   PENDING   │ ────── approve ───────▶│  APPROVED   │ ◀── FINAL
     └──────┬──────┘                         └─────────────┘
            │
            │ Any approver rejects
            ▼
     ┌─────────────┐
     │  REJECTED   │ ◀── FINAL (cannot resubmit in v0)
     └─────────────┘
```

> ⚠️ **Note:** In v0, rejected assets cannot be resubmitted. See [v1](../v1/) for resubmission support.

---

## 🔐 Access Control (OBAC)

Access is enforced **in chaincode** using MSP ID verification:

| Operation | Org1 (Owner) | Org2 (Auditor) | Org3 (Regulator) |
|-----------|:------------:|:--------------:|:----------------:|
| CreateAsset | ✅ | ❌ | ❌ |
| UpdateAssetStatus | ✅ | ❌ | ❌ |
| ApproveAsset | ❌ | ✅ | ✅ |
| RejectAsset | ❌ | ✅ | ✅ |
| DeleteAsset | ✅ | ❌ | ❌ |
| QueryAsset | ✅ | ✅ | ✅ |
| QueryPrivateDetails | ✅ | ✅ | ❌ |

---

## 📁 Project Structure

```
v0/
├── 📂 scripts/                        # Automation
│   ├── start-all.sh                  # Complete startup
│   ├── stop-all.sh                   # Clean shutdown
│   ├── demo.sh                       # Interactive demo
│   ├── run-tests.sh                  # Security tests
│   └── test-fault-tolerance.sh       # Raft tests
│
├── 📂 chaincode/asset-approval/
│   ├── lib/assetContract.js          # Smart contract
│   ├── collections_config.json       # Private data config
│   ├── index.js                      # Entry point
│   └── package.json
│
├── 📂 client/
│   ├── src/
│   │   ├── app.js                    # CLI application
│   │   ├── config.js                 # Configuration
│   │   ├── gateway.js                # Network connection
│   │   ├── invoke.js                 # Transaction functions
│   │   ├── query.js                  # Query functions
│   │   ├── enrollAdmin.js            # Admin enrollment
│   │   └── registerUser.js           # User registration
│   ├── wallet/                       # Identity wallets (generated)
│   └── package.json
│
├── 📂 network/
│   ├── configtx/configtx.yaml        # Channel configuration
│   ├── docker/
│   │   ├── docker-compose.yaml       # 12 containers
│   │   └── docker-compose-ca.yaml    # Certificate authorities
│   ├── organizations/                 # Crypto material (generated)
│   ├── peercfg/core.yaml             # Peer configuration
│   └── scripts/                       # Network scripts
│       ├── network.sh
│       ├── createChannel.sh
│       ├── deployCC.sh
│       ├── registerEnroll.sh
│       └── envVar.sh
│
└── 📂 docs/
    └── ARCHITECTURE.md
```

---

## 🖥️ CLI Commands

```bash
cd client

# Create asset (Org1 only)
node src/app.js create ASSET001 "Manufacturing Equipment" org1 admin

# Query asset (all orgs)
node src/app.js query ASSET001 org1 admin

# Query private data (Org1/Org2 only)
node src/app.js queryPrivate ASSET001 org1 admin

# Approve asset (Org2/Org3)
node src/app.js approve ASSET001 org2 admin

# Reject asset (Org2/Org3)
node src/app.js reject ASSET001 "Missing documents" org3 admin

# View history
node src/app.js history ASSET001 org1 admin

# List all assets
node src/app.js list org1 admin

# Delete asset (Org1 only)
node src/app.js delete ASSET001 org1 admin
```

---

## 🧪 Test Suites

### Security Tests (`./scripts/run-tests.sh`)

| Suite | Tests | What It Validates |
|-------|-------|-------------------|
| Access Control | 6 | Create/approve permissions |
| State Machine | 3 | Finalized asset immutability |
| Rejection Workflow | 3 | Reject and block approval |
| Query Permissions | 3 | All orgs can read public data |
| Private Data | 3 | Org3 cannot access private data |
| **Total** | **18** | Full OBAC coverage |

### Fault Tolerance Tests (`./scripts/test-fault-tolerance.sh`)

| Scenario | Expected |
|----------|----------|
| All 3 orderers up | ✅ Transactions succeed |
| 1 orderer down | ✅ Transactions succeed (2/3 quorum) |
| 2 orderers down | ❌ Transactions fail (expected) |
| Orderers restart | ✅ Network recovers |

---

## ⚙️ Configuration

### Environment Variables (Production)

```bash
export NODE_ENV=production
export ORG1_ADMIN_SECRET=<secure-password>
export ORG2_ADMIN_SECRET=<secure-password>
export ORG3_ADMIN_SECRET=<secure-password>
export TLS_VERIFY=true
```

### Input Validation

The CLI validates all inputs:

| Field | Rules |
|-------|-------|
| Asset ID | 1-64 chars, alphanumeric + `_-` |
| Organization | org1, org2, or org3 |
| User ID | Alphanumeric + `_-` |
| Description | Max 500 chars |
| Reason | Required, max 1000 chars |

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| `/bin/bash^M: bad interpreter` | `dos2unix scripts/*.sh network/scripts/*.sh` |
| `fabric-ca-client: not found` | Add `~/bin` to PATH |
| Port already in use | `docker stop $(docker ps -aq)` |
| Permission denied | `sudo chown -R $USER:$USER .` |
| ENDORSEMENT_POLICY_FAILURE | Wait 10s and retry (cold start) |

### Clean Restart

```bash
./scripts/stop-all.sh
docker volume prune -f
./scripts/start-all.sh
```

---

## 🆚 v0 vs v1 Comparison

| Aspect | v0 (This) | v1 |
|--------|-----------|-----|
| Complexity | Simple | Production-grade |
| Containers | 12 | 24 |
| Peers per Org | 1 | 3 |
| Language | JavaScript | TypeScript |
| States | 3 | 6 |
| Resubmit Rejected | ❌ | ✅ |

**👉 Ready for production? See [v1 README](../v1/README.md)**

---

## 📄 License

Apache-2.0

---

<div align="center">

**Perfect for Learning Hyperledger Fabric**

*JavaScript · Simple Architecture · Full OBAC Demo*

[⬅️ Back to Main README](../README.md) · [➡️ Upgrade to v1](../v1/README.md)

</div>
