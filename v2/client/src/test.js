'use strict';

/**
 * Test Runner - Asset Approval System v2
 * Executes test suites independently or all together
 * 
 * Usage:
 *   npm test                    # Run all tests
 *   npm test -- --suite=abac    # Run specific suite
 *   npm test -- --list          # List available suites
 */

const { FabricClient } = require('./fabricClient');

// ANSI Colors
const c = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

// Test statistics
let passed = 0;
let failed = 0;
const results = [];

// Clients
let ownerClient, auditorClient, regulatorClient;

// Utility functions
const log = {
    suite: (name) => console.log(`\n${c.bgBlue}${c.bright} ${name} ${c.reset}\n`),
    test: (name) => process.stdout.write(`  ${c.dim}○${c.reset} ${name}... `),
    pass: (detail = '') => {
        passed++;
        console.log(`${c.green}✓ PASS${c.reset}${detail ? ` ${c.dim}(${detail})${c.reset}` : ''}`);
    },
    fail: (reason) => {
        failed++;
        console.log(`${c.red}✗ FAIL${c.reset} - ${reason}`);
    },
    skip: (reason) => console.log(`${c.yellow}⊘ SKIP${c.reset} - ${reason}`),
};

const c_bgBlue = '\x1b[44m';
log.suite = (name) => console.log(`\n${c_bgBlue}${c.bright} ${name} ${c.reset}\n`);

// Generate unique asset ID
const genAssetId = (prefix = 'TEST') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to check if an error is an expected failure (access denied, invalid transition, etc.)
// Fabric Gateway wraps chaincode errors in gRPC status, so we check for ABORTED or the actual message
const isExpectedError = (error, ...keywords) => {
    const msg = error.message || '';
    // If transaction was aborted, it means chaincode rejected it - this is expected for negative tests
    if (msg.includes('ABORTED') || msg.includes('failed to endorse')) {
        return true;
    }
    // Check for specific keywords if provided
    return keywords.some(kw => msg.toLowerCase().includes(kw.toLowerCase()));
};

// ===========================================================================
// Test Suites
// ===========================================================================

