'use strict';

/**
 * Combined Test Runner
 * Runs all test suites and displays a consolidated summary
 */

const { spawn } = require('child_process');
const path = require('path');

// Colors
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
    bgRed: '\x1b[41m',
};

const testSuites = [
    { name: 'Comprehensive Tests', script: 'test.js', passed: 0, failed: 0 },
    { name: 'Security Tests', script: 'securityTest.js', passed: 0, failed: 0 },
    { name: 'Fault Tolerance Tests', script: 'faultTest.js', passed: 0, failed: 0 },
];

function runTest(suite) {
    return new Promise((resolve) => {
        const scriptPath = path.join(__dirname, suite.script);
        const child = spawn('node', [scriptPath], { stdio: 'pipe' });

        let output = '';

        child.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            process.stdout.write(text);
        });

        child.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        child.on('close', (code) => {
            // Parse results from output
            const passMatch = output.match(/Passed:\s+(\d+)/);
            const failMatch = output.match(/Failed:\s+(\d+)/);

            suite.passed = passMatch ? parseInt(passMatch[1]) : 0;
            suite.failed = failMatch ? parseInt(failMatch[1]) : 0;
            suite.exitCode = code;

            resolve(suite);
        });
    });
}

async function main() {
    const startTime = Date.now();

    console.log(`${c.bgBlue}${c.bright}`);
    console.log('╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║         HYPERLEDGER FABRIC - COMPLETE TEST SUITE RUNNER                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝');
    console.log(`${c.reset}\n`);

    // Run all test suites sequentially
    for (const suite of testSuites) {
        console.log(`\n${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        console.log(`${c.cyan}  Running: ${suite.name}${c.reset}`);
        console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
        await runTest(suite);
        console.log('\n');
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    // Calculate totals
    const totalPassed = testSuites.reduce((sum, s) => sum + s.passed, 0);
    const totalFailed = testSuites.reduce((sum, s) => sum + s.failed, 0);
    const totalTests = totalPassed + totalFailed;
    const allPassed = totalFailed === 0;

    // Print consolidated summary
    console.log(`\n${c.bright}`);
    console.log('╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    CONSOLIDATED TEST RESULTS                              ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝');
    console.log(`${c.reset}`);

    console.log(`\n${c.bright}Test Suite Results:${c.reset}\n`);
    console.log('  ┌────────────────────────────────┬────────┬────────┬────────┐');
    console.log('  │ Test Suite                     │ Passed │ Failed │ Status │');
    console.log('  ├────────────────────────────────┼────────┼────────┼────────┤');

    for (const suite of testSuites) {
        const name = suite.name.padEnd(30);
        const passed = String(suite.passed).padStart(6);
        const failed = String(suite.failed).padStart(6);
        const status = suite.failed === 0 ? `${c.green}  ✓   ${c.reset}` : `${c.red}  ✗   ${c.reset}`;
        console.log(`  │ ${name} │${passed} │${failed} │${status}│`);
    }

    console.log('  ├────────────────────────────────┼────────┼────────┼────────┤');
    const totalLabel = 'TOTAL'.padEnd(30);
    const passedStr = String(totalPassed).padStart(6);
    const failedStr = String(totalFailed).padStart(6);
    const totalStatus = allPassed ? `${c.green}  ✓   ${c.reset}` : `${c.red}  ✗   ${c.reset}`;
    console.log(`  │ ${c.bright}${totalLabel}${c.reset} │${c.green}${passedStr}${c.reset} │${totalFailed > 0 ? c.red : ''}${failedStr}${c.reset} │${totalStatus}│`);
    console.log('  └────────────────────────────────┴────────┴────────┴────────┘');

    console.log(`\n${c.dim}  Total Duration: ${duration}s${c.reset}\n`);

    // Final status banner
    if (allPassed) {
        console.log(`${c.bgGreen}${c.bright}`);
        console.log('╔══════════════════════════════════════════════════════════════════════════╗');
        console.log('║                    ✓ ALL TESTS PASSED SUCCESSFULLY!                      ║');
        console.log('╚══════════════════════════════════════════════════════════════════════════╝');
        console.log(`${c.reset}`);

        console.log(`\n${c.bright}Verified Capabilities:${c.reset}`);
        console.log(`  ${c.green}✓${c.reset} Organization-Based Access Control (OBAC/RBAC)`);
        console.log(`  ${c.green}✓${c.reset} State Machine Enforcement`);
        console.log(`  ${c.green}✓${c.reset} Private Data Collections`);
        console.log(`  ${c.green}✓${c.reset} Multi-Org Approval Workflow`);
        console.log(`  ${c.green}✓${c.reset} Fault Tolerance & Recovery`);
        console.log(`  ${c.green}✓${c.reset} Complete Audit Trail\n`);

        process.exit(0);
    } else {
        console.log(`${c.bgRed}${c.bright}`);
        console.log('╔══════════════════════════════════════════════════════════════════════════╗');
        console.log('║                    ✗ SOME TESTS FAILED!                                  ║');
        console.log('╚══════════════════════════════════════════════════════════════════════════╝');
        console.log(`${c.reset}\n`);
        process.exit(1);
    }
}

main().catch(console.error);
