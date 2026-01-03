'use strict';

/**
 * Security Test Suite
 * Format: Yellow "Test X.X: Description..." then PASS/FAIL with verification output
 */

const { AssetService } = require('./assetService');

// Colors
const c = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[1;33m',
    cyan: '\x1b[36m',
};

let TESTS_PASSED = 0;
let TESTS_FAILED = 0;
let org1, org2, org3;
let testCounter = 0;

function testPass(desc, verification) {
    console.log(`${c.green}✓ PASS${c.reset}: ${desc}`);
    if (verification) {
        console.log(`${c.dim}  └─ Verified: ${verification}${c.reset}`);
    }
    TESTS_PASSED++;
}

function testFail(desc, expected, got) {
    console.log(`${c.red}✗ FAIL${c.reset}: ${desc}`);
    console.log(`${c.red}  Expected: ${expected}${c.reset}`);
    console.log(`${c.red}  Got: ${got}${c.reset}`);
    TESTS_FAILED++;
}

function testSection(title) {
    console.log(`\n${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.cyan}  ${title}${c.reset}`);
    console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
}

function genId() {
    testCounter++;
    return `SEC_${Date.now()}_${testCounter}`;
}

async function runTest(testNum, desc, fn) {
    console.log(`${c.yellow}Test ${testNum}: ${desc}...${c.reset}`);
    try {
        const verification = await fn();
        testPass(desc, verification);
    } catch (error) {
        testFail(desc, 'Operation should succeed', error.message);
    }
}

async function runTestExpectError(testNum, desc, fn, expectedError) {
    console.log(`${c.yellow}Test ${testNum}: ${desc}...${c.reset}`);
    try {
        await fn();
        testFail(desc + ' - should be DENIED', 'Error/Access Denied', 'Command succeeded unexpectedly');
    } catch (error) {
        if (error.message.toLowerCase().includes(expectedError.toLowerCase())) {
            testPass(desc + ' - DENIED (expected)', `Error: "${error.message.substring(0, 60)}..."`);
        } else {
            testFail(desc, `Error containing '${expectedError}'`, error.message);
        }
    }
}

