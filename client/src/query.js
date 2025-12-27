/*
 * Copyright IBM Corp. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Query Functions
 * 
 * Evaluates transactions to query asset data from the ledger.
 */

'use strict';

const { connectToNetwork, disconnect } = require('./gateway');

/**
 * Query a single asset (public data)
 * @param {string} org - Organization
 * @param {string} userId - User ID
 * @param {string} assetID - Asset ID
 * @returns {object} Asset data
 */
async function queryAsset(org, userId, assetID) {
    let gateway;
    try {
        const { gateway: gw, contract } = await connectToNetwork(org, userId);
        gateway = gw;

        console.log(`\nQuerying asset ${assetID}...`);

        const result = await contract.evaluateTransaction('QueryAsset', assetID);

        const asset = JSON.parse(result.toString());
        console.log('Asset data:');
        console.log(JSON.stringify(asset, null, 2));
        return asset;

    } finally {
        disconnect(gateway);
    }
}

/**
 * Query private asset details (Org1 and Org2 only)
 * @param {string} org - Organization
 * @param {string} userId - User ID
 * @param {string} assetID - Asset ID
 * @returns {object} Private asset data
 */
async function queryPrivateDetails(org, userId, assetID) {
    let gateway;
    try {
        const { gateway: gw, contract } = await connectToNetwork(org, userId);
        gateway = gw;

        console.log(`\nQuerying private details for asset ${assetID}...`);

        const result = await contract.evaluateTransaction('QueryPrivateDetails', assetID);

        const privateData = JSON.parse(result.toString());
        console.log('Private data:');
        console.log(JSON.stringify(privateData, null, 2));
        return privateData;

    } finally {
        disconnect(gateway);
    }
}

/**
 * Get all assets
 * @param {string} org - Organization
 * @param {string} userId - User ID
 * @returns {array} Array of assets
 */
async function getAllAssets(org, userId) {
    let gateway;
    try {
        const { gateway: gw, contract } = await connectToNetwork(org, userId);
        gateway = gw;

        console.log('\nQuerying all assets...');

        const result = await contract.evaluateTransaction('GetAllAssets');

        const assets = JSON.parse(result.toString());
        console.log(`Found ${assets.length} asset(s)`);
        console.log(JSON.stringify(assets, null, 2));
        return assets;

    } finally {
        disconnect(gateway);
    }
}

/**
 * Get asset history (audit trail)
 * @param {string} org - Organization
 * @param {string} userId - User ID
 * @param {string} assetID - Asset ID
 * @returns {array} History of changes
 */
async function getAssetHistory(org, userId, assetID) {
    let gateway;
    try {
        const { gateway: gw, contract } = await connectToNetwork(org, userId);
        gateway = gw;

        console.log(`\nQuerying history for asset ${assetID}...`);

        const result = await contract.evaluateTransaction('GetAssetHistory', assetID);

        const history = JSON.parse(result.toString());
        console.log(`Found ${history.length} history record(s)`);
        console.log(JSON.stringify(history, null, 2));
        return history;

    } finally {
        disconnect(gateway);
    }
}

/**
 * Get assets by status
 * @param {string} org - Organization
 * @param {string} userId - User ID
 * @param {string} status - Status to filter by
 * @returns {array} Assets with matching status
 */
async function getAssetsByStatus(org, userId, status) {
    let gateway;
    try {
        const { gateway: gw, contract } = await connectToNetwork(org, userId);
        gateway = gw;

        console.log(`\nQuerying assets with status: ${status}...`);

        const result = await contract.evaluateTransaction('GetAssetsByStatus', status);

        const assets = JSON.parse(result.toString());
        console.log(`Found ${assets.length} asset(s) with status "${status}"`);
        console.log(JSON.stringify(assets, null, 2));
        return assets;

    } finally {
        disconnect(gateway);
    }
}

/**
 * Check if asset exists
 * @param {string} org - Organization
 * @param {string} userId - User ID
 * @param {string} assetID - Asset ID
 * @returns {boolean} True if exists
 */
async function assetExists(org, userId, assetID) {
    let gateway;
    try {
        const { gateway: gw, contract } = await connectToNetwork(org, userId);
        gateway = gw;

        const result = await contract.evaluateTransaction('AssetExists', assetID);

        return result.toString() === 'true';

    } finally {
        disconnect(gateway);
    }
}

module.exports = {
    queryAsset,
    queryPrivateDetails,
    getAllAssets,
    getAssetHistory,
    getAssetsByStatus,
    assetExists
};
