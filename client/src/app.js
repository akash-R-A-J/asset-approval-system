/*
 * Copyright IBM Corp. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Asset Approval CLI Application
 * 
 * Command-line interface for interacting with the Asset Approval chaincode.
 * 
 * Usage:
 *   node app.js <command> <args...>
 * 
 * Commands:
 *   create <assetID> <description> <org> <userId>
 *   approve <assetID> <org> <userId>
 *   reject <assetID> <reason> <org> <userId>
 *   query <assetID> <org> <userId>
 *   queryPrivate <assetID> <org> <userId>
 *   history <assetID> <org> <userId>
 *   list <org> <userId>
 *   delete <assetID> <org> <userId>
 */

'use strict';

const { createAsset, approveAsset, rejectAsset, deleteAsset } = require('./invoke');
const { queryAsset, queryPrivateDetails, getAllAssets, getAssetHistory } = require('./query');

// Import validation functions from config
const { validateAssetId, validateDescription, validateReason, getOrgConfig } = require('./config');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
    console.log(`
Asset Approval System - CLI Application

Usage: node app.js <command> [arguments]

Commands:
  create <assetID> <description> <org> <userId>
      Create a new asset (Org1 only)
      Example: node app.js create ASSET001 "Manufacturing Equipment" org1 admin

  approve <assetID> <org> <userId>
      Approve an asset (Org2 or Org3 only)
      Example: node app.js approve ASSET001 org2 admin

  reject <assetID> <reason> <org> <userId>
      Reject an asset (Org2 or Org3 only)
      Example: node app.js reject ASSET001 "Missing documents" org3 admin

  query <assetID> <org> <userId>
      Query public asset data
      Example: node app.js query ASSET001 org1 admin

  queryPrivate <assetID> <org> <userId>
      Query private asset data (Org1 or Org2 only)
      Example: node app.js queryPrivate ASSET001 org1 admin

  history <assetID> <org> <userId>
      Get asset history (audit trail)
      Example: node app.js history ASSET001 org1 admin

  list <org> <userId>
      List all assets
      Example: node app.js list org1 admin

  delete <assetID> <org> <userId>
      Delete an asset (Org1 only)
      Example: node app.js delete ASSET001 org1 admin

Organizations:
  org1 - Asset Owner (can create, update, delete assets)
  org2 - Auditor (can approve/reject, view private data)
  org3 - Regulator (can approve/reject, view public data only)

Asset ID Format:
  - 1-64 characters
  - Alphanumeric, underscores, and hyphens only
  - Example: ASSET001, my-asset_123
    `);
}

/**
 * Validate organization parameter
 * @param {string} org - Organization name
 * @throws {Error} - If invalid
 */
function validateOrg(org) {
    try {
        getOrgConfig(org);
    } catch (error) {
        throw new Error(`Invalid organization: ${org}. Valid options: org1, org2, org3`);
    }
}

/**
 * Validate user ID parameter
 * @param {string} userId - User ID
 * @throws {Error} - If invalid
 */
function validateUserId(userId) {
    if (!userId || userId.length === 0) {
        throw new Error('User ID is required');
    }
    // Basic sanitization - alphanumeric only
    if (!/^[A-Za-z0-9_-]+$/.test(userId)) {
        throw new Error('User ID must be alphanumeric (underscores and hyphens allowed)');
    }
}

async function main() {
    try {
        if (!command) {
            printUsage();
            process.exit(0);
        }

        switch (command.toLowerCase()) {
            case 'create': {
                const [assetID, description, org, userId] = args.slice(1);
                if (!assetID || !description || !org || !userId) {
                    console.error('Usage: node app.js create <assetID> <description> <org> <userId>');
                    process.exit(1);
                }

                // Input validation
                validateAssetId(assetID);
                validateDescription(description);
                validateOrg(org);
                validateUserId(userId);

                const privateData = {
                    description: description,
                    internalNotes: 'Created via CLI',
                    valuationAmount: 0,
                    confidentialTerms: ''
                };
                await createAsset(org, userId, assetID, privateData);
                break;
            }

            case 'approve': {
                const [assetID, org, userId] = args.slice(1);
                if (!assetID || !org || !userId) {
                    console.error('Usage: node app.js approve <assetID> <org> <userId>');
                    process.exit(1);
                }

                // Input validation
                validateAssetId(assetID);
                validateOrg(org);
                validateUserId(userId);

                await approveAsset(org, userId, assetID);
                break;
            }

            case 'reject': {
                const [assetID, reason, org, userId] = args.slice(1);
                if (!assetID || !reason || !org || !userId) {
                    console.error('Usage: node app.js reject <assetID> <reason> <org> <userId>');
                    process.exit(1);
                }

                // Input validation
                validateAssetId(assetID);
                validateReason(reason);
                validateOrg(org);
                validateUserId(userId);

                await rejectAsset(org, userId, assetID, reason);
                break;
            }

            case 'query': {
                const [assetID, org, userId] = args.slice(1);
                if (!assetID || !org || !userId) {
                    console.error('Usage: node app.js query <assetID> <org> <userId>');
                    process.exit(1);
                }

                // Input validation
                validateAssetId(assetID);
                validateOrg(org);
                validateUserId(userId);

                await queryAsset(org, userId, assetID);
                break;
            }

            case 'queryprivate': {
                const [assetID, org, userId] = args.slice(1);
                if (!assetID || !org || !userId) {
                    console.error('Usage: node app.js queryPrivate <assetID> <org> <userId>');
                    process.exit(1);
                }

                // Input validation
                validateAssetId(assetID);
                validateOrg(org);
                validateUserId(userId);

                await queryPrivateDetails(org, userId, assetID);
                break;
            }

            case 'history': {
                const [assetID, org, userId] = args.slice(1);
                if (!assetID || !org || !userId) {
                    console.error('Usage: node app.js history <assetID> <org> <userId>');
                    process.exit(1);
                }

                // Input validation
                validateAssetId(assetID);
                validateOrg(org);
                validateUserId(userId);

                await getAssetHistory(org, userId, assetID);
                break;
            }

            case 'list': {
                const [org, userId] = args.slice(1);
                if (!org || !userId) {
                    console.error('Usage: node app.js list <org> <userId>');
                    process.exit(1);
                }

                // Input validation
                validateOrg(org);
                validateUserId(userId);

                await getAllAssets(org, userId);
                break;
            }

            case 'delete': {
                const [assetID, org, userId] = args.slice(1);
                if (!assetID || !org || !userId) {
                    console.error('Usage: node app.js delete <assetID> <org> <userId>');
                    process.exit(1);
                }

                // Input validation
                validateAssetId(assetID);
                validateOrg(org);
                validateUserId(userId);

                await deleteAsset(org, userId, assetID);
                break;
            }

            case 'help':
            case '--help':
            case '-h':
                printUsage();
                process.exit(0);
                break;

            default:
                console.error(`Unknown command: ${command}`);
                printUsage();
                process.exit(1);
        }

    } catch (error) {
        console.error(`\n✗ Error: ${error.message}`);
        process.exit(1);
    }
}

main();
