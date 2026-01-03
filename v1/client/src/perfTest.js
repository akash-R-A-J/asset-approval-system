'use strict';

/**
 * Performance & Scalability Test Suite for Asset Approval System
 * Tests throughput, latency, and concurrent operations
 */

const { AssetService } = require('./assetService');

// ANSI Colors
const c = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    magenta: '\x1b[35m',
};

// Config
const CONFIG = {
    BATCH_SIZES: [5, 10, 20],
    CONCURRENT_CLIENTS: 3,
    WARMUP_COUNT: 2,
};

// Stats
const stats = {
    operations: [],
    summaries: []
};

// Helper
function generateAssetId() {
    return `PERF-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function percentile(arr, p) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * p / 100) - 1;
    return sorted[Math.max(0, idx)];
}

function formatMs(ms) {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

function progressBar(current, total, width = 30) {
    const pct = current / total;
    const filled = Math.round(width * pct);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${(pct * 100).toFixed(0)}%`;
}

async function measureOperation(name, fn) {
    const start = Date.now();
    try {
        await fn();
        const duration = Date.now() - start;
        stats.operations.push({ name, duration, success: true });
        return { success: true, duration };
    } catch (error) {
        const duration = Date.now() - start;
        stats.operations.push({ name, duration, success: false, error: error.message });
        return { success: false, duration, error: error.message };
    }
}

