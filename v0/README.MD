<h1 align="center">
  <br>
  📚 Asset Approval System v0
  <br>
</h1>

<h4 align="center">Simple implementation for learning <a href="https://www.hyperledger.org/projects/fabric">Hyperledger Fabric</a> fundamentals</h4>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Fabric-2.5-2F3134?style=for-the-badge&logo=hyperledger&logoColor=white" alt="Fabric">
  <img src="https://img.shields.io/badge/Containers-12-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Containers">
  <img src="https://img.shields.io/badge/Status-Learning-blue?style=for-the-badge" alt="Status">
</p>

<p align="center">
  <a href="#-key-features">Features</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-state-machine">State Machine</a>
</p>

---

## ✨ Key Features

<table>
  <tr>
    <td>🔐</td>
    <td><b>OBAC</b></td>
    <td>Organization-based access control via MSP ID verification</td>
  </tr>
  <tr>
    <td>📊</td>
    <td><b>3-State Machine</b></td>
    <td>Simple PENDING → APPROVED/REJECTED workflow</td>
  </tr>
  <tr>
    <td>🔒</td>
    <td><b>Private Data</b></td>
    <td>Confidential collection shared between Org1 + Org2</td>
  </tr>
  <tr>
    <td>🐳</td>
    <td><b>12 Containers</b></td>
    <td>Minimal footprint for learning environments</td>
  </tr>
</table>

> 💡 v0 intentionally keeps the workflow simple to focus on Fabric fundamentals rather than governance complexity.

---

## 📊 Version Comparison

| Aspect | v0 (This) | v1 | v2 |
|--------|:---------:|:--:|:--:|
| **Best For** | Learning | Multi-Peer | Production |
| State Machine | 3 states | 6 states | 6 states |
| Resubmission | ❌ | ✅ | ✅ |
| Access Control | OBAC | OBAC | ABAC |

> 💡 **Start here to learn**, then graduate to [v1](../v1/) or [v2](../v2/) for production patterns.

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

Run these commands to verify all prerequisites are installed correctly:

```bash
# Docker (should show 20+)
docker --version

# Docker Compose (should show v2+)
docker compose version

# Node.js (should show 18+)
node --version

# npm (should show 8+)
npm --version

# Fabric peer (should show 2.5.x)
peer version

# jq (should show any version)
jq --version
```

**Expected output:**
```
Docker version 24.0.x
Docker Compose version v2.x.x
v18.x.x
8.x.x
peer:
 Version: 2.5.0
jq-1.6
```

---

### Step 3: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/akash-R-A-J/asset-approval-system.git

# Navigate to v0
cd asset-approval-system/v0
```

---

### Step 4: Make Scripts Executable

```bash
# Make all scripts executable
chmod +x scripts/*.sh
chmod +x network/scripts/*.sh
```

---

### Step 5: Start the Network

```bash
./scripts/start-all.sh
```

**What happens:**
```
✓ Cleaning up old containers...
✓ Generating crypto materials...
✓ Starting network (12 containers)...
✓ Creating channel...
✓ Joining peers to channel...
✓ Deploying chaincode...
✓ Installing client dependencies...
✓ Warming up chaincode...

════════════════════════════════════════════
  SUCCESS! Network is ready.
════════════════════════════════════════════
```

**Estimated time:** 3-5 minutes on first run.

---

### Step 6: Run the Demo

```bash
./scripts/demo.sh
```

This runs an interactive demo showing:
1. Asset creation by Org1 (Owner)
2. Approval by Org2 (Auditor)
3. Approval by Org3 (Regulator)
4. Final asset status

---

### Step 7: Run Tests

```bash
# Workflow tests (18 tests)
./scripts/run-tests.sh

# Fault tolerance tests
./scripts/test-fault-tolerance.sh
```

---

### Step 8: Stop the Network

```bash
./scripts/stop-all.sh
```

This stops all containers and cleans up.

---

## 🛠️ Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `docker: command not found` | Install Docker: `sudo apt-get install docker.io` |
| `permission denied` on docker | Run `sudo usermod -aG docker $USER` and re-login |
| `peer: command not found` | Add Fabric binaries to PATH |
| Port already in use | Run `docker stop $(docker ps -aq)` |
| Chaincode install fails | Clean restart (see below) |

### Clean Restart

If you encounter issues, do a complete cleanup:

```bash
# Stop everything
./scripts/stop-all.sh

# Remove all Docker volumes
docker volume prune -f

# Remove all Docker networks
docker network prune -f

# Remove generated files
rm -rf network/organizations network/channel-artifacts

# Start fresh
./scripts/start-all.sh
```

### View Container Logs

```bash
# Peer logs
docker logs peer0.org1.example.com

# Orderer logs
docker logs orderer.example.com

# Follow logs in real-time
docker logs -f peer0.org1.example.com

# Chaincode logs
docker logs $(docker ps -q --filter name=dev-peer0.org1)
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ORDERING SERVICE (Raft)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │    orderer0     │  │    orderer1     │  │    orderer2     │          │
│  │     :7050       │  │     :8050       │  │     :9050       │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
│                    Tolerates 1 orderer failure                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┏━━━━━━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━━━━━━━┓       │
│   ┃   ORG1 (Owner)  ┃  ┃  ORG2 (Auditor) ┃  ┃ ORG3 (Regulator) ┃       │
│   ┣━━━━━━━━━━━━━━━━━┫  ┣━━━━━━━━━━━━━━━━━┫  ┣━━━━━━━━━━━━━━━━━━┫       │
│   ┃ • Peer    :7051 ┃  ┃ • Peer    :9051 ┃  ┃ • Peer    :11051 ┃       │
│   ┃ • CA      :7054 ┃  ┃ • CA      :8054 ┃  ┃ • CA       :9054 ┃       │
│   ┃ • CouchDB :5984 ┃  ┃ • CouchDB :7984 ┃  ┃ • CouchDB  :8984 ┃       │
│   ┗━━━━━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━━━━━━┛       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 State Machine

```
                    ┌─────────────────┐
                    │                 │
                    │     PENDING     │ ◄── Asset created
                    │                 │
                    └────────┬────────┘
                             │
           ┌─────────────────┴─────────────────┐
           │                                   │
           ▼                                   ▼
   ┌───────────────┐                   ┌───────────────┐
   │               │                   │               │
   │   APPROVED    │                   │   REJECTED    │
   │               │                   │               │
   └───────────────┘                   └───────────────┘
         ▲                                    ▲
         │                                    │
         └──── Org2 + Org3 both approve ─────┘
                                   or any rejects
```

> ⚠️ **Limitation:** Rejected assets cannot be resubmitted in v0. See [v1](../v1/) for resubmission support.

---

## 🔐 Access Control (OBAC)

| Operation | Org1 (Owner) | Org2 (Auditor) | Org3 (Regulator) |
|-----------|:------------:|:--------------:|:----------------:|
| CreateAsset | ✅ | ❌ | ❌ |
| ApproveAsset | ❌ | ✅ | ✅ |
| RejectAsset | ❌ | ✅ | ✅ |
| QueryAsset | ✅ | ✅ | ✅ |
| QueryPrivateData | ✅ | ✅ | ❌ |
| DeleteAsset | ✅ | ❌ | ❌ |

---

<p align="center">
  <a href="../README.md">⬅️ Back to Main</a> •
  <a href="../v1/">➡️ Upgrade to v1</a> •
  <a href="../v2/">⚡ Upgrade to v2</a>
</p>