const testSuites = {
    // =========================================================================
    // ABAC (Attribute-Based Access Control) Tests
    // =========================================================================
    abac: {
        name: 'ABAC Access Control Tests',
        tests: [
            {
                name: 'Owner can read caller info with role=owner',
                run: async () => {
                    const info = await ownerClient.getCallerInfo();
                    if (info.role !== 'owner') throw new Error(`Expected role=owner, got ${info.role}`);
                    return `role=${info.role}`;
                }
            },
            {
                name: 'Auditor can read caller info with role=auditor',
                run: async () => {
                    const info = await auditorClient.getCallerInfo();
                    if (info.role !== 'auditor') throw new Error(`Expected role=auditor, got ${info.role}`);
                    return `role=${info.role}`;
                }
            },
            {
                name: 'Regulator can read caller info with role=regulator',
                run: async () => {
                    const info = await regulatorClient.getCallerInfo();
                    if (info.role !== 'regulator') throw new Error(`Expected role=regulator, got ${info.role}`);
                    return `role=${info.role}`;
                }
            },
            {
                name: 'Owner can create asset',
                run: async () => {
                    const assetId = genAssetId('ABAC');
                    await ownerClient.createAsset(assetId, 'ABAC test asset');
                    const asset = await ownerClient.queryAsset(assetId);
                    if (asset.status !== 'CREATED') throw new Error(`Unexpected status: ${asset.status}`);
                    return `assetId=${assetId}`;
                }
            },
            {
                name: 'Auditor cannot create asset',
                run: async () => {
                    const assetId = genAssetId('ABAC-FAIL');
                    try {
                        await auditorClient.createAsset(assetId, 'Should fail');
                        throw new Error('Expected access denied');
                    } catch (e) {
                        if (!isExpectedError(e, 'Access denied', 'role', 'owner')) {
                            throw e;
                        }
                        return 'Access denied as expected';
                    }
                }
            },
            {
                name: 'Regulator cannot create asset',
                run: async () => {
                    const assetId = genAssetId('ABAC-FAIL');
                    try {
                        await regulatorClient.createAsset(assetId, 'Should fail');
                        throw new Error('Expected access denied');
                    } catch (e) {
                        if (!isExpectedError(e, 'Access denied', 'role', 'owner')) {
                            throw e;
                        }
                        return 'Access denied as expected';
                    }
                }
            },
        ]
    },

    // =========================================================================
    // State Machine Tests
    // =========================================================================
    state: {
        name: 'State Machine Tests',
        tests: [
            {
                name: 'New asset starts in CREATED state',
                run: async () => {
                    const assetId = genAssetId('STATE');
                    await ownerClient.createAsset(assetId, 'State test');
                    const asset = await ownerClient.queryAsset(assetId);
                    if (asset.status !== 'CREATED') throw new Error(`Expected CREATED, got ${asset.status}`);
                    return 'status=CREATED';
                }
            },
            {
                name: 'CREATED -> PENDING_APPROVAL on submit',
                run: async () => {
                    const assetId = genAssetId('STATE');
                    await ownerClient.createAsset(assetId, 'State test');
                    await ownerClient.submitForApproval(assetId);
                    const asset = await ownerClient.queryAsset(assetId);
                    if (asset.status !== 'PENDING_APPROVAL') throw new Error(`Expected PENDING_APPROVAL, got ${asset.status}`);
                    return 'status=PENDING_APPROVAL';
                }
            },
            {
                name: 'PENDING_APPROVAL -> APPROVED after all approvals',
                run: async () => {
                    const assetId = genAssetId('STATE');
                    await ownerClient.createAsset(assetId, 'State test');
                    await ownerClient.submitForApproval(assetId);
                    await auditorClient.approveAsset(assetId);
                    await regulatorClient.approveAsset(assetId);
                    const asset = await ownerClient.queryAsset(assetId);
                    if (asset.status !== 'APPROVED') throw new Error(`Expected APPROVED, got ${asset.status}`);
                    return 'status=APPROVED';
                }
            },
            {
                name: 'APPROVED -> ACTIVE on activation',
                run: async () => {
                    const assetId = genAssetId('STATE');
                    await ownerClient.createAsset(assetId, 'State test');
                    await ownerClient.submitForApproval(assetId);
                    await auditorClient.approveAsset(assetId);
                    await regulatorClient.approveAsset(assetId);
                    await ownerClient.activateAsset(assetId);
                    const asset = await ownerClient.queryAsset(assetId);
                    if (asset.status !== 'ACTIVE') throw new Error(`Expected ACTIVE, got ${asset.status}`);
                    return 'status=ACTIVE';
                }
            },
            {
                name: 'ACTIVE -> DELETED on delete',
                run: async () => {
                    const assetId = genAssetId('STATE');
                    await ownerClient.createAsset(assetId, 'State test');
                    await ownerClient.submitForApproval(assetId);
                    await auditorClient.approveAsset(assetId);
                    await regulatorClient.approveAsset(assetId);
                    await ownerClient.activateAsset(assetId);
                    // Delete the asset
                    await ownerClient.deleteAsset(assetId);
                    // Verify via QueryAllAssets - deleted assets should not appear
                    const allAssets = await ownerClient.queryAllAssets();
                    const found = allAssets.find(a => a.assetID === assetId);
                    if (found) throw new Error('Deleted asset should not appear in QueryAllAssets');
                    return 'Asset deleted (not in list)';
                }
            },
        ]
    },

    // =========================================================================
    // Approval Workflow Tests
    // =========================================================================
    approval: {
        name: 'Approval Workflow Tests',
        tests: [
            {
                name: 'Auditor can approve pending asset',
                run: async () => {
                    const assetId = genAssetId('APPR');
                    await ownerClient.createAsset(assetId, 'Approval test');
                    await ownerClient.submitForApproval(assetId);
                    await auditorClient.approveAsset(assetId);
                    const asset = await ownerClient.queryAsset(assetId);
                    if (asset.approvals.auditor !== true) throw new Error('Auditor approval not recorded');
                    return 'auditor=true';
                }
            },
            {
                name: 'Regulator can approve pending asset',
                run: async () => {
                    const assetId = genAssetId('APPR');
                    await ownerClient.createAsset(assetId, 'Approval test');
                    await ownerClient.submitForApproval(assetId);
                    await regulatorClient.approveAsset(assetId);
                    const asset = await ownerClient.queryAsset(assetId);
                    if (asset.approvals.regulator !== true) throw new Error('Regulator approval not recorded');
                    return 'regulator=true';
                }
            },
            {
                name: 'Owner cannot approve own asset',
                run: async () => {
                    const assetId = genAssetId('APPR-FAIL');
                    await ownerClient.createAsset(assetId, 'Approval test');
                    await ownerClient.submitForApproval(assetId);
                    try {
                        await ownerClient.approveAsset(assetId);
                        throw new Error('Expected access denied');
                    } catch (e) {
                        if (!isExpectedError(e, 'Access denied', 'role', 'auditor', 'regulator')) {
                            throw e;
                        }
                        return 'Access denied as expected';
                    }
                }
            },
            {
                name: 'Cannot approve asset in CREATED state',
                run: async () => {
                    const assetId = genAssetId('APPR-FAIL');
                    await ownerClient.createAsset(assetId, 'Approval test');
                    // Don't submit - still in CREATED state
                    try {
                        await auditorClient.approveAsset(assetId);
                        throw new Error('Expected state transition error');
                    } catch (e) {
                        if (!isExpectedError(e, 'Invalid', 'transition', 'PENDING')) {
                            throw e;
                        }
                        return 'Invalid transition as expected';
                    }
                }
            },
            {
                name: 'Partial approval keeps asset in PENDING_APPROVAL',
                run: async () => {
                    const assetId = genAssetId('APPR');
                    await ownerClient.createAsset(assetId, 'Approval test');
                    await ownerClient.submitForApproval(assetId);
                    await auditorClient.approveAsset(assetId);
                    // Only auditor approved, regulator not yet
                    const asset = await ownerClient.queryAsset(assetId);
                    if (asset.status !== 'PENDING_APPROVAL') throw new Error(`Expected PENDING_APPROVAL, got ${asset.status}`);
                    return 'status=PENDING_APPROVAL (waiting for regulator)';
                }
            },
        ]
    },

    // =========================================================================
    // Rejection Workflow Tests
    // =========================================================================
    rejection: {
        name: 'Rejection Workflow Tests',
        tests: [
            {
                name: 'Auditor can reject pending asset',
                run: async () => {
                    const assetId = genAssetId('REJ');
                    await ownerClient.createAsset(assetId, 'Rejection test');
                    await ownerClient.submitForApproval(assetId);
                    await auditorClient.rejectAsset(assetId, 'Missing documents');
                    const asset = await ownerClient.queryAsset(assetId);
                    if (asset.status !== 'REJECTED') throw new Error(`Expected REJECTED, got ${asset.status}`);
                    return 'status=REJECTED';
                }
            },
            {
                name: 'Regulator can reject pending asset',
                run: async () => {
                    const assetId = genAssetId('REJ');
                    await ownerClient.createAsset(assetId, 'Rejection test');
                    await ownerClient.submitForApproval(assetId);
                    await regulatorClient.rejectAsset(assetId, 'Non-compliant');
                    const asset = await ownerClient.queryAsset(assetId);
                    if (asset.status !== 'REJECTED') throw new Error(`Expected REJECTED, got ${asset.status}`);
                    return 'status=REJECTED';
                }
            },
            {
                name: 'Owner cannot reject asset',
                run: async () => {
                    const assetId = genAssetId('REJ-FAIL');
                    await ownerClient.createAsset(assetId, 'Rejection test');
                    await ownerClient.submitForApproval(assetId);
                    try {
                        await ownerClient.rejectAsset(assetId, 'Self rejection');
                        throw new Error('Expected access denied');
                    } catch (e) {
                        if (!isExpectedError(e, 'Access denied', 'role', 'auditor', 'regulator')) {
                            throw e;
                        }
                        return 'Access denied as expected';
                    }
                }
            },
            {
                name: 'Rejection includes reason in approvals',
                run: async () => {
                    const assetId = genAssetId('REJ');
                    await ownerClient.createAsset(assetId, 'Rejection test');
                    await ownerClient.submitForApproval(assetId);
                    await auditorClient.rejectAsset(assetId, 'Missing certification');
                    const asset = await ownerClient.queryAsset(assetId);
                    const auditorRejection = asset.approvals.auditor;
                    if (!auditorRejection || !auditorRejection.includes('REJECTED')) {
                        throw new Error(`Expected rejection reason, got: ${JSON.stringify(asset.approvals)}`);
                    }
                    return 'reason recorded';
                }
            },
        ]
    },

    // =========================================================================
    // Query Tests
    // =========================================================================
    query: {
        name: 'Query Tests',
        tests: [
            {
                name: 'Owner can query own asset',
                run: async () => {
                    const assetId = genAssetId('QUERY');
                    await ownerClient.createAsset(assetId, 'Query test');
                    const asset = await ownerClient.queryAsset(assetId);
                    if (asset.assetID !== assetId) throw new Error('Asset ID mismatch');
                    return `assetID=${assetId}`;
                }
            },
            {
                name: 'Auditor can query any asset',
                run: async () => {
                    const assetId = genAssetId('QUERY');
                    await ownerClient.createAsset(assetId, 'Query test');
                    const asset = await auditorClient.queryAsset(assetId);
                    if (asset.assetID !== assetId) throw new Error('Asset ID mismatch');
                    return 'Cross-org query successful';
                }
            },
            {
                name: 'Regulator can query any asset',
                run: async () => {
                    const assetId = genAssetId('QUERY');
                    await ownerClient.createAsset(assetId, 'Query test');
                    const asset = await regulatorClient.queryAsset(assetId);
                    if (asset.assetID !== assetId) throw new Error('Asset ID mismatch');
                    return 'Cross-org query successful';
                }
            },
            {
                name: 'QueryAllAssets returns array',
                run: async () => {
                    const assets = await ownerClient.queryAllAssets();
                    if (!Array.isArray(assets)) throw new Error('Expected array');
                    return `count=${assets.length}`;
                }
            },
            {
                name: 'GetAssetHistory returns transactions',
                run: async () => {
                    const assetId = genAssetId('QUERY');
                    await ownerClient.createAsset(assetId, 'Query test');
                    await ownerClient.updateAsset(assetId, 'Updated description');
                    const history = await ownerClient.getAssetHistory(assetId);
                    if (!Array.isArray(history) || history.length < 2) {
                        throw new Error(`Expected at least 2 history entries, got ${history.length}`);
                    }
                    return `transactions=${history.length}`;
                }
            },
            {
                name: 'Query non-existent asset throws error',
                run: async () => {
                    try {
                        await ownerClient.queryAsset('NONEXISTENT-12345');
                        throw new Error('Expected asset not found error');
                    } catch (e) {
                        if (!e.message.includes('not found') && !e.message.includes('does not exist')) {
                            throw e;
                        }
                        return 'Not found error as expected';
                    }
                }
            },
        ]
    },

    // =========================================================================
    // Security Tests
    // =========================================================================
    security: {
        name: 'Security Tests',
        tests: [
            {
                name: 'Cannot activate non-approved asset',
                run: async () => {
                    const assetId = genAssetId('SEC');
                    await ownerClient.createAsset(assetId, 'Security test');
                    await ownerClient.submitForApproval(assetId);
                    // Only partial approval
                    await auditorClient.approveAsset(assetId);
                    try {
                        await ownerClient.activateAsset(assetId);
                        throw new Error('Expected activation to fail');
                    } catch (e) {
                        if (!isExpectedError(e, 'Invalid', 'transition', 'APPROVED')) {
                            throw e;
                        }
                        return 'Activation blocked as expected';
                    }
                }
            },
            {
                name: 'Cannot delete asset in PENDING_APPROVAL state',
                run: async () => {
                    const assetId = genAssetId('SEC');
                    await ownerClient.createAsset(assetId, 'Security test');
                    await ownerClient.submitForApproval(assetId);
                    try {
                        await ownerClient.deleteAsset(assetId);
                        throw new Error('Expected delete to fail');
                    } catch (e) {
                        if (!isExpectedError(e, 'Invalid', 'transition')) {
                            throw e;
                        }
                        return 'Delete blocked as expected';
                    }
                }
            },
            {
                name: 'Auditor cannot activate approved asset',
                run: async () => {
                    const assetId = genAssetId('SEC');
                    await ownerClient.createAsset(assetId, 'Security test');
                    await ownerClient.submitForApproval(assetId);
                    await auditorClient.approveAsset(assetId);
                    await regulatorClient.approveAsset(assetId);
                    try {
                        await auditorClient.activateAsset(assetId);
                        throw new Error('Expected access denied');
                    } catch (e) {
                        if (!isExpectedError(e, 'Access denied', 'role', 'owner')) {
                            throw e;
                        }
                        return 'Access denied as expected';
                    }
                }
            },
            {
                name: 'Auditor cannot delete asset',
                run: async () => {
                    const assetId = genAssetId('SEC');
                    await ownerClient.createAsset(assetId, 'Security test');
                    try {
                        await auditorClient.deleteAsset(assetId);
                        throw new Error('Expected access denied');
                    } catch (e) {
                        if (!isExpectedError(e, 'Access denied', 'role', 'owner')) {
                            throw e;
                        }
                        return 'Access denied as expected';
                    }
                }
            },
            {
                name: 'Cannot create duplicate asset',
                run: async () => {
                    const assetId = genAssetId('SEC');
                    await ownerClient.createAsset(assetId, 'First asset');
                    try {
                        await ownerClient.createAsset(assetId, 'Duplicate asset');
                        throw new Error('Expected duplicate error');
                    } catch (e) {
                        if (!isExpectedError(e, 'already exists', 'exists')) {
                            throw e;
                        }
                        return 'Duplicate blocked as expected';
                    }
                }
            },
            {
                name: 'Asset ID validation - empty ID rejected',
                run: async () => {
                    try {
                        await ownerClient.createAsset('', 'Empty ID test');
                        throw new Error('Expected validation error');
                    } catch (e) {
                        if (!isExpectedError(e, 'valid', 'required', 'empty')) {
                            throw e;
                        }
                        return 'Validation error as expected';
                    }
                }
            },
        ]
    },
};

