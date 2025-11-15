const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CONTRACT_ADDRESS = '0x2ea259ccD2e983f9E635f138b28655d62127F6Bb';
const PLATFORM_WALLET = '0xd657131ed517c53eabaeb2f0ee66de91c40ed74b';
const CHAIN_ID = '8453';

console.log('🔍 Attempting Blockscout verification (alternative explorer)...\n');
console.log('Contract Address:', CONTRACT_ADDRESS);
console.log('Platform Wallet:', PLATFORM_WALLET);
console.log('');

// Read contract source
const contractSource = fs.readFileSync(
  path.join(__dirname, 'contracts', 'CoinRegistry.sol'),
  'utf8'
);

// ABI-encode constructor argument  
const abiEncodedConstructorArg = '000000000000000000000000' + PLATFORM_WALLET.replace('0x', '').toLowerCase();

// Try Blockscout API (Base uses Blockscout under the hood)
const verificationData = {
  addressHash: CONTRACT_ADDRESS,
  name: 'CoinRegistry',
  compilerVersion: 'v0.8.30+commit.73712a01',
  optimization: true,
  optimizationRuns: '200',
  contractSourceCode: contractSource,
  constructorArguments: abiEncodedConstructorArg,
  evmVersion: 'paris',
  autodetectConstructorArguments: false
};

const jsonData = JSON.stringify(verificationData);

const options = {
  hostname: 'base.blockscout.com',
  port: 443,
  path: '/api/v2/smart-contracts/verification/via/flattened-code',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(jsonData)
  }
};

console.log('📤 Submitting to Blockscout...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response status:', res.statusCode);
    console.log('Response:', data);
    
    try {
      const response = JSON.parse(data);
      
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('\n✅ Verification submitted to Blockscout!');
        console.log(`\n🔗 View on Blockscout:`);
        console.log(`   https://base.blockscout.com/address/${CONTRACT_ADDRESS}`);
        console.log(`\n🔗 This may sync to BaseScan:`);
        console.log(`   https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
      } else if (response.message && response.message.includes('already verified')) {
        console.log('\n✅ Contract already verified!');
      } else {
        console.log('\n⚠️ Response:', response.message || JSON.stringify(response));
      }
    } catch (e) {
      if (data.includes('verified') || data.includes('success')) {
        console.log('\n✅ Verification may have succeeded!');
        console.log(`Check: https://base.blockscout.com/address/${CONTRACT_ADDRESS}`);
      } else {
        console.log('\n❌ Unexpected response format');
      }
    }
  });
});

req.on('error', (e) => {
  console.error('\n❌ Request error:', e.message);
  console.log('\n💡 Blockscout verification failed.');
  console.log('The contract is deployed and functional at:');
  console.log(`   https://basescan.org/address/${CONTRACT_ADDRESS}`);
});

req.write(jsonData);
req.end();
