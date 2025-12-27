/*
 * Copyright IBM Corp. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Gateway Connection Helper
 * 
 * The Node.js backend acts as a trusted gateway to the Fabric network,
 * not an authority over business rules. The gateway manages connections
 * and submits transactions on behalf of enrolled users. Business logic
 * enforcement happens in chaincode, not in the client.
 */

'use strict';

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

// Import centralized configuration
const { config, getOrgConfig } = require('./config');

// Get the network root directory (assumes client is at hyperledger/client)
const NETWORK_ROOT = path.resolve(__dirname, '..', '..', 'network');

/**
 * Build connection profile dynamically with embedded TLS certs
 * @param {string} org - Organization name (org1, org2, org3)
 * @returns {object} Connection profile with embedded certs
 */
function buildConnectionProfile(org) {
    const orgConfig = getOrgConfig(org);

    // Read TLS certificate for peer
    const tlsCertPath = path.join(
        NETWORK_ROOT,
        'organizations',
        'peerOrganizations',
        orgConfig.orgDomain,
        'peers',
        orgConfig.peerHost,
        'tls',
        'ca.crt'
    );

    if (!fs.existsSync(tlsCertPath)) {
        throw new Error(`TLS certificate not found at: ${tlsCertPath}`);
    }
    const tlsCert = fs.readFileSync(tlsCertPath, 'utf8');

    // Read CA certificate
    const caCertPath = path.join(
        NETWORK_ROOT,
        'organizations',
        'fabric-ca',
        org,
        'ca-cert.pem'
    );

    let caCert = '';
    if (fs.existsSync(caCertPath)) {
        caCert = fs.readFileSync(caCertPath, 'utf8');
    }

    // Build connection profile
    const ccp = {
        name: `asset-approval-network-${org}`,
        version: '1.0.0',
        client: {
            organization: orgConfig.mspId.replace('MSP', ''),
            connection: {
                timeout: {
                    peer: {
                        endorser: String(config.timeouts.peer)
                    }
                }
            }
        },
        organizations: {
            [orgConfig.mspId.replace('MSP', '')]: {
                mspid: orgConfig.mspId,
                peers: [orgConfig.peerHost],
                certificateAuthorities: [`ca.${orgConfig.orgDomain}`]
            }
        },
        peers: {
            [orgConfig.peerHost]: {
                url: `grpcs://localhost:${orgConfig.peerPort}`,
                tlsCACerts: {
                    pem: tlsCert
                },
                grpcOptions: {
                    'ssl-target-name-override': orgConfig.peerHost,
                    'hostnameOverride': orgConfig.peerHost
                }
            }
        },
        certificateAuthorities: {
            [`ca.${orgConfig.orgDomain}`]: {
                url: `https://localhost:${orgConfig.caPort}`,
                caName: orgConfig.caName,
                tlsCACerts: {
                    pem: caCert || tlsCert
                },
                httpOptions: {
                    // TLS verification based on environment config
                    verify: config.tls.verify
                }
            }
        }
    };

    return ccp;
}

/**
 * Connect to the Fabric network
 * @param {string} org - Organization name
 * @param {string} userId - User identity to use
 * @returns {object} { gateway, network, contract }
 */
async function connectToNetwork(org, userId) {
    // Build connection profile dynamically
    const ccp = buildConnectionProfile(org);

    // Load wallet
    const walletPath = path.join(__dirname, '..', 'wallet', org);
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Check if identity exists
    const identity = await wallet.get(userId);
    if (!identity) {
        throw new Error(`Identity "${userId}" not found in wallet for ${org}`);
    }

    // Create gateway
    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: userId,
        discovery: { enabled: true, asLocalhost: true }
    });

    // Get network and contract
    const network = await gateway.getNetwork(config.channelName);
    const contract = network.getContract(config.chaincodeName);

    return { gateway, network, contract };
}

/**
 * Disconnect from the network
 * @param {Gateway} gateway - Gateway instance
 */
function disconnect(gateway) {
    if (gateway) {
        gateway.disconnect();
    }
}

module.exports = {
    connectToNetwork,
    disconnect,
    buildConnectionProfile,
    getOrgConfig,
    CHANNEL_NAME: config.channelName,
    CHAINCODE_NAME: config.chaincodeName,
    NETWORK_ROOT,
    ORG_CONFIG: config.organizations
};