async function main() {
    console.clear();
    console.log(`
${c.blue}╔══════════════════════════════════════════════════════════════╗${c.reset}
${c.blue}║${c.reset}  ${c.bright}⚡ Performance & Scalability Test Suite${c.reset}                   ${c.blue}║${c.reset}
${c.blue}╚══════════════════════════════════════════════════════════════╝${c.reset}
    `);

    const totalStartTime = Date.now();

    // Setup connections
    console.log(`${c.cyan}Setting up connections...${c.reset}`);
    const org1 = new AssetService('org1');
    const org2 = new AssetService('org2');
    const org3 = new AssetService('org3');

    await org1.connect();
    await org2.connect();
    await org3.connect();
    console.log(`${c.green}✓${c.reset} All organizations connected\n`);

    try {
        // ============================================================
        // WARMUP
        // ============================================================
        console.log(`${c.yellow}Warming up...${c.reset}`);
        for (let i = 0; i < CONFIG.WARMUP_COUNT; i++) {
            const assetId = `WARMUP-${i}`;
            try {
                await org1.createAsset(assetId, 'Warmup asset');
                await org1.deleteAsset(assetId);
            } catch (e) {
                // Ignore warmup errors
            }
        }
        console.log(`${c.green}✓${c.reset} Warmup complete\n`);

        // ============================================================
        // TEST 1: Single Operation Latency
        // ============================================================
        console.log(`\n${c.blue}━━━ ${c.bright}Test 1: Single Operation Latency${c.reset}${c.blue} ━━━${c.reset}\n`);

        const singleOps = {
            create: [],
            query: [],
            submit: [],
            approve: [],
            activate: [],
            delete: [],
        };

        const sampleSize = 5;
        console.log(`  Running ${sampleSize} samples per operation...\n`);

        for (let i = 0; i < sampleSize; i++) {
            process.stdout.write(`\r  ${progressBar(i + 1, sampleSize)}`);

            const assetId = generateAssetId();

            // Create
            let start = Date.now();
            await org1.createAsset(assetId, 'Latency test');
            singleOps.create.push(Date.now() - start);

            // Query
            start = Date.now();
            await org1.queryAsset(assetId);
            singleOps.query.push(Date.now() - start);

            // Submit
            start = Date.now();
            await org1.submitForApproval(assetId);
            singleOps.submit.push(Date.now() - start);

            // Approve (Org2)
            start = Date.now();
            await org2.approveAsset(assetId);
            singleOps.approve.push(Date.now() - start);

            // Approve (Org3)
            await org3.approveAsset(assetId);

            // Activate
            start = Date.now();
            await org1.activateAsset(assetId);
            singleOps.activate.push(Date.now() - start);

            // Delete
            start = Date.now();
            await org1.deleteAsset(assetId);
            singleOps.delete.push(Date.now() - start);
        }

        console.log('\n');
        console.log(`  ${c.bright}Operation Latency (ms):${c.reset}`);
        console.log(`  ${'─'.repeat(55)}`);
        console.log(`  ${c.dim}Operation${c.reset}       ${c.dim}Min${c.reset}      ${c.dim}Avg${c.reset}      ${c.dim}Max${c.reset}      ${c.dim}P95${c.reset}`);
        console.log(`  ${'─'.repeat(55)}`);

        for (const [op, times] of Object.entries(singleOps)) {
            const min = Math.min(...times);
            const max = Math.max(...times);
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            const p95 = percentile(times, 95);
            console.log(`  ${op.padEnd(13)} ${min.toString().padStart(6)}   ${avg.toFixed(0).padStart(6)}   ${max.toString().padStart(6)}   ${p95.toString().padStart(6)}`);
        }
        console.log(`  ${'─'.repeat(55)}`);

        // ============================================================
        // TEST 2: Batch Processing Throughput
        // ============================================================
        console.log(`\n${c.blue}━━━ ${c.bright}Test 2: Batch Processing Throughput${c.reset}${c.blue} ━━━${c.reset}\n`);

        for (const batchSize of CONFIG.BATCH_SIZES) {
            console.log(`  ${c.cyan}Batch size: ${batchSize}${c.reset}`);

            const assetIds = [];
            const batchStart = Date.now();

            // Create batch
            const createStart = Date.now();
            for (let i = 0; i < batchSize; i++) {
                const assetId = generateAssetId();
                assetIds.push(assetId);
                await org1.createAsset(assetId, `Batch asset ${i}`);
                process.stdout.write(`\r    Creating: ${progressBar(i + 1, batchSize)}`);
            }
            const createTime = Date.now() - createStart;
            console.log(`\n    ${c.green}✓${c.reset} Created ${batchSize} assets in ${formatMs(createTime)}`);

            // Submit all for approval
            const submitStart = Date.now();
            for (let i = 0; i < assetIds.length; i++) {
                await org1.submitForApproval(assetIds[i]);
                process.stdout.write(`\r    Submitting: ${progressBar(i + 1, batchSize)}`);
            }
            const submitTime = Date.now() - submitStart;
            console.log(`\n    ${c.green}✓${c.reset} Submitted ${batchSize} assets in ${formatMs(submitTime)}`);

            // Approve all (Org2)
            const approveStart = Date.now();
            for (let i = 0; i < assetIds.length; i++) {
                await org2.approveAsset(assetIds[i]);
                await org3.approveAsset(assetIds[i]);
                process.stdout.write(`\r    Approving: ${progressBar(i + 1, batchSize)}`);
            }
            const approveTime = Date.now() - approveStart;
            console.log(`\n    ${c.green}✓${c.reset} Approved ${batchSize} assets in ${formatMs(approveTime)}`);

            const batchTime = Date.now() - batchStart;
            const tps = (batchSize / (batchTime / 1000)).toFixed(2);

            console.log(`    ${c.bright}Throughput: ${c.magenta}${tps} workflows/sec${c.reset}\n`);

            stats.summaries.push({
                test: 'Batch Processing',
                batchSize,
                totalTime: batchTime,
                tps: parseFloat(tps)
            });

            // Cleanup
            for (const assetId of assetIds) {
                try {
                    await org1.activateAsset(assetId);
                    await org1.deleteAsset(assetId);
                } catch (e) { }
            }
        }

        // ============================================================
        // TEST 3: Concurrent Multi-Org Operations
        // ============================================================
        console.log(`\n${c.blue}━━━ ${c.bright}Test 3: Concurrent Multi-Org Operations${c.reset}${c.blue} ━━━${c.reset}\n`);

        const concurrentAssets = [];
        const concurrentCount = 10;

        console.log(`  Creating ${concurrentCount} assets for concurrent approval...\n`);

        for (let i = 0; i < concurrentCount; i++) {
            const assetId = generateAssetId();
            concurrentAssets.push(assetId);
            await org1.createAsset(assetId, `Concurrent test ${i}`);
            await org1.submitForApproval(assetId);
        }

        // Simulate concurrent approvals from Org2 and Org3
        console.log(`  ${c.cyan}Simulating concurrent approvals from Org2 and Org3...${c.reset}`);
        const concurrentStart = Date.now();

        const approvalPromises = concurrentAssets.map(async (assetId) => {
            await org2.approveAsset(assetId);
            await org3.approveAsset(assetId);
        });

        await Promise.all(approvalPromises);
        const concurrentTime = Date.now() - concurrentStart;

        console.log(`  ${c.green}✓${c.reset} ${concurrentCount} assets approved concurrently in ${formatMs(concurrentTime)}`);
        console.log(`  ${c.bright}Effective rate: ${c.magenta}${(concurrentCount / (concurrentTime / 1000)).toFixed(2)} approvals/sec${c.reset}`);

        // Cleanup
        for (const assetId of concurrentAssets) {
            try {
                await org1.activateAsset(assetId);
                await org1.deleteAsset(assetId);
            } catch (e) { }
        }

        // ============================================================
        // TEST 4: Query Performance
        // ============================================================
        console.log(`\n${c.blue}━━━ ${c.bright}Test 4: Query Performance${c.reset}${c.blue} ━━━${c.reset}\n`);

        // Create some assets for querying
        const queryTestAssets = [];
        console.log(`  Creating 20 assets for query tests...`);
        for (let i = 0; i < 20; i++) {
            const assetId = generateAssetId();
            queryTestAssets.push(assetId);
            await org1.createAsset(assetId, `Query test ${i}`);
        }

        // Test different query types
        const queryTests = [
            { name: 'Query Single Asset', fn: () => org1.queryAsset(queryTestAssets[0]) },
            { name: 'Query All Assets', fn: () => org1.queryAllAssets() },
            { name: 'Query by Status', fn: () => org1.queryAssetsByStatus('CREATED') },
            { name: 'Query by Owner', fn: () => org1.queryAssetsByOwner('Org1MSP') },
            { name: 'Get Asset History', fn: () => org1.getAssetHistory(queryTestAssets[0]) },
        ];

        console.log(`\n  ${c.dim}Query Type${c.reset}                ${c.dim}Latency${c.reset}`);
        console.log(`  ${'─'.repeat(45)}`);

        for (const test of queryTests) {
            const times = [];
            for (let i = 0; i < 5; i++) {
                const start = Date.now();
                await test.fn();
                times.push(Date.now() - start);
            }
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            console.log(`  ${test.name.padEnd(25)} ${formatMs(avg).padStart(10)}`);
        }
        console.log(`  ${'─'.repeat(45)}`);

        // Cleanup query test assets
        for (const assetId of queryTestAssets) {
            try { await org1.deleteAsset(assetId); } catch (e) { }
        }

        // ============================================================
        // TEST 5: Sustained Load
        // ============================================================
        console.log(`\n${c.blue}━━━ ${c.bright}Test 5: Sustained Load (30 seconds)${c.reset}${c.blue} ━━━${c.reset}\n`);

        const sustainedDuration = 30000; // 30 seconds
        const sustainedStart = Date.now();
        let sustainedOps = 0;
        let sustainedErrors = 0;

        console.log(`  Running sustained load test...\n`);

        while (Date.now() - sustainedStart < sustainedDuration) {
            const assetId = generateAssetId();
            const elapsed = Date.now() - sustainedStart;
            process.stdout.write(`\r  ${progressBar(elapsed, sustainedDuration)} - ${sustainedOps} ops, ${sustainedErrors} errors`);

            try {
                await org1.createAsset(assetId, 'Sustained load test');
                sustainedOps++;

                await org1.queryAsset(assetId);
                sustainedOps++;

                await org1.deleteAsset(assetId);
                sustainedOps++;
            } catch (e) {
                sustainedErrors++;
            }
        }

        const actualDuration = (Date.now() - sustainedStart) / 1000;
        const opsPerSec = (sustainedOps / actualDuration).toFixed(2);

        console.log(`\n\n  ${c.bright}Sustained Load Results:${c.reset}`);
        console.log(`  ${c.dim}├─${c.reset} Duration: ${actualDuration.toFixed(1)}s`);
        console.log(`  ${c.dim}├─${c.reset} Total Operations: ${sustainedOps}`);
        console.log(`  ${c.dim}├─${c.reset} Errors: ${sustainedErrors}`);
        console.log(`  ${c.dim}└─${c.reset} Rate: ${c.magenta}${c.bright}${opsPerSec} ops/sec${c.reset}`);

    } catch (error) {
        console.error(`\n${c.red}Error: ${error.message}${c.reset}`);
    } finally {
        org1?.disconnect();
        org2?.disconnect();
        org3?.disconnect();
    }

    const totalDuration = ((Date.now() - totalStartTime) / 1000).toFixed(2);

    // Summary
    console.log(`
${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
${c.bright}⚡ PERFORMANCE TEST COMPLETE${c.reset}
${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

  ${c.dim}Total Test Duration:${c.reset} ${totalDuration}s

${c.green}${c.bright}✓ Performance baseline established${c.reset}
    `);

    process.exit(0);
}

main();
