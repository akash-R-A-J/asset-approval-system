/*
 * Copyright IBM Corp. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Transaction Invocation Functions
 * 
 * Submits transactions to the chaincode for asset lifecycle operations.
 */

'use strict';

const { connectToNetwork, disconnect } = require('./gateway');

/**
 * Create a new asset (Org1 only)
 * @param {string} org - Organization
 * @param {string} userId - User ID
 * @param {string} assetID - Asset ID
 * @param {object} privateData - Private data (description, notes, etc.)
 */
async function createAsset(org, userId, assetID, privateData = {}) {
    let gateway;
    try {
        const { gateway: gw, contract } = await connectToNetwork(org, userId);
        gateway = gw;

        console.log(`\nCreating asset ${assetID}...`);

        // Prepare transient data for private data
        const transientData = {
            asset_properties: Buffer.from(JSON.stringify(privateData))
        };

        // Submit transaction
        const result = await contract.createTransaction('CreateAsset')
            .setTransient(transientData)
            .submit(assetID);

        console.log('✓ Asset created successfully');
        return JSON.parse(result.toString());

    } finally {
        disconnect(gateway);
    }
}

/**
 * Update asset status (Org1 only)
 * @param {string} org - Organization
 * @param {string} userId - User ID
 * @param {string} assetID - Asset ID
 * @param {string} newStatus - New status (PENDING, APPROVED, REJECTED)
 */
async function updateAssetStatus(org, userId, assetID, newStatus) {
    let gateway;
    try {
        const { gateway: gw, contract } = await connectToNetwork(org, userId);
        gateway = gw;

        console.log(`\nUpdating asset ${assetID} status to ${newStatus}...`);

        const result = await contract.submitTransaction('UpdateAssetStatus', assetID, newStatus);

        console.log('✓ Asset status updated successfully');
        return JSON.parse(result.toString());

    } finally {
        disconnect(gateway);
    }
}

/**
 * Add private details to asset (Org1 only)
 * @param {string} org - Organization
 * @param {string} userId - User ID
 * @param {string} assetID - Asset ID
 * @param {object} privateData - Private data
 */
async function addPrivateDetails(org, userId, assetID, privateData) {
    let gateway;
    try {
        const { gateway: gw, contract } = await connectToNetwork(org, userId);
        gateway = gw;

        console.log(`\nAdding private details to asset ${assetID}...`);

        const transientData = {
            asset_properties: Buffer.from(JSON.stringify(privateData))
        };

        await contract.createTransaction('AddPrivateDetails')
            .setTransient(transientData)
            .submit(assetID);

        console.log('✓ Private details added successfully');

    } finally {
        disconnect(gateway);
    }
}

/**
 * Approve an asset (Org2 or Org3 only)
 * @param {string} org - Organization
 * @param {string} userId - User ID
 * @param {string} assetID - Asset ID
 */
async function approveAsset(org, userId, assetID) {
    let gateway;
    try {
        const { gateway: gw, contract } = await connectToNetwork(org, userId);
        gateway = gw;

        console.log(`\nApproving asset ${assetID} as ${org}...`);

        const result = await contract.submitTransaction('ApproveAsset', assetID);

        console.log('✓ Asset approved successfully');
        return JSON.parse(result.toString());

    } finally {
        disconnect(gateway);
    }
}

/**
 * Reject an asset (Org2 or Org3 only)
 * @param {string} org - Organization
 * @param {string} userId - User ID
 * @param {string} assetID - Asset ID
 * @param {string} reason - Rejection reason
 */
async function rejectAsset(org, userId, assetID, reason) {
    let gateway;
    try {
        const { gateway: gw, contract } = await connectToNetwork(org, userId);
        gateway = gw;

        console.log(`\nRejecting asset ${assetID} as ${org}...`);

        const result = await contract.submitTransaction('RejectAsset', assetID, reason);

        console.log('✓ Asset rejected');
        return JSON.parse(result.toString());

    } finally {
        disconnect(gateway);
    }
}

/**
 * Delete an asset (Org1 only)
 * @param {string} org - Organization
 * @param {string} userId - User ID
 * @param {string} assetID - Asset ID
 */
async function deleteAsset(org, userId, assetID) {
    let gateway;
    try {
        const { gateway: gw, contract } = await connectToNetwork(org, userId);
        gateway = gw;

        console.log(`\nDeleting asset ${assetID}...`);

        await contract.submitTransaction('DeleteAsset', assetID);

        console.log('✓ Asset deleted successfully');

    } finally {
        disconnect(gateway);
    }
}

module.exports = {
    createAsset,
    updateAssetStatus,
    addPrivateDetails,
    approveAsset,
    rejectAsset,
    deleteAsset
};