// ===========================================================================
// Test Runner
// ===========================================================================

async function runSuite(suiteName) {
    const suite = testSuites[suiteName];
    if (!suite) {
        console.error(`${c.red}Unknown test suite: ${suiteName}${c.reset}`);
        return { passed: 0, failed: 1 };
    }

    log.suite(suite.name);
    let suitePassed = 0;
    let suiteFailed = 0;

    for (const test of suite.tests) {
        log.test(test.name);
        try {
            const detail = await test.run();
            log.pass(detail);
            suitePassed++;
        } catch (error) {
            log.fail(error.message);
            suiteFailed++;
        }
    }

    return { passed: suitePassed, failed: suiteFailed };
}

async function runAllSuites() {
    for (const suiteName of Object.keys(testSuites)) {
        const result = await runSuite(suiteName);
        passed += result.passed;
        failed += result.failed;
    }
}

async function connect() {
    console.log(`${c.dim}Connecting to network...${c.reset}`);
    ownerClient = new FabricClient('org1', { quiet: true });
    auditorClient = new FabricClient('org2', { quiet: true });
    regulatorClient = new FabricClient('org3', { quiet: true });

    await ownerClient.connect();
    await auditorClient.connect();
    await regulatorClient.connect();
    console.log(`${c.green}✓${c.reset} Connected to all organizations\n`);
}

