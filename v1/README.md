<h1 align="center">🚀 Asset Approval System v1</h1>

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![Fabric](https://img.shields.io/badge/Fabric-2.5-blue)
![Containers](https://img.shields.io/badge/Containers-24-orange)
![Production](https://img.shields.io/badge/Status-Production--Ready-green)

**Production-grade implementation with TypeScript chaincode, multi-peer architecture, and comprehensive testing.**

</div>

---

## ✨ What's Different from v0?

| Feature | v0 (Simple) | v1 (This Version) |
|---------|-------------|-------------------|
| Chaincode | JavaScript | **TypeScript** with type safety |
| Peers per Org | 1 | **3** (Endorser, Query, Committer) |
| State Machine | 3 states | **6 states** with explicit transitions |
| Input Validation | Client only | **Chaincode + Client** |
| Rejected Assets | Final | **Can be resubmitted** |
| SDK | fabric-network | **fabric-gateway** (modern) |
| Test Coverage | Basic | **Security, Fault, Performance** |

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

### One-Command Startup

```bash
# Clone (if not already)
git clone https://github.com/akash-R-A-J/asset-approval-system.git
cd asset-approval-system/v1

# Make scripts executable (first time only)
chmod +x *.sh scripts/*.sh

# Start everything (3-5 minutes)
./start-all.sh
```

**What happens:**
```
✓ Prerequisites checked
✓ Crypto materials generated
✓ 24 Docker containers started
✓ Channel created & peers joined
✓ Chaincode deployed with private data
✓ Client dependencies installed
✓ Demo executed successfully
```

### Run Tests

```bash
cd client

# Run all tests with summary
npm run test:all

# Individual suites
npm run test           # Comprehensive tests
npm run test:security  # RBAC & access control (12 tests)
npm run test:fault     # Raft fault tolerance
npm run test:perf      # Performance benchmarks
```

### Stop Everything

```bash
./stop-all.sh
```

---

## 🏗️ Architecture

### Network Topology (24 Containers)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        ORDERING SERVICE (Raft)                           │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐                     │
│  │  orderer   │    │  orderer2  │    │  orderer3  │                     │
│  │   :7050    │    │   :8050    │    │   :9050    │                     │
│  └────────────┘    └────────────┘    └────────────┘                     │
│                         Can tolerate 1 failure                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ORG1 (Asset Owner)        ORG2 (Auditor)         ORG3 (Regulator)      │
│  ┌─────────────────┐      ┌─────────────────┐    ┌─────────────────┐    │
│  │ peer0     :7051 │ (E)  │ peer0     :8051 │(E) │ peer0     :9051 │(E) │
│  │ peer1     :7151 │ (Q)  │ peer1     :8151 │(Q) │ peer1     :9151 │(Q) │
│  │ peer2     :7251 │ (C)  │ peer2     :8251 │(C) │ peer2     :9251 │(C) │
│  │ CA        :7054 │      │ CA        :8054 │    │ CA        :9054 │    │
│  │ CouchDB ×3      │      │ CouchDB ×3      │    │ CouchDB ×3      │    │
│  └─────────────────┘      └─────────────────┘    └─────────────────┘    │
│                                                                          │
│  (E) Endorser/Leader  (Q) Query  (C) Committer                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Peer Roles Explained

| Role | Gossip Config | Purpose |
|------|--------------|---------|
| **Endorser (peer0)** | Static Leader | Signs transactions, receives blocks from orderer |
| **Query (peer1)** | Follower | Handles read queries, reduces load on endorser |
| **Committer (peer2)** | Follower | Validates and commits blocks |

---

## 🔄 State Machine

```
                                                    ┌─────────────┐
     ┌─────────────┐    submit    ┌──────────────┐  │             │
     │   CREATED   │ ───────────▶ │   PENDING    │  │   DELETED   │
     └──────┬──────┘              └──────┬───────┘  │             │
            │                            │          └──────▲──────┘
            │                    ┌───────┴───────┐         │
            │                    │               │         │
            │               approve          reject        │
            │                    │               │         │
            │                    ▼               ▼         │
            │             ┌──────────┐    ┌──────────┐     │
            │             │ APPROVED │    │ REJECTED │─────┤
            │             └────┬─────┘    └────┬─────┘     │
            │                  │               │           │
            │             activate        resubmit         │
            │                  │               │           │
            │                  ▼               │           │
            │             ┌──────────┐         │           │
            └────────────▶│  ACTIVE  │◀────────┘           │
                          └────┬─────┘                     │
                               │                           │
                               └───────── delete ──────────┘
```

**Key Transitions:**
- `CREATED → PENDING_APPROVAL` - Owner submits for review
- `PENDING_APPROVAL → APPROVED` - Both Org2 AND Org3 approve
- `PENDING_APPROVAL → REJECTED` - Any approver rejects
- `REJECTED → PENDING_APPROVAL` - **Can resubmit!** (unlike v0)
- `APPROVED → ACTIVE` - Owner activates
- `Any State → DELETED` - Soft delete for audit trail

---

## 🔐 Access Control (OBAC)

| Operation | Org1 (Owner) | Org2 (Auditor) | Org3 (Regulator) |
|-----------|:------------:|:--------------:|:----------------:|
| CreateAsset | ✅ | ❌ | ❌ |
| SubmitForApproval | ✅ | ❌ | ❌ |
| ApproveAsset | ❌ | ✅ | ✅ |
| RejectAsset | ❌ | ✅ | ✅ |
| UpdateAsset | ✅ | ❌ | ❌ |
| ActivateAsset | ✅ | ❌ | ❌ |
| DeleteAsset | ✅ | ❌ | ❌ |
| QueryAsset | ✅ | ✅ | ✅ |
| ReadPrivateData | ✅ | ✅ | ❌ |

---

## 📁 Project Structure

```
v1/
├── 📜 start-all.sh              # One-command startup
├── 📜 stop-all.sh               # Clean shutdown
│
├── 📂 chaincode/asset-approval/
│   ├── src/
│   │   ├── assetApproval.ts    # Main contract (TypeScript)
│   │   └── index.ts            # Entry point
│   ├── collections_config.json  # Private data config
│   ├── package.json
│   └── tsconfig.json
│
├── 📂 client/
│   ├── src/
│   │   ├── fabricClient.js     # Fabric gateway client
│   │   ├── assetService.js     # High-level API
│   │   ├── demo.js             # Interactive demonstration
│   │   ├── test.js             # Comprehensive tests
│   │   ├── securityTest.js     # RBAC tests
│   │   ├── faultTest.js        # Fault tolerance tests
│   │   ├── perfTest.js         # Performance tests
│   │   └── runAllTests.js      # Test runner
│   ├── connection-profiles/    # Org connection configs
│   └── package.json
│
├── 📂 network/
│   ├── configtx.yaml           # Channel & org policies
│   ├── crypto-config.yaml      # Certificate config
│   ├── core.yaml               # Peer config
│   └── docker/
│       ├── docker-compose.yaml # 24 containers
│       └── .env                # Credentials
│
├── 📂 scripts/
│   ├── check-prerequisites.sh
│   ├── start-network.sh
│   ├── deploy-chaincode.sh
│   └── stop-network.sh
│
└── 📂 docs/
    └── (documentation files)
```

---

## 🔧 Configuration

### Credentials (`network/docker/.env`)

```bash
# CA Admin
CA_ADMIN_USER=admin
CA_ADMIN_PASSWORD=adminpw

# CouchDB
COUCHDB_USER=admin
COUCHDB_PASSWORD=adminpw
```

> ⚠️ **Change these for production!**

### Performance Tuning (`network/configtx.yaml`)

| Parameter | Default | Description |
|-----------|---------|-------------|
| BatchTimeout | 200ms | Block creation interval |
| MaxMessageCount | 50 | Transactions per block |
| AbsoluteMaxBytes | 99MB | Max block size |

---

## 🧪 Test Suites

### Security Tests (`npm run test:security`)

| Test | Description |
|------|-------------|
| Owner can create | Org1 creates successfully |
| Auditor denied create | Org2 gets access denied |
| Regulator denied create | Org3 gets access denied |
| Auditor can approve | Org2 approves successfully |
| Regulator can approve | Org3 approves successfully |
| Owner denied self-approve | Org1 cannot approve own assets |
| Non-owner denied delete | Org2/Org3 cannot delete |
| Private data isolation | Org3 cannot read private data |
| State machine enforcement | Invalid transitions blocked |
| Audit trail | All changes recorded |

### Fault Tolerance Tests (`npm run test:fault`)

| Scenario | Expected |
|----------|----------|
| All orderers up | ✅ Transactions succeed |
| 1 orderer down | ✅ Transactions succeed (2/3 quorum) |
| 2 orderers down | ❌ Transactions fail (expected) |
| Orderers restart | ✅ Network recovers |

---

## 🛠️ Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **Docker not running** | `sudo systemctl start docker` |
| **Port conflicts** | `docker stop $(docker ps -aq)` |
| **Fabric binaries not found** | Add `~/bin` to PATH |
| **Permission denied** | `sudo chown -R $USER:$USER .` |
| **ENDORSEMENT_POLICY_FAILURE** | Wait and retry (cold start) |

### Clean Restart

```bash
./stop-all.sh
docker volume prune -f
docker network prune -f
./start-all.sh
```

### View Container Logs

```bash
# Specific container
docker logs peer0.org1.example.com

# Follow logs
docker logs -f orderer.example.com

# All containers
docker-compose -f network/docker/docker-compose.yaml logs
```

---

## 📊 Performance Expectations

| Metric | Expected Range |
|--------|----------------|
| TPS (Transactions/sec) | 300-500 |
| Latency | 300-500ms |
| Block Time | 200ms |
| Endorsement Time | 50-100ms |

Run benchmarks with:
```bash
cd client
npm run test:perf
```

---

## 📄 License

Apache-2.0

---

<div align="center">

**Built for Production with Hyperledger Fabric v2.5**

*TypeScript · Multi-Peer Architecture · Comprehensive Testing*

[⬅️ Back to Main README](../README.md)

</div>
