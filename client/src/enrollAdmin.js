/*
 * Copyright IBM Corp. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enroll Admin User
 * 
 * Enrolls the admin user for a specified organization using Fabric CA.
 * All cryptographic material is generated on the client side during enrollment;
 * private keys never leave the enrolling entity.
 * 
 * Usage: node enrollAdmin.js <org>
 * Example: node enrollAdmin.js org1
 */

'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// Import centralized configuration
const { config, getOrgConfig } = require('./config');

// Get the network root directory (assumes client is at hyperledger/client)
const NETWORK_ROOT = path.resolve(__dirname, '..', '..', 'network');

async function main() {
    try {
        // Get org from command line
        const org = process.argv[2];

        if (!org) {
            console.error('Usage: node enrollAdmin.js <org>');
            console.error('  org: org1, org2, or org3');
            process.exit(1);
        }

        // Get organization config (validates org name)
        const orgConfig = getOrgConfig(org);
        console.log(`\nEnrolling admin for ${org.toUpperCase()} (${orgConfig.mspId})`);

        // Load CA certificate using absolute path
        const caCertPath = path.join(NETWORK_ROOT, 'organizations', 'fabric-ca', org, 'ca-cert.pem');

        if (!fs.existsSync(caCertPath)) {
            console.error(`CA certificate not found at ${caCertPath}`);
            console.error('Make sure the network is running and CAs are started.');
            process.exit(1);
        }

        const caCert = fs.readFileSync(caCertPath, 'utf8');

        // Create CA client with TLS verification based on environment
        const caURL = `https://localhost:${orgConfig.caPort}`;
        const ca = new FabricCAServices(caURL, {
            trustedRoots: caCert,
            verify: config.tls.verify
        }, orgConfig.caName);

        // Create wallet
        const walletPath = path.join(__dirname, '..', 'wallet', org);
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check if admin already exists
        const identity = await wallet.get('admin');
        if (identity) {
            console.log('Admin identity already exists in the wallet');
            return;
        }

        // Enroll admin using credentials from config (which uses env vars)
        console.log('Enrolling admin user...');
        const enrollment = await ca.enroll({
            enrollmentID: orgConfig.admin.enrollmentId,
            enrollmentSecret: orgConfig.admin.enrollmentSecret
        });

        // Create identity
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes()
            },
            mspId: orgConfig.mspId,
            type: 'X.509'
        };

        // Store in wallet
        await wallet.put('admin', x509Identity);
        console.log(`\n✓ Successfully enrolled admin user for ${org.toUpperCase()}`);
        console.log(`  MSP ID: ${orgConfig.mspId}`);
        console.log(`  Identity stored in wallet: ${walletPath}/admin`);

    } catch (error) {
        console.error(`\n✗ Failed to enroll admin user: ${error.message}`);
        process.exit(1);
    }
}

main();
