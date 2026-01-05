<h1 align="center">
  <br>
  ⚡ Asset Approval System v2
  <br>
</h1>

<h4 align="center">True ABAC with <a href="https://hyperledger-fabric-ca.readthedocs.io/">Fabric CA</a> - Production-ready patterns</h4>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Fabric-2.5-2F3134?style=for-the-badge&logo=hyperledger&logoColor=white" alt="Fabric">
  <img src="https://img.shields.io/badge/ABAC-Certificate_Attrs-4CAF50?style=for-the-badge" alt="ABAC">
  <img src="https://img.shields.io/badge/Fabric_CA-100%25-FF6B35?style=for-the-badge" alt="Fabric CA">
</p>

<p align="center">
  <a href="#-key-features">Features</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-design-decisions">Design</a> •
  <a href="#-how-abac-works">ABAC</a>
</p>

---

## ✨ Key Features

<table>
  <tr>
    <td>🎯</td>
    <td><b>True ABAC</b></td>
    <td>Role read from X.509 certificate attributes, not MSP ID</td>
  </tr>
  <tr>
    <td>🏛️</td>
    <td><b>100% Fabric CA</b></td>
    <td>All identities issued by CA (no cryptogen)</td>
  </tr>
  <tr>
    <td>🔌</td>
    <td><b>Org-Agnostic</b></td>
    <td>No hardcoded org names in chaincode</td>
  </tr>
  <tr>
    <td>➕</td>
    <td><b>Config-Only Extension</b></td>
    <td>Add Org4 without any code changes</td>
  </tr>
  <tr>
    <td>🧪</td>
    <td><b>32+ Tests</b></td>
    <td>6 test suites covering all scenarios</td>
  </tr>
  <tr>
    <td>🔀</td>
    <td><b>Identity ≠ Authorization</b></td>
    <td>Identity issued by CA, authorization enforced exclusively in chaincode</td>
  </tr>
</table>

---

## 📊 Version Comparison

| Aspect | v0 | v1 | v2 (This) |
|--------|:--:|:--:|:---------:|
| **Language** | JS | TS | TS |
| **Access Control** | OBAC | OBAC | **ABAC** ✨ |
| **Role Source** | MSP ID | MSP ID | **Certificate** ✨ |
| **Identity Mgmt** | cryptogen | cryptogen | **Fabric CA** ✨ |
| **Add New Org** | Code change | Code change | **Config only** ✨ |

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

# Download Fabric binaries (2.5.0) with CA client
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

# Fabric CA client (required for v2!)
fabric-ca-client version

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
fabric-ca-client:
 Version: 1.5.5
jq-1.6
```

> ⚠️ **v2 requires `fabric-ca-client`** - This is automatically included when you download Fabric binaries.

---

### Step 3: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/akash-R-A-J/asset-approval-system.git

# Navigate to v2
cd asset-approval-system/v2
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
✓ Starting Fabric CAs...
✓ Enrolling CA admins...
✓ Registering identities with role attributes...
✓ Enrolling user identities...
✓ Creating orderer genesis block...
✓ Starting orderers and peers (12 containers)...
✓ Creating channel...
✓ Joining peers to channel...
✓ Deploying TypeScript chaincode...
✓ Installing client dependencies...
✓ Running demo...

════════════════════════════════════════════
  SUCCESS! Network is ready with True ABAC.
════════════════════════════════════════════
```

**Estimated time:** 5-7 minutes (includes CA enrollment)

---

### Step 6: Run the Demo

```bash
cd client
npm run demo
```

Demo shows:
1. GetCallerInfo - displays role from certificate
2. Asset creation by `role=owner`
3. Approval by `role=auditor`
4. Approval by `role=regulator`
5. Activation by `role=owner`
6. Complete audit trail

---

### Step 7: Run Tests

```bash
cd client

# Run ALL 32 tests
npm test

# Or run individual test suites:
npm run test:abac       # ABAC role verification (6 tests)
npm run test:state      # State machine transitions (5 tests)
npm run test:approval   # Approval workflow (5 tests)
npm run test:rejection  # Rejection workflow (4 tests)
npm run test:query      # Query operations (6 tests)
npm run test:security   # Security validations (6 tests)

# List all available suites
npm run test:list

# Show help
npm run test:help
```

**Expected output:**
```
════════════════════════════════════════════
         TEST RESULTS SUMMARY
════════════════════════════════════════════
  abac:      6/6 passed ✓
  state:     5/5 passed ✓
  approval:  5/5 passed ✓
  rejection: 4/4 passed ✓
  query:     6/6 passed ✓
  security:  6/6 passed ✓
────────────────────────────────────────────
  TOTAL:    32/32 passed (100%)
════════════════════════════════════════════
```

---

### Step 8: Stop the Network

```bash
# From v2 directory
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
| `fabric-ca-client: command not found` | Install Fabric CA: `curl -sSL https://bit.ly/2ysbOFE \| bash -s` |
| CA enrollment fails | Check CA container logs: `docker logs ca_org1` |
| Port already in use | Run `docker stop $(docker ps -aq)` |

