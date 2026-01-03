<h1 align="center">Asset Approval System - Hyperledger Fabric</h1>

<div align="center">

![Hyperledger Fabric](https://img.shields.io/badge/Hyperledger%20Fabric-v2.5-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-Apache%202.0-yellow)
![Docker](https://img.shields.io/badge/Docker-Required-blue)

**A production-grade permissioned blockchain system for multi-organization asset approval workflows.**

📚 **[View Full Documentation](https://deepwiki.com/akash-R-A-J/asset-approval-system)**

</div>

---

## 📖 Overview

This repository contains **two implementations** of the Asset Approval System built on Hyperledger Fabric, demonstrating enterprise blockchain patterns for multi-organization workflows.

### The Problem

Enterprise asset approvals require multiple organizations to review and sign off, but traditional centralized systems suffer from:
- ❌ Single point of failure
- ❌ No audit trail of approvals
- ❌ Trust issues between organizations
- ❌ Data tampering risks
- ❌ No privacy for sensitive information

### The Solution

A **decentralized, permissioned blockchain** using Hyperledger Fabric that provides:
- ✅ **Distributed trust** across multiple organizations
- ✅ **Immutable audit trail** for every action
- ✅ **Fault tolerance** via Raft consensus
- ✅ **Private data** shared only with authorized orgs
- ✅ **Smart contract enforcement** of business rules

---

## 🏗️ Project Versions

| Feature | [v0](./v0/) | [v1](./v1/) |
|---------|-------------|-------------|
| **Chaincode Language** | JavaScript | TypeScript |
| **Peers per Org** | 1 | 3 (Endorser, Query, Committer) |
| **Total Containers** | ~12 | ~24 |
| **Focus** | Simplicity & Learning | Production-Scale Architecture |
| **State Machine** | `PENDING → APPROVED/REJECTED` | `CREATED → PENDING → APPROVED → ACTIVE` |
| **Best For** | POC/Demo | Production-ready deployments |

### Quick Comparison

```
v0 (Simple)                          v1 (Scalable)
┌─────────────────┐                  ┌─────────────────┐
│ Org1            │                  │ Org1            │
│ ├── 1 Peer      │                  │ ├── peer0 (E)   │
│ ├── 1 CA        │                  │ ├── peer1 (Q)   │
│ └── CouchDB     │                  │ ├── peer2 (C)   │
└─────────────────┘                  │ ├── CA          │
                                     │ └── CouchDB     │
                                     └─────────────────┘
(E)=Endorser (Q)=Query (C)=Committer
```

---

## 🚀 Getting Started

### Prerequisites

> ⚠️ **Requires Linux or WSL2** - Cannot run on native Windows

| Software | Version |
|----------|---------|
| **Docker** | 20+ |
| **Docker Compose** | v2+ |
| **Node.js** | 18+ |
| **Hyperledger Fabric Binaries** | 2.5.x |
| **jq** | Any |

### Installation

```bash
# Clone the repository
git clone https://github.com/akash-R-A-J/asset-approval-system.git
cd asset-approval-system

# Choose your version
cd v0  # Simple version for learning
# OR
cd v1  # Production-scale version

# Follow the README in each version for specific setup instructions
```

---

## 📐 Common Architecture

Both versions share the same core architecture:

### Ordering Service
- **3 Raft nodes** for crash fault tolerance
- Survives 1 orderer failure

### Organizations
| Org | Role | Permissions |
|-----|------|-------------|
| **Org1** | Asset Owner | Create, Update, Delete assets |
| **Org2** | Auditor | Approve/Reject, View private data |
| **Org3** | Regulator | Approve/Reject, Public data only |

### Private Data Collections
- Sensitive data (valuations, internal notes) stored in private collections
- Only Org1 + Org2 can access private data
- Org3 (Regulator) sees only public asset status

### Asset Lifecycle

```
     ┌─────────┐
     │ CREATE  │ ← Org1 creates asset
     └────┬────┘
          │
          ▼
     ┌─────────┐     Org2/Org3       ┌─────────┐
     │ PENDING │ ─── approves ─────► │APPROVED │ ◄── FINAL
     └────┬────┘                     └─────────┘
          │
          └── Org2/Org3 rejects ───► ┌──────────┐
                                     │ REJECTED │ ◄── FINAL
                                     └──────────┘
```

---

## 🔐 Organization-Based Access Control (OBAC)

| Function | Org1 (Owner) | Org2 (Auditor) | Org3 (Regulator) |
|----------|:------------:|:--------------:|:----------------:|
| CreateAsset | ✅ | ❌ | ❌ |
| ApproveAsset | ❌ | ✅ | ✅ |
| RejectAsset | ❌ | ✅ | ✅ |
| QueryAsset (public) | ✅ | ✅ | ✅ |
| QueryPrivateDetails | ✅ | ✅ | ❌ |
| DeleteAsset | ✅ | ❌ | ❌ |

---

## 🧪 Testing

Both versions include comprehensive test suites:

| Test Suite | Description |
|------------|-------------|
| **Security Tests** | OBAC access control validation |
| **State Machine Tests** | Lifecycle enforcement |
| **Fault Tolerance Tests** | Raft consensus behavior |
| **Private Data Tests** | Collection access restrictions |

See individual version READMEs for specific test commands.

---

## 📁 Repository Structure

```
asset-approval-system/
├── README.md           # This file
├── .gitignore          # Root gitignore
│
├── v0/                 # Simple JavaScript version
│   ├── chaincode/      # JavaScript smart contracts
│   ├── client/         # Node.js client application
│   ├── network/        # Docker + network config
│   ├── scripts/        # Automation scripts
│   └── docs/           # Documentation
│
└── v1/                 # Production TypeScript version
    ├── chaincode/      # TypeScript smart contracts
    ├── client/         # Node.js client application
    ├── network/        # Docker + network config
    ├── scripts/        # Automation scripts
    └── docs/           # Documentation
```

---

## 🛠️ Common Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `bad interpreter` | Windows line endings (CRLF) | Run `dos2unix scripts/*.sh` |
| `fabric-ca-client: not found` | Binaries not in PATH | Install and add `~/bin` to PATH |
| Port conflicts | Previous containers running | `docker stop $(docker ps -aq)` |
| Permission denied | Root-owned CA files | Use `sudo rm -rf` for cleanup |

---

## 📚 Documentation

- **[v0 Documentation](./v0/docs/)** - Simple version guides
- **[v1 Documentation](./v1/docs/)** - Production version guides
- **[DeepWiki](https://deepwiki.com/akash-R-A-J/asset-approval-system)** - Full online documentation

---

## 📄 License

Apache-2.0

---

<div align="center">

**Built with Hyperledger Fabric v2.5 | Raft Consensus | Private Data Collections**

*Demonstrates enterprise blockchain patterns: OBAC, State Machines, Fault Tolerance*

</div>
