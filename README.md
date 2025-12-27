# Asset Approval System - Hyperledger Fabric

<div align="center">

![Hyperledger Fabric](https://img.shields.io/badge/Hyperledger%20Fabric-v2.5-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-Apache%202.0-yellow)
![Docker](https://img.shields.io/badge/Docker-Required-blue)

**A production-ready distributed blockchain system for multi-organization asset approval workflows.**

📚 **[View Full Documentation](https://deepwiki.com/akash-R-A-J/asset-approval-system)**

</div>

---

## 📖 About This Project

### The Problem

In enterprise environments, asset approvals often require **multiple organizations** to review and sign off before an asset can be considered valid. Traditional centralized systems suffer from:

- ❌ Single point of failure
- ❌ No audit trail of who approved what and when
- ❌ Trust issues between organizations
- ❌ Data tampering risks
- ❌ No privacy for sensitive information

### The Solution

This project implements a **decentralized, permissioned blockchain** using Hyperledger Fabric that:

- ✅ **Distributes trust** across multiple organizations (no single owner)
- ✅ **Immutable audit trail** - every action is recorded on the blockchain
- ✅ **Fault tolerant** - survives node failures (Raft consensus)
- ✅ **Private data** - sensitive information shared only with authorized orgs
- ✅ **Smart contract enforcement** - business rules enforced in code

### Use Case: Multi-Organization Approval Workflow

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Org1        │      │  Org2        │      │  Org3        │
│  Asset Owner │ ──▶  │  Auditor     │ ──▶  │  Regulator   │
│  Creates     │      │  Approves    │      │  Approves    │
└──────────────┘      └──────────────┘      └──────────────┘
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             ▼
                    ┌──────────────────┐
                    │  ASSET APPROVED  │
                    │  (Immutable)     │
                    └──────────────────┘
```

---

## ✨ Key Features

### Network Architecture
- **3 Organizations** with independent Certificate Authorities
- **3 Orderers** running Raft consensus (fault tolerant)
- **CouchDB** state database for rich JSON queries
- **TLS encryption** for all communications

### Security & Access Control
- **Organization-Based Access Control (OBAC)** enforced in smart contract
- **Only Org1** can create/update/delete assets
- **Only Org2 & Org3** can approve/reject assets
- **All orgs** can query public data
- **Only Org1 & Org2** can access private data

### State Machine Enforcement
- Assets follow strict lifecycle: `PENDING → APPROVED` or `PENDING → REJECTED`
- **Finalized assets are immutable** - cannot be modified after approval/rejection
- All state transitions recorded with timestamps

### Private Data Collections
- Sensitive data (descriptions, valuations) stored in private data collection
- **Org3 (Regulator)** cannot see private details - only public status
- Hash of private data recorded on-chain for verification

### Testing & Validation
- **18 automated security tests** covering OBAC, state machine, private data
- **Fault tolerance tests** demonstrating Raft consensus behavior
- **Interactive demo script** for live demonstrations

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HYPERLEDGER FABRIC NETWORK                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   ORDERER ORG   │  │                 │  │                 │             │
│  │  (Raft 3 nodes) │  │                 │  │                 │             │
│  │  orderer0:7050  │  │                 │  │                 │             │
│  │  orderer1:8050  │  │                 │  │                 │             │
│  │  orderer2:9050  │  │                 │  │                 │             │
│  └────────┬────────┘  │                 │  │                 │             │
│           │           │                 │  │                 │             │
│  ┌────────▼────────┐  ┌────────────────┐  ┌────────────────┐              │
│  │   ORG1 (Owner)  │  │  ORG2 (Auditor)│  │ORG3 (Regulator)│              │
│  │  CA: 7054       │  │  CA: 8054      │  │  CA: 9054      │              │
│  │  Peer: 7051     │  │  Peer: 9051    │  │  Peer: 11051   │              │
│  │  CouchDB: 5984  │  │  CouchDB: 7984 │  │  CouchDB: 8984 │              │
│  └─────────────────┘  └────────────────┘  └────────────────┘              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     CHANNEL: asset-channel                           │   │
│  │  ┌─────────────────┐  ┌──────────────────────────────────────────┐  │   │
│  │  │  PUBLIC LEDGER  │  │  PRIVATE DATA COLLECTION (Org1+Org2)     │  │   │
│  │  │  - assetID      │  │  - description                           │  │   │
│  │  │  - status       │  │  - internal notes                        │  │   │
│  │  │  - approvals    │  │  - valuation amount                      │  │   │
│  │  │  - timestamps   │  │  - confidential terms                    │  │   │
│  │  └─────────────────┘  └──────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---


## 📋 Prerequisites

> ⚠️ **IMPORTANT:** This system requires **Linux** or **WSL2 (Windows Subsystem for Linux)**. It cannot run on native Windows because Hyperledger Fabric binaries, Docker networking, and shell scripts require a Linux environment.

### Platform Requirements

| Platform | Requirement |
|----------|-------------|
| **Linux** | Ubuntu 22.04+ recommended |
| **Windows** | WSL2 with Ubuntu 22.04+ (`wsl --install -d Ubuntu-22.04`) |
| **macOS** | Not tested, but should work with Docker Desktop |

### Required Software (Install in Linux/WSL)

| Software | Version | Installation |
|----------|---------|----------|
| **Docker** | 20+ | [Install Docker](https://docs.docker.com/engine/install/ubuntu/) or Docker Desktop with WSL2 |
| **Docker Compose** | v2+ | Included with Docker Desktop or `apt install docker-compose-plugin` |
| **Node.js** | v18+ | `curl -fsSL https://deb.nodesource.com/setup_18.x \| sudo -E bash - && sudo apt install -y nodejs` |
| **jq** | Any | `sudo apt install -y jq` |
| **Git** | Any | `sudo apt install -y git` |

### Fabric Binaries (Install in Linux/WSL)

```bash
cd ~
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh --fabric-version 2.5.0 binary

# Add to PATH
echo 'export PATH=$PATH:$HOME/bin' >> ~/.bashrc
source ~/.bashrc

# Verify
peer version
fabric-ca-client version
```

---

## 🚀 Quick Start

> All commands below must be run **inside Linux or WSL**, not in Windows PowerShell/CMD.

```bash
# Navigate to your projects directory
cd ~ && mkdir -p projects && cd projects

# Clone the repository (replace with your actual repo URL)
git clone https://github.com/akash-R-A-J/hyperledger-asset-approval.git hyperledger

# Enter project directory
cd hyperledger

# Make all scripts executable
chmod +x scripts/*.sh network/scripts/*.sh
```

> **📦 What to Expect After Cloning:**
> 
> The repository does NOT include generated files (they are in `.gitignore`). When you run `start-all.sh`, the following will be automatically created:
> 
> | Generated | Location | Purpose |
> |-----------|----------|---------|
> | Crypto material | `network/organizations/` | Private keys, certificates for all orgs |
> | Channel artifacts | `network/channel-artifacts/` | Channel configuration blocks |
> | Client wallets | `client/wallet/` | Enrolled admin identities |
> | Node modules | `*/node_modules/` | Dependencies (via `npm install`) |
> 
> These files are unique to your deployment and should never be committed to git.

#### Verify Your Environment

Before running the network, ensure all prerequisites are installed:

```bash
# Check Docker
docker --version          # Should show Docker version 20+
docker compose version    # Should show Docker Compose v2+
docker info > /dev/null && echo "✓ Docker is running" || echo "✗ Start Docker first"

# Check Node.js
node --version            # Should show v18+
npm --version             # Should show 8+

# Check Fabric binaries
peer version              # Should show Fabric 2.5.x
fabric-ca-client version  # Should show CA 1.5.x

# Check other tools
jq --version              # Any version
```

> **Note:** All required versions are listed in the Prerequisites section above. The system is tested with Fabric 2.5.0, Node.js 18+, and Docker 20+.

#### Start the Network

```bash
# Start everything (takes 3-5 minutes on first run)
./scripts/start-all.sh

# You should see:
# ✓ Network started
# ✓ Channel created
# ✓ Chaincode deployed
# ✓ Client setup complete
# ✓ Chaincode warmed up
# SUCCESS! Network is ready for demo
```

> **Note for Windows Users:** If you previously downloaded the project on Windows, copy it to WSL first:
> ```bash
> cp -r /mnt/c/Users/<USERNAME>/Desktop/hyperledger ~/projects/
> cd ~/projects/hyperledger
> find . -name "*.sh" -exec dos2unix {} \;  # Fix line endings
> find . -name "*.yaml" -exec dos2unix {} \;
> chmod +x scripts/*.sh network/scripts/*.sh
> ```

### Run Demo and Tests


```bash
# Interactive demonstration
./scripts/demo.sh

# Security test suite (18 tests)
./scripts/run-tests.sh

# Raft fault tolerance tests
./scripts/test-fault-tolerance.sh

# Stop when done
./scripts/stop-all.sh
```

---

## 📁 Project Structure

```
hyperledger/
├── scripts/                           # Operational scripts
│   ├── start-all.sh                  # Complete network startup
│   ├── stop-all.sh                   # Clean shutdown
│   ├── demo.sh                       # Interactive workflow demo
│   ├── run-tests.sh                  # Security test suite (18 tests)
│   └── test-fault-tolerance.sh       # Raft consensus tests
│
├── network/
│   ├── configtx/configtx.yaml        # Channel & org configuration
│   ├── docker/                       # Docker Compose files
│   │   ├── docker-compose.yaml       # Peers, orderers, CouchDB
│   │   └── docker-compose-ca.yaml    # Certificate authorities
│   ├── organizations/                # Crypto material (generated)
│   ├── peercfg/core.yaml             # Peer configuration
│   └── scripts/                      # Network operational scripts
│       ├── network.sh                # Network lifecycle control
│       ├── createChannel.sh          # Channel creation
│       ├── deployCC.sh               # Chaincode deployment
│       ├── registerEnroll.sh         # Identity enrollment
│       └── envVar.sh                 # Environment setup
│
├── chaincode/
│   └── asset-approval/
│       ├── lib/assetContract.js      # Smart contract (OBAC, state machine)
│       ├── collections_config.json   # Private data collection config
│       ├── index.js                  # Chaincode entry point
│       └── package.json
│
├── client/
│   ├── src/
│   │   ├── app.js                    # CLI application with validation
│   │   ├── config.js                 # Centralized configuration
│   │   ├── gateway.js                # Network connection management
│   │   ├── invoke.js                 # Transaction functions
│   │   ├── query.js                  # Query functions
│   │   ├── enrollAdmin.js            # Admin enrollment
│   │   └── registerUser.js           # User registration
│   ├── wallet/                       # Identity wallets (generated)
│   └── package.json
│
└── docs/
    └── ARCHITECTURE.md               # Detailed technical documentation
```

---

## 🔐 Organization-Based Access Control (OBAC)

Access control is enforced **in chaincode** using MSP ID verification:

| Function | Org1 (Owner) | Org2 (Auditor) | Org3 (Regulator) |
|----------|:------------:|:--------------:|:----------------:|
| CreateAsset | ✅ | ❌ | ❌ |
| UpdateAssetStatus | ✅ | ❌ | ❌ |
| ApproveAsset | ❌ | ✅ | ✅ |
| RejectAsset | ❌ | ✅ | ✅ |
| QueryAsset (public) | ✅ | ✅ | ✅ |
| QueryPrivateDetails | ✅ | ✅ | ❌ |
| DeleteAsset | ✅ | ❌ | ❌ |

> **Note:** This can be extended to Attribute-Based Access Control (ABAC) using Fabric CA certificate attributes.

---

## 🔄 Asset Lifecycle State Machine

```
     ┌─────────┐
     │ CREATE  │ ← Org1 creates asset
     └────┬────┘
          │
          ▼
     ┌─────────┐     Org2+Org3      ┌─────────┐
     │ PENDING │ ─── approves ────► │APPROVED │ ◄── FINAL (immutable)
     └────┬────┘                    └─────────┘
          │
          │  Org2|Org3
          └── rejects ─────────────►┌──────────┐
                                   │ REJECTED │ ◄── FINAL (immutable)
                                   └──────────┘
```

> **Important:** Once an asset reaches APPROVED or REJECTED status, it cannot be modified. This is enforced in chaincode with state guards.

---

## 🧪 Test Suites

### Security Tests (`run-tests.sh`)

Runs 18 automated tests verifying:

| Suite | Tests | Coverage |
|-------|-------|----------|
| Access Control (OBAC) | 6 | Create/approve permissions |
| State Machine | 3 | Finalized asset immutability |
| Rejection Workflow | 3 | Reject and block approval |
| Query Permissions | 3 | All orgs can read public data |
| Private Data Access | 3 | Org3 cannot access private data |

```bash
./scripts/run-tests.sh
# Output: All 18 tests PASS
```

### Fault Tolerance Tests (`test-fault-tolerance.sh`)

Demonstrates Raft consensus fault tolerance:

| Scenario | Expected Result |
|----------|-----------------|
| All 3 orderers running | ✅ Transactions succeed |
| 1 orderer down (2/3 quorum) | ✅ Transactions succeed |
| 2 orderers down (1/3 no quorum) | ❌ Transactions fail (expected) |
| Orderers restart | ✅ Network recovers |

```bash
./scripts/test-fault-tolerance.sh
```

---

## 🖥️ CLI Commands

```bash
# Create asset (Org1 only)
node src/app.js create <assetID> <description> <org> <userId>
node src/app.js create ASSET001 "Manufacturing Equipment" org1 admin

# Query asset (all orgs)
node src/app.js query <assetID> <org> <userId>

# Query private data (Org1/Org2 only)
node src/app.js queryPrivate <assetID> <org> <userId>

# Approve asset (Org2/Org3)
node src/app.js approve <assetID> <org> <userId>

# Reject asset (Org2/Org3)
node src/app.js reject <assetID> <reason> <org> <userId>

# View asset history
node src/app.js history <assetID> <org> <userId>

# List all assets
node src/app.js list <org> <userId>

# Delete asset (Org1 admin only)
node src/app.js delete <assetID> <org> <userId>
```

---

## ⚙️ Configuration

### Environment Variables (Production)

```bash
# Set before running client application
export NODE_ENV=production
export ORG1_ADMIN_SECRET=<secure-password>
export ORG2_ADMIN_SECRET=<secure-password>
export ORG3_ADMIN_SECRET=<secure-password>
export TLS_VERIFY=true
```

### Input Validation

The CLI automatically validates:
- **Asset ID:** 1-64 alphanumeric characters, underscores, hyphens
- **Organization:** Must be org1, org2, or org3
- **User ID:** Alphanumeric only
- **Description:** Max 500 characters
- **Reason:** Required, max 1000 characters

---

## 🏛️ Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Identity Provider | Fabric CA | Production-ready, supports revocation |
| Consensus | Raft (3 nodes) | CFT for trusted consortium |
| Endorsement Policy | OR(Org1, Org2, Org3) | Flexible; OBAC in chaincode |
| State Database | CouchDB | Rich JSON queries required |
| Chaincode Language | Node.js | Modern, maintainable |
| Private Data | Org1Org2Collection | Sensitive data isolation |

---

## 🛠️ Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `fabric-ca-client: not found` | Binaries not in PATH | Install and add `~/bin` to PATH |
| `GLIBC_2.32 not found` | Ubuntu too old | Use Ubuntu 22.04+ in WSL |
| `No Raft leader` | Orderers not joined | All 3 must join via osnadmin |
| ENDORSEMENT_POLICY_FAILURE | Cold start | Wait and retry |
| Permission denied on cleanup | Root-owned CA files | Use `sudo rm -rf` |

---

## 📝 License

Apache-2.0

---

<div align="center">

**Built with Hyperledger Fabric v2.5 | Node.js Chaincode | Raft Consensus | Fabric CA**

*Demonstrates enterprise blockchain patterns: OBAC, Private Data, State Machines, Fault Tolerance*

</div>
