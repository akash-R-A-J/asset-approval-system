/*
 * SPDX-License-Identifier: Apache-2.0
 * Asset Approval Chaincode - TypeScript
 * 
 * Features:
 * - ABAC (Attribute-Based Access Control)
 * - Explicit State Machine
 * - Private Data Collections
 */

import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';

// ===========================================================================
// Types and Interfaces
// ===========================================================================

export enum AssetStatus {
    CREATED = 'CREATED',
    PENDING_APPROVAL = 'PENDING_APPROVAL',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    ACTIVE = 'ACTIVE',
    DELETED = 'DELETED'
}

export interface Asset {
    docType: string;
    assetID: string;
    description: string;
    owner: string;
    status: AssetStatus;
    approvals: { [key: string]: string };
    createdAt: string;
    updatedAt: string;
}

export interface PrivateAssetData {
    assetID: string;
    confidentialNotes: string;
    internalValue: number;
}

// Role constants for ABAC
const ROLE_ASSET_OWNER = 'asset_owner';
const ROLE_AUDITOR = 'auditor';
const ROLE_REGULATOR = 'regulator';

// Valid state transitions
const VALID_TRANSITIONS: { [key: string]: AssetStatus[] } = {
    [AssetStatus.CREATED]: [AssetStatus.PENDING_APPROVAL, AssetStatus.DELETED],
    [AssetStatus.PENDING_APPROVAL]: [AssetStatus.APPROVED, AssetStatus.REJECTED],
    [AssetStatus.APPROVED]: [AssetStatus.ACTIVE, AssetStatus.DELETED],
    [AssetStatus.REJECTED]: [AssetStatus.PENDING_APPROVAL, AssetStatus.DELETED],
    [AssetStatus.ACTIVE]: [AssetStatus.DELETED],
};

// ===========================================================================
// Smart Contract
// ===========================================================================

@Info({ title: 'AssetApproval', description: 'Asset Approval Smart Contract' })
export class AssetApprovalContract extends Contract {

    // ===========================================================================
    // Access Control (ABAC - Role derived from MSP ID)
    // ===========================================================================

    private getRoleFromMSP(mspId: string): string {
        // Derive role from MSP ID since cryptogen doesn't support certificate attributes
        const mspRoleMap: { [key: string]: string } = {
            'Org1MSP': ROLE_ASSET_OWNER,
            'Org2MSP': ROLE_AUDITOR,
            'Org3MSP': ROLE_REGULATOR
        };
        return mspRoleMap[mspId] || '';
    }

    private async requireRole(ctx: Context, allowedRoles: string[]): Promise<void> {
        const mspId = ctx.clientIdentity.getMSPID();
        const role = this.getRoleFromMSP(mspId);

        if (!role) {
            throw new Error(`Unknown organization: ${mspId}`);
        }

        if (!allowedRoles.includes(role)) {
            throw new Error(`Role '${role}' (${mspId}) not authorized. Allowed: ${allowedRoles.join(', ')}`);
        }
    }

    private getClientMSP(ctx: Context): string {
        return ctx.clientIdentity.getMSPID();
    }

    private getClientRole(ctx: Context): string {
        return this.getRoleFromMSP(ctx.clientIdentity.getMSPID());
    }

    /**
     * Input validation for asset creation and updates
     */
    private validateAssetInput(assetID: string, description: string): void {
        // Validate asset ID
        if (!assetID || assetID.trim().length === 0) {
            throw new Error('Asset ID cannot be empty');
        }
        if (assetID.length > 64) {
            throw new Error('Asset ID exceeds maximum length of 64 characters');
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(assetID)) {
            throw new Error('Asset ID contains invalid characters. Only alphanumeric, underscore, and hyphen allowed');
        }

        // Validate description
        if (!description || description.trim().length === 0) {
            throw new Error('Description cannot be empty');
        }
        if (description.length > 1024) {
            throw new Error('Description exceeds maximum length of 1024 characters');
        }
    }

    /**
     * Get deterministic timestamp from transaction (same across all peers)
     */
    private getTimestamp(ctx: Context): string {
        const txTimestamp = ctx.stub.getTxTimestamp();
        const seconds = txTimestamp.seconds.toNumber ? txTimestamp.seconds.toNumber() : Number(txTimestamp.seconds);
        return new Date(seconds * 1000).toISOString();
    }

    // ===========================================================================
    // State Machine Validation
    // ===========================================================================

    private validateTransition(current: AssetStatus, next: AssetStatus): void {
        const allowed = VALID_TRANSITIONS[current];
        if (!allowed || !allowed.includes(next)) {
            throw new Error(`Invalid state transition: ${current} -> ${next}`);
        }
    }

    // ===========================================================================
    // Asset Lifecycle Operations
    // ===========================================================================

