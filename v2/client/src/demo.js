'use strict';

/**
 * Interactive Demo - Asset Approval System v2
 * Demonstrates True ABAC with role from certificate attributes
 */

const readline = require('readline');
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
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
};

const log = {
    header: (msg) => console.log(`\n${c.bgBlue}${c.bright} ${msg} ${c.reset}\n`),
    success: (msg) => console.log(`${c.green}✓${c.reset} ${msg}`),
    error: (msg) => console.log(`${c.red}✗${c.reset} ${msg}`),
    info: (msg) => console.log(`${c.cyan}ℹ${c.reset} ${msg}`),
    step: (num, msg) => {
        console.log('');
        console.log(`${c.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        console.log(`${c.yellow}  STEP ${num}: ${msg}${c.reset}`);
        console.log(`${c.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    },
    explain: (lines) => {
        console.log('');
        lines.forEach(line => console.log(`  ${c.dim}${line}${c.reset}`));
    },
    status: (status) => {
        const colors = {
            'CREATED': c.yellow,
            'PENDING_APPROVAL': c.blue,
            'APPROVED': c.green,
            'REJECTED': c.red,
            'ACTIVE': c.bgGreen + c.bright,
            'DELETED': c.dim,
        };
        return `${colors[status] || ''}${status}${c.reset}`;
    }
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const pause = async (msg = 'Press Enter to continue...') => {
    return new Promise(resolve => rl.question(`${c.yellow}${msg}${c.reset}`, resolve));
};

let ownerClient, auditorClient, regulatorClient;

async function connectAll() {
    log.step(1, 'Connecting to Organizations');
    log.explain([
        'v2 uses True ABAC - role comes from X.509 certificate attribute',
        'No hardcoded org names in chaincode!',
        'Adding Org4 = just issue cert with role=auditor, no code change',
    ]);

    ownerClient = new FabricClient('org1', { quiet: true });
    auditorClient = new FabricClient('org2', { quiet: true });
    regulatorClient = new FabricClient('org3', { quiet: true });

    await ownerClient.connect();
    console.log(`  ${c.blue}Org1MSP${c.reset} → role=owner (from cert attribute)`);

    await auditorClient.connect();
    console.log(`  ${c.yellow}Org2MSP${c.reset} → role=auditor (from cert attribute)`);

    await regulatorClient.connect();
    console.log(`  ${c.magenta}Org3MSP${c.reset} → role=regulator (from cert attribute)`);

    log.success('All organizations connected');
}

function disconnectAll() {
    ownerClient?.disconnect();
    auditorClient?.disconnect();
    regulatorClient?.disconnect();
    log.info('All connections closed');
}

async function runDemo() {
    console.clear();
    console.log(`
${c.bgBlue}${c.bright}                                                              ${c.reset}
${c.bgBlue}${c.bright}     🔗 ASSET APPROVAL SYSTEM v2 - TRUE ABAC 🔗              ${c.reset}
${c.bgBlue}${c.bright}                                                              ${c.reset}
    `);

    console.log(`${c.dim}────────────────────────────────────────────────────────────${c.reset}`);
    console.log(`
${c.bright}v2 Design Principles:${c.reset}
  ${c.green}•${c.reset} TRUE ABAC - role from X.509 cert attribute
  ${c.green}•${c.reset} Org-agnostic chaincode (no hardcoded org names)
  ${c.green}•${c.reset} Config-only org addition
  ${c.green}•${c.reset} Externalized endorsement policies

${c.bright}Access Control:${c.reset}
  Chaincode reads: ${c.cyan}ctx.clientIdentity.getAttributeValue('role')${c.reset}
  NOT: getMSPID() → hardcoded map (v1 pattern)
`);
    console.log(`${c.dim}────────────────────────────────────────────────────────────${c.reset}\n`);

    await pause('Press Enter to start the demo...');

    try {
        await connectAll();
        await pause();

        // Verify caller info
        log.step(2, 'Verify ABAC - Get Caller Info');
        log.explain([
            'Each client calls GetCallerInfo() to verify role is from cert attribute',
            'This proves ch aincode reads role dynamically, not from hardcoded map',
        ]);

        const ownerInfo = await ownerClient.getCallerInfo();
        console.log(`  ${c.blue}Owner:${c.reset} role=${c.green}${ownerInfo.role}${c.reset}, msp=${ownerInfo.mspId}`);

        const auditorInfo = await auditorClient.getCallerInfo();
        console.log(`  ${c.yellow}Auditor:${c.reset} role=${c.green}${auditorInfo.role}${c.reset}, msp=${auditorInfo.mspId}`);

        const regulatorInfo = await regulatorClient.getCallerInfo();
        console.log(`  ${c.magenta}Regulator:${c.reset} role=${c.green}${regulatorInfo.role}${c.reset}, msp=${regulatorInfo.mspId}`);

        await pause();

        // Create asset
        log.step(3, 'Create Asset (role=owner required)');
        log.explain([
            'Chaincode checks: requireRole(ctx, ["owner"])',
            'Role comes from cert attribute, not org name!',
        ]);

        const assetId = `ASSET-${Date.now()}`;
        log.info(`Creating asset: ${c.bright}${assetId}${c.reset}`);
        await ownerClient.createAsset(assetId, 'v2 Demo Asset - True ABAC');
        log.success('Asset created!');

        let asset = await ownerClient.queryAsset(assetId);
        console.log(`  Status: ${log.status(asset.status)}`);
        console.log(`  Approvals: ${JSON.stringify(asset.approvals)}`);
        await pause();

        // Submit for approval
        log.step(4, 'Submit for Approval (role=owner required)');
        await ownerClient.submitForApproval(assetId);
        asset = await ownerClient.queryAsset(assetId);
        log.success(`Status: ${log.status(asset.status)}`);
        await pause();

        // Auditor approves
        log.step(5, 'Auditor Approves (role=auditor required)');
        log.explain([
            'Any user with role=auditor in cert can approve',
            'Could be Org2 today, Org4 tomorrow - no code change!',
        ]);
        await auditorClient.approveAsset(assetId);
        asset = await auditorClient.queryAsset(assetId);
        log.success('Auditor approved!');
        console.log(`  Approvals: ${JSON.stringify(asset.approvals)}`);
        await pause();

        // Regulator approves
        log.step(6, 'Regulator Approves (role=regulator required)');
        await regulatorClient.approveAsset(assetId);
        asset = await regulatorClient.queryAsset(assetId);
        log.success(`Status: ${log.status(asset.status)}`);
        await pause();

        // Activate
        log.step(7, 'Activate Asset (role=owner required)');
        await ownerClient.activateAsset(assetId);
        asset = await ownerClient.queryAsset(assetId);
        log.success(`Status: ${log.status(asset.status)}`);
        await pause();

        // History
        log.step(8, 'View Complete Audit Trail');
        const history = await ownerClient.getAssetHistory(assetId);
        console.log(`\n  ${c.bgBlue}${c.bright} VERIFIED HISTORY (${history.length} transactions) ${c.reset}\n`);

        history.reverse().forEach((record, i) => {
            console.log(`  ${c.dim}${i === history.length - 1 ? '└' : '├'}${c.reset} ${c.cyan}${record.txId.substring(0, 20)}...${c.reset} → ${log.status(record.value?.status || 'N/A')}`);
        });
        await pause();

        // Delete
        log.step(9, 'Delete Asset');
        await ownerClient.deleteAsset(assetId);
        log.success('Asset soft-deleted');

        // Complete
        console.log(`
${c.bgGreen}${c.bright}                                                              ${c.reset}
${c.bgGreen}${c.bright}     ✅ v2 DEMO COMPLETED SUCCESSFULLY!                       ${c.reset}
${c.bgGreen}${c.bright}                                                              ${c.reset}
        `);

        console.log(`${c.bright}Key Takeaways:${c.reset}`);
        console.log(`  ${c.green}1.${c.reset} Role read from X.509 cert attribute (True ABAC)`);
        console.log(`  ${c.green}2.${c.reset} No org names hardcoded in chaincode`);
        console.log(`  ${c.green}3.${c.reset} Adding Org4 = issue cert + update policies (no code change)`);
        console.log(`  ${c.green}4.${c.reset} Extensible approvals { [role]: status }\n`);

    } catch (error) {
        log.error(`Demo failed: ${error.message}`);
        console.error(error);
        disconnectAll();
        rl.close();
        process.exit(1);
    }

    disconnectAll();
    rl.close();
    process.exit(0);
}

runDemo();
