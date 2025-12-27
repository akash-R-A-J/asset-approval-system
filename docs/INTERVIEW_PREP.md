# Hyperledger Fabric Interview Preparation Guide

> **Your POC**: Asset Approval System with 3 organizations, Raft consensus, Fabric CA, private data collections, and Node.js chaincode.

---

## 1. Architecture Overview (Know This Cold!)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    HYPERLEDGER FABRIC NETWORK                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │   Org1MSP   │    │   Org2MSP   │    │   Org3MSP   │   ← Peer Orgs    │
│  │ Asset Owner │    │   Auditor   │    │  Regulator  │                  │
│  │             │    │             │    │             │                  │
│  │ ┌─────────┐ │    │ ┌─────────┐ │    │ ┌─────────┐ │                  │
│  │ │  Peer0  │ │    │ │  Peer0  │ │    │ │  Peer0  │ │   ← Endorsers    │
│  │ │ :7051   │ │    │ │ :9051   │ │    │ │ :11051  │ │                  │
│  │ └────┬────┘ │    │ └────┬────┘ │    │ └────┬────┘ │                  │
│  │      │      │    │      │      │    │      │      │                  │
│  │ ┌────┴────┐ │    │ ┌────┴────┐ │    │ ┌────┴────┐ │                  │
│  │ │ CouchDB │ │    │ │ CouchDB │ │    │ │ CouchDB │ │   ← State DBs    │
│  │ └─────────┘ │    │ └─────────┘ │    │ └─────────┘ │                  │
│  │             │    │             │    │             │                  │
│  │ ┌─────────┐ │    │ ┌─────────┐ │    │ ┌─────────┐ │                  │
│  │ │ CA :7054│ │    │ │ CA :8054│ │    │ │ CA :9054│ │   ← Fabric CAs   │
│  │ └─────────┘ │    │ └─────────┘ │    │ └─────────┘ │                  │
│  └─────────────┘    └─────────────┘    └─────────────┘                  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    RAFT ORDERING SERVICE                         │    │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐                   │    │
│  │   │ Orderer0 │◄──►│ Orderer1 │◄──►│ Orderer2 │   ← Consensus     │    │
│  │   │  :7050   │    │  :8050   │    │  :9050   │                   │    │
│  │   └──────────┘    └──────────┘    └──────────┘                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Interview Topics & Answers

### Q: Why Hyperledger Fabric instead of Ethereum?

**Answer**: "Fabric is designed for **enterprise/permissioned** use cases:
- **Permissioned network**: All participants have known identities via Fabric CA
- **Private transactions**: Private Data Collections allow selective data sharing
- **No cryptocurrency**: No gas fees, using execute-order-validate model
- **Pluggable consensus**: I used Raft for CFT; production could use BFT
- **Confidentiality**: Channels provide data isolation between subsets of organizations"

### Q: Why did you choose Raft consensus?

**Answer**: "Raft provides **Crash Fault Tolerance (CFT)** with 3 orderers:
- Tolerates 1 orderer failure (n=3, can tolerate (n-1)/2 = 1 failure)
- Simpler than BFT but sufficient for trusted consortium environments
- Leader election is automatic - if leader fails, new one elected in ~seconds
- For a POC, Raft is ideal; production with untrusted parties might use BFT (Fabric 3.0)"

### Q: Explain the transaction flow in your project.

**Answer** (Say this while drawing):
1. **Client submits proposal** → My Node.js app sends to endorsing peers
2. **Endorsement** → Peers execute chaincode, return signed Read-Write sets
3. **Client collects endorsements** → Checks endorsement policy is satisfied
4. **Submit to orderer** → Orderer creates block via Raft consensus
5. **Block delivery** → All peers receive block via gossip
6. **Validation** → Peers verify:
   - Endorsement policy satisfied
   - MVCC (no version conflicts)
   - Valid signatures
7. **Commit** → Valid transactions applied to world state (CouchDB)

### Q: What is your endorsement policy?

**Answer**: "I used `OR('Org1MSP.peer','Org2MSP.peer','Org3MSP.peer')`:
- **Any single organization** can endorse transactions
- This is a flexible policy for development
- Production might use `AND` or `OutOf(2, ...)` for stronger guarantees
- Policy is set during chaincode lifecycle approval, not hardcoded"

### Q: How do you enforce access control?

