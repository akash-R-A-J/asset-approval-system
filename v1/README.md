<h1 align="center">
  <br>
  🚀 Asset Approval System v1
  <br>
</h1>

<h4 align="center">Multi-peer architecture with <a href="https://www.typescriptlang.org/">TypeScript</a> chaincode</h4>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Fabric-2.5-2F3134?style=for-the-badge&logo=hyperledger&logoColor=white" alt="Fabric">
  <img src="https://img.shields.io/badge/Containers-24-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Containers">
  <img src="https://img.shields.io/badge/Peers_per_Org-3-green?style=for-the-badge" alt="Multi-Peer">
</p>

<p align="center">
  <a href="#-key-features">Features</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-test-suites">Tests</a>
</p>

---

## ✨ Key Features

<table>
  <tr>
    <td>📘</td>
    <td><b>TypeScript</b></td>
    <td>Type-safe chaincode with interfaces and enums</td>
  </tr>
  <tr>
    <td>🖥️</td>
    <td><b>Multi-Peer</b></td>
    <td>3 peers per org (Endorser, Query, Committer)</td>
  </tr>
  <tr>
    <td>🔄</td>
    <td><b>6-State Machine</b></td>
    <td>Complete lifecycle with resubmission support</td>
  </tr>
  <tr>
    <td>✅</td>
    <td><b>Input Validation</b></td>
    <td>Chaincode-level validation with clear error messages</td>
  </tr>
  <tr>
    <td>🧪</td>
    <td><b>Comprehensive Tests</b></td>
    <td>Security, fault tolerance, and performance tests</td>
  </tr>
  <tr>
    <td>🎯</td>
    <td><b>Endorsement Awareness</b></td>
    <td>Explicit peer roles aligned with endorsement, query, and commit paths</td>
  </tr>
</table>

---

## 📊 Version Comparison

| Aspect | v0 | v1 (This) | v2 |
|--------|:--:|:---------:|:--:|
| **Language** | JavaScript | **TypeScript** | TypeScript |
| **Peers per Org** | 1 | **3** | 1 |
| **Container Count** | 12 | **24** | 12 |
| **Resubmission** | ❌ | **✅** | ✅ |
| **Access Control** | OBAC | OBAC | **ABAC** |

---

## 🚀 Getting Started

### Step 1: Install Prerequisites

> ⚠️ **Requires Linux or WSL2** - Hyperledger Fabric cannot run on native Windows.

#### Install Docker

```bash
# Update packages
sudo apt-get update

# Install Docker
sudo apt-get install -y docker.io docker-compose-plugin

# Add your user to docker group (logout/login after)
sudo usermod -aG docker $USER

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker
```

#### Install Node.js 18+

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js 18
nvm install 18
nvm use 18
```

#### Install jq

```bash
sudo apt-get install -y jq
```

#### Install Hyperledger Fabric Binaries

```bash
# Create directory for Fabric
mkdir -p ~/fabric && cd ~/fabric

# Download Fabric binaries (2.5.0)
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.5

# Add to PATH (add this to ~/.bashrc for permanence)
export PATH=$PATH:~/fabric/fabric-samples/bin
```

---

### Step 2: Verify Prerequisites

```bash
# Docker (should show 20+)
docker --version

# Docker Compose (should show v2+)
docker compose version

# Node.js (should show 18+)
node --version

# Fabric peer (should show 2.5.x)
peer version

# jq (any version)
jq --version
```

**Expected output:**
```
Docker version 24.0.x
Docker Compose version v2.x.x
v18.x.x
peer:
 Version: 2.5.0
jq-1.6
```

---

### Step 3: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/akash-R-A-J/asset-approval-system.git

# Navigate to v1
cd asset-approval-system/v1
```

---

### Step 4: Make Scripts Executable

```bash
# Make all scripts executable
chmod +x *.sh
chmod +x scripts/*.sh
```

---

### Step 5: Start the Network

```bash
./start-all.sh
```

**What happens:**
```
✓ Checking prerequisites...
✓ Generating crypto materials...
✓ Starting network (24 containers)...
✓ Creating channel...
✓ Joining all 9 peers to channel...
✓ Deploying TypeScript chaincode...
✓ Installing client dependencies...
✓ Running demo...

════════════════════════════════════════════
  SUCCESS! Network is ready.
════════════════════════════════════════════
```

**Estimated time:** 5-8 minutes (24 containers + TypeScript compilation)

---

### Step 6: Run the Demo

```bash
cd client
npm run demo
```

This runs an interactive demo showing:
1. Asset creation by Owner
2. Submission for approval
3. Approval by Auditor
4. Approval by Regulator
5. Activation by Owner
6. Full audit trail

---

### Step 7: Run Tests

```bash
cd client

# Run all tests with summary
npm run test:all

# Or run individual test suites:
npm run test           # Comprehensive tests
npm run test:security  # RBAC & access control (12 tests)
npm run test:fault     # Raft fault tolerance
npm run test:perf      # Performance benchmarks
```

---

### Step 8: Stop the Network

```bash
# From v1 directory
./stop-all.sh
```

---

