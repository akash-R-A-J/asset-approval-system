/*
 * Copyright IBM Corp. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Asset Approval Chaincode Entry Point
 * Exports the AssetContract for Fabric runtime
 */

'use strict';

const AssetContract = require('./lib/assetContract');

module.exports.AssetContract = AssetContract;
module.exports.contracts = [AssetContract];