**Answer**: "I implemented **Organization-Based Access Control (OBAC)** in chaincode:
```javascript
_getClientMSP(ctx) {
    return ctx.clientIdentity.getMSPID();  // e.g., 'Org1MSP'
}

_verifyOrg1(ctx) {
    if (this._getClientMSP(ctx) !== 'Org1MSP') {
        throw new Error('Only Org1 can perform this action');
    }
}
```

| Operation | Allowed Organizations |
|-----------|----------------------|
| CreateAsset | Org1 only |
| ApproveAsset | Org2, Org3 only |
| QueryAsset | All organizations |

This is enforced at the **chaincode level**, not endorsement policy."

### Q: What is the difference between endorsement policy and chaincode access control?

**Answer**: "These are **two different layers**:
- **Endorsement Policy**: Determines *who must sign* a transaction for it to be valid. Network-level, checked during validation.
- **Chaincode Access Control (OBAC)**: Business logic that determines *who can call* specific functions. Application-level, checked during execution.

Example: My endorsement policy says 'any org can endorse', but my chaincode says 'only Org1 can create assets'. Even if Org2 tries to endorse a CreateAsset transaction, the chaincode will throw an error."

### Q: Explain Private Data Collections in your project.

**Answer**: "I use `Org1Org2PrivateCollection` for sensitive asset details:
- **What's private**: description, valuationAmount, internalNotes
- **Who can access**: Only Org1 and Org2 (not Org3)
- **How it works**:
  - Private data stored in **sideDB**, separate from world state
  - Only hash goes on the blockchain (for integrity)
  - Data shared via **gossip** only to authorized peers
  - Transient data used to pass private data to chaincode

```javascript
// Reading private data
const privateData = await ctx.stub.getPrivateData(
    'Org1Org2PrivateCollection', 
    assetID
);
```"

### Q: Why Fabric CA instead of cryptogen?

**Answer**: "**Fabric CA is production-ready**; cryptogen is only for testing:

| Aspect | Fabric CA | cryptogen |
|--------|-----------|-----------|
| Key Generation | Client-side (private key never leaves) | Generated centrally |
| Dynamic Enrollment | Yes, new users anytime | Pre-generated only |
| Revocation | CRL support | None |
| Production Use | Yes | Never |

My project uses Fabric CA exclusively with separate CAs per organization."

### Q: What is the MSP and why is it important?

**Answer**: "**Membership Service Provider (MSP)** is Fabric's identity framework:
- Defines **who belongs** to an organization
- Contains **root CA certs**, **intermediate CAs**, and **policies**
- Stored in each peer's `/var/hyperledger/orderer/msp` directory
- Structure:
  - `cacerts/`: Root CA certificate
  - `signcerts/`: Entity's signing certificate
  - `keystore/`: Private key (never shared)
  - `config.yaml`: NodeOUs for role classification

MSP ID (e.g., `Org1MSP`) is used throughout Fabric to identify organizations."

---

## 3. Your Asset State Machine

```
┌──────────────────────────────────────────────────────────────────────┐
│                      ASSET LIFECYCLE                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌─────────┐                                                         │
│   │ CREATE  │ ← Org1 creates asset                                    │
│   └────┬────┘                                                         │
│        │                                                              │
│        ▼                                                              │
│   ┌─────────┐     Org2/Org3       ┌─────────┐                         │
│   │ PENDING │ ──── approves ────► │APPROVED │ ◄── FINAL (immutable)   │
│   └────┬────┘                     └─────────┘                         │
│        │                                                              │
│        │  Org2/Org3                                                   │
│        └── rejects ──────────────►┌──────────┐                        │
│                                   │ REJECTED │ ◄── FINAL (immutable)  │
│                                   └──────────┘                        │
│                                                                       │
│   ⚠️  APPROVED/REJECTED assets cannot be modified (state machine)     │
└──────────────────────────────────────────────────────────────────────┘
```

**Key Point**: Once an asset reaches APPROVED or REJECTED, it's **immutable**. This is enforced in chaincode:
```javascript
if (asset.status === 'APPROVED' || asset.status === 'REJECTED') {
    throw new Error(`Cannot modify finalized asset`);
}
```

---

## 4. Common Interview Questions

### Fabric Fundamentals

