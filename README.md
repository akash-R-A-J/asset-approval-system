<h1 align="center">🏛️ Asset Approval System</h1>

<div align="center">

![Hyperledger Fabric](https://img.shields.io/badge/Hyperledger%20Fabric-v2.5-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![License](https://img.shields.io/badge/License-Apache%202.0-yellow)
![Docker](https://img.shields.io/badge/Docker-Required-blue)

**Enterprise-grade permissioned blockchain for multi-organization asset approval workflows.**

[📚 Full Documentation](https://deepwiki.com/akash-R-A-J/asset-approval-system) · [🐛 Report Bug](https://github.com/akash-R-A-J/asset-approval-system/issues) · [💡 Request Feature](https://github.com/akash-R-A-J/asset-approval-system/issues)

</div>

---

## 🎯 What is This?

A **production-ready blockchain solution** for enterprises that need **multiple organizations to approve assets** before they become valid. Built on Hyperledger Fabric.

### The Problem

| Traditional Systems | This Solution |
|---------------------|---------------|
| ❌ Single point of failure | ✅ Distributed across 3+ orgs |
| ❌ "Who approved what?" is unclear | ✅ Immutable audit trail |
| ❌ Data can be tampered | ✅ Cryptographically secured |
| ❌ No privacy for sensitive data | ✅ Private data collections |
| ❌ Trust issues between orgs | ✅ Smart contract enforcement |

---

## 🏗️ Two Versions Available

| | **v0 - Simple** | **v1 - Production** |
|---|-----------------|---------------------|
| **Best For** | 📚 Learning, POC, Demos | 🚀 Production deployment |
| **Chaincode** | JavaScript | TypeScript |
| **Peers/Org** | 1 | 3 (Endorser, Query, Committer) |
| **Containers** | ~12 | ~24 |
| **State Machine** | 3 states | 6 states |
| **Resubmit Rejected?** | ❌ No | ✅ Yes |
| **Input Validation** | Client-side | Chaincode + Client |
| **Test Suites** | Basic | Security, Fault, Performance |

### Quick Visual

```
v0 (Simple)                         v1 (Production)
┌─────────────────┐                 ┌─────────────────┐
│ Org1            │                 │ Org1            │
│ └── 1 Peer      │                 │ ├── peer0 (E)   │
│                 │                 │ ├── peer1 (Q)   │
│                 │                 │ └── peer2 (C)   │
└─────────────────┘                 └─────────────────┘
(E)=Endorser (Q)=Query (C)=Committer
```

**👉 Start with v0 to learn, graduate to v1 for production.**

---

## ⚡ 5-Minute Quick Start

> ⚠️ **Requires Linux or WSL2** - Cannot run on native Windows

### Prerequisites

```bash
# Check you have everything
docker --version        # Need 20+
node --version          # Need 18+
peer version            # Need Fabric 2.5.x
```

<details>
<summary>📦 Don't have prerequisites? Click to expand installation guide</summary>

```bash
# Ubuntu/WSL2

# 1. Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# 2. Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Fabric Binaries
cd ~
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh --fabric-version 2.5.0 binary
echo 'export PATH=$PATH:$HOME/bin' >> ~/.bashrc
source ~/.bashrc

# 4. Other tools
sudo apt install -y jq git
```

</details>

### Run It

```bash
# Clone
git clone https://github.com/akash-R-A-J/asset-approval-system.git
cd asset-approval-system

# Choose your version
cd v0   # Simple version for learning
# OR
cd v1   # Production version

# Start (takes 3-5 minutes first time)
./scripts/start-all.sh   # v0
./start-all.sh           # v1

# See it work
./scripts/demo.sh        # v0
npm run demo             # v1 (from client/ folder)
```

---

## 🔐 How It Works

### Three Organizations, Different Roles

| Org | Role | Can Do |
|-----|------|--------|
| **Org1** | Asset Owner | Create, Update, Delete assets |
| **Org2** | Auditor | Approve/Reject, View private data |
| **Org3** | Regulator | Approve/Reject, Public data only |

### Asset Lifecycle

```
         ┌─────────┐     submit      ┌─────────────────┐
         │ CREATED │ ─────────────▶ │ PENDING_APPROVAL │
         └─────────┘                └────────┬────────┘
                                             │
        ┌────────────────────────────────────┼────────────────────────────────────┐
        │                                    │                                    │
        ▼                                    ▼                                    ▼
  ┌──────────┐                         ┌──────────┐                        ┌──────────┐
  │ APPROVED │ ───▶ ACTIVE ───▶       │ REJECTED │ ──▶ Can Resubmit! (v1) │ DELETED  │
  └──────────┘                         └──────────┘                        └──────────┘
       ↑                                                                         ↑
       │                    Both Org2 AND Org3 must approve                     │
       └────────────────────────────────────────────────────────────────────────┘
```

### Private Data

- **Sensitive info** (valuations, internal notes) stored in private collection
- Only **Org1 + Org2** can access
- **Org3** (Regulator) sees only public status
- Hash stored on-chain for verification

---

## 📁 Repository Structure

```
asset-approval-system/
├── 📄 README.md              # You are here
├── 📁 v0/                    # Simple JavaScript version
│   ├── chaincode/           # Smart contracts
│   ├── client/              # CLI application
│   ├── network/             # Docker & config
│   ├── scripts/             # Automation
│   └── docs/                # Documentation
│
└── 📁 v1/                    # Production TypeScript version
    ├── chaincode/           # TypeScript smart contracts
    ├── client/              # Node.js client + tests
    ├── network/             # Multi-peer Docker config
    ├── scripts/             # Automation
    └── docs/                # Documentation
```

---

## 🧪 Testing

Both versions include comprehensive test suites:

```bash
# v0 - From project root
./scripts/run-tests.sh

# v1 - From client/ folder
npm run test:all          # All tests with summary
npm run test:security     # RBAC & access control
npm run test:fault        # Raft consensus
```

| Test Suite | What It Validates |
|------------|-------------------|
| **Security** | OBAC permissions, private data access |
| **State Machine** | Invalid transitions blocked |
| **Fault Tolerance** | Raft consensus under failure |
| **History/Audit** | Complete transaction trail |

---

## 🛠️ Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `bad interpreter: /bin/bash^M` | Windows line endings | `dos2unix scripts/*.sh` |
| `peer: command not found` | Fabric not in PATH | Add `~/bin` to PATH |
| Port already in use | Old containers running | `docker stop $(docker ps -aq)` |
| Permission denied | Root-owned files | `sudo chown -R $USER:$USER .` |
| ENDORSEMENT_POLICY_FAILURE | Cold chaincode | Wait 10s and retry |

---

## 📚 Documentation

- **[v0 README](./v0/README.md)** - Complete guide for simple version
- **[v1 README](./v1/README.md)** - Complete guide for production version
- **[DeepWiki](https://deepwiki.com/akash-R-A-J/asset-approval-system)** - Full online documentation
- **[Architecture Docs](./v0/docs/)** - Technical deep-dives

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Apache-2.0 - see [LICENSE](./v0/LICENSE) for details.

---

<div align="center">

**Built with ❤️ using Hyperledger Fabric v2.5**

*Raft Consensus · Private Data Collections · Organization-Based Access Control*

</div>
