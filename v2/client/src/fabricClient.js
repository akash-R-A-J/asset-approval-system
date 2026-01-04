'use strict';

/**
 * Fabric Gateway Client for Asset Approval System v2
 * Uses @hyperledger/fabric-gateway SDK
 */

const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Network configuration
const CHANNEL_NAME = 'asset-channel';
const CHAINCODE_NAME = 'asset-approval';

// Organization configuration with role mapping
// Note: In v2, the ROLE comes from cert attribute, not this mapping
// This is just for client-side information display
const ORG_CONFIG = {
    org1: {
        mspId: 'Org1MSP',
        expectedRole: 'owner',  // Expected role from cert attribute
        peerEndpoint: 'localhost:7051',
        peerHostAlias: 'peer0.org1.example.com',
        cryptoPath: '../../network/organizations/peerOrganizations/org1.example.com'
    },
    org2: {
        mspId: 'Org2MSP',
        expectedRole: 'auditor',
        peerEndpoint: 'localhost:8051',
        peerHostAlias: 'peer0.org2.example.com',
        cryptoPath: '../../network/organizations/peerOrganizations/org2.example.com'
    },
    org3: {
        mspId: 'Org3MSP',
        expectedRole: 'regulator',
        peerEndpoint: 'localhost:9051',
        peerHostAlias: 'peer0.org3.example.com',
        cryptoPath: '../../network/organizations/peerOrganizations/org3.example.com'
    }
};

/**
 * Create gRPC client connection
 */
async function newGrpcConnection(org) {
    const config = ORG_CONFIG[org];
    const tlsCertPath = path.resolve(__dirname, config.cryptoPath, 'peers', config.peerHostAlias, 'tls', 'ca.crt');
    const tlsRootCert = fs.readFileSync(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);

    return new grpc.Client(config.peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': config.peerHostAlias,
    });
}

/**
 * Get user identity
 */
async function newIdentity(org) {
    const config = ORG_CONFIG[org];
    const certPath = path.resolve(__dirname, config.cryptoPath, 'users', `Admin@${config.peerHostAlias.replace('peer0.', '')}`, 'msp', 'signcerts', 'cert.pem');
    const credentials = fs.readFileSync(certPath);
    return { mspId: config.mspId, credentials };
}

/**
 * Get signer from private key
 */
async function newSigner(org) {
    const config = ORG_CONFIG[org];
    const keyPath = path.resolve(__dirname, config.cryptoPath, 'users', `Admin@${config.peerHostAlias.replace('peer0.', '')}`, 'msp', 'keystore');
    const files = fs.readdirSync(keyPath);
    const keyFile = files.find(f => f.endsWith('_sk'));
    const privateKeyPem = fs.readFileSync(path.join(keyPath, keyFile));
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

/**
 * FabricClient class - manages connection and contract
 */
class FabricClient {
    constructor(org, options = {}) {
        this.org = org;
        this.config = ORG_CONFIG[org];
        this.quiet = options.quiet || false;
        this.gateway = null;
        this.client = null;
        this.contract = null;
    }

    async connect() {
        this.client = await newGrpcConnection(this.org);
        const identity = await newIdentity(this.org);
        const signer = await newSigner(this.org);

        this.gateway = connect({
            client: this.client,
            identity,
            signer,
            evaluateOptions: () => ({ deadline: Date.now() + 30000 }),
            endorseOptions: () => ({ deadline: Date.now() + 30000 }),
            submitOptions: () => ({ deadline: Date.now() + 30000 }),
            commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
        });

        const network = this.gateway.getNetwork(CHANNEL_NAME);
        this.contract = network.getContract(CHAINCODE_NAME);

        if (!this.quiet) {
            console.log(`Connected as ${this.config.mspId} (expected role: ${this.config.expectedRole})`);
        }
    }

    disconnect() {
        if (this.gateway) {
            this.gateway.close();
        }
        if (this.client) {
            this.client.close();
        }
    }

    // ===========================================================================
    // Asset Operations
    // ===========================================================================

    async createAsset(assetId, description) {
        const result = await this.contract.submitTransaction('CreateAsset', assetId, description);
        return result.toString() || 'success';
    }

    async createAssetWithPrivateData(assetId, description, privateData) {
        const privateDataBuffer = Buffer.from(JSON.stringify(privateData));
        await this.contract.submit('CreateAssetWithPrivateData', {
            arguments: [assetId, description],
            transientData: { asset_private_data: privateDataBuffer }
        });
        return 'success';
    }

    async submitForApproval(assetId) {
        await this.contract.submitTransaction('SubmitForApproval', assetId);
        return 'success';
    }

    async approveAsset(assetId) {
        await this.contract.submitTransaction('ApproveAsset', assetId);
        return 'success';
    }

    async rejectAsset(assetId, reason) {
        await this.contract.submitTransaction('RejectAsset', assetId, reason);
        return 'success';
    }

    async activateAsset(assetId) {
        await this.contract.submitTransaction('ActivateAsset', assetId);
        return 'success';
    }

    async updateAsset(assetId, newDescription) {
        await this.contract.submitTransaction('UpdateAsset', assetId, newDescription);
        return 'success';
    }

    async deleteAsset(assetId) {
        await this.contract.submitTransaction('DeleteAsset', assetId);
        return 'success';
    }

    // ===========================================================================
    // Query Operations
    // ===========================================================================

    async queryAsset(assetId) {
        const result = await this.contract.evaluateTransaction('QueryAsset', assetId);
        return JSON.parse(Buffer.from(result).toString('utf8'));
    }

    async queryAllAssets() {
        const result = await this.contract.evaluateTransaction('QueryAllAssets');
        return JSON.parse(Buffer.from(result).toString('utf8'));
    }

    async getAssetHistory(assetId) {
        const result = await this.contract.evaluateTransaction('GetAssetHistory', assetId);
        return JSON.parse(Buffer.from(result).toString('utf8'));
    }

    async readPrivateData(assetId) {
        const result = await this.contract.evaluateTransaction('ReadPrivateData', assetId);
        return JSON.parse(Buffer.from(result).toString('utf8'));
    }

    async getCallerInfo() {
        const result = await this.contract.evaluateTransaction('GetCallerInfo');
        // Convert Uint8Array to proper string using Buffer
        const resultStr = Buffer.from(result).toString('utf8').trim();
        try {
            return JSON.parse(resultStr);
        } catch (e) {
            // Debug: show what we received
            console.error('GetCallerInfo raw result:', resultStr);
            throw new Error(`Failed to parse GetCallerInfo result: ${e.message}`);
        }
    }

    async assetExists(assetId) {
        const result = await this.contract.evaluateTransaction('AssetExists', assetId);
        return Buffer.from(result).toString('utf8') === 'true';
    }
}

module.exports = { FabricClient, ORG_CONFIG, CHANNEL_NAME, CHAINCODE_NAME };
