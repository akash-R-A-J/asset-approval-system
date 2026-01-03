'use strict';

/**
 * Asset Service Module
 * Wraps all asset operations with proper error handling
 */

const { FabricClient } = require('./fabricClient');

class AssetService {
    constructor(orgName, options = {}) {
        this.client = new FabricClient(orgName);
        this.connected = false;
        this.quiet = options.quiet || false; // Suppress console output
    }

    _log(msg) {
        if (!this.quiet) {
            console.log(msg);
        }
    }

    async connect() {
        await this.client.connect();
        this.connected = true;
        return this;
    }

    disconnect() {
        if (this.connected) {
            this.client.disconnect();
            this.connected = false;
        }
    }

    // ===========================================================================
    // Asset Lifecycle Operations
    // ===========================================================================

    /**
     * Create a new asset (asset_owner only)
     */
    async createAsset(assetId, description) {
        this._log(`Creating asset: ${assetId}`);
        const result = await this.client.submitTransaction('CreateAsset', assetId, description);
        this._log(`Asset ${assetId} created successfully`);
        return result;
    }

    /**
     * Create asset with private data (asset_owner only)
     */
    async createAssetWithPrivateData(assetId, description, privateData) {
        this._log(`Creating asset with private data: ${assetId}`);

        const transientData = {
            asset_private_data: Buffer.from(JSON.stringify(privateData)),
        };

        const result = await this.client.submitTransactionWithPrivateData(
            'CreateAssetWithPrivateData',
            transientData,
            assetId,
            description
        );

        this._log(`Asset ${assetId} created with private data`);
        return result;
    }

    /**
     * Submit asset for approval (asset_owner only)
     */
    async submitForApproval(assetId) {
        this._log(`Submitting asset for approval: ${assetId}`);
        const result = await this.client.submitTransaction('SubmitForApproval', assetId);
        this._log(`Asset ${assetId} submitted for approval`);
        return result;
    }

    /**
     * Approve an asset (auditor or regulator only)
     */
    async approveAsset(assetId) {
        this._log(`Approving asset: ${assetId}`);
        const result = await this.client.submitTransaction('ApproveAsset', assetId);
        this._log(`Asset ${assetId} approved`);
        return result;
    }

    /**
     * Reject an asset (auditor or regulator only)
     */
    async rejectAsset(assetId, reason) {
        this._log(`Rejecting asset: ${assetId}, reason: ${reason}`);
        const result = await this.client.submitTransaction('RejectAsset', assetId, reason);
        this._log(`Asset ${assetId} rejected`);
        return result;
    }

    /**
     * Activate an approved asset (asset_owner only)
     */
    async activateAsset(assetId) {
        this._log(`Activating asset: ${assetId}`);
        const result = await this.client.submitTransaction('ActivateAsset', assetId);
        this._log(`Asset ${assetId} activated`);
        return result;
    }

    /**
     * Update asset description (asset_owner only)
     */
    async updateAsset(assetId, newDescription) {
        this._log(`Updating asset: ${assetId}`);
        const result = await this.client.submitTransaction('UpdateAsset', assetId, newDescription);
        this._log(`Asset ${assetId} updated`);
        return result;
    }

    /**
     * Delete an asset (asset_owner only)
     */
    async deleteAsset(assetId) {
        this._log(`Deleting asset: ${assetId}`);
        const result = await this.client.submitTransaction('DeleteAsset', assetId);
        this._log(`Asset ${assetId} deleted`);
        return result;
    }

    // ===========================================================================
    // Query Operations
    // ===========================================================================

    /**
     * Query single asset by ID
     */
    async queryAsset(assetId) {
        this._log(`Querying asset: ${assetId}`);
        const result = await this.client.evaluateTransaction('QueryAsset', assetId);
        if (!result || result.length === 0) {
            throw new Error(`Asset ${assetId} not found`);
        }
        try {
            return JSON.parse(result);
        } catch (e) {
            console.error('Failed to parse result:', result);
            throw e;
        }
    }

    /**
     * Query all assets
     */
    async queryAllAssets() {
        this._log('Querying all assets');
        const result = await this.client.evaluateTransaction('QueryAllAssets');
        return JSON.parse(result);
    }

    /**
     * Query assets by status
     */
    async queryAssetsByStatus(status) {
        this._log(`Querying assets by status: ${status}`);
        const result = await this.client.evaluateTransaction('QueryAssetsByStatus', status);
        return JSON.parse(result);
    }

    /**
     * Query assets by owner
     */
    async queryAssetsByOwner(ownerMsp) {
        this._log(`Querying assets by owner: ${ownerMsp}`);
        const result = await this.client.evaluateTransaction('QueryAssetsByOwner', ownerMsp);
        return JSON.parse(result);
    }

    /**
     * Get asset history
     */
    async getAssetHistory(assetId) {
        this._log(`Getting history for asset: ${assetId}`);
        const result = await this.client.evaluateTransaction('GetAssetHistory', assetId);
        return JSON.parse(result);
    }

    /**
     * Read private data (Org1 and Org2 only)
     */
    async readPrivateData(assetId) {
        this._log(`Reading private data for asset: ${assetId}`);
        const result = await this.client.evaluateTransaction('ReadPrivateData', assetId);
        return JSON.parse(result);
    }
}

module.exports = { AssetService };
