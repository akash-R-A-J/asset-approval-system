/*
 * Copyright IBM Corp. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Configuration Module
 * 
 * Centralized configuration for the Fabric client application.
 * Uses environment variables with secure defaults for development.
 * 
 * SECURITY: In production, ALL secrets should be provided via environment
 * variables or a secrets management system (Vault, AWS Secrets Manager, etc.)
 */

'use strict';

// Environment detection
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// Track which env vars are using defaults (to show a single warning)
const usingDefaults = [];

/**
 * Validate that a required environment variable is set
 * @param {string} name - Environment variable name
 * @param {string} defaultValue - Default value (only used in development)
 * @returns {string} - The value
 */
function getEnvOrDefault(name, defaultValue) {
    const value = process.env[name];

    if (!value) {
        if (IS_PRODUCTION) {
            throw new Error(`Environment variable ${name} is required in production`);
        }
        // Track defaults used (will show warning once at end)
        usingDefaults.push(name);
        return defaultValue;
    }

    return value;
}

// Network configuration
const config = {
    // Environment
    env: NODE_ENV,
    isProduction: IS_PRODUCTION,

    // Channel and chaincode
    channelName: process.env.CHANNEL_NAME || 'asset-channel',
    chaincodeName: process.env.CHAINCODE_NAME || 'assetcc',

    // TLS settings
    tls: {
        // In production, always verify certificates
        // In development, allow self-signed certs for localhost
        verify: IS_PRODUCTION || process.env.TLS_VERIFY === 'true'
    },

    // Organization configurations
    organizations: {
        org1: {
            mspId: 'Org1MSP',
            peerPort: parseInt(process.env.ORG1_PEER_PORT) || 7051,
            caPort: parseInt(process.env.ORG1_CA_PORT) || 7054,
            caName: 'ca-org1',
            peerHost: 'peer0.org1.example.com',
            orgDomain: 'org1.example.com',
            admin: {
                enrollmentId: getEnvOrDefault('ORG1_ADMIN_ID', 'admin'),
                enrollmentSecret: getEnvOrDefault('ORG1_ADMIN_SECRET', 'adminpw')
            }
        },
        org2: {
            mspId: 'Org2MSP',
            peerPort: parseInt(process.env.ORG2_PEER_PORT) || 9051,
            caPort: parseInt(process.env.ORG2_CA_PORT) || 8054,
            caName: 'ca-org2',
            peerHost: 'peer0.org2.example.com',
            orgDomain: 'org2.example.com',
            admin: {
                enrollmentId: getEnvOrDefault('ORG2_ADMIN_ID', 'admin'),
                enrollmentSecret: getEnvOrDefault('ORG2_ADMIN_SECRET', 'adminpw')
            }
        },
        org3: {
            mspId: 'Org3MSP',
            peerPort: parseInt(process.env.ORG3_PEER_PORT) || 11051,
            caPort: parseInt(process.env.ORG3_CA_PORT) || 9054,
            caName: 'ca-org3',
            peerHost: 'peer0.org3.example.com',
            orgDomain: 'org3.example.com',
            admin: {
                enrollmentId: getEnvOrDefault('ORG3_ADMIN_ID', 'admin'),
                enrollmentSecret: getEnvOrDefault('ORG3_ADMIN_SECRET', 'adminpw')
            }
        }
    },

    // Connection timeouts (in seconds)
    timeouts: {
        peer: parseInt(process.env.PEER_TIMEOUT) || 300,
        orderer: parseInt(process.env.ORDERER_TIMEOUT) || 300
    },

    // Validation settings
    validation: {
        // Asset ID must be alphanumeric with underscores and hyphens only
        assetIdPattern: /^[A-Za-z0-9_-]{1,64}$/,
        maxDescriptionLength: 500,
        maxReasonLength: 1000
    }
};

/**
 * Get organization configuration by name
 * @param {string} orgName - Organization name (org1, org2, org3)
 * @returns {object} - Organization configuration
 * @throws {Error} - If organization not found
 */
function getOrgConfig(orgName) {
    const org = orgName.toLowerCase();
    if (!config.organizations[org]) {
        throw new Error(`Unknown organization: ${orgName}. Valid: org1, org2, org3`);
    }
    return config.organizations[org];
}

/**
 * Validate asset ID format
 * @param {string} assetId - Asset ID to validate
 * @throws {Error} - If validation fails
 */
function validateAssetId(assetId) {
    if (!assetId) {
        throw new Error('Asset ID is required');
    }
    if (!config.validation.assetIdPattern.test(assetId)) {
        throw new Error(
            'Invalid Asset ID format. Must be 1-64 alphanumeric characters, ' +
            'underscores, or hyphens only.'
        );
    }
}

/**
 * Validate description
 * @param {string} description - Description to validate
 * @throws {Error} - If validation fails
 */
function validateDescription(description) {
    if (description && description.length > config.validation.maxDescriptionLength) {
        throw new Error(
            `Description too long. Maximum ${config.validation.maxDescriptionLength} characters.`
        );
    }
}

/**
 * Validate rejection reason
 * @param {string} reason - Reason to validate
 * @throws {Error} - If validation fails
 */
function validateReason(reason) {
    if (!reason) {
        throw new Error('Rejection reason is required');
    }
    if (reason.length > config.validation.maxReasonLength) {
        throw new Error(
            `Reason too long. Maximum ${config.validation.maxReasonLength} characters.`
        );
    }
}

// Show a single consolidated warning if using defaults (suppress with env var for clean demos)
if (usingDefaults.length > 0 && process.env.SUPPRESS_CONFIG_WARNINGS !== 'true') {
    console.warn(`[INFO] Development mode: using default credentials. Set env vars in production.`);
}

module.exports = {
    config,
    getOrgConfig,
    validateAssetId,
    validateDescription,
    validateReason,
    IS_PRODUCTION,
    NODE_ENV,
    usingDefaults
};
