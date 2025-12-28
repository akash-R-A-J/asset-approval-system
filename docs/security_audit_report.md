# Hyperledger Fabric POC - Security Audit & Bug Report

## Executive Summary

This document contains findings from a comprehensive audit of all project files for bugs, security vulnerabilities, and integrity issues.

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | N/A |
| High | 2 | Documented |
| Medium | 5 | Some Fixed |
| Low | 8 | Documented |

---

## Critical Issues (None Found)
No critical security vulnerabilities were identified.

---

## High Severity Issues

### H1: Hardcoded Admin Credentials
**Files Affected:**
- `client/src/enrollAdmin.js` (lines 31-33, 38-39, 45-46)
- `network/scripts/registerEnroll.sh`
- `network/docker/docker-compose-ca.yaml`

**Issue:**
Admin credentials are hardcoded in plain text:
```javascript
adminId: 'admin',
adminSecret: 'adminpw'
```

**Risk:** If source code is exposed, attackers can enroll admin identities.

**Recommendation:**
```javascript
// Use environment variables
adminId: process.env.FABRIC_CA_ADMIN_ID || 'admin',
adminSecret: process.env.FABRIC_CA_ADMIN_SECRET
```

**Status:** Not fixed (acceptable for POC, must fix for production)

---

### H2: TLS Certificate Verification Disabled
**Files Affected:**
- `client/src/gateway.js` (line 136)
- `client/src/enrollAdmin.js` (line 79)
- `client/src/registerUser.js` (line 77)

**Issue:**
```javascript
httpOptions: {
    verify: false  // Disables certificate verification
}
```

**Risk:** Allows man-in-the-middle attacks on CA connections.

**Recommendation:**
Enable verification in production:
```javascript
httpOptions: {
    verify: process.env.NODE_ENV !== 'development'
}
```

**Status:** Not fixed (acceptable for POC with localhost)

---

## Medium Severity Issues

### M1: Shell Script `set -e` Causing Premature Exit ✅ FIXED
**Files Affected:**
- `scripts/run-tests.sh`
- `scripts/test-fault-tolerance.sh`
- `scripts/demo.sh` (still has issue)

**Issue:**
`set -e` combined with bash arithmetic `((var++))` returns exit code 1 when incrementing from 0.

**Status:** Fixed in `run-tests.sh` and `test-fault-tolerance.sh`. `demo.sh` may have similar issues.

---

### M2: Anchor Peer Update Fails on Repeat Runs ✅ FIXED
**File:** `network/scripts/createChannel.sh`

**Issue:**
`compute_update` produces empty output when anchor peer is already set, causing error:
```
ConfigUpdate for channel '' but envelope for channel 'asset-channel'
```

**Status:** Fixed with check for empty update file.

---

### M3: No Input Validation in CLI Application ✅ FIXED
**File:** `client/src/app.js`, `client/src/config.js`

**Issue:**
No validation of assetID format.

**Solution Implemented:**
```javascript
// config.js - validation functions
function validateAssetId(assetId) {
    if (!/^[A-Za-z0-9_-]+$/.test(assetId)) {
        throw new Error('Asset ID must be alphanumeric');
    }
}

// app.js - uses validation
validateAssetId(assetID);
validateDescription(description);
validateReason(reason);
```

**Status:** ✅ Fixed in `config.js` and `app.js`

---

### M4: Private Key Stored in Wallet Without Encryption
**File:** `client/src/enrollAdmin.js`, `client/src/registerUser.js`

**Issue:**
Private keys are stored in the filesystem wallet without encryption:
```javascript
const x509Identity = {
    credentials: {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes()  // Plain text
    }
};
await wallet.put('admin', x509Identity);
```

**Risk:** If wallet directory is compromised, private keys are exposed.

**Recommendation:**
Use HSM wallet provider or encrypt wallet at rest for production.

**Status:** Not fixed (acceptable for POC)

---

### M5: `verifyResult()` Uses `exit 1` in Sourced Scripts
**File:** `network/scripts/envVar.sh` (line 111)

**Issue:**
```bash
function verifyResult() {
  if [ $1 -ne 0 ]; then
    errorln "!!!!!!!!!!!!!!! $2 !!!!!!!!!!!!!!!!"
    exit 1  # Exits entire shell, not just function
  fi
}
```

When sourced by other scripts, this `exit 1` kills the parent script.

**Recommendation:**
```bash
function verifyResult() {
  if [ $1 -ne 0 ]; then
    errorln "!!!!!!!!!!!!!!! $2 !!!!!!!!!!!!!!!!"
    return 1  # Use return instead of exit
  fi
}
# Caller must check: verifyResult $res "message" || exit 1
```

