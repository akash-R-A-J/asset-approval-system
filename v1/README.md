# Asset Approval System - Hyperledger Fabric

Production-grade permissioned blockchain system for multi-organization asset approval workflows.

## 🚀 Quick Start

### Prerequisites

**Required:**
- Docker & Docker Compose (v2+)
- Node.js 18+ and npm
- Hyperledger Fabric binaries 2.5.x (`peer`, `configtxgen`, `cryptogen`, `osnadmin`)

**Verify prerequisites:**
```bash
./scripts/check-prerequisites.sh
```

### One-Command Startup

```bash
# Clone and run
git clone <repo-url>
cd hyperledger_v1

# Make scripts executable (first time only)
chmod +x *.sh scripts/*.sh

# Start everything
./start-all.sh
```

This will:
1. ✅ Check prerequisites
2. ✅ Stop any existing network
3. ✅ Generate crypto materials  
4. ✅ Start all 24 Docker containers
5. ✅ Create channel and join all peers
6. ✅ Deploy chaincode with private data collection
7. ✅ Install client dependencies
8. ✅ Run interactive demo

### Post-Setup Commands

```bash
cd client

# Run interactive demo
npm run demo

# Run all tests with summary
npm run test:all

# Individual test suites
npm run test           # Comprehensive tests
npm run test:security  # Security/RBAC tests
npm run test:fault     # Fault tolerance tests

# Stop network
cd .. && ./stop-all.sh
```

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Asset Approval System                         │
├─────────────────────────────────────────────────────────────────┤
│  Ordering Service (Raft - 3 nodes)                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ orderer  │  │ orderer2 │  │ orderer3 │                      │
│  │  :7050   │  │  :8050   │  │  :9050   │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
├─────────────────────────────────────────────────────────────────┤
│  Organizations                                                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ Org1 (Owner)    │ │ Org2 (Auditor)  │ │ Org3 (Regulator)│   │
│  │ peer0 :7051 (E) │ │ peer0 :8051 (E) │ │ peer0 :9051 (E) │   │
│  │ peer1 :7151 (Q) │ │ peer1 :8151 (Q) │ │ peer1 :9151 (Q) │   │
│  │ peer2 :7251 (C) │ │ peer2 :8251 (C) │ │ peer2 :9251 (C) │   │
│  │ CA    :7054     │ │ CA    :8054     │ │ CA    :9054     │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
(E) = Endorser, (Q) = Query, (C) = Committer
```

---

## 🔑 Key Features

### 1. Explicit State Machine
```
CREATED → PENDING_APPROVAL → APPROVED → ACTIVE → DELETED
                          ↘ REJECTED ↗
```

### 2. Organization-Based Access Control (OBAC)

| Organization | Role | Permissions |
|--------------|------|-------------|
| Org1MSP | Asset Owner | Create, Update, Submit, Activate, Delete |
| Org2MSP | Auditor | Approve, Reject, Query (+ Private Data) |
| Org3MSP | Regulator | Approve, Reject, Query (Public Only) |

### 3. Endorsement Policy
```
AND('Org1MSP.peer', OR('Org2MSP.peer', 'Org3MSP.peer'))
```
- Asset owner (Org1) always endorses
- At least one approver (Org2 OR Org3) endorses

### 4. Private Data Collection
- `assetPrivateOrg1Org2`: Confidential data shared only between Org1 (Owner) and Org2 (Auditor)
- Org3 (Regulator) can only see public asset data

### 5. Input Validation
- Asset ID: max 64 chars, alphanumeric + underscore/hyphen
- Description: max 1024 chars

---

## 📁 Project Structure

```
hyperledger_v1/
├── chaincode/asset-approval/   # TypeScript chaincode
│   └── src/assetApproval.ts   # Main contract logic
├── client/                     # Node.js client application
│   └── src/
│       ├── demo.js            # Interactive demo
│       ├── fabricClient.js    # Fabric gateway client
│       └── *Test.js           # Test suites
├── network/                    # Network configuration
│   ├── configtx.yaml          # Channel/org policies
│   ├── crypto-config.yaml     # Crypto material config
│   └── docker/
│       ├── docker-compose.yaml
│       └── .env               # Credentials (gitignored)
├── scripts/                    # Automation scripts
│   ├── check-prerequisites.sh # Verify dependencies
│   ├── start-network.sh       # Start containers
│   ├── deploy-chaincode.sh    # Deploy chaincode
│   └── stop-network.sh        # Cleanup
├── docs/                       # Documentation
├── start-all.sh               # One-command startup
└── stop-all.sh                # One-command shutdown
```

---

## ⚙️ Configuration

### Credentials
Credentials are configured via environment variables in `network/docker/.env`:
```bash
CA_ADMIN_USER=admin
CA_ADMIN_PASSWORD=adminpw
COUCHDB_USER=admin
COUCHDB_PASSWORD=adminpw
```

> ⚠️ **Change these before production deployment!**

### Performance Tuning

| Parameter | Value | Description |
|-----------|-------|-------------|
| BatchTimeout | 200ms | Block creation interval |
| MaxMessageCount | 50 | Max transactions per block |
| Expected TPS | 300-500 | Transactions per second |
| Expected Latency | 300-500ms | Transaction confirmation |

---

## 🔧 Troubleshooting

### Common Issues

**Docker not running:**
```bash
# Check Docker status
docker info

# Start Docker daemon (Linux)
sudo systemctl start docker
```

**Fabric binaries not found:**
```bash
# Download and install
curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh | bash -s -- binary

# Add to PATH
export PATH=$PATH:$(pwd)/bin
```

**Port conflicts:**
```bash
# Check what's using ports
netstat -tlnp | grep -E '(7050|7051|8051|9051)'

# Stop conflicting containers
docker stop $(docker ps -aq)
```

**Clean restart:**
```bash
./stop-all.sh
docker volume prune -f
./start-all.sh
```

---

## 📄 License

Apache-2.0