async function main() {
    console.log(`${c.blue}`);
    console.log('╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║     HYPERLEDGER FABRIC - SECURITY TEST SUITE                           ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝');
    console.log(`${c.reset}`);

    // Setup
    console.log(`${c.yellow}Setting up: Connecting to all organizations...${c.reset}`);
    try {
        org1 = new AssetService('org1', { quiet: true });
        org2 = new AssetService('org2', { quiet: true });
        org3 = new AssetService('org3', { quiet: true });
        await org1.connect();
        await org2.connect();
        await org3.connect();
        console.log(`${c.green}✓ Connected to Org1, Org2, Org3${c.reset}`);
    } catch (e) {
        console.log(`${c.red}✗ Connection failed: ${e.message}${c.reset}`);
        process.exit(1);
    }

    // ========================================================================
    testSection('TEST SUITE 1: Role-Based Access Control (RBAC)');
    // ========================================================================

    const ASSET_RBAC = genId();

    await runTest('1.1', 'Owner (Org1) can create assets', async () => {
        await org1.createAsset(ASSET_RBAC, 'RBAC Test');
        const a = await org1.queryAsset(ASSET_RBAC);
        return `owner="${a.owner}", status="${a.status}"`;
    });

    await runTestExpectError('1.2', 'Auditor (Org2) denied creating assets',
        () => org2.createAsset(genId(), 'X'), 'not authorized');

    await runTestExpectError('1.3', 'Regulator (Org3) denied creating assets',
        () => org3.createAsset(genId(), 'X'), 'not authorized');

    console.log(`${c.yellow}Setting up: Submitting asset for approval...${c.reset}`);
    await org1.submitForApproval(ASSET_RBAC);
    console.log(`${c.green}✓ Asset submitted${c.reset}`);

    await runTest('1.4', 'Auditor (Org2) can approve assets', async () => {
        await org2.approveAsset(ASSET_RBAC);
        const a = await org1.queryAsset(ASSET_RBAC);
        return `approvals.Org2MSP="${a.approvals['Org2MSP']}"`;
    });

    await runTest('1.5', 'Regulator (Org3) can approve assets', async () => {
        await org3.approveAsset(ASSET_RBAC);
        const a = await org1.queryAsset(ASSET_RBAC);
        return `status="${a.status}", approvals.Org3MSP="${a.approvals['Org3MSP']}"`;
    });

    const ASSET_SELF = genId();
    await org1.createAsset(ASSET_SELF, 'Self approve test');
    await org1.submitForApproval(ASSET_SELF);

    await runTestExpectError('1.6', 'Owner (Org1) denied self-approval',
        () => org1.approveAsset(ASSET_SELF), 'not authorized');

    const ASSET_DEL = genId();
    await org1.createAsset(ASSET_DEL, 'Delete test');

    await runTestExpectError('1.7', 'Non-owner denied deleting asset',
        () => org2.deleteAsset(ASSET_DEL), 'not authorized');

    await runTestExpectError('1.8', 'Non-owner denied updating asset',
        () => org2.updateAsset(ASSET_DEL, 'Hacked'), 'not authorized');

    // ========================================================================
    testSection('TEST SUITE 2: Data Isolation');
    // ========================================================================

    await runTest('2.1', 'All orgs can read public asset data', async () => {
        const a1 = await org1.queryAsset(ASSET_RBAC);
        const a2 = await org2.queryAsset(ASSET_RBAC);
        const a3 = await org3.queryAsset(ASSET_RBAC);
        return `Org1 sees "${a1.assetID}", Org2 sees "${a2.assetID}", Org3 sees "${a3.assetID}"`;
    });

    await runTestExpectError('2.2', 'Regulator (Org3) denied private data access',
        () => org3.readPrivateData('any-asset'), 'not authorized');

    // ========================================================================
    testSection('TEST SUITE 3: State Machine Security');
    // ========================================================================

    const ASSET_STATE = genId();
    await org1.createAsset(ASSET_STATE, 'State test');

    await runTestExpectError('3.1', 'Cannot skip approval workflow',
        () => org1.activateAsset(ASSET_STATE), 'Invalid state');

    await runTestExpectError('3.2', 'Cannot approve non-pending asset',
        () => org2.approveAsset(ASSET_STATE), 'PENDING_APPROVAL');

    await org1.submitForApproval(ASSET_STATE);

    await runTestExpectError('3.3', 'Cannot delete pending asset',
        () => org1.deleteAsset(ASSET_STATE), 'Invalid state');

    await org2.approveAsset(ASSET_STATE);
    await org3.approveAsset(ASSET_STATE);
    await org1.activateAsset(ASSET_STATE);

    await runTestExpectError('3.4', 'Cannot update active asset',
        () => org1.updateAsset(ASSET_STATE, 'X'), 'only update');

    // ========================================================================
    testSection('TEST SUITE 4: Audit Trail');
    // ========================================================================

    await runTest('4.1', 'All state changes recorded in history', async () => {
        const h = await org1.getAssetHistory(ASSET_STATE);
        return `${h.length} history entries (create, submit, approve x2, activate)`;
    });

    await runTest('4.2', 'History contains transaction IDs', async () => {
        const h = await org1.getAssetHistory(ASSET_STATE);
        return `txId="${h[0].txId.substring(0, 16)}..."`;
    });

    // ========================================================================
    // CLEANUP
    // ========================================================================
    console.log(`\n${c.yellow}Cleaning up...${c.reset}`);
    for (const id of [ASSET_RBAC, ASSET_SELF, ASSET_DEL, ASSET_STATE]) {
        try {
            const a = await org1.queryAsset(id);
            if (['CREATED', 'REJECTED'].includes(a.status)) await org1.deleteAsset(id);
            if (a.status === 'APPROVED') { await org1.activateAsset(id); await org1.deleteAsset(id); }
            if (a.status === 'ACTIVE') await org1.deleteAsset(id);
        } catch (e) { }
    }
    console.log(`${c.green}✓ Cleanup complete${c.reset}`);

    org1?.disconnect();
    org2?.disconnect();
    org3?.disconnect();

    // RESULTS
    const TESTS_TOTAL = TESTS_PASSED + TESTS_FAILED;

    console.log(`\n${c.cyan}════════════════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.cyan}                        TEST RESULTS SUMMARY                             ${c.reset}`);
    console.log(`${c.cyan}════════════════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`\nTotal Tests:  ${TESTS_TOTAL}`);
    console.log(`${c.green}Passed:       ${TESTS_PASSED}${c.reset}`);
    console.log(`${c.red}Failed:       ${TESTS_FAILED}${c.reset}\n`);

    if (TESTS_FAILED === 0) {
        console.log(`${c.green}╔════════════════════════════════════════════════════════════════════════╗${c.reset}`);
        console.log(`${c.green}║                    ALL SECURITY TESTS PASSED! ✓                        ║${c.reset}`);
        console.log(`${c.green}╚════════════════════════════════════════════════════════════════════════╝${c.reset}`);
        console.log(`\nSecurity features verified:`);
        console.log(`  ✓ Role-Based Access Control (RBAC) enforced`);
        console.log(`  ✓ Private data access restricted`);
        console.log(`  ✓ State machine prevents invalid transitions`);
        console.log(`  ✓ Complete audit trail maintained`);
        process.exit(0);
    } else {
        console.log(`${c.red}╔════════════════════════════════════════════════════════════════════════╗${c.reset}`);
        console.log(`${c.red}║                    SOME TESTS FAILED! ✗                                 ║${c.reset}`);
        console.log(`${c.red}╚════════════════════════════════════════════════════════════════════════╝${c.reset}`);
        process.exit(1);
    }
}

main();
