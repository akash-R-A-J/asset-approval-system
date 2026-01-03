'use strict';

/**
 * Fabric Client Module
 * Handles gateway connections, TLS, and retry logic
 */

const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const CHANNEL_NAME = 'asset-channel';
const CHAINCODE_NAME = 'asset-approval';

// Org configurations
const ORG_CONFIG = {
    org1: {
        mspId: 'Org1MSP',
        role: 'asset_owner',
        peerEndpoint: 'localhost:7051',
        peerHostAlias: 'peer0.org1.example.com',
        cryptoPath: path.resolve(__dirname, '../../network/organizations/peerOrganizations/org1.example.com'),
    },
    org2: {
        mspId: 'Org2MSP',
        role: 'auditor',
        peerEndpoint: 'localhost:8051',
        peerHostAlias: 'peer0.org2.example.com',
        cryptoPath: path.resolve(__dirname, '../../network/organizations/peerOrganizations/org2.example.com'),
    },
    org3: {
        mspId: 'Org3MSP',
        role: 'regulator',
        peerEndpoint: 'localhost:9051',
        peerHostAlias: 'peer0.org3.example.com',
        cryptoPath: path.resolve(__dirname, '../../network/organizations/peerOrganizations/org3.example.com'),
    }
};

// ===========================================================================
// Client-Side Pre-Filtering (ABAC)
// ===========================================================================

const OPERATION_ROLES = {
    'CreateAsset': ['asset_owner'],
    'CreateAssetWithPrivateData': ['asset_owner'],
    'SubmitForApproval': ['asset_owner'],
    'ApproveAsset': ['auditor', 'regulator'],
    'RejectAsset': ['auditor', 'regulator'],
    'ActivateAsset': ['asset_owner'],
    'UpdateAsset': ['asset_owner'],
    'DeleteAsset': ['asset_owner'],
    'QueryAsset': ['asset_owner', 'auditor', 'regulator'],
    'QueryAllAssets': ['asset_owner', 'auditor', 'regulator'],
    'QueryAssetsByStatus': ['asset_owner', 'auditor', 'regulator'],
    'QueryAssetsByOwner': ['asset_owner', 'auditor', 'regulator'],
    'GetAssetHistory': ['asset_owner', 'auditor', 'regulator'],
    'ReadPrivateData': ['asset_owner', 'auditor'],  // Org1 and Org2 only
};

/**
 * Pre-filter check before sending to endorsers
 * Saves endorsement CPU on unauthorized requests
 */
function validateOperation(operation, userRole) {
    const allowedRoles = OPERATION_ROLES[operation];
    if (!allowedRoles) {
        throw new Error(`Unknown operation: ${operation}`);
    }
    if (!allowedRoles.includes(userRole)) {
        throw new Error(`Role '${userRole}' not authorized for operation '${operation}'. Allowed roles: ${allowedRoles.join(', ')}`);
    }
    return true;
}

// ===========================================================================
// Fabric Gateway Connection
// ===========================================================================

class FabricClient {
    constructor(orgName) {
        if (!ORG_CONFIG[orgName]) {
            throw new Error(`Unknown organization: ${orgName}`);
        }
        this.orgName = orgName;
        this.config = ORG_CONFIG[orgName];
        this.gateway = null;
        this.client = null;
    }

    /**
     * Connect to the Fabric Gateway
     */
    async connect() {
        // Load credentials
        const credentials = await this._loadCredentials();

        // Create gRPC client with TLS
        this.client = await this._createGrpcClient();

        // Connect to gateway
        this.gateway = connect({
            client: this.client,
            identity: credentials.identity,
            signer: credentials.signer,
            evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
            endorseOptions: () => ({ deadline: Date.now() + 15000 }),
            submitOptions: () => ({ deadline: Date.now() + 5000 }),
            commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
        });


        return this;
    }

    /**
     * Get the contract for asset-approval chaincode
     */
    getContract() {
        const network = this.gateway.getNetwork(CHANNEL_NAME);
        return network.getContract(CHAINCODE_NAME);
    }