| Question | Your Answer |
|----------|-------------|
| What is a channel? | Logical partition of the network where specific orgs share a ledger. I use `asset-channel`. |
| What is chaincode? | Smart contract code that runs on peers. Mine is Node.js in `chaincode/asset-approval/`. |
| What is world state? | Current values of all assets, stored in CouchDB for rich queries. |
| What is the blockchain? | Immutable log of all transactions, separate from world state. |
| Execute-order-validate vs order-execute? | Fabric executes first (proposal), then orders, then validates. Allows non-determinism handling. |

### Your Project Specifics

| Question | Your Answer |
|----------|-------------|
| Why 3 organizations? | Simulates real consortium: Owner creates, Auditor verifies, Regulator approves. |
| Why CouchDB? | Enables JSON queries. I can query all PENDING assets: `{"selector":{"status":"PENDING"}}` |
| Why Node.js chaincode? | JavaScript familiarity, good tooling, `fabric-contract-api` makes development easy. |
| How do you handle timestamps? | `ctx.stub.getTxTimestamp()` for deterministic, consensus-agreed timestamps. |

### Troubleshooting You Experienced

| Issue | Cause | Solution |
|-------|-------|----------|
| "No Raft leader" | Only 1 orderer joined channel | All 3 orderers must join via osnadmin |
| ENDORSEMENT_POLICY_FAILURE on first call | Chaincode container cold start | Warm-up call or increase timeout |
| Path not found in WSL | Relative paths in connection profiles | Use absolute paths with `path.resolve()` |
| GLIBC version error | Old Ubuntu with new binaries | Upgraded to Ubuntu 22.04 |

---

## 5. Code Snippets to Know

### Creating an Asset (Chaincode)
```javascript
async CreateAsset(ctx, assetID) {
    // 1. Access control - only Org1
    this._verifyOrg1(ctx);
    
    // 2. Check if exists
    const exists = await this._assetExists(ctx, assetID);
    if (exists) throw new Error(`Asset ${assetID} already exists`);
    
    // 3. Create asset object
    const asset = {
        docType: 'asset',
        assetID,
        owner: this._getClientMSP(ctx),
        status: STATUS.PENDING,
        approvals: {},
        createdAt: this._getTimestamp(ctx)
    };
    
    // 4. Save to world state
    await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    
    // 5. Handle private data from transient
    const transientData = ctx.stub.getTransient();
    if (transientData.has('asset_properties')) {
        const privateDetails = JSON.parse(transientData.get('asset_properties'));
        await ctx.stub.putPrivateData('Org1Org2PrivateCollection', assetID, 
            Buffer.from(JSON.stringify(privateDetails)));
    }
    
    return asset;
}
```

### Client Gateway Connection
```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, {
    wallet,
    identity: 'admin',
    discovery: { enabled: true, asLocalhost: true }
});
const network = await gateway.getNetwork('asset-channel');
const contract = network.getContract('assetcc');
```

---

## 6. Diagrams to Draw in Interview

### Transaction Flow
```
Client → Peer(Endorse) → Client → Orderer → Block → All Peers → Validate → Commit
```

### Your Three Organizations
```
Org1 (Owner) ──creates──► Asset ◄──approves── Org2 (Auditor)
                              ◄──approves── Org3 (Regulator)
```

### Raft Leader Election
```
Orderer0 ←─► Orderer1 ←─► Orderer2
   │              │            │
   └──────────────┴────────────┘
         (Raft consensus)
    If leader fails, new one elected
```

---

## 7. What Makes Your Project Interview-Ready

✅ **Fabric CA only** - No cryptogen (production-ready)  
✅ **Raft consensus** - Fault-tolerant ordering  
✅ **Private Data Collections** - Confidentiality between org subsets  
✅ **OBAC** - Organization-based access control in chaincode  
✅ **State Machine** - Immutable final states  
✅ **Node.js chaincode** - Modern, maintainable  
✅ **CouchDB** - Rich query support  
✅ **Complete scripts** - One-click demo  

---

## 8. Quick Commands for Demo

```bash
# Start everything
./scripts/start-all.sh

# Interactive demo with explanations
./scripts/demo.sh

# Manual testing
cd client
node src/app.js create ASSET001 "Equipment" org1 admin
node src/app.js query ASSET001 org1 admin
node src/app.js approve ASSET001 org2 admin
node src/app.js approve ASSET001 org3 admin
node src/app.js query ASSET001 org1 admin  # Status: APPROVED

# Stop
./scripts/stop-all.sh
```

---

**Good luck with your interview! 🚀**