### Clean Restart

```bash
# Stop everything
./stop-all.sh

# Remove all Docker volumes
docker volume prune -f

# Remove all Docker networks
docker network prune -f

# Remove generated files (CA certs, channel artifacts)
rm -rf network/organizations network/channel-artifacts

# Start fresh
./start-all.sh
```

### View Container Logs

```bash
# CA logs (check enrollment issues)
docker logs ca_org1
docker logs ca_org2
docker logs ca_org3

# Peer logs
docker logs peer0.org1.example.com

# Orderer logs
docker logs orderer.example.com

# Chaincode logs
docker logs $(docker ps -q --filter name=dev-peer0.org1)
```

---

## 🎨 Design Decisions

### Why 1 Peer per Org?
Simpler topology focused on demonstrating ABAC. Production adds redundant peers.

### Why Fabric CA (not cryptogen)?
**cryptogen** cannot embed custom attributes. **Fabric CA** enables:
```bash
fabric-ca-client register --id.attrs 'role=auditor:ecert'
```

### Why ABAC over OBAC?
```
OBAC (v0, v1): getMSPID() → hardcoded map → role
               Problem: Org4 requires code change

ABAC (v2):     getAttributeValue('role') → role
               Benefit: Org4 = just issue cert with role attribute
```

---

## 🔑 How ABAC Works

### Certificate Attribute Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. FABRIC CA ENROLLMENT                                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  fabric-ca-client register \                                         │
│      --id.name user1 \                                               │
│      --id.attrs 'role=auditor:ecert'  ◄── Role embedded in cert     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  2. CHAINCODE READS ATTRIBUTE                                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  const role = ctx.clientIdentity.getAttributeValue('role');          │
│  // Returns 'auditor' ◄── Read directly from certificate            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  3. AUTHORIZATION DECISION                                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  this.requireRole(ctx, ['auditor', 'regulator']);                    │
│  // Allows if caller's role is in allowed list                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ORDERING SERVICE (Raft)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │    orderer      │  │    orderer2     │  │    orderer3     │          │
│  │     :7050       │  │     :8050       │  │     :9050       │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┏━━━━━━━━━━━━━━━━━┓   ┏━━━━━━━━━━━━━━━━━┓   ┏━━━━━━━━━━━━━━━━━━┓     │
│   ┃  ORG1 (Owner)   ┃   ┃  ORG2 (Auditor) ┃   ┃ ORG3 (Regulator) ┃     │
│   ┣━━━━━━━━━━━━━━━━━┫   ┣━━━━━━━━━━━━━━━━━┫   ┣━━━━━━━━━━━━━━━━━━┫     │
│   ┃ Peer     :7051  ┃   ┃ Peer     :9051  ┃   ┃ Peer    :11051   ┃     │
│   ┃ CA       :7054  ┃   ┃ CA       :8054  ┃   ┃ CA       :9054   ┃     │
│   ┃ CouchDB  :5984  ┃   ┃ CouchDB  :7984  ┃   ┃ CouchDB  :8984   ┃     │
│   ┃ ───────────────  ┃   ┃ ───────────────  ┃   ┃ ────────────────  ┃    │
│   ┃ role=owner      ┃   ┃ role=auditor    ┃   ┃ role=regulator   ┃    │
│   ┗━━━━━━━━━━━━━━━━━┛   ┗━━━━━━━━━━━━━━━━━┛   ┗━━━━━━━━━━━━━━━━━━┛     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 State Machine

```
CREATED → PENDING_APPROVAL → APPROVED → ACTIVE → DELETED
                          ↓
                      REJECTED → PENDING_APPROVAL (resubmit)
```

---

## 🔐 Access Control (ABAC)

| Operation | owner | auditor | regulator |
|-----------|:-----:|:-------:|:---------:|
| CreateAsset | ✅ | ❌ | ❌ |
| ApproveAsset | ❌ | ✅ | ✅ |
| RejectAsset | ❌ | ✅ | ✅ |
| ActivateAsset | ✅ | ❌ | ❌ |
| DeleteAsset | ✅ | ❌ | ❌ |
| ReadPrivateData | ✅ | ✅ | ❌ |
| GetCallerInfo | ✅ | ✅ | ✅ |

---

## 🧪 Test Suites

| Suite | Tests | Description |
|-------|:-----:|-------------|
| `abac` | 6 | Role verification, access control |
| `state` | 5 | State machine transitions |
| `approval` | 5 | Approval workflow paths |
| `rejection` | 4 | Rejection workflow paths |
| `query` | 6 | Query operations |
| `security` | 6 | Security validations |

---

<p align="center">
  <a href="../README.md">⬅️ Back to Main</a> •
  <a href="../v0/">📚 v0 (Simple)</a> •
  <a href="../v1/">🚀 v1 (Multi-Peer)</a>
</p>
