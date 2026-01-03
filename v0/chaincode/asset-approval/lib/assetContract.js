/*
 * Copyright IBM Corp. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Asset Approval Smart Contract
 * 
 * This chaincode implements asset lifecycle management with:
 * - Organization-based access control (OBAC) enforced via MSP ID
 *   (Org1 = Owner, Org2 = Auditor, Org3 = Regulator)
 * - Private data collection for sensitive information (Org1 & Org2 only)
 * - Multi-org approval workflow with state machine enforcement
 * 
 * Endorsement policies ensure transaction validity at the network level.
 * Access control logic in this chaincode enforces business authorization.
 * 
 * Note: This can be extended to attribute-based access control (ABAC)
 * using Fabric CA certificate attributes.
 */

'use strict';

const { Contract } = require('fabric-contract-api');

// Asset status constants
const STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
};

// Organization MSP IDs
const ORG1_MSP = 'Org1MSP';  // Asset Owner
const ORG2_MSP = 'Org2MSP';  // Auditor
const ORG3_MSP = 'Org3MSP';  // Regulator

// Private data collection name
const PRIVATE_COLLECTION = 'Org1Org2PrivateCollection';

class AssetContract extends Contract {

    /**
     * Initialize the chaincode (called once during instantiation)
     * @param {Context} ctx - Transaction context
     */
    async InitLedger(ctx) {
        console.info('============= Initializing Asset Approval Ledger =============');
        return;
    }

    // ============================================================================
    // ORGANIZATION-BASED ACCESS CONTROL (OBAC) HELPERS
    // ============================================================================

    /**
     * Get the calling client's MSP ID
     * @param {Context} ctx - Transaction context
     * @returns {string} - MSP ID of the caller
     */
    _getClientMSP(ctx) {
        return ctx.clientIdentity.getMSPID();
    }

    /**
     * Verify that the caller is from Org1 (Asset Owner)
     * @param {Context} ctx - Transaction context
     * @throws Error if caller is not from Org1
     */
    _verifyOrg1(ctx) {
        const clientMSP = this._getClientMSP(ctx);
        if (clientMSP !== ORG1_MSP) {
            throw new Error(`Access denied. Only ${ORG1_MSP} (Asset Owner) can perform this operation. Caller: ${clientMSP}`);
        }
    }

    /**
     * Verify that the caller is from Org2 or Org3 (Approvers)
     * @param {Context} ctx - Transaction context
     * @throws Error if caller is not from Org2 or Org3
     */
    _verifyApprover(ctx) {
        const clientMSP = this._getClientMSP(ctx);
        if (clientMSP !== ORG2_MSP && clientMSP !== ORG3_MSP) {
            throw new Error(`Access denied. Only ${ORG2_MSP} (Auditor) or ${ORG3_MSP} (Regulator) can approve/reject assets. Caller: ${clientMSP}`);
        }
    }

    /**
     * Verify that the caller can access private data (Org1 or Org2)
     * @param {Context} ctx - Transaction context
     * @throws Error if caller is not from Org1 or Org2
     */
    _verifyPrivateDataAccess(ctx) {
        const clientMSP = this._getClientMSP(ctx);
        if (clientMSP !== ORG1_MSP && clientMSP !== ORG2_MSP) {
            throw new Error(`Access denied. Only ${ORG1_MSP} and ${ORG2_MSP} can access private data. Caller: ${clientMSP}`);
        }
    }

    /**
     * Get transaction timestamp from Fabric (deterministic across peers)
     * @param {Context} ctx - Transaction context
     * @returns {string} - Timestamp in ISO format
     */
    _getTimestamp(ctx) {
        const txTimestamp = ctx.stub.getTxTimestamp();
        const seconds = txTimestamp.seconds.low;
        const nanos = txTimestamp.nanos;
        const date = new Date(seconds * 1000 + nanos / 1000000);
        return date.toISOString();
    }

    // ============================================================================
    // ASSET CREATION AND UPDATE (Org1 Only)
    // ============================================================================

