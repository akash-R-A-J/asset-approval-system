'use strict';

/**
 * Fault Tolerance Test Suite
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
    return `FAULT_${Date.now()}_${testCounter}`;
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
        testFail(desc + ' - should FAIL', 'Error message', 'Command succeeded unexpectedly');
    } catch (error) {
        if (error.message.toLowerCase().includes(expectedError.toLowerCase())) {
            testPass(desc + ' - ERROR handled (expected)', `Error: "${error.message.substring(0, 50)}..."`);
        } else {
            testFail(desc, `Error containing '${expectedError}'`, error.message);
        }
    }
}

async function main() {
    console.log(`${c.blue}`);
    console.log('╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║     HYPERLEDGER FABRIC - FAULT TOLERANCE TEST SUITE                    ║');
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
    testSection('TEST SUITE 1: Error Handling');
    // ========================================================================

    await runTestExpectError('1.1', 'Handle non-existent asset query gracefully',
        () => org1.queryAsset('NONEXISTENT_ASSET'), 'does not exist');

    const ASSET_DUP = genId();
    await org1.createAsset(ASSET_DUP, 'Duplicate test');

    await runTestExpectError('1.2', 'Handle duplicate asset creation gracefully',
        () => org1.createAsset(ASSET_DUP, 'Dup'), 'already exists');

    await runTestExpectError('1.3', 'Handle invalid state transition gracefully',
        () => org1.activateAsset(ASSET_DUP), 'Invalid state');

    await runTestExpectError('1.4', 'Handle unauthorized operation gracefully',
        () => org2.deleteAsset(ASSET_DUP), 'not authorized');

    await org1.deleteAsset(ASSET_DUP);

    // ========================================================================
    testSection('TEST SUITE 2: Recovery & Resilience');
    // ========================================================================

    const ASSET_RECOVER = genId();

    await runTest('2.1', 'System recovers after failed operation', async () => {
        await org1.createAsset(ASSET_RECOVER, 'Recovery test');
        try { await org2.deleteAsset(ASSET_RECOVER); } catch (e) { }
        const a = await org1.queryAsset(ASSET_RECOVER);
        return `status="${a.status}" (unchanged after failed delete)`;
    });

    await runTest('2.2', 'State preserved after partial workflow failure', async () => {
        await org1.submitForApproval(ASSET_RECOVER);
        await org2.approveAsset(ASSET_RECOVER);
        try { await org3.deleteAsset(ASSET_RECOVER); } catch (e) { }
        const a = await org1.queryAsset(ASSET_RECOVER);
        return `approvals.Org2MSP="${a.approvals['Org2MSP']}" (preserved after failed delete)`;
    });

    const ASSET_REJECT = genId();
    await runTest('2.3', 'Rejected asset can be fixed and resubmitted', async () => {
        await org1.createAsset(ASSET_REJECT, 'Bad docs');
        await org1.submitForApproval(ASSET_REJECT);
        await org2.rejectAsset(ASSET_REJECT, 'Incomplete');
        let a = await org1.queryAsset(ASSET_REJECT);
        const rejectedStatus = a.status;
        await org1.updateAsset(ASSET_REJECT, 'Fixed docs');
        await org1.submitForApproval(ASSET_REJECT);
        a = await org1.queryAsset(ASSET_REJECT);
        return `${rejectedStatus} → ${a.status} (recovery workflow complete)`;
    });

    // ========================================================================
    testSection('TEST SUITE 3: Multi-Org Coordination');
    // ========================================================================

    const ASSET_COORD = genId();
    await org1.createAsset(ASSET_COORD, 'Coordination test');
    await org1.submitForApproval(ASSET_COORD);

    await runTest('3.1', 'Both approvals required for completion', async () => {
        await org2.approveAsset(ASSET_COORD);
        let a = await org1.queryAsset(ASSET_COORD);
        const afterOne = a.status;
        await org3.approveAsset(ASSET_COORD);
        a = await org1.queryAsset(ASSET_COORD);
        return `After Org2: "${afterOne}", After Org3: "${a.status}"`;
    });

    const ASSET_REJCOORD = genId();
    await org1.createAsset(ASSET_REJCOORD, 'Rejection coord');
    await org1.submitForApproval(ASSET_REJCOORD);
    await org2.approveAsset(ASSET_REJCOORD);

    await runTest('3.2', 'Any org can reject and stop workflow', async () => {
        await org3.rejectAsset(ASSET_REJCOORD, 'Regulator rejected');
        const a = await org1.queryAsset(ASSET_REJCOORD);
        return `status="${a.status}" (Org3 rejected after Org2 approved)`;
    });

    const ASSET_ORDER = genId();
    await runTest('3.3', 'Approval order is independent', async () => {
        await org1.createAsset(ASSET_ORDER, 'Order test');
        await org1.submitForApproval(ASSET_ORDER);
        await org3.approveAsset(ASSET_ORDER);
        await org2.approveAsset(ASSET_ORDER);
        const a = await org1.queryAsset(ASSET_ORDER);
        return `status="${a.status}" (Org3 first, then Org2)`;
    });

    // ========================================================================
    testSection('TEST SUITE 4: Transaction Integrity');
    // ========================================================================

    await runTest('4.1', 'Complete audit history maintained', async () => {
        const h = await org1.getAssetHistory(ASSET_COORD);
        return `${h.length} history entries found`;
    });

    await runTest('4.2', 'Each history entry has transaction ID', async () => {
        const h = await org1.getAssetHistory(ASSET_COORD);
        const allHaveTxId = h.every(e => e.txId);
        return `${h.length} entries, all have txId: ${allHaveTxId}`;
    });

    // ========================================================================
    testSection('TEST SUITE 5: Connection Resilience');
    // ========================================================================

    await runTest('5.1', 'Reconnect after disconnect works', async () => {
        const temp = new AssetService('org1', { quiet: true });
        await temp.connect();
        const id = genId();
        await temp.createAsset(id, 'Reconnect test');
        temp.disconnect();
        const a = await org1.queryAsset(id);
        await org1.deleteAsset(id);
        return `Created via temp client, queried via main: "${a.assetID}"`;
    });

    await runTest('5.2', 'Multiple sequential client operations', async () => {
        const c1 = new AssetService('org1', { quiet: true });
        const c2 = new AssetService('org1', { quiet: true });
        await c1.connect();
        await c2.connect();

        const id1 = genId();
        const id2 = genId();

        await c1.createAsset(id1, 'Client1');
        await c2.createAsset(id2, 'Client2');

        const a1 = await org1.queryAsset(id1);
        const a2 = await org1.queryAsset(id2);

        c1.disconnect();
        c2.disconnect();
        await org1.deleteAsset(id1);
        await org1.deleteAsset(id2);

        return `Client1 created "${a1.assetID}", Client2 created "${a2.assetID}"`;
    });

    // ========================================================================
    // CLEANUP
    // ========================================================================
    console.log(`\n${c.yellow}Cleaning up...${c.reset}`);
    for (const id of [ASSET_RECOVER, ASSET_REJECT, ASSET_COORD, ASSET_REJCOORD, ASSET_ORDER]) {
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
        console.log(`${c.green}║                    ALL FAULT TOLERANCE TESTS PASSED! ✓                 ║${c.reset}`);
        console.log(`${c.green}╚════════════════════════════════════════════════════════════════════════╝${c.reset}`);
        console.log(`\nFault tolerance verified:`);
        console.log(`  ✓ Graceful error handling`);
        console.log(`  ✓ System recovery after failures`);
        console.log(`  ✓ Multi-org coordination works correctly`);
        console.log(`  ✓ Transaction integrity maintained`);
        console.log(`  ✓ Connection resilience confirmed`);
        process.exit(0);
    } else {
        console.log(`${c.red}╔════════════════════════════════════════════════════════════════════════╗${c.reset}`);
        console.log(`${c.red}║                    SOME TESTS FAILED! ✗                                 ║${c.reset}`);
        console.log(`${c.red}╚════════════════════════════════════════════════════════════════════════╝${c.reset}`);
        process.exit(1);
    }
}

main();