    /**
     * Submit a transaction with pre-filtering
     */
    async submitTransaction(operation, ...args) {
        // Client-side pre-filter (saves endorsement CPU)
        validateOperation(operation, this.config.role);

        const contract = this.getContract();

        try {
            const result = await contract.submitTransaction(operation, ...args);
            // Handle Uint8Array response properly
            return Buffer.from(result).toString('utf8');
        } catch (error) {
            throw this._parseError(error);
        }
    }

    /**
     * Evaluate a transaction (query, no ledger update)
     */
    async evaluateTransaction(operation, ...args) {
        // Client-side pre-filter
        validateOperation(operation, this.config.role);

        const contract = this.getContract();

        try {
            const result = await contract.evaluateTransaction(operation, ...args);
            // Handle Uint8Array response properly
            return Buffer.from(result).toString('utf8');
        } catch (error) {
            throw this._parseError(error);
        }
    }

    /**
     * Submit transaction with private data
     */
    async submitTransactionWithPrivateData(operation, transientData, ...args) {
        validateOperation(operation, this.config.role);

        const contract = this.getContract();

        try {
            const proposal = contract.newProposal(operation, {
                arguments: args,
                transientData: transientData,
            });

            const transaction = await proposal.endorse();
            const result = await transaction.submit();

            return result.toString();
        } catch (error) {
            throw this._parseError(error);
        }
    }

    /**
     * Disconnect from the gateway
     */
    disconnect() {
        if (this.gateway) {
            this.gateway.close();
        }
        if (this.client) {
            this.client.close();
        }
    }

    // ===========================================================================
    // Private Helper Methods
    // ===========================================================================

    async _loadCredentials() {
        const signcertsDir = path.join(
            this.config.cryptoPath,
            'users',
            `Admin@${this.orgName}.example.com`,
            'msp',
            'signcerts'
        );

        const keyDir = path.join(
            this.config.cryptoPath,
            'users',
            `Admin@${this.orgName}.example.com`,
            'msp',
            'keystore'
        );

        // Find the certificate file (cryptogen uses Admin@orgN.example.com-cert.pem)
        const certFiles = fs.readdirSync(signcertsDir);
        const certFile = certFiles.find(f => f.endsWith('.pem')) || certFiles[0];
        const certPath = path.join(signcertsDir, certFile);

        // Find the private key file
        const keyFiles = fs.readdirSync(keyDir);
        const keyFile = keyFiles.find(f => f.endsWith('_sk')) || keyFiles[0];
        const keyPath = path.join(keyDir, keyFile);

        const certificate = fs.readFileSync(certPath).toString();
        const privateKeyPem = fs.readFileSync(keyPath).toString();

        const privateKey = crypto.createPrivateKey(privateKeyPem);

        return {
            identity: {
                mspId: this.config.mspId,
                credentials: Buffer.from(certificate),
            },
            signer: signers.newPrivateKeySigner(privateKey),
        };
    }

    async _createGrpcClient() {
        const tlsCertPath = path.join(
            this.config.cryptoPath,
            'peers',
            this.config.peerHostAlias,
            'tls',
            'ca.crt'
        );

        const tlsRootCert = fs.readFileSync(tlsCertPath);
        const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);

        return new grpc.Client(
            this.config.peerEndpoint,
            tlsCredentials,
            {
                'grpc.ssl_target_name_override': this.config.peerHostAlias,
            }
        );
    }

    _parseError(error) {
        // Handle array of error details from fabric gateway
        if (error.details && Array.isArray(error.details)) {
            const messages = error.details.map(d => d.message || JSON.stringify(d)).join('; ');
            return new Error(messages);
        }
        if (error.details) {
            return new Error(typeof error.details === 'string' ? error.details : JSON.stringify(error.details));
        }
        if (error.message) {
            return new Error(error.message);
        }
        return error;
    }
}

// ===========================================================================
// Export
// ===========================================================================

module.exports = {
    FabricClient,
    validateOperation,
    OPERATION_ROLES,
    ORG_CONFIG,
    CHANNEL_NAME,
    CHAINCODE_NAME,
};
