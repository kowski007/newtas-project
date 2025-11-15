#!/usr/bin/env node

/**
 * Contract Verification using Etherscan API V2
 * Supports unified API endpoint across 60+ networks with chainid parameter
 * 
 * Usage: node verify-v2.cjs
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const CONTRACT_ADDRESS = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const PLATFORM_WALLET = '0xd657131eD517C53EAbAeb2F0ee66dE91c40eD74B';
const CONSTRUCTOR_ARGS = '000000000000000000000000d657131ed517c53eabaeb2f0ee66de91c40ed74b';

// Base chain ID (chainid=8453 for Base Mainnet)
const BASE_CHAIN_ID = 8453;
const API_BASE = 'https://api.etherscan.io/v2/api';
const API_KEY = process.env.BASESCAN_API_KEY;

if (!API_KEY) {
  console.error('❌ Error: BASESCAN_API_KEY environment variable is not set');
  process.exit(1);
}

// Read contract source
const contractPath = path.join(__dirname, 'contracts', 'CoinRegistry.sol');
if (!fs.existsSync(contractPath)) {
  console.error(`❌ Error: Contract file not found at ${contractPath}`);
  process.exit(1);
}

const contractSource = fs.readFileSync(contractPath, 'utf8');

async function verifyContract() {
  try {
    console.log('🔍 Verifying contract using Etherscan API V2...\n');
    console.log(`📋 Contract Address: ${CONTRACT_ADDRESS}`);
    console.log(`🔗 Network: Base Mainnet (Chain ID: ${BASE_CHAIN_ID})`);
    console.log(`👤 Platform Wallet: ${PLATFORM_WALLET}\n`);

    // Prepare verification payload for V2 API
    const params = {
      chainid: BASE_CHAIN_ID,
      apikey: API_KEY,
      action: 'verifysourcecode',
      codeformat: 'solidity-single-file',
      sourceCode: contractSource,
      contractaddress: CONTRACT_ADDRESS,
      contractname: 'CoinRegistry',
      compilerversion: 'v0.8.30+commit.73712a01',
      optimizationUsed: '1',
      runs: '200',
      constructorArguements: CONSTRUCTOR_ARGS,
      evmversion: 'shanghai',
      licenseType: '3', // MIT license
    };

    console.log('📤 Sending verification request to Etherscan API V2...\n');
    
    const response = await axios.get(API_BASE, { params });
    
    if (!response.data) {
      console.error('❌ No response from API');
      process.exit(1);
    }

    const { status, message, result } = response.data;

    if (status === '1') {
      console.log('✅ Verification submitted successfully!\n');
      console.log(`📌 GUID: ${result}`);
      console.log('⏳ Processing verification... This may take a few moments.\n');
      
      // Poll for verification status
      await pollVerificationStatus(result);
    } else if (status === '0') {
      if (message === 'NOTOK') {
        console.error(`❌ Verification failed: ${result}`);
        
        // Check for specific errors
        if (result.includes('already verified')) {
          console.log('\n✅ Contract is already verified on BaseScan!');
          console.log(`🔗 View: https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
        } else if (result.includes('bytecode')) {
          console.log('\n⚠️  Bytecode mismatch detected.');
          console.log('Possible causes:');
          console.log('  - Different compiler version or settings');
          console.log('  - Different optimizer runs');
          console.log('  - Different EVM version');
          console.log('  - Flattened contract instead of single file');
        }
      } else {
        console.error(`❌ Error: ${message}`);
      }
      process.exit(1);
    } else {
      console.error(`❌ Unexpected response: ${JSON.stringify(response.data)}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Verification error:');
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

async function pollVerificationStatus(guid) {
  const maxAttempts = 30;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const checkParams = {
        chainid: BASE_CHAIN_ID,
        apikey: API_KEY,
        action: 'checkverifystatus',
        guid: guid,
      };

      const response = await axios.get(API_BASE, { params: checkParams });
      const { status, result } = response.data;

      if (status === '1') {
        if (result === '0') {
          attempts++;
          console.log(`⏳ Still processing... (attempt ${attempts}/${maxAttempts})`);
        } else if (result === '1') {
          console.log('✅ Verification successful!\n');
          console.log(`🔗 View on BaseScan: https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
          return;
        } else if (result === '2') {
          console.error('❌ Verification failed');
          process.exit(1);
        }
      }
    } catch (error) {
      console.error('Error checking verification status:', error.message);
    }
  }

  console.log('\n⏱️  Verification is taking longer than expected.');
  console.log('Check the contract status manually:');
  console.log(`🔗 https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
}

// Run verification
verifyContract();