**Status:** Not fixed (may cause issues in complex script chains)

---

## Low Severity Issues

### L1: Missing Process Exit Code on Error
**File:** `client/src/app.js`

**Issue:**
Errors are caught but `process.exit(1)` is not called:
```javascript
} catch (error) {
    console.error(`Error: ${error.message}`);
    // Should add: process.exit(1);
}
```

**Status:** Not fixed

---

### L2: Console Logging in Chaincode
**File:** `chaincode/asset-approval/lib/assetContract.js`

**Issue:**
```javascript
console.info(`Asset ${assetID} created by ${clientMSP}`);
```

Production chaincode should use structured logging or remove console logs.

**Status:** Not fixed (acceptable for POC/debugging)

---

### L3: Docker CouchDB Uses Default Credentials
**File:** `network/docker/docker-compose.yaml`

**Issue:**
```yaml
environment:
  - COUCHDB_USER=admin
  - COUCHDB_PASSWORD=adminpw
```

**Status:** Not fixed (acceptable for POC)

---

### L4: No Rate Limiting on Client Application
**File:** `client/src/gateway.js`

**Issue:**
No rate limiting on transaction submission. A malicious client could flood the network.

**Status:** Not fixed (would be handled by API gateway in production)

---

### L5: Relative Paths May Break in Different Working Directories
**File:** `client/src/registerUser.js` (line 28)

**Issue:**
```javascript
caPath: '../network/organizations/fabric-ca/org1/ca-cert.pem'
```

Different from `enrollAdmin.js` which uses absolute paths.

**Status:** Not fixed (minor inconsistency)

---

### L6: Demo Script Doesn't Handle Errors Gracefully
**File:** `scripts/demo.sh`

**Issue:**
Uses `set -e` which causes immediate exit on any error. Has same potential issues as run-tests.sh.

**Status:** Not fixed

---

### L7: No Timeout Handling for Network Operations
**Files:** `client/src/invoke.js`, `client/src/query.js`

**Issue:**
No explicit timeout handling for long-running transactions:
```javascript
const result = await contract.submitTransaction('CreateAsset', assetID);
// Could hang indefinitely
```

**Recommendation:**
Use Promise.race with timeout or configure gateway timeouts.

**Status:** Not fixed (gateway has built-in timeouts)

---

### L8: Missing .gitignore Entries
**Issue:**
Wallet directories and generated certificates should be in .gitignore to prevent accidental commits.

**Status:** Not verified

---

## Security Architecture Assessment

### ✅ Strong Points

1. **Organization-Based Access Control (OBAC)**
   - Properly implemented in chaincode
   - MSP ID verification before every operation
   - Clear separation of concerns (owner/auditor/regulator)

2. **State Machine Enforcement**
   - Finalized assets (APPROVED/REJECTED) cannot be modified
   - All state transitions validated

3. **Private Data Collections**
   - Sensitive data properly isolated
   - Collection policy restricts access to authorized orgs
   - Transient data used for private data submission

4. **TLS Enabled**
   - All peer and orderer communication uses TLS
   - Proper certificate configuration

5. **Raft Consensus**
   - CFT with 3 orderers (tolerates 1 failure)
   - Production-ready consensus configuration

6. **Fabric CA Identity Management**
   - Dynamic certificate issuance
   - Proper enrollment workflow

### ⚠️ Areas for Production Hardening

1. **Credential Management**
   - Move secrets to environment variables or vault
   - Implement proper secrets rotation

2. **Certificate Verification**
   - Enable TLS verification for CA connections
   - Implement certificate pinning

3. **Wallet Security**
   - Use HSM for private key storage
   - Implement wallet encryption

4. **Logging & Monitoring**
   - Add structured logging
   - Implement audit trails for all operations
   - Add monitoring for security events

5. **Input Validation**
   - Validate all user inputs in client application
   - Implement strict assetID format requirements

---

## Summary of Fixed Issues

| Issue | File | Status |
|-------|------|--------|
| run-tests.sh exits after first test | scripts/run-tests.sh | ✅ FIXED |
| test-fault-tolerance.sh shows false success | scripts/test-fault-tolerance.sh | ✅ FIXED |
| start-all.sh exits after deployCC | scripts/start-all.sh | ✅ FIXED |
| Anchor peer already set error | network/scripts/createChannel.sh | ✅ FIXED |

---

## Production Recommendations

For production deployment, implement:
1. Proper credential management (secrets manager)
2. TLS certificate verification
3. Input validation on all endpoints
4. HSM for wallet security
5. Comprehensive audit logging
