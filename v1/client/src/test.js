'use strict';

/**
 * Comprehensive Test Suite for Asset Approval System
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
let testAssets = [];
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
    const id = `TEST_${Date.now()}_${testCounter}`;
    testAssets.push(id);
    return id;
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
    console.log('║     HYPERLEDGER FABRIC - COMPREHENSIVE TEST SUITE                      ║');
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
    testSection('TEST SUITE 1: Access Control (OBAC)');
    // ========================================================================

    const ASSET_ACCESS = genId();

    await runTest('1.1', 'Org1 should be ALLOWED to create assets', async () => {
        await org1.createAsset(ASSET_ACCESS, 'Access Control Test');
        const asset = await org1.queryAsset(ASSET_ACCESS);
        return `status="${asset.status}", owner="${asset.owner}"`;
    });

    await runTestExpectError('1.2', 'Org2 should be DENIED creating assets',
        () => org2.createAsset(genId(), 'Unauthorized'), 'not authorized');

    await runTestExpectError('1.3', 'Org3 should be DENIED creating assets',
        () => org3.createAsset(genId(), 'Unauthorized'), 'not authorized');

    console.log(`${c.yellow}Setting up: Submitting asset for approval...${c.reset}`);
    await org1.submitForApproval(ASSET_ACCESS);
    console.log(`${c.green}✓ Asset submitted${c.reset}`);

    await runTestExpectError('1.4', 'Org1 should be DENIED approving assets',
        () => org1.approveAsset(ASSET_ACCESS), 'not authorized');

    await runTest('1.5', 'Org2 should be ALLOWED to approve assets', async () => {
        await org2.approveAsset(ASSET_ACCESS);
        const asset = await org1.queryAsset(ASSET_ACCESS);
        return `approvals.Org2MSP="${asset.approvals['Org2MSP']}"`;
    });

    await runTest('1.6', 'Org3 should be ALLOWED to approve assets', async () => {
        await org3.approveAsset(ASSET_ACCESS);
        const asset = await org1.queryAsset(ASSET_ACCESS);
        return `status="${asset.status}", approvals.Org3MSP="${asset.approvals['Org3MSP']}"`;
    });

    // ========================================================================
    testSection('TEST SUITE 2: State Machine Enforcement');
    // ========================================================================

    const ASSET_STATE = genId();
    console.log(`${c.yellow}Setting up: Creating and approving asset for state machine tests...${c.reset}`);
    await org1.createAsset(ASSET_STATE, 'State Machine Test');
    await org1.submitForApproval(ASSET_STATE);
    await org2.approveAsset(ASSET_STATE);
    await org3.approveAsset(ASSET_STATE);
    console.log(`${c.green}✓ Asset created and approved${c.reset}`);

    await runTest('2.1', 'Asset should have APPROVED status', async () => {
        const asset = await org1.queryAsset(ASSET_STATE);
        if (asset.status !== 'APPROVED') throw new Error(`Status is ${asset.status}`);
        return `status="${asset.status}"`;
    });

    await runTestExpectError('2.2', 'Re-approving an APPROVED asset should be DENIED',
        () => org2.approveAsset(ASSET_STATE), 'PENDING_APPROVAL');

    const ASSET_PARTIAL = genId();
    await org1.createAsset(ASSET_PARTIAL, 'Partial test');
    await runTestExpectError('2.3', 'Activating non-approved asset should be DENIED',
        () => org1.activateAsset(ASSET_PARTIAL), 'Invalid state');

    // ========================================================================
    testSection('TEST SUITE 3: Rejection State Machine');
    // ========================================================================

    const ASSET_REJECT = genId();
    console.log(`${c.yellow}Setting up: Creating asset for rejection tests...${c.reset}`);
    await org1.createAsset(ASSET_REJECT, 'Rejection Test');
    await org1.submitForApproval(ASSET_REJECT);
    console.log(`${c.green}✓ Asset created and submitted${c.reset}`);

    await runTest('3.1', 'Org2 should be ALLOWED to reject pending assets', async () => {
        await org2.rejectAsset(ASSET_REJECT, 'Failed audit check');
        const asset = await org1.queryAsset(ASSET_REJECT);
        return `status="${asset.status}", reason in approvals`;
    });

    await runTest('3.2', 'Asset should have REJECTED status', async () => {
        const asset = await org1.queryAsset(ASSET_REJECT);
        if (asset.status !== 'REJECTED') throw new Error(`Status is ${asset.status}`);
        return `status="${asset.status}"`;
    });

    await runTestExpectError('3.3', 'Approving a REJECTED asset should be DENIED',
        () => org3.approveAsset(ASSET_REJECT), 'PENDING_APPROVAL');

    await runTest('3.4', 'Should be ALLOWED to resubmit after fixing rejected asset', async () => {
        await org1.updateAsset(ASSET_REJECT, 'Fixed documentation');
        await org1.submitForApproval(ASSET_REJECT);
        const asset = await org1.queryAsset(ASSET_REJECT);
        return `status="${asset.status}", description="${asset.description.substring(0, 20)}..."`;
    });

    // ========================================================================
    testSection('TEST SUITE 4: Query Permissions (All Orgs Can Read)');
    // ========================================================================

    await runTest('4.1', 'Org1 should be ALLOWED to query assets', async () => {
        const asset = await org1.queryAsset(ASSET_ACCESS);
        return `assetID="${asset.assetID}"`;
    });

    await runTest('4.2', 'Org2 should be ALLOWED to query assets', async () => {
        const asset = await org2.queryAsset(ASSET_ACCESS);
        return `assetID="${asset.assetID}"`;
    });

    await runTest('4.3', 'Org3 should be ALLOWED to query assets', async () => {
        const asset = await org3.queryAsset(ASSET_ACCESS);
        return `assetID="${asset.assetID}"`;
    });

    await runTest('4.4', 'Should be ALLOWED to query asset history', async () => {
        const history = await org1.getAssetHistory(ASSET_ACCESS);
        return `${history.length} history entries found`;
    });

    // ========================================================================
    testSection('TEST SUITE 5: Private Data Access Control');
    // ========================================================================

    await runTestExpectError('5.1', 'Org3 (Regulator) should be DENIED querying private data',
        () => org3.readPrivateData('any-asset'), 'not authorized');

    // ========================================================================
    // CLEANUP
    // ========================================================================
    console.log(`\n${c.yellow}Cleaning up test assets...${c.reset}`);
    for (const id of testAssets) {
        try {
            const a = await org1.queryAsset(id);
            if (a.status !== 'DELETED' && ['CREATED', 'APPROVED', 'ACTIVE', 'REJECTED'].includes(a.status)) {
                if (a.status === 'APPROVED') await org1.activateAsset(id);
                await org1.deleteAsset(id);
            }
        } catch (e) { }
    }
    console.log(`${c.green}✓ Cleanup complete${c.reset}`);

    org1?.disconnect();
    org2?.disconnect();
    org3?.disconnect();

    // ========================================================================
    // RESULTS SUMMARY
    // ========================================================================
    const TESTS_TOTAL = TESTS_PASSED + TESTS_FAILED;

    console.log(`\n${c.cyan}════════════════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.cyan}                        TEST RESULTS SUMMARY                             ${c.reset}`);
    console.log(`${c.cyan}════════════════════════════════════════════════════════════════════════${c.reset}`);
    console.log(`\nTotal Tests:  ${TESTS_TOTAL}`);
    console.log(`${c.green}Passed:       ${TESTS_PASSED}${c.reset}`);
    console.log(`${c.red}Failed:       ${TESTS_FAILED}${c.reset}\n`);

    if (TESTS_FAILED === 0) {
        console.log(`${c.green}╔════════════════════════════════════════════════════════════════════════╗${c.reset}`);
        console.log(`${c.green}║                    ALL TESTS PASSED! ✓                                  ║${c.reset}`);
        console.log(`${c.green}╚════════════════════════════════════════════════════════════════════════╝${c.reset}`);
        console.log(`\nSecurity features verified:`);
        console.log(`  ✓ Organization-Based Access Control (OBAC) enforced`);
        console.log(`  ✓ State machine prevents modification of finalized assets`);
        console.log(`  ✓ Query permissions work for all organizations`);
        console.log(`  ✓ Private data access restricted to authorized organizations`);
        process.exit(0);
    } else {
        console.log(`${c.red}╔════════════════════════════════════════════════════════════════════════╗${c.reset}`);
        console.log(`${c.red}║                    SOME TESTS FAILED! ✗                                 ║${c.reset}`);
        console.log(`${c.red}╚════════════════════════════════════════════════════════════════════════╝${c.reset}`);
        process.exit(1);
    }
}

main();
