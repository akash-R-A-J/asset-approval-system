/*
 * Copyright IBM Corp. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Register and Enroll User
 * 
 * Registers a new user with Fabric CA and enrolls them.
 * Uses the admin identity to register the new user.
 * 
 * Usage: node registerUser.js <org> <userId>
 * Example: node registerUser.js org1 user1
 */

'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// Import centralized configuration
const { config, getOrgConfig } = require('./config');

// Get the network root directory
const NETWORK_ROOT = path.resolve(__dirname, '..', '..', 'network');

async function main() {
    try {
        // Get arguments from command line
        const org = process.argv[2];
        const userId = process.argv[3];

        if (!org || !userId) {
            console.error('Usage: node registerUser.js <org> <userId>');
            console.error('  org: org1, org2, or org3');
            console.error('  userId: name of the user to register');
            process.exit(1);
        }

        // Get organization config (validates org name)
        const orgConfig = getOrgConfig(org);

        // Validate userId format
        if (!/^[A-Za-z0-9_-]+$/.test(userId)) {
            console.error('Error: User ID must be alphanumeric (underscores and hyphens allowed)');
            process.exit(1);
        }

        console.log(`\nRegistering user "${userId}" for ${org.toUpperCase()} (${orgConfig.mspId})`);

        // Load CA certificate
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

        // Load wallet
        const walletPath = path.join(__dirname, '..', 'wallet', org);
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check if user already exists
        const userIdentity = await wallet.get(userId);
        if (userIdentity) {
            console.log(`User "${userId}" already exists in the wallet`);
            return;
        }

        // Check if admin exists
        const adminIdentity = await wallet.get('admin');
        if (!adminIdentity) {
            console.error('Admin identity not found in wallet');
            console.error('Run enrollAdmin.js first');
            process.exit(1);
        }

        // Build a user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'admin');

        // Build affiliation from org config
        const affiliation = `${org}.department1`;

        // Register the user
        console.log('Registering user with CA...');
        const secret = await ca.register({
            affiliation: affiliation,
            enrollmentID: userId,
            role: 'client'
        }, adminUser);

        // Enroll the user
        console.log('Enrolling user...');
        const enrollment = await ca.enroll({
            enrollmentID: userId,
            enrollmentSecret: secret
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
        await wallet.put(userId, x509Identity);
        console.log(`\n✓ Successfully registered and enrolled user "${userId}"`);
        console.log(`  Organization: ${org.toUpperCase()}`);
        console.log(`  MSP ID: ${orgConfig.mspId}`);
        console.log(`  Identity stored in wallet: ${walletPath}/${userId}`);

    } catch (error) {
        console.error(`\n✗ Failed to register user: ${error.message}`);
        process.exit(1);
    }
}

main();