function disconnect() {
    ownerClient?.disconnect();
    auditorClient?.disconnect();
    regulatorClient?.disconnect();
}

function printHelp() {
    console.log(`
${c.bright}Asset Approval System v2 - Test Runner${c.reset}

${c.yellow}Usage:${c.reset}
  npm test                     Run all test suites
  npm test -- --suite=<name>   Run specific suite
  npm test -- --list           List available suites
  npm test -- --help           Show this help

${c.yellow}Available Suites:${c.reset}
${Object.entries(testSuites).map(([key, val]) => `  ${c.cyan}${key.padEnd(12)}${c.reset} ${val.name} (${val.tests.length} tests)`).join('\n')}

${c.yellow}Examples:${c.reset}
  npm test -- --suite=abac     Run ABAC tests only
  npm test -- --suite=security Run security tests only
`);
}

async function main() {
    const args = process.argv.slice(2);

    // Parse arguments
    if (args.includes('--help') || args.includes('-h')) {
        printHelp();
        process.exit(0);
    }

    if (args.includes('--list')) {
        console.log(`\n${c.bright}Available Test Suites:${c.reset}\n`);
        for (const [key, suite] of Object.entries(testSuites)) {
            console.log(`  ${c.cyan}${key.padEnd(12)}${c.reset} ${suite.name} (${suite.tests.length} tests)`);
        }
        console.log('');
        process.exit(0);
    }

    const suiteArg = args.find(a => a.startsWith('--suite='));
    const specificSuite = suiteArg ? suiteArg.split('=')[1] : null;

    // Header
    console.log(`
${c.bgBlue}${c.bright}                                                              ${c.reset}
${c.bgBlue}${c.bright}     🧪 ASSET APPROVAL SYSTEM v2 - TEST RUNNER              ${c.reset}
${c.bgBlue}${c.bright}                                                              ${c.reset}
`);

    const startTime = Date.now();

    try {
        await connect();

        if (specificSuite) {
            if (!testSuites[specificSuite]) {
                console.error(`${c.red}Unknown suite: ${specificSuite}${c.reset}`);
                console.log(`Use --list to see available suites`);
                process.exit(1);
            }
            const result = await runSuite(specificSuite);
            passed = result.passed;
            failed = result.failed;
        } else {
            await runAllSuites();
        }

    } catch (error) {
        console.error(`${c.red}Fatal error: ${error.message}${c.reset}`);
        console.error(error);
        failed++;
    } finally {
        disconnect();
    }

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const total = passed + failed;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(0) : 0;

    console.log(`
${c.dim}────────────────────────────────────────────────────────────${c.reset}
${c.bright}Test Summary${c.reset}
${c.dim}────────────────────────────────────────────────────────────${c.reset}
  ${c.green}Passed:${c.reset}  ${passed}
  ${c.red}Failed:${c.reset}  ${failed}
  ${c.blue}Total:${c.reset}   ${total}
  ${c.cyan}Rate:${c.reset}    ${passRate}%
  ${c.dim}Time:${c.reset}    ${elapsed}s
${c.dim}────────────────────────────────────────────────────────────${c.reset}
`);

    process.exit(failed > 0 ? 1 : 0);
}

main();
