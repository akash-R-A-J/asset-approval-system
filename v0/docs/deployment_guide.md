# Deployment Guide

## Table of Contents
1. [Deployment Options](#1-deployment-options)
2. [Local Development](#2-local-development)
3. [Staging Deployment](#3-staging-deployment)
4. [Production Deployment](#4-production-deployment)
5. [Cloud Deployment](#5-cloud-deployment)
6. [Deployment Checklist](#6-deployment-checklist)

---

## 1. Deployment Options

### Environment Comparison

| Environment | Purpose | Infrastructure | Effort |
|-------------|---------|----------------|--------|
| Local Dev | Development, testing | Docker Compose on WSL/Linux | 30 min |
| Staging | Integration testing | VMs or small Kubernetes | 2-4 hours |
| Production | Live system | Kubernetes or managed service | 1-2 weeks |

### Infrastructure Options

| Option | Best For | Complexity | Cost |
|--------|----------|------------|------|
| Docker Compose | Dev, POC | Low | Free |
| Kubernetes | Production | High | Medium-High |
| AWS Managed Blockchain | Fast production | Medium | High |
| IBM Blockchain Platform | Enterprise | Medium | High |

---

## 2. Local Development

### Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Docker | 20+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| Node.js | 18+ | `node --version` |
| Fabric Binaries | 2.5.0 | `peer version` |

### Quick Start

```bash
# Clone repository
git clone https://github.com/akash-R-A-J/hyperledger-asset-approval.git
cd hyperledger-asset-approval

# Make scripts executable
chmod +x scripts/*.sh network/scripts/*.sh

# Start network
./scripts/start-all.sh

# Verify
./scripts/run-tests.sh
```

### What Gets Deployed

| Component | Container | Port |
|-----------|-----------|------|
| Orderer 0 | orderer0.orderer.example.com | 7050 |
| Orderer 1 | orderer1.orderer.example.com | 8050 |
| Orderer 2 | orderer2.orderer.example.com | 9050 |
| Peer Org1 | peer0.org1.example.com | 7051 |
| Peer Org2 | peer0.org2.example.com | 9051 |
| Peer Org3 | peer0.org3.example.com | 11051 |
| CouchDB 0 | couchdb0 | 5984 |
| CouchDB 1 | couchdb1 | 7984 |
| CouchDB 2 | couchdb2 | 8984 |
| CA Org1 | ca_org1 | 7054 |
| CA Org2 | ca_org2 | 8054 |
| CA Org3 | ca_org3 | 9054 |
| CA Orderer | ca_orderer | 10054 |

### Stop and Cleanup

```bash
# Stop network (preserves data)
./scripts/stop-all.sh

# Full cleanup (removes all data)
cd network && ./scripts/network.sh down
```

---

## 3. Staging Deployment

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    STAGING ENVIRONMENT                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   VM 1       │  │   VM 2       │  │   VM 3       │       │
│  │   Org1       │  │   Org2       │  │   Org3       │       │
│  │ ─────────────│  │ ─────────────│  │ ─────────────│       │
│  │ • Peer       │  │ • Peer       │  │ • Peer       │       │
│  │ • CouchDB    │  │ • CouchDB    │  │ • CouchDB    │       │
│  │ • CA         │  │ • CA         │  │ • CA         │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │              Orderer Cluster (3 VMs)             │       │
│  │  orderer0  │  orderer1  │  orderer2  │  CA       │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### VM Requirements

| Role | vCPUs | RAM | Disk | Count |
|------|-------|-----|------|-------|
| Org VM (Peer + CA + CouchDB) | 4 | 8GB | 50GB SSD | 3 |
| Orderer VM | 2 | 4GB | 20GB SSD | 3 |
| **Total** | **18** | **36GB** | **210GB** | **6** |

### Configuration Changes for Staging

#### 1. Update Docker Compose for Remote Access

```yaml
# docker-compose.yaml - Add external networks
services:
  peer0.org1.example.com:
    extra_hosts:
      - "orderer0.orderer.example.com:${ORDERER0_IP}"
      - "orderer1.orderer.example.com:${ORDERER1_IP}"
      - "peer0.org2.example.com:${ORG2_IP}"
```

#### 2. Update Connection Profiles

```json
{
  "peers": {
    "peer0.org1.example.com": {
      "url": "grpcs://org1.staging.example.com:7051"
    }
  }
}
```

#### 3. Replace Credentials

```bash
# Generate strong passwords
export CA_ADMIN_ID="admin"
export CA_ADMIN_SECRET=$(openssl rand -base64 32)
export COUCHDB_PASSWORD=$(openssl rand -base64 32)
```

---

## 4. Production Deployment

### Architecture (Kubernetes)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐                                                    │
│  │   Load Balancer │  ← External traffic                                │
│  └────────┬────────┘                                                    │
│           │                                                             │
│  ┌────────▼────────────────────────────────────────────────────────┐   │
│  │                    KUBERNETES CLUSTER                            │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  Namespace: fabric-org1                                   │   │   │
│  │  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐         │   │   │
│  │  │  │ Peer-0 │  │ Peer-1 │  │ CA     │  │CouchDB │         │   │   │
│  │  │  └────────┘  └────────┘  └────────┘  └────────┘         │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  Namespace: fabric-orderer                                │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │   │   │
│  │  │  │Orderer-0 │  │Orderer-1 │  │Orderer-2 │               │   │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘               │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────┐                               │
│  │  Persistent Storage (EBS/Azure Disk) │                               │
│  │  • Ledger data                       │                               │
│  │  • CouchDB data                      │                               │
│  │  • CA database                       │                               │
│  └──────────────────────────────────────┘                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Kubernetes Resources

| Component | Deployment | Replicas | Resources |
|-----------|------------|----------|-----------|
| Peer | StatefulSet | 2/org | 4 CPU, 8GB RAM |
| CouchDB | StatefulSet | 1/peer | 2 CPU, 4GB RAM |
| Orderer | StatefulSet | 3 | 2 CPU, 4GB RAM |
| CA | Deployment | 1/org | 1 CPU, 2GB RAM |

### Helm Chart Deployment

```bash
# Add Hyperledger Helm repo
helm repo add hyperledger https://hyperledger.github.io/helm-charts
helm repo update

# Deploy CA
helm install org1-ca hyperledger/fabric-ca \
  --namespace fabric-org1 \
  --set adminUsername=admin \
  --set adminPassword=${CA_ADMIN_SECRET}

# Deploy Peer
helm install org1-peer hyperledger/fabric-peer \
  --namespace fabric-org1 \
  --set mspID=Org1MSP \
  --set stateDatabase=CouchDB
```

### Best Practices

| Area | Practice |
|------|----------|
| **Storage** | Use SSD-backed persistent volumes |
| **Secrets** | Store in Kubernetes Secrets or Vault |
| **Networking** | Use NetworkPolicy to isolate namespaces |
| **Monitoring** | Deploy Prometheus + Grafana |
| **Backup** | Regular snapshots of persistent volumes |
| **Scaling** | Use HPA for peer pods |

---

## 5. Cloud Deployment

### Option A: AWS

| Service | Use For |
|---------|---------|
| EKS | Kubernetes cluster |
| EBS | Persistent storage (gp3 SSD) |
| ALB | Load balancer |
| Secrets Manager | Credentials |
| CloudWatch | Monitoring |

**Estimated Cost:** $2,000-5,000/month

### Option B: Azure

| Service | Use For |
|---------|---------|
| AKS | Kubernetes cluster |
| Azure Disk | Persistent storage |
| Azure LB | Load balancer |
| Key Vault | Secrets |
| Azure Monitor | Monitoring |

**Estimated Cost:** $2,000-5,000/month

### Option C: AWS Managed Blockchain

```
Pros:
✅ Managed service (no K8s management)
✅ Automatic upgrades
✅ Built-in monitoring
✅ Easy peer addition

Cons:
❌ Higher cost (~$0.25/hour/node)
❌ Less customization
❌ Vendor lock-in
```

**Estimated Cost:** $3,000-8,000/month

---

## 6. Deployment Checklist

### Pre-Deployment

| # | Task | Dev | Staging | Prod |
|---|------|-----|---------|------|
| 1 | Generate strong credentials | ⬜ | ✅ | ✅ |
| 2 | Configure TLS certificates | ⬜ | ✅ | ✅ |
| 3 | Set up persistent storage | ⬜ | ✅ | ✅ |
| 4 | Configure DNS/hostnames | ⬜ | ✅ | ✅ |
| 5 | Set up secrets manager | ⬜ | ⬜ | ✅ |
| 6 | Configure HSM | ⬜ | ⬜ | ✅ |
| 7 | Set up monitoring | ⬜ | ⬜ | ✅ |
| 8 | Configure backup strategy | ⬜ | ⬜ | ✅ |

### Deployment Order

```
1. Deploy CAs (all organizations)
   ↓
2. Register identities
   ↓
3. Deploy Orderer cluster
   ↓
4. Create channel
   ↓
5. Deploy Peers (all organizations)
   ↓
6. Join peers to channel
   ↓
7. Deploy chaincode
   ↓
8. Test with client application
```

### Post-Deployment Verification

| Test | Command |
|------|---------|
| Network health | `peer channel list` |
| Chaincode status | `peer lifecycle chaincode querycommitted` |
| Security tests | `./scripts/run-tests.sh` |
| Fault tolerance | `./scripts/test-fault-tolerance.sh` |

---

## Summary

| Environment | Complexity | Time | Cost/Month |
|-------------|------------|------|------------|
| Local Dev | ★☆☆ | 30 min | $0 |
| Staging (VMs) | ★★☆ | 4 hours | $200-500 |
| Production (K8s) | ★★★ | 1-2 weeks | $2,000-5,000 |
| Managed (AWS/IBM) | ★★☆ | 1-2 days | $3,000-8,000 |
