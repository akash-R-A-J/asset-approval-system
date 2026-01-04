'use strict';

/**
 * Interactive Demo - Asset Approval System
 * Colorful, interactive demonstration of the complete workflow
 */

const readline = require('readline');
const { AssetService } = require('./assetService');

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
    white: '\x1b[37m',
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
};

// Helper functions
const log = {
    header: (msg) => console.log(`\n${c.bgBlue}${c.white}${c.bright} ${msg} ${c.reset}\n`),
    success: (msg) => console.log(`${c.green}✓${c.reset} ${msg}`),
    error: (msg) => console.log(`${c.red}✗${c.reset} ${msg}`),
    info: (msg) => console.log(`${c.cyan}ℹ${c.reset} ${msg}`),
    warn: (msg) => console.log(`${c.yellow}⚠${c.reset} ${msg}`),
    command: (cmd) => console.log(`\n  ${c.dim}Command:${c.reset} ${c.green}${cmd}${c.reset}\n`),
    separator: () => console.log(`${c.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`),
    step: (num, msg) => {
        console.log('');
        console.log(`${c.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        console.log(`${c.yellow}  STEP ${num}: ${msg}${c.reset}`);
        console.log(`${c.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    },
    org: (name, role) => console.log(`  ${c.blue}${name}${c.reset} (${c.dim}${role}${c.reset})`),
    asset: (data) => console.log(`  ${c.cyan}${JSON.stringify(data, null, 2).replace(/\n/g, '\n  ')}${c.reset}`),
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
            'ACTIVE': c.bgGreen + c.white,
            'DELETED': c.dim,
        };
        return `${colors[status] || c.white}${status}${c.reset}`;
    }
};

// Create readline interface for interactive mode
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (prompt) => new Promise((resolve) => {
    rl.question(`${c.yellow}${prompt}${c.reset}`, resolve);
});

const pause = async (msg = 'Press Enter to continue...') => {
    await question(msg);
};

// Services
let org1Service, org2Service, org3Service;

async function connectAll() {
    log.step(1, 'Connecting to Organizations');

    org1Service = new AssetService('org1', { quiet: true });
    org2Service = new AssetService('org2', { quiet: true });
    org3Service = new AssetService('org3', { quiet: true });

    await org1Service.connect();
    log.org('Org1MSP', 'Asset Owner');

    await org2Service.connect();
    log.org('Org2MSP', 'Auditor');

    await org3Service.connect();
    log.org('Org3MSP', 'Regulator');

    log.success('All organizations connected');
}

function disconnectAll() {
    org1Service?.disconnect();
    org2Service?.disconnect();
    org3Service?.disconnect();
    log.info('All connections closed');
}

