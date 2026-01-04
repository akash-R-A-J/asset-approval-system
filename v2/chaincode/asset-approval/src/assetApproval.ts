/*
 * SPDX-License-Identifier: Apache-2.0
 * Asset Approval Chaincode v2 - True ABAC Implementation
 * 
 * Features:
 * - TRUE ABAC using X.509 certificate attributes
 * - Organization-agnostic (no hardcoded org names)
 * - Extensible approval model
 * - Config-only org addition
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
    status: AssetStatus;
    owner: string;           // Creator's cert fingerprint (for ownership verification)
    createdBy: string;       // MSP ID for audit metadata ONLY (never used for authorization)

    // EXTENSIBLE: Map of role → approval status
    // Adding role=supervisor tomorrow? No schema change needed.
    approvals: {
        [role: string]: boolean | string;  // true/false or 'PENDING' or 'REJECTED: reason'
    };

    requiredApprovals: string[];  // Roles required to approve (configurable)

    createdAt: string;
    updatedAt: string;
}

export interface PrivateAssetData {
    assetID: string;
    confidentialNotes: string;
    internalValue: number;
}

// Required approval roles (can be configured at deployment)
const REQUIRED_APPROVER_ROLES = ['auditor', 'regulator'];

// Roles that can access private data
const PRIVATE_DATA_ROLES = ['owner', 'auditor'];

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

@Info({ title: 'AssetApprovalV2', description: 'Asset Approval Smart Contract v2 - True ABAC' })
export class AssetApprovalContract extends Contract {

    // ===========================================================================
    // TRUE ABAC - Role from Certificate Attributes
    // ===========================================================================

    /**
     * Get role from X.509 certificate attribute
     * This is TRUE ABAC - no MSP ID mapping!
     */
    private getRole(ctx: Context): string {
        const role = ctx.clientIdentity.getAttributeValue('role');
        if (!role) {
            throw new Error('Certificate missing "role" attribute. Ensure Fabric CA issued cert with role attribute.');
        }
        return role;
    }

    /**
     * Require caller to have one of the allowed roles
     */
    private requireRole(ctx: Context, allowedRoles: string[]): void {
        const role = this.getRole(ctx);
        if (!allowedRoles.includes(role)) {
            throw new Error(`Role '${role}' not authorized. Allowed: ${allowedRoles.join(', ')}`);
        }
    }

    /**
     * Get MSP ID for audit purposes only (NEVER for authorization)
     */
    private getAuditMSP(ctx: Context): string {
        return ctx.clientIdentity.getMSPID();
    }

    /**
     * Get unique owner identifier from certificate
     */
    private getOwnerFingerprint(ctx: Context): string {
        // Use certificate's subject + issuer hash as unique identifier
        const id = ctx.clientIdentity.getID();
        return Buffer.from(id).toString('base64').substring(0, 44);
    }

    /**
     * Input validation for asset creation and updates
     */
    private validateAssetInput(assetID: string, description: string): void {
        if (!assetID || assetID.trim().length === 0) {
            throw new Error('Asset ID cannot be empty');
        }
        if (assetID.length > 64) {
            throw new Error('Asset ID exceeds maximum length of 64 characters');
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(assetID)) {
            throw new Error('Asset ID contains invalid characters');
        }
        if (!description || description.trim().length === 0) {
            throw new Error('Description cannot be empty');
        }
        if (description.length > 1024) {
            throw new Error('Description exceeds maximum length of 1024 characters');
        }
    }

    /**
     * Get deterministic timestamp from transaction
     */
    private getTimestamp(ctx: Context): string {
        const txTimestamp = ctx.stub.getTxTimestamp();
        const seconds = parseInt(txTimestamp.seconds.toString(), 10);
        return new Date(seconds * 1000).toISOString();
    }

    /**
     * Validate state transition
     */
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

        // TRUE ABAC: Check role from certificate
        this.requireRole(ctx, ['owner']);

        // Check if exists
        const exists = await this.AssetExists(ctx, assetID);
        if (exists) {
            throw new Error(`Asset ${assetID} already exists`);
        }

        const now = this.getTimestamp(ctx);

        // Build initial approvals map from required roles
        const approvals: { [role: string]: boolean | string } = {};
        for (const role of REQUIRED_APPROVER_ROLES) {
            approvals[role] = 'PENDING';
        }

        const asset: Asset = {
            docType: 'asset',
            assetID,
            description,
            owner: this.getOwnerFingerprint(ctx),
            createdBy: this.getAuditMSP(ctx),  // Audit only, never for auth
            status: AssetStatus.CREATED,
            approvals,
            requiredApprovals: REQUIRED_APPROVER_ROLES,
            createdAt: now,
            updatedAt: now
        };

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    @Transaction()
    public async CreateAssetWithPrivateData(ctx: Context, assetID: string, description: string): Promise<void> {
        // Create public asset first
        await this.CreateAsset(ctx, assetID, description);

        // Get private data from transient map
        const transientMap = ctx.stub.getTransient();
        const privateDataBuffer = transientMap.get('asset_private_data');

        if (privateDataBuffer && privateDataBuffer.length > 0) {
            const privateData: PrivateAssetData = JSON.parse(privateDataBuffer.toString());

            // SEC-001 FIX: Validate private data structure
            if (!privateData.confidentialNotes || typeof privateData.confidentialNotes !== 'string') {
                throw new Error('Private data must include confidentialNotes (string)');
            }
            if (privateData.internalValue !== undefined && typeof privateData.internalValue !== 'number') {
                throw new Error('internalValue must be a number');
            }

            privateData.assetID = assetID;

            await ctx.stub.putPrivateData(
                'assetPrivateDetails',
                assetID,
                Buffer.from(JSON.stringify(privateData))
            );
        }
    }

    @Transaction()
    public async SubmitForApproval(ctx: Context, assetID: string): Promise<void> {
        this.requireRole(ctx, ['owner']);

        const asset = await this.ReadAsset(ctx, assetID);
        this.validateTransition(asset.status, AssetStatus.PENDING_APPROVAL);

        // Verify ownership using cert fingerprint (not MSP!)
        const callerFingerprint = this.getOwnerFingerprint(ctx);
        if (asset.owner !== callerFingerprint) {
            throw new Error('Only asset owner can submit for approval');
        }

        // Reset approvals for fresh cycle
        for (const role of asset.requiredApprovals) {
            asset.approvals[role] = 'PENDING';
        }

        asset.status = AssetStatus.PENDING_APPROVAL;
        asset.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    @Transaction()
    public async ApproveAsset(ctx: Context, assetID: string): Promise<void> {
        // TRUE ABAC: Any approver role can approve
        const callerRole = this.getRole(ctx);

        if (!REQUIRED_APPROVER_ROLES.includes(callerRole)) {
            throw new Error(`Role '${callerRole}' cannot approve. Required: ${REQUIRED_APPROVER_ROLES.join(', ')}`);
        }

        const asset = await this.ReadAsset(ctx, assetID);

        if (asset.status !== AssetStatus.PENDING_APPROVAL) {
            throw new Error(`Asset must be PENDING_APPROVAL to approve (current: ${asset.status})`);
        }

        // Check if this role already approved
        if (asset.approvals[callerRole] === true) {
            throw new Error(`Role '${callerRole}' has already approved this asset`);
        }

        // Record approval by ROLE (not org!)
        asset.approvals[callerRole] = true;
        asset.updatedAt = this.getTimestamp(ctx);

        // Check if all required approvals are complete
        const allApproved = asset.requiredApprovals.every(role => asset.approvals[role] === true);
        if (allApproved) {
            asset.status = AssetStatus.APPROVED;
        }

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    @Transaction()
    public async RejectAsset(ctx: Context, assetID: string, reason: string): Promise<void> {
        const callerRole = this.getRole(ctx);

        if (!REQUIRED_APPROVER_ROLES.includes(callerRole)) {
            throw new Error(`Role '${callerRole}' cannot reject. Required: ${REQUIRED_APPROVER_ROLES.join(', ')}`);
        }

        if (!reason || reason.trim().length === 0) {
            throw new Error('Rejection reason is required');
        }

        const asset = await this.ReadAsset(ctx, assetID);

        if (asset.status !== AssetStatus.PENDING_APPROVAL) {
            throw new Error(`Asset must be PENDING_APPROVAL to reject (current: ${asset.status})`);
        }

        // SEC-002 FIX: Store rejection as string to match type
        asset.approvals[callerRole] = `REJECTED: ${reason.substring(0, 500)} (${this.getTimestamp(ctx)})`;

        asset.status = AssetStatus.REJECTED;
        asset.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    @Transaction()
    public async ActivateAsset(ctx: Context, assetID: string): Promise<void> {
        this.requireRole(ctx, ['owner']);

        const asset = await this.ReadAsset(ctx, assetID);
        this.validateTransition(asset.status, AssetStatus.ACTIVE);

        const callerFingerprint = this.getOwnerFingerprint(ctx);
        if (asset.owner !== callerFingerprint) {
            throw new Error('Only asset owner can activate');
        }

        asset.status = AssetStatus.ACTIVE;
        asset.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    @Transaction()
    public async UpdateAsset(ctx: Context, assetID: string, newDescription: string): Promise<void> {
        if (!newDescription || newDescription.trim().length === 0) {
            throw new Error('Description cannot be empty');
        }
        if (newDescription.length > 1024) {
            throw new Error('Description exceeds maximum length');
        }

        this.requireRole(ctx, ['owner']);

        const asset = await this.ReadAsset(ctx, assetID);

        if (asset.status !== AssetStatus.CREATED && asset.status !== AssetStatus.REJECTED) {
            throw new Error(`Can only update in CREATED or REJECTED status (current: ${asset.status})`);
        }

        const callerFingerprint = this.getOwnerFingerprint(ctx);
        if (asset.owner !== callerFingerprint) {
            throw new Error('Only asset owner can update');
        }

        asset.description = newDescription;
        asset.updatedAt = this.getTimestamp(ctx);

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(asset)));
    }

    @Transaction()
    public async DeleteAsset(ctx: Context, assetID: string): Promise<void> {
        this.requireRole(ctx, ['owner']);

        const asset = await this.ReadAsset(ctx, assetID);
        this.validateTransition(asset.status, AssetStatus.DELETED);

        const callerFingerprint = this.getOwnerFingerprint(ctx);
        if (asset.owner !== callerFingerprint) {
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
        const asset = JSON.parse(assetBuffer.toString()) as Asset;

        // Filter out DELETED assets
        if (asset.status === AssetStatus.DELETED) {
            throw new Error(`Asset ${assetID} has been deleted`);
        }

        return asset;
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
            selector: {
                docType: 'asset',
                status: { '$ne': AssetStatus.DELETED }
            }
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
    public async GetAssetHistory(ctx: Context, assetID: string): Promise<string> {
        const iterator = await ctx.stub.getHistoryForKey(assetID);

        interface HistoryRecord {
            txId: string;
            timestamp: { seconds: number; nanos: number };
            isDelete: boolean;
            value?: Asset;
        }

        const history: HistoryRecord[] = [];

        let result = await iterator.next();
        while (!result.done) {
            const record: HistoryRecord = {
                txId: result.value.txId,
                timestamp: {
                    seconds: Number(result.value.timestamp?.seconds || 0),
                    nanos: Number(result.value.timestamp?.nanos || 0)
                },
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
        // Verify asset exists first (prevent info leakage)
        const exists = await this.AssetExists(ctx, assetID);
        if (!exists) {
            throw new Error(`Asset ${assetID} does not exist`);
        }

        // TRUE ABAC: Check role for private data access
        const callerRole = this.getRole(ctx);
        if (!PRIVATE_DATA_ROLES.includes(callerRole)) {
            throw new Error(`Role '${callerRole}' cannot access private data`);
        }

        const privateData = await ctx.stub.getPrivateData('assetPrivateDetails', assetID);
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
        if (!assetBuffer || assetBuffer.length === 0) {
            return false;
        }
        // BUG-001 FIX: Wrap in try-catch for corrupted data
        try {
            const asset = JSON.parse(assetBuffer.toString()) as Asset;
            return asset.status !== AssetStatus.DELETED;
        } catch {
            // Treat corrupted data as non-existent
            return false;
        }
    }

    @Transaction(false)
    @Returns('string')
    public async GetCallerInfo(ctx: Context): Promise<string> {
        // Utility function for debugging/testing
        return JSON.stringify({
            role: this.getRole(ctx),
            mspId: this.getAuditMSP(ctx),
            fingerprint: this.getOwnerFingerprint(ctx)
        });
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
