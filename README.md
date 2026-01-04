<h1 align="center">📚 Asset Approval System</h1>

<div align="center">

![Hyperledger Fabric](https://img.shields.io/badge/Hyperledger_Fabric-2.5-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)
![License](https://img.shields.io/badge/License-Apache_2.0-green)

**Enterprise Asset Lifecycle Management on Hyperledger Fabric**

*Multi-party approval workflows · Private data collections · Immutable audit trails*

</div>

---

## 🎯 What Is This?

A complete implementation of **multi-organization asset approval workflows** on Hyperledger Fabric. Three organizations collaborate to manage assets through creation, approval, activation, and deletion — with full audit trails and access control.

**Use Cases:**
- 📄 Document approval workflows
- 🏭 Supply chain asset verification
- 🏛️ Regulatory compliance tracking
- 💼 Multi-party governance systems

---

## 📦 Choose Your Version

| Version | Best For | Key Features |
|---------|----------|--------------|
| [**v2**](./v2/) | ✅ **Production, Interviews** | True ABAC · 100% Fabric CA · Scalable |
| [v1](./v1/) | Multi-peer learning | 9 peers · TypeScript · cryptogen |
| [v0](./v0/) | Beginners | Simple · JavaScript · OBAC |

> 💡 **New users:** Start with **v2** — it has the best documentation and modern architecture.

---

## ⚡ Quick Start (v2 Recommended)

### Prerequisites

| Software | Version | Check |
|----------|---------|-------|
| Docker | 20+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| Node.js | 18+ | `node --version` |
| Fabric Binaries | 2.5.x | `peer version` |

> ⚠️ **Requires Linux or WSL2** — Native Windows not supported

### Run in 4 Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-org/asset-approval-system.git
cd asset-approval-system/v2

# 2. Make scripts executable
chmod +x *.sh scripts/*.sh

# 3. Start everything (3-5 minutes)
./start-all.sh

# 4. Run interactive demo
cd client && npm install && npm run demo
```

**That's it!** You now have a 14-container Fabric network with deployed chaincode.

---

## 🏗️ Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                    ASSET APPROVAL SYSTEM                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐             │
│  │   Org1     │     │   Org2     │     │   Org3     │             │
│  │   OWNER    │     │  AUDITOR   │     │ REGULATOR  │             │
│  │ Creates &  │     │ Reviews &  │     │ Approves & │             │
│  │ Manages    │     │ Approves   │     │ Complies   │             │
│  └─────┬──────┘     └─────┬──────┘     └─────┬──────┘             │
│        │                  │                  │                     │
│        └──────────────────┼──────────────────┘                     │
│                           │                                        │
│               ┌───────────▼───────────┐                           │
│               │    SMART CONTRACT     │                           │
│               │ (True ABAC in v2)     │                           │
│               └───────────┬───────────┘                           │
│               ┌───────────▼───────────┐                           │
│               │    FABRIC LEDGER      │                           │
│               │  + Private Data       │                           │
│               └───────────────────────┘                           │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Access Control Comparison

| Feature | v0 | v1 | v2 |
|---------|:--:|:--:|:--:|
| **Access Control Type** | OBAC | OBAC | **True ABAC** |
| **Role Source** | MSP ID | MSP ID | **Certificate Attribute** |
| **Add New Org** | Chaincode change | Chaincode change | **Config only** |
| **Identity Management** | Fabric CA | cryptogen | **100% Fabric CA** |

**OBAC** = Organization-Based (checks MSP ID in chaincode)  
**ABAC** = Attribute-Based (reads role from X.509 certificate)

---

## � Asset Lifecycle

All versions share this workflow:

```
CREATE ──► SUBMIT ──► APPROVE (by Auditor + Regulator) ──► ACTIVATE
              │                                              │
              └──── REJECT ◄─────────────────────────────────┘
                      │
                      └──► RESUBMIT (v1, v2 only)
```

---

## � Version Comparison

| Aspect | v0 | v1 | **v2** |
|--------|:--:|:--:|:------:|
| Purpose | Learning | Multi-peer | **Production** |
| Language | JavaScript | TypeScript | **TypeScript** |
| Containers | 12 | 24 | **14** |
| Peers per Org | 1 | 3 | **1** |
| Orderers | 3 | 3 | **3** |
| CAs | 3 | cryptogen | **4** |
| States | 3 | 6 | **6** |
| Resubmit Rejected | ❌ | ✅ | **✅** |
| Scalability | ❌ | ❌ | **✅** |

---

## 📁 Repository Structure

```
asset-approval-system/
├── README.md           # This file
├── v0/                 # JavaScript learning version
│   ├── chaincode/
│   ├── client/
│   ├── network/
│   └── scripts/
├── v1/                 # TypeScript multi-peer version
│   ├── chaincode/
│   ├── client/
│   ├── network/
│   └── scripts/
└── v2/                 # Production-ready True ABAC (recommended)
    ├── chaincode/
    ├── client/
    ├── network/
    └── scripts/
```

---

## 🛠️ Common Commands

```bash
# Start network (any version)
./start-all.sh

# Stop and clean up
./stop-all.sh

# Run demo
cd client && npm run demo

# Run tests (v0)
./scripts/run-tests.sh

# Full reset
./stop-all.sh && docker volume prune -f && ./start-all.sh
```

---

## 📋 Prerequisites Setup

### Install Fabric Binaries

```bash
mkdir -p ~/bin && cd ~/bin
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.4 1.5.7 -d -s
export PATH=$PATH:~/bin/bin
```

### Install Other Dependencies

```bash
# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18

# jq (for JSON parsing)
sudo apt install jq

# dos2unix (for Windows line endings)
sudo apt install dos2unix
```

---

## 🤔 Which Version Should I Use?

| Scenario | Recommended |
|----------|-------------|
| Learning Hyperledger Fabric | **v0** |
| Understanding multi-peer setups | v1 |
| Interview demonstrations | **v2** |
| Production deployment base | **v2** |
| Quick POC | v0 or **v2** |

---

## � License

Apache-2.0

---

<div align="center">

**Built for Learning, Interviews, and Production**

*Hyperledger Fabric 2.5 · Multi-Party Governance · Private Data*

[📚 v0 - Learning](./v0/) · [🔄 v1 - Multi-Peer](./v1/) · [🏢 v2 - Production](./v2/)

</div>