    @Transaction()
    public async CreateAsset(ctx: Context, assetID: string, description: string): Promise<void> {
        // Input validation
        this.validateAssetInput(assetID, description);

        // ABAC check
        await this.requireRole(ctx, [ROLE_ASSET_OWNER]);

        // Check if exists
        const exists = await this.AssetExists(ctx, assetID);
        if (exists) {
            throw new Error(`Asset ${assetID} already exists`);
        }

        const mspID = this.getClientMSP(ctx);
        const now = this.getTimestamp(ctx);

        const asset: Asset = {
            docType: 'asset',
            assetID,
            description,
            owner: mspID,
            status: AssetStatus.CREATED,
            approvals: {
                'Org2MSP': 'PENDING',
                'Org3MSP': 'PENDING'
            },
            createdAt: now,
            updatedAt: now
        };

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    @Transaction()
    public async CreateAssetWithPrivateData(ctx: Context, assetID: string, description: string): Promise<void> {
        // ABAC check
        await this.requireRole(ctx, [ROLE_ASSET_OWNER]);

        // Create public asset first
        await this.CreateAsset(ctx, assetID, description);

        // Get private data from transient map
        const transientMap = ctx.stub.getTransient();
        const privateDataBuffer = transientMap.get('asset_private_data');

        if (privateDataBuffer && privateDataBuffer.length > 0) {
            const privateData: PrivateAssetData = JSON.parse(privateDataBuffer.toString());
            privateData.assetID = assetID;

            await ctx.stub.putPrivateData(
                'assetPrivateOrg1Org2',
                assetID,
                Buffer.from(JSON.stringify(privateData))
            );
        }
    }

    @Transaction()
    public async SubmitForApproval(ctx: Context, assetID: string): Promise<void> {
        await this.requireRole(ctx, [ROLE_ASSET_OWNER]);

        const asset = await this.ReadAsset(ctx, assetID);

        // Validate transition
        this.validateTransition(asset.status, AssetStatus.PENDING_APPROVAL);

        // Verify ownership
        const mspID = this.getClientMSP(ctx);
        if (asset.owner !== mspID) {
            throw new Error('Only asset owner can submit for approval');
        }

        asset.status = AssetStatus.PENDING_APPROVAL;
        asset.updatedAt = this.getTimestamp(ctx);
        asset.approvals = {
            'Org2MSP': 'PENDING',
            'Org3MSP': 'PENDING'
        };

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    @Transaction()
    public async ApproveAsset(ctx: Context, assetID: string): Promise<void> {
        await this.requireRole(ctx, [ROLE_AUDITOR, ROLE_REGULATOR]);

        const asset = await this.ReadAsset(ctx, assetID);

        if (asset.status !== AssetStatus.PENDING_APPROVAL) {
            throw new Error(`Asset must be PENDING_APPROVAL to approve (current: ${asset.status})`);
        }

        const mspID = this.getClientMSP(ctx);
        asset.approvals[mspID] = 'APPROVED';
        asset.updatedAt = this.getTimestamp(ctx);

        // Check if all approvals complete
        const allApproved = Object.values(asset.approvals).every(s => s === 'APPROVED');
        if (allApproved) {
            asset.status = AssetStatus.APPROVED;
        }

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    @Transaction()
    public async RejectAsset(ctx: Context, assetID: string, reason: string): Promise<void> {
        await this.requireRole(ctx, [ROLE_AUDITOR, ROLE_REGULATOR]);

        const asset = await this.ReadAsset(ctx, assetID);

        if (asset.status !== AssetStatus.PENDING_APPROVAL) {
            throw new Error(`Asset must be PENDING_APPROVAL to reject (current: ${asset.status})`);
        }

        const mspID = this.getClientMSP(ctx);
        asset.approvals[mspID] = `REJECTED: ${reason}`;
        asset.status = AssetStatus.REJECTED;
        asset.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    @Transaction()
    public async ActivateAsset(ctx: Context, assetID: string): Promise<void> {
        await this.requireRole(ctx, [ROLE_ASSET_OWNER]);

        const asset = await this.ReadAsset(ctx, assetID);
        this.validateTransition(asset.status, AssetStatus.ACTIVE);

        const mspID = this.getClientMSP(ctx);
        if (asset.owner !== mspID) {
            throw new Error('Only asset owner can activate');
        }

        asset.status = AssetStatus.ACTIVE;
        asset.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    @Transaction()
    public async UpdateAsset(ctx: Context, assetID: string, newDescription: string): Promise<void> {
        // Validate new description
        if (!newDescription || newDescription.trim().length === 0) {
            throw new Error('Description cannot be empty');
        }
        if (newDescription.length > 1024) {
            throw new Error('Description exceeds maximum length of 1024 characters');
        }

        await this.requireRole(ctx, [ROLE_ASSET_OWNER]);

        const asset = await this.ReadAsset(ctx, assetID);

        if (asset.status !== AssetStatus.CREATED && asset.status !== AssetStatus.REJECTED) {
            throw new Error(`Can only update in CREATED or REJECTED status (current: ${asset.status})`);
        }

        const mspID = this.getClientMSP(ctx);
        if (asset.owner !== mspID) {
            throw new Error('Only asset owner can update');
        }

        asset.description = newDescription;
        asset.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    @Transaction()
    public async DeleteAsset(ctx: Context, assetID: string): Promise<void> {
        await this.requireRole(ctx, [ROLE_ASSET_OWNER]);

        const asset = await this.ReadAsset(ctx, assetID);
        this.validateTransition(asset.status, AssetStatus.DELETED);

        const mspID = this.getClientMSP(ctx);
        if (asset.owner !== mspID) {
            throw new Error('Only asset owner can delete');
        }

        asset.status = AssetStatus.DELETED;
        asset.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    // ===========================================================================
    // Query Operations
    // ===========================================================================

    @Transaction(false)
    @Returns('Asset')
    public async ReadAsset(ctx: Context, assetID: string): Promise<Asset> {
        const assetBuffer = await ctx.stub.getState(assetID);
        if (!assetBuffer || assetBuffer.length === 0) {
            throw new Error(`Asset ${assetID} does not exist`);
        }
        return JSON.parse(assetBuffer.toString()) as Asset;
    }

    @Transaction(false)
    @Returns('string')
    public async QueryAsset(ctx: Context, assetID: string): Promise<string> {
        const asset = await this.ReadAsset(ctx, assetID);
        return JSON.stringify(asset);
    }

    @Transaction(false)
    @Returns('string')
    public async QueryAllAssets(ctx: Context): Promise<string> {
        const queryString = JSON.stringify({
            selector: { docType: 'asset' }
        });
        return await this.queryWithQueryString(ctx, queryString);
    }

    @Transaction(false)
    @Returns('string')
    public async QueryAssetsByStatus(ctx: Context, status: string): Promise<string> {
        const queryString = JSON.stringify({
            selector: { docType: 'asset', status }
        });
        return await this.queryWithQueryString(ctx, queryString);
    }

    @Transaction(false)
    @Returns('string')
    public async QueryAssetsByOwner(ctx: Context, owner: string): Promise<string> {
        const queryString = JSON.stringify({
            selector: { docType: 'asset', owner }
        });
        return await this.queryWithQueryString(ctx, queryString);
    }

    @Transaction(false)
    @Returns('string')
    public async GetAssetHistory(ctx: Context, assetID: string): Promise<string> {
        const iterator = await ctx.stub.getHistoryForKey(assetID);
        const history: any[] = [];

        let result = await iterator.next();
        while (!result.done) {
            const record: any = {
                txId: result.value.txId,
                timestamp: result.value.timestamp,
                isDelete: result.value.isDelete
            };

            if (result.value.value && result.value.value.length > 0) {
                record.value = JSON.parse(result.value.value.toString());
            }

            history.push(record);
            result = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify(history);
    }

    @Transaction(false)
    @Returns('string')
    public async ReadPrivateData(ctx: Context, assetID: string): Promise<string> {
        // First verify the asset exists (prevent info leakage about which assets have private data)
        const exists = await this.AssetExists(ctx, assetID);
        if (!exists) {
            throw new Error(`Asset ${assetID} does not exist`);
        }

        const mspID = this.getClientMSP(ctx);
        if (mspID !== 'Org1MSP' && mspID !== 'Org2MSP') {
            throw new Error(`Private data access denied for ${mspID}`);
        }

        const privateData = await ctx.stub.getPrivateData('assetPrivateOrg1Org2', assetID);
        if (!privateData || privateData.length === 0) {
            throw new Error(`Private data for asset ${assetID} does not exist`);
        }

        return privateData.toString();
    }

    // ===========================================================================
    // Helper Functions
    // ===========================================================================

    @Transaction(false)
    @Returns('boolean')
    public async AssetExists(ctx: Context, assetID: string): Promise<boolean> {
        const assetBuffer = await ctx.stub.getState(assetID);
        return assetBuffer && assetBuffer.length > 0;
    }

    private async queryWithQueryString(ctx: Context, queryString: string): Promise<string> {
        const iterator = await ctx.stub.getQueryResult(queryString);
        const results: Asset[] = [];

        let result = await iterator.next();
        while (!result.done) {
            if (result.value.value && result.value.value.length > 0) {
                results.push(JSON.parse(result.value.value.toString()));
            }
            result = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify(results);
    }
}