## 🛠️ Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `docker: command not found` | Install Docker: `sudo apt-get install docker.io` |
| `permission denied` on docker | Run `sudo usermod -aG docker $USER` and re-login |
| `peer: command not found` | Add Fabric binaries to PATH |
| Port already in use | Run `docker stop $(docker ps -aq)` |
| TypeScript compile error | `cd chaincode/asset-approval && npm run build` |
| ENDORSEMENT_POLICY_FAILURE | Wait 30s and retry (cold start issue) |

### Clean Restart

```bash
# Stop everything
./stop-all.sh

# Remove all Docker volumes
docker volume prune -f

# Remove all Docker networks
docker network prune -f

# Remove generated files
rm -rf network/organizations network/channel-artifacts

# Start fresh
./start-all.sh
```

### View Container Logs

```bash
# Peer logs
docker logs peer0.org1.example.com

# Follow logs in real-time
docker logs -f peer0.org1.example.com

# Chaincode logs
docker logs $(docker ps -q --filter name=dev-peer0.org1)

# All containers
docker-compose -f network/docker/docker-compose.yaml logs
```

---

## 🏗️ Architecture

### Multi-Peer Topology (24 Containers)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          ORDERING SERVICE (Raft)                              │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐                │
│  │    orderer     │   │    orderer2    │   │    orderer3    │                │
│  │     :7050      │   │     :8050      │   │     :9050      │                │
│  └────────────────┘   └────────────────┘   └────────────────┘                │
│                     Crash Fault Tolerant (1/3)                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┏━━━━━━━━━━━━━━━━━┓    ┏━━━━━━━━━━━━━━━━━┓    ┏━━━━━━━━━━━━━━━━━━┓         │
│  ┃  ORG1 (Owner)   ┃    ┃  ORG2 (Auditor) ┃    ┃ ORG3 (Regulator) ┃         │
│  ┣━━━━━━━━━━━━━━━━━┫    ┣━━━━━━━━━━━━━━━━━┫    ┣━━━━━━━━━━━━━━━━━━┫         │
│  ┃ peer0 :7051 (E) ┃    ┃ peer0 :8051 (E) ┃    ┃ peer0  :9051 (E) ┃         │
│  ┃ peer1 :7151 (Q) ┃    ┃ peer1 :8151 (Q) ┃    ┃ peer1  :9151 (Q) ┃         │
│  ┃ peer2 :7251 (C) ┃    ┃ peer2 :8251 (C) ┃    ┃ peer2  :9251 (C) ┃         │
│  ┃ CA       :7054  ┃    ┃ CA       :8054  ┃    ┃ CA        :9054  ┃         │
│  ┃ CouchDB ×3      ┃    ┃ CouchDB ×3      ┃    ┃ CouchDB ×3       ┃         │
│  ┗━━━━━━━━━━━━━━━━━┛    ┗━━━━━━━━━━━━━━━━━┛    ┗━━━━━━━━━━━━━━━━━━┛         │
│                                                                              │
│  (E) Endorser/Leader    (Q) Query Node    (C) Committer Node                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 State Machine

```
CREATED → PENDING_APPROVAL → APPROVED → ACTIVE → DELETED
                          ↓
                      REJECTED → PENDING_APPROVAL (resubmit) ✨
```

| From | To | Action | Role |
|------|----|--------|------|
| CREATED | PENDING_APPROVAL | Submit for review | Owner |
| PENDING | APPROVED | Both approve | Auditor + Regulator |
| PENDING | REJECTED | Any rejects | Auditor or Regulator |
| **REJECTED** | **PENDING** | **Resubmit** ✨ | Owner |
| APPROVED | ACTIVE | Activate | Owner |
| Any | DELETED | Soft delete | Owner |

---

## 🔐 Access Control (OBAC)

| Operation | Owner | Auditor | Regulator |
|-----------|:-----:|:-------:|:---------:|
| CreateAsset | ✅ | ❌ | ❌ |
| SubmitForApproval | ✅ | ❌ | ❌ |
| ApproveAsset | ❌ | ✅ | ✅ |
| RejectAsset | ❌ | ✅ | ✅ |
| ActivateAsset | ✅ | ❌ | ❌ |
| DeleteAsset | ✅ | ❌ | ❌ |
| ReadPrivateData | ✅ | ✅ | ❌ |

---

## 🧪 Test Suites

### Security Tests (`npm run test:security`)

| Test | Description |
|------|-------------|
| Owner can create | Org1 creates successfully |
| Auditor denied create | Org2 gets access denied |
| Owner denied self-approve | Org1 cannot approve own assets |
| Private data isolation | Org3 cannot read private data |

### Fault Tolerance Tests (`npm run test:fault`)

| Scenario | Expected |
|----------|----------|
| All orderers up | ✅ Transactions succeed |
| 1 orderer down | ✅ Transactions succeed |
| 2 orderers down | ❌ Transactions fail (expected) |

---

<p align="center">
  <a href="../README.md">⬅️ Back to Main</a> •
  <a href="../v0/">📚 v0 (Simple)</a> •
  <a href="../v2/">⚡ Upgrade to v2</a>
</p>
