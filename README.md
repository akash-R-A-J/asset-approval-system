<h1 align="center">
  <br>
  🔐 Asset Approval System
  <br>
</h1>

<h4 align="center">A multi-organization asset approval workflow built on <a href="https://www.hyperledger.org/projects/fabric">Hyperledger Fabric</a></h4>

<p align="center">
  <img src="https://img.shields.io/badge/Hyperledger_Fabric-2.5-2F3134?style=for-the-badge&logo=hyperledger&logoColor=white" alt="Fabric">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Docker-20+-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/License-Apache_2.0-D22128?style=for-the-badge" alt="License">
</p>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-versions">Versions</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-architecture">Architecture</a>
</p>

---

## 📋 Overview

A blockchain-based system demonstrating **multi-party asset approval workflows** with:

- **Multi-Organization Governance** - 3 orgs with distinct roles (Owner, Auditor, Regulator)
- **State Machine Enforcement** - Controlled asset lifecycle transitions
- **Private Data Collections** - Confidential information shared between specific orgs
- **Immutable Audit Trail** - Complete history of all asset changes
- **Progressive Architecture** - 3 versions showing evolution from POC to production

---

## 🔄 Versions

Three implementations demonstrating progressive architectural maturity:

<table>
  <tr>
    <th></th>
    <th>📚 v0</th>
    <th>🚀 v1</th>
    <th>⚡ v2</th>
  </tr>
  <tr>
    <td><b>Focus</b></td>
    <td>Learning</td>
    <td>Multi-Peer</td>
    <td>True ABAC</td>
  </tr>
  <tr>
    <td><b>Language</b></td>
    <td>JavaScript</td>
    <td>TypeScript</td>
    <td>TypeScript</td>
  </tr>
  <tr>
    <td><b>Access Control</b></td>
    <td>OBAC</td>
    <td>OBAC</td>
    <td><b>ABAC</b> ✨</td>
  </tr>
  <tr>
    <td><b>Role Source</b></td>
    <td>MSP ID</td>
    <td>MSP ID</td>
    <td><b>Certificate</b> ✨</td>
  </tr>
  <tr>
    <td><b>State Machine</b></td>
    <td>3 states</td>
    <td>6 states</td>
    <td>6 states</td>
  </tr>
  <tr>
    <td><b>Identity Mgmt</b></td>
    <td>cryptogen</td>
    <td>cryptogen</td>
    <td><b>Fabric CA</b> ✨</td>
  </tr>
  <tr>
    <td><b>Add New Org</b></td>
    <td>Code change</td>
    <td>Code change</td>
    <td><b>Config only</b> ✨</td>
  </tr>
  <tr>
    <td><b>Resubmission</b></td>
    <td>❌</td>
    <td>✅</td>
    <td>✅</td>
  </tr>
  <tr>
    <td><b>Peers per Org</b></td>
    <td>1</td>
    <td>3</td>
    <td>1</td>
  </tr>
  <tr>
    <td><b>Containers</b></td>
    <td>12</td>
    <td>24</td>
    <td>12</td>
  </tr>
</table>

### Which Version Should I Use?

| If you want to... | Use | README |
|-------------------|-----|--------|
| **Learn Fabric basics** | v0 | [📚 v0 Getting Started](./v0/README.md) |
| **Understand multi-peer architecture** | v1 | [🚀 v1 Getting Started](./v1/README.md) |
| **Implement production patterns** | v2 | [⚡ v2 Getting Started](./v2/README.md) |

---

## 🚀 Getting Started

> **Each version has its own detailed Getting Started guide** with step-by-step instructions for prerequisites installation, cloning, setup, and running.

### Choose Your Version:

- **[v0 - Learning Guide](./v0/README.md#-getting-started)** - Simple setup for beginners
- **[v1 - Multi-Peer Guide](./v1/README.md#-getting-started)** - Production-like environment
- **[v2 - Production Guide](./v2/README.md#-getting-started)** - True ABAC with Fabric CA

### Platform Requirement

> ⚠️ **Requires Linux or WSL2** - Hyperledger Fabric cannot run on native Windows. Use Ubuntu 20.04+ or WSL2.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ORDERING SERVICE (Raft)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │    orderer      │  │    orderer2     │  │    orderer3     │          │
│  │     :7050       │  │     :8050       │  │     :9050       │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
│                    Crash Fault Tolerant (1/3)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┏━━━━━━━━━━━━━━━┓   ┏━━━━━━━━━━━━━━━┓   ┏━━━━━━━━━━━━━━━┓            │
│   ┃  ORG1 (Owner) ┃   ┃ ORG2 (Auditor)┃   ┃ORG3 (Regulator)┃           │
│   ┣━━━━━━━━━━━━━━━┫   ┣━━━━━━━━━━━━━━━┫   ┣━━━━━━━━━━━━━━━┫            │
│   ┃ Peer    :7051 ┃   ┃ Peer    :9051 ┃   ┃ Peer   :11051 ┃            │
│   ┃ CA      :7054 ┃   ┃ CA      :8054 ┃   ┃ CA      :9054 ┃            │
│   ┃ CouchDB :5984 ┃   ┃ CouchDB :7984 ┃   ┃ CouchDB :8984 ┃            │
│   ┗━━━━━━━━━━━━━━━┛   ┗━━━━━━━━━━━━━━━┛   ┗━━━━━━━━━━━━━━━┛            │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    CHANNEL: asset-channel                        │   │
│   │  ┌──────────────────────┐   ┌──────────────────────────────┐    │   │
│   │  │     PUBLIC STATE     │   │    PRIVATE DATA COLLECTION   │    │   │
│   │  │  • assetID           │   │    (Org1 + Org2 only)        │    │   │
│   │  │  • status            │   │  • confidentialNotes         │    │   │
│   │  │  • approvals         │   │  • internalValue             │    │   │
│   │  │  • owner             │   │  • sensitiveTerms            │    │   │
│   │  │  • timestamps        │   │                              │    │   │
│   │  └──────────────────────┘   └──────────────────────────────┘    │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Access Control Models

### OBAC (v0, v1) - Organization-Based
```javascript
// Role derived from MSP ID
if (ctx.clientIdentity.getMSPID() === 'Org1MSP') {
    role = 'owner';
}
```

### ABAC (v2) - Attribute-Based
```typescript
// Role read from X.509 certificate attribute
const role = ctx.clientIdentity.getAttributeValue('role');
// Returns 'owner', 'auditor', or 'regulator'
```

---

## 📁 Project Structure

```
asset-approval-system/
│
├── v0/                          # 📚 Learning / POC
│   ├── chaincode/              # JavaScript chaincode
│   ├── client/                 # Node.js client
│   ├── network/                # Docker configs
│   └── scripts/                # Automation scripts
│
├── v1/                          # 🚀 Multi-Peer Architecture
│   ├── chaincode/              # TypeScript chaincode
│   ├── client/                 # Modern Fabric Gateway client
│   ├── network/                # 24-container setup
│   └── scripts/                # Deployment scripts
│
└── v2/                          # ⚡ True ABAC / Production
    ├── chaincode/              # TypeScript with ABAC
    ├── client/                 # Comprehensive tests
    ├── network/                # Fabric CA configs
    └── scripts/                # CA enrollment scripts
```

---

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <b>Built with Hyperledger Fabric v2.5</b><br>
  <sub>Multi-Organization Governance • Private Data • Immutable Audit Trail</sub>
</p>