async function interactiveDemo() {
    console.clear();
    console.log(`
${c.bgBlue}${c.white}${c.bright}                                                              ${c.reset}
${c.bgBlue}${c.white}${c.bright}     🔗 HYPERLEDGER FABRIC - ASSET APPROVAL SYSTEM 🔗         ${c.reset}
${c.bgBlue}${c.white}${c.bright}              Interactive Demo v1.0                           ${c.reset}
${c.bgBlue}${c.white}${c.bright}                                                              ${c.reset}
    `);

    console.log(`${c.dim}────────────────────────────────────────────────────────────${c.reset}`);
    console.log(`
${c.bright}Architecture:${c.reset}
  ${c.green}•${c.reset} 3 Organizations with distinct roles
  ${c.green}•${c.reset} 9 Peers (3 per org: endorser, query, committer)
  ${c.green}•${c.reset} 3 Orderers (Raft consensus cluster)
  ${c.green}•${c.reset} Private Data Collection (Org1 + Org2)
  ${c.green}•${c.reset} Role-Based Access Control (RBAC/ABAC)

${c.bright}Organizations:${c.reset}
  ${c.blue}Org1MSP${c.reset} - Asset Owner    ${c.dim}(Create, Update, Delete, Query)${c.reset}
  ${c.yellow}Org2MSP${c.reset} - Auditor        ${c.dim}(Approve/Reject, Query, Private Data)${c.reset}
  ${c.magenta}Org3MSP${c.reset} - Regulator      ${c.dim}(Approve/Reject, Query Public Only)${c.reset}

${c.bright}Endorsement Policy:${c.reset} ${c.cyan}AND(Org1, OR(Org2, Org3))${c.reset}
`);
    console.log(`${c.dim}────────────────────────────────────────────────────────────${c.reset}\n`);

    await pause('Press Enter to start the demo...');

    try {
        await connectAll();
        await pause();

        // Step 2: Create Asset
        log.step(2, 'Creating Asset (Org1 - Asset Owner)');
        log.explain([
            'This operation:',
            '• Submits transaction to chaincode as Org1 (Asset Owner)',
            '• Chaincode enforces Organization-Based Access Control (OBAC)',
            '• Only Org1MSP can create assets',
            '• Asset created with status: CREATED',
        ]);
        const assetId = `ASSET-${Date.now()}`;
        log.command(`createAsset("${assetId}", "Industrial Equipment...")`);
        log.info(`Asset ID: ${c.bright}${assetId}${c.reset}`);
        await org1Service.createAsset(assetId, 'Industrial Equipment - High Value Manufacturing Asset');
        log.success('Asset created successfully!');

        let asset = await org1Service.queryAsset(assetId);
        console.log(`\n  ${c.bright}Asset Details:${c.reset}`);
        console.log(`  ${c.dim}├─${c.reset} ID: ${c.cyan}${asset.assetID}${c.reset}`);
        console.log(`  ${c.dim}├─${c.reset} Owner: ${c.blue}${asset.owner}${c.reset}`);
        console.log(`  ${c.dim}├─${c.reset} Status: ${log.status(asset.status)}`);
        console.log(`  ${c.dim}└─${c.reset} Description: ${asset.description}`);
        await pause();

        // Step 3: Submit for Approval
        log.step(3, 'Submitting for Approval (Org1)');
        log.explain([
            'This operation:',
            '• Transitions asset from CREATED → PENDING_APPROVAL',
            '• State machine validates the transition is allowed',
            '• Only the asset owner can submit for approval',
            '• Asset now awaits approval from Org2 and Org3',
        ]);
        log.command(`submitForApproval("${assetId}")`);
        await org1Service.submitForApproval(assetId);
        asset = await org1Service.queryAsset(assetId);
        log.success(`Status changed to: ${log.status(asset.status)}`);
        console.log(`  ${c.dim}Pending approvals from: Org2MSP (Auditor), Org3MSP (Regulator)${c.reset}`);
        await pause();

        // Step 4: Org2 Approval
        log.step(4, 'Auditor Approval (Org2)');
        log.explain([
            'This operation:',
            '• Org2 (Auditor) reviews and approves the asset',
            '• Chaincode verifies caller is Org2MSP or Org3MSP',
            '• Approval recorded with timestamp',
            '• Asset still PENDING_APPROVAL (needs both approvals)',
        ]);
        log.command(`org2.approveAsset("${assetId}")`);
        log.info('Org2 (Auditor) reviewing asset...');
        await org2Service.approveAsset(assetId);
        asset = await org2Service.queryAsset(assetId);
        log.success('Org2 approved!');
        console.log(`  ${c.dim}├─${c.reset} Org2MSP: ${c.green}✓ APPROVED${c.reset}`);
        console.log(`  ${c.dim}└─${c.reset} Org3MSP: ${c.yellow}⏳ PENDING${c.reset}`);
        console.log(`  Status: ${log.status(asset.status)} ${c.dim}(waiting for Org3)${c.reset}`);
        await pause();

        // Step 5: Org3 Approval
        log.step(5, 'Regulator Approval (Org3)');
        log.explain([
            'This operation:',
            '• Org3 (Regulator) gives final approval',
            '• With both approvals, status changes to APPROVED',
            '• State machine enforces: once APPROVED, cannot be modified',
            '• Asset is now ready for activation',
        ]);
        log.command(`org3.approveAsset("${assetId}")`);
        log.info('Org3 (Regulator) reviewing asset...');
        await org3Service.approveAsset(assetId);
        asset = await org3Service.queryAsset(assetId);
        log.success('Org3 approved!');
        console.log(`  ${c.dim}├─${c.reset} Org2MSP: ${c.green}✓ APPROVED${c.reset}`);
        console.log(`  ${c.dim}└─${c.reset} Org3MSP: ${c.green}✓ APPROVED${c.reset}`);
        console.log(`  Status: ${log.status(asset.status)} ${c.green}(all approvals complete!)${c.reset}`);
        await pause();

        // Step 6: Activate Asset
        log.step(6, 'Activating Asset (Org1)');
        log.explain([
            'This operation:',
            '• Transitions asset from APPROVED → ACTIVE',
            '• Only the asset owner (Org1) can activate',
            '• Asset is now fully operational',
        ]);
        log.command(`org1.activateAsset("${assetId}")`);
        await org1Service.activateAsset(assetId);
        asset = await org1Service.queryAsset(assetId);
        log.success(`Asset is now ${log.status('ACTIVE')}!`);
        await pause();

        // Step 7: View History
        log.step(7, 'Viewing Asset History (Blockchain Provenance)');
        log.explain([
            'Fabric maintains full history of all changes:',
            '• Each transaction is in a separate block',
            '• Immutable audit trail',
            '• TxId for each state change',
            '• All organizations can query history',
        ]);
        log.command(`getAssetHistory("${assetId}")`);
        const history = await org1Service.getAssetHistory(assetId);
        console.log(`\n  ${c.bright}Transaction History (${history.length} entries):${c.reset}`);
        history.reverse().forEach((h, i) => {
            const status = h.value?.status || 'N/A';
            const arrow = i === history.length - 1 ? '└─' : '├─';
            console.log(`  ${c.dim}${arrow}${c.reset} ${c.cyan}${h.txId.substring(0, 8)}...${c.reset} → ${log.status(status)}`);
        });
        await pause();

        // Step 8: Test Access Control
        log.step(8, 'Testing Access Control (OBAC/ABAC)');
        log.explain([
            'Demonstrating access control enforcement:',
            '• Org2 (Auditor) attempts to create an asset',
            '• Chaincode enforces OBAC - only Org1 can create',
            '• Transaction is rejected at endorsement',
        ]);
        log.info('Attempting unauthorized operation: Org2 tries to create asset...');
        try {
            await org2Service.createAsset('UNAUTHORIZED', 'Should fail');
            log.error('This should not have succeeded!');
        } catch (err) {
            log.success(`Access denied (as expected)`);
            console.log(`  ${c.dim}Error: ${err.message.substring(0, 60)}...${c.reset}`);
        }
        await pause();

        // Step 9: Delete Asset
        log.step(9, 'Deleting Asset (Org1)');
        log.explain([
            'This operation:',
            '• Soft-deletes the asset (status → DELETED)',
            '• Asset remains on blockchain for audit purposes',
            '• Cannot be modified after deletion',
        ]);
        log.command(`org1.deleteAsset("${assetId}")`);
        await org1Service.deleteAsset(assetId);
        asset = await org1Service.queryAsset(assetId);
        log.success(`Asset status: ${log.status(asset.status)}`);
        await pause();

        // Step 10: Complete Audit Trail
        log.step(10, 'Complete Blockchain Audit Trail');
        log.explain([
            '🔒 IMMUTABLE PROOF OF WORK',
            '• Every state change is recorded with transaction ID',
            '• Timestamps are from the blockchain (not client)',
            '• Full provenance from creation to deletion',
            '• Cannot be altered or deleted',
        ]);

        const fullHistory = await org1Service.getAssetHistory(assetId);

        console.log(`\n  ${c.bgBlue}${c.white}${c.bright} VERIFIED ASSET HISTORY (${fullHistory.length} transactions) ${c.reset}\n`);

        // Display history in reverse chronological order (newest first)
        fullHistory.reverse().forEach((record, index) => {
            const isLast = index === fullHistory.length - 1;
            const prefix = isLast ? '└' : '├';
            const line = isLast ? ' ' : '│';

            console.log(`  ${c.dim}${prefix}──────────────────────────────────────────────────────────────${c.reset}`);
            console.log(`  ${c.dim}${line}${c.reset}  ${c.bright}Transaction ${fullHistory.length - index}${c.reset}`);
            console.log(`  ${c.dim}${line}${c.reset}  ${c.cyan}┌─────────────────────────────────────────────────────────┐${c.reset}`);
            console.log(`  ${c.dim}${line}${c.reset}  ${c.cyan}│${c.reset} ${c.dim}TxID:${c.reset}      ${c.yellow}${record.txId.substring(0, 48)}...${c.reset}`);

            // Format timestamp nicely
            let timestamp = 'N/A';
            if (record.timestamp) {
                const ts = record.timestamp;
                if (ts.seconds) {
                    const seconds = typeof ts.seconds === 'object' ? ts.seconds.low : ts.seconds;
                    timestamp = new Date(seconds * 1000).toISOString();
                }
            }
            console.log(`  ${c.dim}${line}${c.reset}  ${c.cyan}│${c.reset} ${c.dim}Timestamp:${c.reset} ${c.white}${timestamp}${c.reset}`);

            if (record.value) {
                console.log(`  ${c.dim}${line}${c.reset}  ${c.cyan}│${c.reset} ${c.dim}Status:${c.reset}    ${log.status(record.value.status)}`);
                console.log(`  ${c.dim}${line}${c.reset}  ${c.cyan}│${c.reset} ${c.dim}Owner:${c.reset}     ${c.blue}${record.value.owner}${c.reset}`);

                // Show approvals if they exist
                if (record.value.approvals && Object.keys(record.value.approvals).length > 0) {
                    console.log(`  ${c.dim}${line}${c.reset}  ${c.cyan}│${c.reset} ${c.dim}Approvals:${c.reset}`);
                    Object.entries(record.value.approvals).forEach(([org, status]) => {
                        const icon = status === 'APPROVED' ? `${c.green}✓${c.reset}` :
                            status === 'PENDING' ? `${c.yellow}⏳${c.reset}` :
                                `${c.red}✗${c.reset}`;
                        console.log(`  ${c.dim}${line}${c.reset}  ${c.cyan}│${c.reset}   ${icon} ${org}: ${status}`);
                    });
                }
            }
            console.log(`  ${c.dim}${line}${c.reset}  ${c.cyan}└─────────────────────────────────────────────────────────┘${c.reset}`);
        });

        console.log(`\n  ${c.green}${c.bright}✓ All ${fullHistory.length} transactions verified on blockchain${c.reset}`);
        console.log(`  ${c.dim}This history is immutable and can be audited at any time.${c.reset}\n`);

        await pause();

        // Complete
        console.log(`
${c.bgGreen}${c.white}${c.bright}                                                              ${c.reset}
${c.bgGreen}${c.white}${c.bright}     ✅ DEMO COMPLETED SUCCESSFULLY!                          ${c.reset}
${c.bgGreen}${c.white}${c.bright}                                                              ${c.reset}
        `);

        console.log(`${c.bright}Workflow Summary:${c.reset}`);
        console.log(`  ${c.green}1.${c.reset} Connected to all 3 organizations`);
        console.log(`  ${c.green}2.${c.reset} Org1 (Asset Owner) created asset`);
        console.log(`  ${c.green}3.${c.reset} Org1 submitted for approval`);
        console.log(`  ${c.green}4.${c.reset} Org2 (Auditor) approved`);
        console.log(`  ${c.green}5.${c.reset} Org3 (Regulator) approved`);
        console.log(`  ${c.green}6.${c.reset} Org1 activated asset`);
        console.log(`  ${c.green}7.${c.reset} Viewed transaction history`);
        console.log(`  ${c.green}8.${c.reset} Tested access control (OBAC)`);
        console.log(`  ${c.green}9.${c.reset} Org1 deleted asset`);
        console.log(`  ${c.green}10.${c.reset} ${c.bright}Displayed complete audit trail ✓${c.reset}\n`);

        console.log(`${c.dim}All state changes are immutably recorded on the Hyperledger Fabric blockchain.${c.reset}\n`);


    } catch (error) {
        log.error(`Demo failed: ${error.message}`);
        console.error(error);
    } finally {
        disconnectAll();
        rl.close();
    }
}

// Run
interactiveDemo();