    /**
     * Create a new asset (Org1 only)
     * 
     * Creates public asset data on-chain and stores sensitive details
     * in the private data collection shared between Org1 and Org2.
     * 
     * @param {Context} ctx - Transaction context
     * @param {string} assetID - Unique asset identifier
     * @returns {Object} - Created asset
     */
    async CreateAsset(ctx, assetID) {
        // Access control - only Org1 can create assets
        this._verifyOrg1(ctx);

        // Check if asset already exists
        const exists = await this.AssetExists(ctx, assetID);
        if (exists) {
            throw new Error(`Asset ${assetID} already exists`);
        }

        const timestamp = this._getTimestamp(ctx);
        const clientMSP = this._getClientMSP(ctx);

        // Public asset data (visible to all orgs)
        const publicAsset = {
            docType: 'asset',
            assetID: assetID,
            status: STATUS.PENDING,
            owner: clientMSP,
            approvals: {},
            createdAt: timestamp,
            updatedAt: timestamp
        };

        // Store public data
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(publicAsset)));

        // Get private data from transient map
        const transientData = ctx.stub.getTransient();

        if (transientData.has('asset_properties')) {
            const privateDataBuffer = transientData.get('asset_properties');
            const privateData = JSON.parse(privateDataBuffer.toString());

            // Private asset data (visible only to Org1 and Org2)
            const privateAsset = {
                assetID: assetID,
                description: privateData.description || '',
                internalNotes: privateData.internalNotes || '',
                valuationAmount: privateData.valuationAmount || 0,
                confidentialTerms: privateData.confidentialTerms || ''
            };

            // Store private data in the collection
            await ctx.stub.putPrivateData(
                PRIVATE_COLLECTION,
                assetID,
                Buffer.from(JSON.stringify(privateAsset))
            );
        }

        console.info(`Asset ${assetID} created by ${clientMSP}`);
        return publicAsset;
    }

    /**
     * Update asset status (Org1 only)
     * 
     * Note: Finalized assets (APPROVED or REJECTED) cannot be modified.
     * This enforces the state machine integrity of the approval workflow.
     * 
     * @param {Context} ctx - Transaction context
     * @param {string} assetID - Asset identifier
     * @param {string} newStatus - New status value
     * @returns {Object} - Updated asset
     */
    async UpdateAssetStatus(ctx, assetID, newStatus) {
        // Organization-based access control - only Org1 can update asset status
        this._verifyOrg1(ctx);

        // Validate status
        if (!Object.values(STATUS).includes(newStatus)) {
            throw new Error(`Invalid status: ${newStatus}. Must be one of: ${Object.values(STATUS).join(', ')}`);
        }

        // Get existing asset
        const asset = await this._getAsset(ctx, assetID);

        // State machine guard: finalized assets cannot be modified
        if (asset.status === STATUS.APPROVED || asset.status === STATUS.REJECTED) {
            throw new Error(`Cannot modify finalized asset. Asset ${assetID} has status: ${asset.status}`);
        }

        // Update asset
        asset.status = newStatus;
        asset.updatedAt = this._getTimestamp(ctx);

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));

        console.info(`Asset ${assetID} status updated to ${newStatus}`);
        return asset;
    }

    /**
     * Add or update private details for an asset (Org1 only)
     * 
     * Sensitive business data is stored in a private data collection 
     * shared only between Org1 (Asset Owner) and Org2 (Auditor).
     * 
     * @param {Context} ctx - Transaction context
     * @param {string} assetID - Asset identifier
     */
    async AddPrivateDetails(ctx, assetID) {
        // Access control - only Org1 can add private details
        this._verifyOrg1(ctx);

        // Check asset exists
        const exists = await this.AssetExists(ctx, assetID);
        if (!exists) {
            throw new Error(`Asset ${assetID} does not exist`);
        }

        // Get private data from transient map
        const transientData = ctx.stub.getTransient();

        if (!transientData.has('asset_properties')) {
            throw new Error('Private data not provided in transient map');
        }

        const privateDataBuffer = transientData.get('asset_properties');
        const privateData = JSON.parse(privateDataBuffer.toString());

        // Private asset data
        const privateAsset = {
            assetID: assetID,
            description: privateData.description || '',
            internalNotes: privateData.internalNotes || '',
            valuationAmount: privateData.valuationAmount || 0,
            confidentialTerms: privateData.confidentialTerms || ''
        };

        // Store private data
        await ctx.stub.putPrivateData(
            PRIVATE_COLLECTION,
            assetID,
            Buffer.from(JSON.stringify(privateAsset))
        );

        console.info(`Private details added for asset ${assetID}`);
    }

    // ============================================================================
    // ASSET APPROVAL (Org2 and Org3 Only)
    // ============================================================================

    /**
     * Approve an asset (Org2 or Org3 only)
     * 
     * Records the approval from the calling organization.
     * Asset becomes APPROVED when it has approvals from both Org2 AND Org3.
     * 
     * Note: Rejected assets cannot be approved (state machine enforcement).
     * 
     * @param {Context} ctx - Transaction context
     * @param {string} assetID - Asset identifier
     * @returns {Object} - Updated asset
     */
    async ApproveAsset(ctx, assetID) {
        // Organization-based access control - only Org2 or Org3 can approve
        this._verifyApprover(ctx);

        // Get existing asset
        const asset = await this._getAsset(ctx, assetID);
        const clientMSP = this._getClientMSP(ctx);

        // State machine guard: rejected assets cannot be approved
        if (asset.status === STATUS.REJECTED) {
            throw new Error(`Cannot approve rejected asset. Asset ${assetID} was rejected.`);
        }

        // State machine guard: already approved assets don't need re-approval
        if (asset.status === STATUS.APPROVED) {
            throw new Error(`Asset ${assetID} is already approved.`);
        }

        // Check if already approved by this org
        if (asset.approvals[clientMSP] && asset.approvals[clientMSP].approved) {
            throw new Error(`Asset ${assetID} already approved by ${clientMSP}`);
        }

        // Record approval
        asset.approvals[clientMSP] = {
            approved: true,
            timestamp: this._getTimestamp(ctx)
        };

        asset.updatedAt = this._getTimestamp(ctx);

        // Check if we have all required approvals (Org2 AND Org3)
        const hasOrg2Approval = asset.approvals[ORG2_MSP] && asset.approvals[ORG2_MSP].approved;
        const hasOrg3Approval = asset.approvals[ORG3_MSP] && asset.approvals[ORG3_MSP].approved;

        if (hasOrg2Approval && hasOrg3Approval) {
            asset.status = STATUS.APPROVED;
        }

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));

        console.info(`Asset ${assetID} approved by ${clientMSP}`);
        return asset;
    }

    /**
     * Reject an asset (Org2 or Org3 only)
     * 
     * Records the rejection and immediately finalizes the asset.
     * Note: Already approved assets cannot be rejected (state machine enforcement).
     * 
     * @param {Context} ctx - Transaction context
     * @param {string} assetID - Asset identifier
     * @param {string} reason - Rejection reason
     * @returns {Object} - Updated asset
     */
    async RejectAsset(ctx, assetID, reason) {
        // Organization-based access control - only Org2 or Org3 can reject
        this._verifyApprover(ctx);

        // Get existing asset
        const asset = await this._getAsset(ctx, assetID);
        const clientMSP = this._getClientMSP(ctx);

        // State machine guard: approved assets cannot be rejected
        if (asset.status === STATUS.APPROVED) {
            throw new Error(`Cannot reject approved asset. Asset ${assetID} was already approved.`);
        }

        // State machine guard: already rejected assets don't need re-rejection
        if (asset.status === STATUS.REJECTED) {
            throw new Error(`Asset ${assetID} is already rejected.`);
        }

        // Record rejection
        asset.approvals[clientMSP] = {
            approved: false,
            reason: reason,
            timestamp: this._getTimestamp(ctx)
        };

        asset.status = STATUS.REJECTED;
        asset.updatedAt = this._getTimestamp(ctx);

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));

        console.info(`Asset ${assetID} rejected by ${clientMSP}: ${reason}`);
        return asset;
    }

    // ============================================================================
    // QUERY FUNCTIONS (All Orgs)
    // ============================================================================

    /**
     * Query a single asset (public data)
     * 
     * @param {Context} ctx - Transaction context
     * @param {string} assetID - Asset identifier
     * @returns {Object} - Asset public data
     */
    async QueryAsset(ctx, assetID) {
        const asset = await this._getAsset(ctx, assetID);
        return asset;
    }

    /**
     * Query private asset details (Org1 and Org2 only)
     * 
     * @param {Context} ctx - Transaction context
     * @param {string} assetID - Asset identifier
     * @returns {Object} - Asset private data
     */
    async QueryPrivateDetails(ctx, assetID) {
        // Access control - only Org1 and Org2 can access private data
        this._verifyPrivateDataAccess(ctx);

        const privateDataBuffer = await ctx.stub.getPrivateData(PRIVATE_COLLECTION, assetID);

        if (!privateDataBuffer || privateDataBuffer.length === 0) {
            throw new Error(`Private data for asset ${assetID} does not exist`);
        }

        return JSON.parse(privateDataBuffer.toString());
    }

    /**
     * Get all assets
     * 
     * @param {Context} ctx - Transaction context
     * @returns {Array} - Array of all assets
     */
    async GetAllAssets(ctx) {
        const allResults = [];

        // Use CouchDB rich query
        const queryString = {
            selector: {
                docType: 'asset'
            }
        };

        const iterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
        let result = await iterator.next();

        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push(record);
            result = await iterator.next();
        }

        await iterator.close();
        return allResults;
    }

    /**
     * Get asset history (audit trail)
     * 
     * @param {Context} ctx - Transaction context
     * @param {string} assetID - Asset identifier
     * @returns {Array} - History of asset changes
     */
    async GetAssetHistory(ctx, assetID) {
        const allResults = [];
        const iterator = await ctx.stub.getHistoryForKey(assetID);
        let result = await iterator.next();

        while (!result.done) {
            const record = {
                txId: result.value.txId,
                timestamp: result.value.timestamp,
                isDelete: result.value.isDelete
            };

            if (!result.value.isDelete) {
                record.value = JSON.parse(result.value.value.toString());
            }

            allResults.push(record);
            result = await iterator.next();
        }

        await iterator.close();
        return allResults;
    }

    /**
     * Get assets by status
     * 
     * @param {Context} ctx - Transaction context
     * @param {string} status - Status to filter by
     * @returns {Array} - Assets with matching status
     */
    async GetAssetsByStatus(ctx, status) {
        const queryString = {
            selector: {
                docType: 'asset',
                status: status
            }
        };

        const iterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
        const allResults = [];
        let result = await iterator.next();

        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            allResults.push(JSON.parse(strValue));
            result = await iterator.next();
        }

        await iterator.close();
        return allResults;
    }

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    /**
     * Check if an asset exists
     * 
     * @param {Context} ctx - Transaction context
     * @param {string} assetID - Asset identifier
     * @returns {boolean} - True if exists
     */
    async AssetExists(ctx, assetID) {
        const assetJSON = await ctx.stub.getState(assetID);
        return assetJSON && assetJSON.length > 0;
    }

    /**
     * Get an asset by ID (internal helper)
     * 
     * @param {Context} ctx - Transaction context
     * @param {string} assetID - Asset identifier
     * @returns {Object} - Asset data
     * @throws Error if asset not found
     */
    async _getAsset(ctx, assetID) {
        const assetJSON = await ctx.stub.getState(assetID);

        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Asset ${assetID} does not exist`);
        }

        return JSON.parse(assetJSON.toString());
    }

    /**
     * Delete an asset (Org1 only)
     * 
     * IMPORTANT: DeleteAsset is an administrative cleanup operation available
     * only to Org1 and is not part of the normal approval workflow.
     * Use with caution as this permanently removes the asset.
     * 
     * @param {Context} ctx - Transaction context
     * @param {string} assetID - Asset identifier
     */
    async DeleteAsset(ctx, assetID) {
        // Organization-based access control - only Org1 can delete
        this._verifyOrg1(ctx);

        const exists = await this.AssetExists(ctx, assetID);
        if (!exists) {
            throw new Error(`Asset ${assetID} does not exist`);
        }

        // Delete public data
        await ctx.stub.deleteState(assetID);

        // Delete private data if exists
        try {
            await ctx.stub.deletePrivateData(PRIVATE_COLLECTION, assetID);
        } catch (err) {
            // Private data might not exist, ignore error
        }

        console.info(`Asset ${assetID} deleted (administrative cleanup)`);
    }
}

module.exports = AssetContract;
